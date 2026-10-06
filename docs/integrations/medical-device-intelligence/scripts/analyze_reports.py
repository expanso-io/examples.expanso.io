#!/usr/bin/env python3
"""Build review candidates from deterministic synthetic device-report fixtures."""

import csv
import json
import os
import subprocess
import sys
from pathlib import Path

REPOSITORY_ROOT = Path(__file__).resolve().parents[4]
DATA_DIR = REPOSITORY_ROOT / "examples" / "integrations" / "medical-device-intelligence"

SYSTEM_PROMPT = """Review only the supplied synthetic device-report fixtures.
Group related records into candidate fleet-review items. Do not diagnose a device,
recommend clinical or safety action, infer a real manufacturer, or claim accuracy.
Return JSON with fixture_batch_id and review_candidates. Each candidate must contain
candidate_id, device_id, review_reason, source_signals, and evidence_refs."""

OUTPUT_SCHEMA = {
    "type": "object",
    "properties": {
        "fixture_batch_id": {"type": "string"},
        "review_candidates": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "candidate_id": {"type": "string"},
                    "device_id": {"type": "string"},
                    "review_reason": {"type": "string"},
                    "source_signals": {
                        "type": "array",
                        "items": {"type": "string"},
                    },
                    "evidence_refs": {
                        "type": "array",
                        "items": {"type": "string"},
                    },
                },
                "required": [
                    "candidate_id",
                    "device_id",
                    "review_reason",
                    "source_signals",
                    "evidence_refs",
                ],
                "additionalProperties": False,
            },
        },
    },
    "required": ["fixture_batch_id", "review_candidates"],
    "additionalProperties": False,
}


def load_fixtures(command_input=None):
    data_dir = Path(os.environ.get("MEDICAL_FIXTURE_DIR", str(DATA_DIR)))
    with (data_dir / "maintenance-logs.csv").open(
        newline="", encoding="utf-8"
    ) as stream:
        maintenance = list(csv.DictReader(stream))
    with (data_dir / "error-events.json").open(encoding="utf-8") as stream:
        events = json.load(stream)
    notes = (data_dir / "technician-notes.txt").read_text(encoding="utf-8")
    fixtures = {"maintenance": maintenance, "events": events, "notes": notes}
    if command_input is not None:
        source = command_input["source"]
        data = command_input["data"]
        if source == "maintenance_log":
            if not isinstance(data, dict):
                raise ValueError("Maintenance input must be a row object")
            fixtures["maintenance"] = [data]
        elif source == "error_events":
            if not isinstance(data, list):
                raise ValueError("Error input must be an array")
            fixtures["events"] = data
        elif source == "technician_notes":
            if not isinstance(data, str):
                raise ValueError("Notes input must be text")
            fixtures["notes"] = data
        else:
            raise ValueError("Unknown fixture source")
    return fixtures


def analyze_with_claude(fixtures):
    prompt = SYSTEM_PROMPT + "\n\nFixtures:\n" + json.dumps(fixtures, sort_keys=True)
    completed = subprocess.run(
        [
            "claude",
            "--print",
            "--restricted",
            "--permission-prompts",
            "none",
            "--no-session-persistence",
            "--output-format",
            "json",
            "--json-schema",
            json.dumps(OUTPUT_SCHEMA, separators=(",", ":")),
            "--model",
            os.environ.get("ANTHROPIC_MODEL", "sonnet"),
            prompt,
        ],
        check=True,
        capture_output=True,
        text=True,
        timeout=120,
    )
    envelope = json.loads(completed.stdout)
    result = envelope.get("structured_output", envelope.get("result"))
    return json.loads(result) if isinstance(result, str) else result


def deterministic_mock():
    return {
        "fixture_batch_id": "medical-device-synthetic-v1",
        "review_candidates": [
            {
                "candidate_id": "CANDIDATE-001",
                "device_id": "VENT-TEST-01",
                "review_reason": "Repeated synthetic status S2",
                "source_signals": ["adapter-status", "maintenance-note"],
                "evidence_refs": ["SENSOR-STATUS-S2", "TECH-01"],
            },
            {
                "candidate_id": "CANDIDATE-002",
                "device_id": "PUMP-TEST-02",
                "review_reason": "Repeated synthetic status S1",
                "source_signals": ["adapter-status", "fixture-change"],
                "evidence_refs": ["FLOW-STATUS-S1", "TECH-02"],
            },
        ],
        "limitations": [
            "Synthetic fixtures only",
            "Human review required",
            "No diagnostic, clinical, safety, or maintenance conclusion",
        ],
    }


def main():
    command_text = "" if sys.stdin.isatty() else sys.stdin.read()
    command_input = json.loads(command_text) if command_text.strip() else None
    fixtures = load_fixtures(command_input)
    if os.environ.get("MEDICAL_ANALYZER_MODE") == "claude-subscription":
        result = analyze_with_claude(fixtures)
    else:
        result = deterministic_mock()
    print(json.dumps(result, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
