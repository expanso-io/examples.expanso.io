#!/usr/bin/env python3
"""
Medical Device Field Report Analyzer

Merges maintenance logs, error events, and technician notes into a unified
batch, sends to Claude for structured incident extraction, and outputs
structured JSON reports.

If ANTHROPIC_API_KEY is set, calls the real Claude API.
If not, returns a realistic mock response.
"""

import csv
import json
import os
import sys
from datetime import datetime
from pathlib import Path

DATA_DIR = Path(__file__).parent.parent / "data"

SYSTEM_PROMPT = """You are a medical device fleet intelligence system. You analyze 
batched field data from hospital equipment — maintenance logs, error codes, and 
technician notes — and produce structured incident reports.

For each distinct incident you identify, output a JSON object with:
- incident_id: a short unique ID (e.g. "INC-001")
- device_id: the device identifier
- device_model: inferred device model/type (e.g. "Dräger Ventilator", "Philips MX800 Monitor")
- failure_mode: concise description of what failed
- severity: "critical", "warning", or "info"
- root_cause: your best assessment of the root cause
- recommended_action: specific next step
- confidence: 0.0-1.0 confidence in your assessment
- evidence: list of data sources that support this finding
- fleet_impact: whether this might affect other units (null if no indication)

Return a JSON object with:
- batch_id: timestamp-based batch identifier
- site: "General Hospital — Main Campus"
- analysis_timestamp: ISO 8601 timestamp
- incidents: array of incident objects
- fleet_alerts: array of any cross-device or systemic concerns
- supply_alerts: array of any inventory/supply concerns found in notes"""

def load_maintenance_logs():
    """Load and parse maintenance CSV."""
    logs = []
    csv_path = DATA_DIR / "maintenance-logs.csv"
    with open(csv_path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            logs.append(row)
    return logs

def load_error_events():
    """Load and parse error events JSON."""
    json_path = DATA_DIR / "error-events.json"
    with open(json_path, encoding="utf-8") as f:
        return json.load(f)

def load_technician_notes():
    """Load freeform technician notes."""
    txt_path = DATA_DIR / "technician-notes.txt"
    with open(txt_path, encoding="utf-8") as f:
        return f.read()

def build_batch_payload(logs, errors, notes):
    """Merge all sources into a single batch for analysis."""
    return {
        "batch_timestamp": datetime.utcnow().isoformat() + "Z",
        "sources": {
            "maintenance_logs": {
                "count": len(logs),
                "records": logs,
            },
            "error_events": {
                "count": len(errors),
                "events": errors,
            },
            "technician_notes": {
                "text": notes,
            },
        },
    }

def analyze_with_claude(batch_payload):
    """Call Claude API for structured incident extraction."""
    import anthropic

    client = anthropic.Anthropic()
    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=4096,
        system=SYSTEM_PROMPT,
        messages=[
            {
                "role": "user",
                "content": f"Analyze this batch of medical device field data and produce structured incident reports:\n\n```json\n{json.dumps(batch_payload, indent=2)}\n```",
            }
        ],
    )

    # Extract JSON from response
    text = response.content[0].text
    # Try to parse JSON directly, or extract from markdown code block
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        # Try extracting from ```json ... ``` block
        if "```json" in text:
            json_str = text.split("```json")[1].split("```")[0].strip()
            return json.loads(json_str)
        elif "```" in text:
            json_str = text.split("```")[1].split("```")[0].strip()
            return json.loads(json_str)
        raise

