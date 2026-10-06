import csv
import hashlib
import io
import json
import os
import re
import sqlite3
import sys
import struct
import base64
import time
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path


def now():
    return datetime.now(timezone.utc).isoformat()


def timestamp(value):
    if isinstance(value, (int, float)):
        return value / 1000 if value > 10_000_000_000 else value
    return datetime.fromisoformat(value.replace("Z", "+00:00")).timestamp()


def utc(value):
    return datetime.fromtimestamp(value, timezone.utc).isoformat().replace("+00:00", "Z")


def database():
    connection = sqlite3.connect(os.environ["EXAMPLE_STATE_PATH"], timeout=30)
    connection.execute("PRAGMA journal_mode=WAL")
    return connection


def deduplicate(event):
    strategy = event.get("dedup_strategy", "event_id" if "event_id" in event else "hash")
    digest = hashlib.sha256(json.dumps(event, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
    key = digest
    if strategy == "event_id":
        key = str(event["event_id"])
    elif strategy == "composite":
        key = f'{event.get("event_type", "unknown")}:{event.get("source", "unknown")}:{int(timestamp(event["timestamp"]) // 60)}'
    with database() as db:
        db.execute("CREATE TABLE IF NOT EXISTS seen (key TEXT PRIMARY KEY, expires REAL)")
        db.execute("BEGIN IMMEDIATE")
        db.execute("DELETE FROM seen WHERE expires <= ?", (time.time(),))
        inserted = db.execute("INSERT OR IGNORE INTO seen VALUES (?, ?)", (key, time.time() + 3600)).rowcount
    event.update(dedup_hash=digest, dedup_key=key, is_duplicate=not bool(inserted), dedup_timestamp=now())
    event["dedup_result"] = {"is_duplicate": event["is_duplicate"], "dedup_key": key, "checked_at": now()}
    if event["is_duplicate"]:
        event["duplicate_metadata"] = {"detected_at": now(), "original_hash": digest, "strategy": strategy}
    return event


def aggregate(event):
    sensor = str(event["sensor_id"])
    seconds = timestamp(event["timestamp"])
    temperature = float(event["temperature"])
    location = event.get("location", "unknown_location")
    facility = event.get("facility", "unknown_facility")
    with database() as db:
        db.execute("CREATE TABLE IF NOT EXISTS readings (ts REAL, sensor TEXT, location TEXT, facility TEXT, temperature REAL)")
        db.execute("CREATE TABLE IF NOT EXISTS watermark (ts REAL)")
        db.execute("BEGIN IMMEDIATE")
        previous = db.execute("SELECT ts FROM watermark").fetchone()
        if previous and seconds < int(previous[0] // 60) * 60:
            raise ValueError("Reading belongs to a closed minute window")
        watermark = max(seconds, previous[0]) if previous else seconds
        db.execute("INSERT INTO readings VALUES (?, ?, ?, ?, ?)", (seconds, sensor, location, facility, temperature))
        rows = db.execute("SELECT ts, sensor, location, facility, temperature FROM readings ORDER BY ts, rowid").fetchall()
        minute = int(watermark // 60) * 60
        closed = {}
        for row in rows:
            bucket = int(row[0] // 60) * 60
            if bucket < minute:
                for kind, level, dimension in [("tumbling", "sensor", row[1]), ("multi_level", "sensor", row[1]), ("multi_level", "location", row[2])]:
                    closed.setdefault((kind, level, dimension, bucket), []).append(row)
        results = []

        def summary(kind, level, dimension, start, readings, duration, complete):
            values = [row[4] for row in readings]
            first = readings[0]
            result = {"aggregation_type": kind, "aggregation_level": level, "group_key": f"{dimension}|{kind}|{level}|{utc(start)}", "window_start": utc(start), "window_end": utc(start + duration), "time_bucket": utc(start), "window_duration_minutes": duration // 60, "window_complete": complete, "aggregation_timestamp": now(), "event_count": len(values), "temperature_avg": round(sum(values) / len(values), 2), "temperature_min": min(values), "temperature_max": max(values), "location": first[2], "facility": first[3], "data_quality_score": 0.95 if len(values) >= 50 else 0.85 if len(values) >= 30 else 0.70 if len(values) >= 10 else 0.50}
            if level == "sensor":
                result["sensor_id"] = dimension
            else:
                result["sensor_count"] = len({row[1] for row in readings})
            if kind == "sliding" and len(values) >= 3:
                change = round(values[-1] - values[0], 2)
                result.update(temperature_change=change, temperature_trend="increasing" if change > 1 else "decreasing" if change < -1 else "stable")
            return result

        for (kind, level, dimension, start), readings in closed.items():
            results.append(summary(kind, level, dimension, start, readings, 60, True))
        rolling = [row for row in rows if watermark - 300 < row[0] <= watermark and row[1] == sensor]
        results.append(summary("sliding", "sensor", sensor, watermark - 300, rolling, 300, False))
        db.execute("DELETE FROM readings WHERE ts <= ?", (watermark - 300,))
        db.execute("DELETE FROM watermark")
        db.execute("INSERT INTO watermark VALUES (?)", (watermark,))
        if previous:
            results = [result for result in results if not result["window_complete"] or timestamp(result["window_end"]) > int(previous[0] // 60) * 60]
    return results


def parse_log(raw):
    if isinstance(raw, dict):
        record = dict(raw)
        kind = "json"
    else:
        text = raw.strip()
        kind = "unknown"
        record = {"raw_content": text, "requires_investigation": True}
        if text.startswith("{"):
            record = json.loads(text)
            kind = "json"
        elif text.startswith("<"):
            match = re.fullmatch(r"<(\d+)>(\w{3}\s+\d+ \d+:\d+:\d+) (\S+) ([^:\[]+)(?:\[(\d+)\])?: (.*)", text)
            if match:
                priority, date, host, program, pid, message = match.groups()
                severity = int(priority) % 8
                record = {"priority": int(priority), "timestamp": date, "hostname": host, "program": program, "pid": pid, "message": message, "facility": int(priority) // 8, "severity": severity, "level": "ERROR" if severity <= 3 else "WARN" if severity <= 4 else "INFO"}
                kind = "syslog"
        elif "HTTP/" in text:
            match = re.fullmatch(r'(\S+) \S+ \S+ \[([^]]+)\] "(\w+) (\S+) HTTP/([^"]+)" (\d+) (\d+|-)', text)
            if match:
                ip, date, method, route, version, status, size = match.groups()
                record = {"client_ip_hash": hashlib.sha256(ip.encode()).hexdigest()[:12], "timestamp": date, "method": method, "path": route, "http_version": version, "status": int(status), "bytes": 0 if size == "-" else int(size), "level": "ERROR" if int(status) >= 500 else "WARN" if int(status) >= 400 else "INFO"}
                kind = "access_log"
        elif "," in text:
            values = next(csv.reader([text]))
            if len(values) == 4:
                record = dict(zip(["timestamp", "level", "service", "message"], values))
                kind = "csv"
    record["level"] = str(record.get("level", record.get("severity", "INFO"))).upper()
    record["message"] = record.get("message", record.get("msg", ""))
    date = record.get("timestamp", record.get("@timestamp", now()))
    record.update(timestamp=date, timestamp_iso=date, format=kind, processed_at=now())
    try:
        record["timestamp_unix"] = int(timestamp(date))
    except ValueError:
        pass
    if "error" in record:
        record["error_details"] = {"message": record["error"], "stack_trace": record.get("stack_trace", ""), "error_code": record.get("error_code", ""), "timestamp": record.get("timestamp_unix")}
    record["metadata"] = {"parsed_by": "multi-format-parser", "parsed_at": int(time.time()), "source_node": os.environ.get("NODE_ID", "unknown")}
    return {k: v for k, v in record.items() if k not in {"debug_info", "internal_state", "raw_request"}}


def xml_value(element):
    if not list(element):
        return element.text or ""
    result = {}
    for child in element:
        value = xml_value(child)
        if child.tag in result:
            if not isinstance(result[child.tag], list):
                result[child.tag] = [result[child.tag]]
            result[child.tag].append(value)
        else:
            result[child.tag] = value
    return result


def decode_format(raw):
    if isinstance(raw, (dict, list)):
        return {"data": raw, "source_format": "json"}
    text = raw.strip()
    if text.startswith(("{", "[")):
        data, kind = json.loads(text), "json"
    elif text.startswith("<"):
        if "<!DOCTYPE" in text.upper() or "<!ENTITY" in text.upper():
            raise ValueError("XML entities are not supported")
        data, kind = xml_value(ET.fromstring(text)), "xml"
    elif "," in text:
        data, kind = list(csv.DictReader(io.StringIO(text))), "csv"
    else:
        data, kind = text, "text"
    return {"data": data, "source_format": kind}


def encode_format(record, accept):
    data = record["data"]
    kind = "xml" if "xml" in accept else "csv" if "csv" in accept else "json"
    if kind == "xml":
        def append(parent, value):
            if isinstance(value, dict):
                for key, child in value.items():
                    append(ET.SubElement(parent, key), child)
            elif isinstance(value, list):
                for child in value:
                    append(ET.SubElement(parent, "item"), child)
            else:
                parent.text = str(value)
        element = ET.Element("root")
        append(element, data)
        encoded = ET.tostring(element, encoding="unicode")
    elif kind == "csv":
        rows = data if isinstance(data, list) else [data]
        if not rows or not all(isinstance(row, dict) for row in rows):
            raise ValueError("CSV output requires object records")
        stream = io.StringIO()
        writer = csv.DictWriter(stream, fieldnames=list(dict.fromkeys(key for row in rows for key in row)))
        writer.writeheader()
        writer.writerows(rows)
        encoded = stream.getvalue()
    else:
        encoded = json.dumps(data)
    return {"data": encoded, "transformation": {"source_format": record["source_format"], "target_format": kind, "transformed_at": now()}}


def encode_avro(record):
    def string(value):
        encoded = str(value).encode("utf-8")
        number = len(encoded) << 1
        prefix = bytearray()
        while number >= 128:
            prefix.append((number & 127) | 128)
            number >>= 7
        prefix.append(number)
        return bytes(prefix) + encoded
    schema = json.loads(Path(__file__).with_name("sensor_reading.avsc").read_text())
    data = b"".join(struct.pack("<d", float(record[field["name"]])) if field["type"] == "double" else string(record[field["name"]]) for field in schema["fields"])
    return {"avro_base64": base64.b64encode(data).decode()}


def main():
    mode = sys.argv[1]
    raw = sys.stdin.read()
    value = json.loads(raw) if mode != "parse-log" and mode != "decode" else None
    if mode == "parse-log" or mode == "decode":
        try:
            value = json.loads(raw)
        except json.JSONDecodeError:
            value = raw
    result = {"aggregate": aggregate, "deduplicate": deduplicate, "parse-log": parse_log, "decode": decode_format, "avro": encode_avro}.get(mode)
    output = result(value) if result else encode_format(value, sys.argv[2])
    print(json.dumps(output, allow_nan=False))


if __name__ == "__main__":
    main()
