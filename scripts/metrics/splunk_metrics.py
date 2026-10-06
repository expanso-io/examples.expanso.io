"""Persist and emit Prometheus aggregates for Splunk pipeline events."""

import fcntl
import json
import math
import os
import sqlite3
import sys
from pathlib import Path
import ssl
from urllib.parse import quote, urlparse
from urllib.request import Request, urlopen


def labels(values):
    return json.dumps({key: str(value) for key, value in values.items()}, sort_keys=True)


def exposition_labels(serialized, extra=None):
    values = json.loads(serialized)
    if extra:
        values.update(extra)
    parts = []
    for key, value in sorted(values.items()):
        escaped = str(value).replace("\\", "\\\\").replace("\n", "\\n").replace('"', '\\"')
        parts.append(f'{key}="{escaped}"')
    return "{" + ",".join(parts) + "}"


def observe(event, state_path):
    event_id = event["metric_event_id"]
    if not isinstance(event_id, str) or not event_id:
        raise ValueError("A stable metric event identifier is required")
    duration = event.get("processing_duration_ms")
    request = event.get("response_time_ms")
    for value in (duration, request):
        if value is not None and (
            not isinstance(value, (int, float))
            or isinstance(value, bool)
            or not math.isfinite(value)
            or value < 0
        ):
            raise ValueError("Metric durations must be finite nonnegative numbers")
    event_labels = labels({key: event.get(field, "unknown") for key, field in (
        ("host", "host"), ("level", "log_level"), ("category", "event_category"),
        ("sourcetype", "sourcetype"), ("priority", "final_priority")
    )})
    measurements = [("expanso_splunk_log_events_total", event_labels, 1)]
    if duration is not None:
        measurements.append(("expanso_splunk_processing_duration_milliseconds", labels({"host": event.get("host", "unknown")}), duration))
    if request is not None:
        measurements.append(("expanso_splunk_http_request_duration_seconds", labels({key: event.get(key, "unknown") for key in ("host", "endpoint", "method", "status_code")}), request / 1000))
    state_path = Path(state_path)
    state_path.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(state_path, timeout=30) as db:
        db.execute("PRAGMA journal_mode=WAL")
        db.execute("CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY)")
        db.execute("CREATE TABLE IF NOT EXISTS aggregates (name TEXT, labels TEXT, total REAL NOT NULL, count INTEGER NOT NULL, PRIMARY KEY (name, labels))")
        db.execute("BEGIN IMMEDIATE")
        inserted = db.execute("INSERT OR IGNORE INTO events VALUES (?)", (event_id,)).rowcount
        if inserted:
            for name, label_set, value in measurements:
                db.execute("INSERT INTO aggregates VALUES (?, ?, ?, 1) ON CONFLICT(name, labels) DO UPDATE SET total = total + excluded.total, count = count + 1", (name, label_set, value))
        rows = db.execute("SELECT name, labels, total, count FROM aggregates ORDER BY name, labels").fetchall()
    rendered = []
    seen = set()
    for name, label_set, total, count in rows:
        counter = name.endswith("_total")
        if name not in seen:
            rendered.append(f"# TYPE {name} {'counter' if counter else 'histogram'}")
            seen.add(name)
        if counter:
            rendered.append(f"{name}{exposition_labels(label_set)} {count}")
        else:
            rendered.append(f"{name}_bucket{exposition_labels(label_set, {'le': '+Inf'})} {count}")
            rendered.append(f"{name}_sum{exposition_labels(label_set)} {total}")
            rendered.append(f"{name}_count{exposition_labels(label_set)} {count}")
    return "\n".join(rendered) + "\n"


def main():
    event = json.load(sys.stdin)
    state_path = Path(os.environ["SPLUNK_METRICS_STATE_PATH"])
    state_path.parent.mkdir(parents=True, exist_ok=True)
    endpoint = os.environ["PROMETHEUS_PUSHGATEWAY_HTTPS_URL"].rstrip("/")
    if urlparse(endpoint).scheme != "https":
        raise ValueError("Pushgateway requires HTTPS")
    node = quote(os.environ["NODE_ID"], safe="")
    token = os.environ["PROMETHEUS_PUSHGATEWAY_TOKEN"]
    context = ssl.create_default_context(cafile=os.environ.get("PROMETHEUS_PUSHGATEWAY_CA_FILE"))
    with state_path.with_suffix(".lock").open("a") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        payload = observe(event, state_path)
        request = Request(
            f"{endpoint}/metrics/job/expanso-edge/instance/{node}",
            data=payload.encode(),
            headers={"Authorization": "Bearer " + token, "Content-Type": "text/plain; version=0.0.4"},
            method="POST",
        )
        for attempt in range(3):
            try:
                with urlopen(request, timeout=10, context=context) as response:
                    response.read()
                break
            except OSError:
                if attempt == 2:
                    raise
        print(payload, end="")


if __name__ == "__main__":
    main()