def mock_analysis(batch_payload):
    """Return realistic mock response when no API key is available."""
    return {
        "batch_id": f"BATCH-{datetime.utcnow().strftime('%Y%m%d-%H%M')}",
        "site": "General Hospital — Main Campus",
        "analysis_timestamp": datetime.utcnow().isoformat() + "Z",
        "incidents": [
            {
                "incident_id": "INC-001",
                "device_id": "VENT-4012",
                "device_model": "Dräger Evita V500 Ventilator",
                "failure_mode": "Recurring O2 sensor failure — 3 cells consumed in 6 months",
                "severity": "critical",
                "root_cause": "Probable moisture ingress through degraded sensor housing seal. Unit is 4 years old (installed 2022-03). Repeated O2 cell failures suggest the housing, not the cells, is the root issue.",
                "recommended_action": "Schedule manufacturer (Dräger) inspection of sensor housing seal. Do not install another O2 cell until housing is assessed. Keep unit on backup ventilator rotation.",
                "confidence": 0.88,
                "evidence": [
                    "maintenance-logs: two entries for O2 sensor issues same day",
                    "error-events: E-O2-SENS-003 drift + E-O2-SENS-007 self-test failure",
                    "technician-notes: M. Chen reports 3rd cell in 6 months, suspects seal",
                ],
                "fleet_impact": "Check other Dräger units of same vintage (2022) for sensor housing condition",
            },
            {
                "incident_id": "INC-002",
                "device_id": "PUMP-7891",
                "device_model": "B. Braun Infusomat Space Infusion Pump",
                "failure_mode": "Firmware 4.2.1 causes false occlusion alarms",
                "severity": "warning",
                "root_cause": "Firmware update 4.2.1 introduced oversensitive occlusion detection threshold. IV set incompatibility confirmed. Rolled back to 4.1.8 resolved the issue.",
                "recommended_action": "1) Hold firmware 4.2.1 deployment fleet-wide. 2) File manufacturer field safety report. 3) Notify other sites on same firmware track.",
                "confidence": 0.95,
                "evidence": [
                    "maintenance-logs: two visits for same alarm, firmware rollback fixed it",
                    "error-events: three E-OCC-ALARM-001 events",
                    "technician-notes: R. Patel confirms firmware root cause, manufacturer report drafted",
                ],
                "fleet_impact": "All infusion pumps on firmware 4.2.1 — do NOT upgrade remaining fleet until manufacturer issues patch",
            },
            {
                "incident_id": "INC-003",
                "device_id": "MON-2234",
                "device_model": "Philips IntelliVue MX800 Patient Monitor",
                "failure_mode": "SpO2 channel failure due to degraded main board connector",
                "severity": "critical",
                "root_cause": "Main board connector degradation on SpO2 channel. Biomed engineering confirmed hardware fault. Unit pulled from service.",
                "recommended_action": "1) Complete board swap (scheduled tomorrow). 2) Audit all MX800 units for connector condition — 3 failures this quarter suggests systemic issue. 3) File Philips quality report.",
                "confidence": 0.92,
                "evidence": [
                    "maintenance-logs: probe and cable replacement failed to fix, board swap needed",
                    "error-events: E-SPO2-SIG-004 signal quality + signal loss events",
                    "technician-notes: M. Chen reports 3 units same problem this quarter",
                ],
                "fleet_impact": "SYSTEMIC: Philips MX800 fleet (2021 vintage) — connector degradation pattern. Recommend proactive inspection of all units.",
            },
            {
                "incident_id": "INC-004",
                "device_id": "VENT-4015",
                "device_model": "Hamilton C1 Ventilator",
                "failure_mode": "Cracked humidifier chamber causing temperature drop",
                "severity": "warning",
                "root_cause": "Humidifier chamber cracked from overtightening (nursing staff). Condensation buildup was secondary effect of compromised seal.",
                "recommended_action": "1) Add 'hand-tight only' reminder to nursing in-service materials. 2) Monitor replacement chamber over next 72 hours for condensation recurrence.",
                "confidence": 0.82,
                "evidence": [
                    "maintenance-logs: cracked chamber + condensation noted",
                    "error-events: E-HUM-TEMP-002 temperature below minimum",
                    "technician-notes: M. Chen reports prior occurrences, suggests nursing education",
                ],
                "fleet_impact": "All Hamilton C1 units — add handling instruction to prevent chamber cracking",
            },
            {
                "incident_id": "INC-005",
                "device_id": "MON-2238",
                "device_model": "Mindray BeneVision N22 Patient Monitor",
                "failure_mode": "NIBP cuff inflation failure — kinked tubing",
                "severity": "info",
                "root_cause": "Mechanical kink in NIBP tubing near connector. Simple replacement resolved.",
                "recommended_action": "No further action needed. Tubing replaced, verified within tolerance.",
                "confidence": 0.98,
                "evidence": [
                    "maintenance-logs: tubing kink found and replaced",
                    "error-events: E-NIBP-PNEU-002 inflation timeout",
                ],
                "fleet_impact": None,
            },
            {
                "incident_id": "INC-006",
                "device_id": "DEFIB-1102",
                "device_model": "Philips HeartStart MRx Defibrillator",
                "failure_mode": "None — routine PM passed",
                "severity": "info",
                "root_cause": "N/A — scheduled calibration test, all parameters within specification.",
                "recommended_action": "Track battery degradation trend (94% → 89% over quarter). Schedule battery replacement when health drops below 70%.",
                "confidence": 0.99,
                "evidence": [
                    "maintenance-logs: all tests passed, battery at 89%",
                    "error-events: E-DEFIB-CAL-001 info-level test event",
                    "technician-notes: S. Williams confirms good unit",
                ],
                "fleet_impact": None,
            },
        ],
        "fleet_alerts": [
            {
                "alert": "Philips MX800 connector degradation",
                "severity": "high",
                "detail": "3 units with same SpO2 board connector failure this quarter. Pattern suggests manufacturing defect in 2021 production run. Recommend fleet-wide inspection and Philips quality notification.",
                "affected_devices": ["MON-2234", "and 2 others per technician notes"],
            },
            {
                "alert": "Infusion pump firmware 4.2.1 hold",
                "severity": "medium",
                "detail": "Firmware 4.2.1 causes false occlusion alarms with certain IV sets. Do not deploy to additional units. Manufacturer report pending.",
                "affected_devices": ["PUMP-7891", "all pumps on upgrade schedule"],
            },
        ],
        "supply_alerts": [
            {
                "item": "Philips SpO2 probe cables (REF M1191B)",
                "current_stock": 3,
                "recommended_order": 10,
                "urgency": "high",
                "reason": "Accelerated consumption due to MX800 connector troubleshooting. Current stock insufficient for fleet maintenance needs.",
            }
        ],
    }


