"""Fail closed when non-historical material contains the prohibited legacy entity."""

from __future__ import annotations

import argparse
import fnmatch
import json
import shutil
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path
from typing import Any

PROJECT_DIR = Path(__file__).resolve().parent.parent
DEFAULT_POLICY = PROJECT_DIR / "PUBLIC-MATERIAL-SCAN.json"
SCANNER_VERSION = 1
LEGACY_TOKEN = bytes((98, 97, 99, 97, 108, 104, 97, 117)).decode("ascii")


class ScanError(RuntimeError):
    """The material scan could not establish a safe result."""


def load_policy(path: Path) -> dict[str, Any]:
    try:
        policy = json.loads(path.read_text())
    except (OSError, json.JSONDecodeError) as error:
        raise ScanError(f"invalid scan policy: {error}") from error
    if (
        not isinstance(policy, dict)
        or policy.get("schema_version") != 1
        or policy.get("scanner_version") != SCANNER_VERSION
    ):
        raise ScanError("scan policy version is unsupported")
    extensions = policy.get("extensions")
    exceptions = policy.get("approved_exceptions")
    if (
        not isinstance(extensions, list)
        or not extensions
        or not all(
            isinstance(value, str) and value.startswith(".") for value in extensions
        )
    ):
        raise ScanError("scan policy extensions are invalid")
    if not isinstance(exceptions, list):
        raise ScanError("scan policy approved_exceptions must be a list")
    for exception in exceptions:
        if (
            not isinstance(exception, dict)
            or exception.get("class") != "historical"
            or not isinstance(exception.get("path_glob"), str)
            or not exception["path_glob"].strip()
            or not isinstance(exception.get("required_context"), list)
            or not exception["required_context"]
            or not all(
                isinstance(value, str) and value.strip()
                for value in exception["required_context"]
            )
            or not isinstance(exception.get("approved_by"), list)
            or len(exception["approved_by"]) < 2
            or not isinstance(exception.get("review_date"), str)
            or not exception["path_glob"].startswith(
                ("history/", "historical/", "archive/history/")
            )
            or not {"historical", "no longer current"}.issubset(
                {value.strip().lower() for value in exception["required_context"]}
            )
        ):
            raise ScanError(
                "every exception must be historical-only, path-scoped, explicitly "
                "non-current, and approved by two owners"
            )
    return policy


def iter_files(root: Path, extensions: set[str]) -> list[Path]:
    if not root.exists():
        raise ScanError(f"scan root does not exist: {root}")
    if root.is_file():
        return [root] if root.suffix.lower() in extensions else []
    return sorted(
        path
        for path in root.rglob("*")
        if path.is_file()
        and path.suffix.lower() in extensions
        and not any(part in {".git", "node_modules"} for part in path.parts)
    )


def extract_text(path: Path) -> str:
    suffix = path.suffix.lower()
    if suffix == ".docx":
        try:
            with zipfile.ZipFile(path) as archive:
                return "\n".join(
                    archive.read(name).decode("utf-8", errors="replace")
                    for name in archive.namelist()
                    if name.endswith(".xml")
                )
        except (OSError, zipfile.BadZipFile) as error:
            raise ScanError(f"cannot inspect Word artifact {path}: {error}") from error
    if suffix == ".pdf":
        converter = shutil.which("pdftotext")
        if converter is None:
            raise ScanError(f"pdftotext is required to inspect PDF artifact: {path}")
        with tempfile.TemporaryDirectory() as tempdir:
            output = Path(tempdir) / "artifact.txt"
            result = subprocess.run(
                [converter, str(path), str(output)],
                capture_output=True,
                text=True,
                check=False,
            )
            if result.returncode != 0:
                raise ScanError(
                    f"cannot inspect PDF artifact {path}: {result.stderr.strip()}"
                )
            return output.read_text(errors="replace")
    try:
        return path.read_text(errors="replace")
    except OSError as error:
        raise ScanError(f"cannot inspect artifact {path}: {error}") from error


def exception_for(
    relative_path: str,
    context: str,
    exceptions: list[dict[str, Any]],
) -> dict[str, Any] | None:
    lowered = context.lower()
    for exception in exceptions:
        if fnmatch.fnmatch(relative_path, exception["path_glob"]) and all(
            phrase.lower() in lowered for phrase in exception["required_context"]
        ):
            return exception
    return None


def scan_roots(roots: list[Path], policy: dict[str, Any]) -> dict[str, Any]:
    extensions = {value.lower() for value in policy["extensions"]}
    violations: list[dict[str, Any]] = []
    approved_matches: list[dict[str, Any]] = []
    scanned_files = 0
    artifact_types: set[str] = set()
    for root in roots:
        resolved_root = root.resolve()
        for path in iter_files(resolved_root, extensions):
            scanned_files += 1
            artifact_types.add(path.suffix.lower())
            text = extract_text(path)
            lowered = text.lower()
            offset = 0
            while True:
                index = lowered.find(LEGACY_TOKEN, offset)
                if index < 0:
                    break
                line = text.count("\n", 0, index) + 1
                start = max(0, index - 240)
                end = min(len(text), index + len(LEGACY_TOKEN) + 240)
                context = text[start:end]
                relative = (
                    path.name
                    if resolved_root.is_file()
                    else path.relative_to(resolved_root).as_posix()
                )
                exception = exception_for(
                    relative, context, policy["approved_exceptions"]
                )
                finding = {
                    "root": str(resolved_root),
                    "path": relative,
                    "line": line,
                }
                if exception is None:
                    violations.append(finding)
                else:
                    approved_matches.append(
                        {
                            **finding,
                            "exception_class": exception["class"],
                            "review_date": exception["review_date"],
                        }
                    )
                offset = index + len(LEGACY_TOKEN)
    return {
        "schema_version": 1,
        "evidence_type": "material_entity_scan",
        "scanner_version": SCANNER_VERSION,
        "result": "pass" if not violations else "blocked",
        "roots": [str(path.resolve()) for path in roots],
        "scanned_files": scanned_files,
        "artifact_types": sorted(artifact_types),
        "approved_matches": approved_matches,
        "violations": violations,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, action="append", required=True)
    parser.add_argument("--policy", type=Path, default=DEFAULT_POLICY)
    parser.add_argument("--output", type=Path)
    arguments = parser.parse_args()
    try:
        report = scan_roots(arguments.root, load_policy(arguments.policy))
    except ScanError as error:
        print(str(error), file=sys.stderr)
        return 2
    payload = json.dumps(report, indent=2, sort_keys=True) + "\n"
    if arguments.output:
        arguments.output.parent.mkdir(parents=True, exist_ok=True)
        arguments.output.write_text(payload)
    print(payload, end="")
    return 0 if report["result"] == "pass" else 1


if __name__ == "__main__":
    sys.exit(main())
