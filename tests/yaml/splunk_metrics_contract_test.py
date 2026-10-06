import importlib.util
from pathlib import Path
import tempfile

root = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("metrics", root / "scripts/metrics/splunk_metrics.py")
metrics = importlib.util.module_from_spec(spec)
spec.loader.exec_module(metrics)
with tempfile.TemporaryDirectory(dir=root) as state_directory:
    state = Path(state_directory) / "metrics.sqlite"
    event = {"metric_event_id": "event-1", "host": "fixture-host", "endpoint": "/orders", "method": "POST", "status_code": 200, "log_level": "INFO", "event_category": "web", "sourcetype": "json", "final_priority": "normal", "response_time_ms": 250, "processing_duration_ms": 2}
    first = metrics.observe(event, state)
    assert 'expanso_splunk_log_events_total{category="web",host="fixture-host",level="INFO",priority="normal",sourcetype="json"} 1' in first
    assert 'expanso_splunk_http_request_duration_seconds_sum{endpoint="/orders",host="fixture-host",method="POST",status_code="200"} 0.25' in first
    assert metrics.observe(event, state) == first
    event["metric_event_id"] = "event-2"
    second = metrics.observe(event, state)
    assert 'priority="normal",sourcetype="json"} 2' in second
    assert 'method="POST",status_code="200"} 0.5' in second
    del event["response_time_ms"]
    event["metric_event_id"] = "event-3"
    third = metrics.observe(event, state)
    assert 'priority="normal",sourcetype="json"} 3' in third
    assert 'expanso_splunk_processing_duration_milliseconds_count{host="fixture-host"} 3' in third
    for duration in (-1, float("nan"), float("inf")):
        event["processing_duration_ms"] = duration
        try:
            metrics.observe(event, state)
        except ValueError:
            pass
        else:
            raise AssertionError("Invalid duration was accepted")
print("Persistent labeled metrics, restart/retry semantics, and invalid-duration rejection PASS")
