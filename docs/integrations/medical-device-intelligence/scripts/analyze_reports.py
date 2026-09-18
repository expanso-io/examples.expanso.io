#!/usr/bin/env python3
"""Build review candidates from deterministic synthetic device-report fixtures."""

import csv
import json
import os
from pathlib import Path

REPOSITORY_ROOT = Path(__file__).resolve().parents[4]
DATA_DIR = REPOSITORY_ROOT / "examples" / "integrations" / "medical-device-intelligence"

SYSTEM_PROMPT = """Review only the supplied synthetic device-report fixtures.
Group related records into candidate fleet-review items. Do not diagnose a device,
recommend clinical or safety action, infer a real manufacturer, or claim accuracy.
Return JSON with fixture_batch_id and review_candidates. Each candidate must contain
candidate_id, device_id, review_reason, source_signals, and evidence_refs."""


def load_fixtures():
    with (DATA_DIR / "maintenance-logs.csv").open(newline="", encoding="utf-8") as stream:
        maintenance = list(csv.DictReader(stream))
    with (DATA_DIR / "error-events.json").open(encoding="utf-8") as stream:
        events = json.load(stream)
    notes = (DATA_DIR / "technician-notes.txt").read_text(encoding="utf-8")
    return {"maintenance": maintenance, "events": events, "notes": notes}


def analyze_with_claude(fixtures):
    import anthropic

    client = anthropic.Anthropic()
    response = client.messages.create(
        model=os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-4-20250514"),
        max_tokens=2048,
        system=SYSTEM_PROMPT,
        messages=[
            {
                "role": "user",
                "content": json.dumps(fixtures, sort_keys=True),
            }
        ],
    )
    text = response.content[0].text
    if "```" in text:
        text = text.split("```", 2)[1].removeprefix("json").strip()
    return json.loads(text)


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
    fixtures = load_fixtures()
    if os.environ.get("ANTHROPIC_API_KEY", "").strip():
        result = analyze_with_claude(fixtures)
    else:
        result = deterministic_mock()
    print(json.dumps(result, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
