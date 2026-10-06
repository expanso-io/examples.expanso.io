import importlib.util
import io
import json
import os
from pathlib import Path
import sys
import tempfile
from contextlib import redirect_stdout

root = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("analyzer", root / "docs/integrations/medical-device-intelligence/scripts/analyze_reports.py")
analyzer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(analyzer)
with tempfile.TemporaryDirectory(dir=root) as fixture_path:
    directory = Path(fixture_path)
    (directory / "maintenance-logs.csv").write_text("device_id,timestamp\nALT-1,fixture-time\n")
    (directory / "error-events.json").write_text('[{"device_id":"ALT-2"}]')
    (directory / "technician-notes.txt").write_text("Alternate batch notes")
    os.environ["MEDICAL_FIXTURE_DIR"] = fixture_path
    fixtures = analyzer.load_fixtures()
    assert fixtures["maintenance"][0]["device_id"] == "ALT-1"
    assert fixtures["events"][0]["device_id"] == "ALT-2"
    assert fixtures["notes"] == "Alternate batch notes"
    os.environ["MEDICAL_ANALYZER_MODE"] = "claude-subscription"
    analyzer.analyze_with_claude = lambda loaded: {"captured": loaded}
    sys.stdin = io.StringIO(json.dumps({"source": "error_events", "data": [{"device_id": "STDIN-3"}]}))
    output = io.StringIO()
    with redirect_stdout(output):
        analyzer.main()
    captured = json.loads(output.getvalue())["captured"]
    assert captured["events"][0]["device_id"] == "STDIN-3"
    assert captured["maintenance"][0]["device_id"] == "ALT-1"
    assert captured["notes"] == "Alternate batch notes"
    for source, data, key in (("maintenance_log", {"device_id": "STDIN-4"}, "maintenance"), ("technician_notes", "stdin notes", "notes")):
        result = analyzer.load_fixtures({"source": source, "data": data})
        assert result[key] == ([data] if key == "maintenance" else data)
print("Medical fixture directory and command-input contract PASS")