def main():
    print("Loading data sources...", file=sys.stderr)
    logs = load_maintenance_logs()
    errors = load_error_events()
    notes = load_technician_notes()

    print(f"  Maintenance logs: {len(logs)} records", file=sys.stderr)
    print(f"  Error events: {len(errors)} events", file=sys.stderr)
    print(f"  Technician notes: {len(notes)} characters", file=sys.stderr)

    batch = build_batch_payload(logs, errors, notes)
    print(f"\nBatch assembled: {json.dumps(batch['batch_timestamp'])}", file=sys.stderr)

    api_key = os.environ.get("ANTHROPIC_API_KEY", "").strip()
    if api_key:
        print("\nANTHROPIC_API_KEY detected — calling Claude API...", file=sys.stderr)
        try:
            result = analyze_with_claude(batch)
            print("Claude analysis complete.", file=sys.stderr)
        except Exception as e:
            print(f"Claude API call failed: {e}", file=sys.stderr)
            print("Falling back to mock response.", file=sys.stderr)
            result = mock_analysis(batch)
    else:
        print("\nNo ANTHROPIC_API_KEY — using mock response.", file=sys.stderr)
        result = mock_analysis(batch)

    # Output structured JSON to stdout
    print(json.dumps(result, indent=2))
    return result


if __name__ == "__main__":
    main()
