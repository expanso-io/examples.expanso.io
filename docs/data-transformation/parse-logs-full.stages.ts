import type { Stage } from '@site/src/components/DataPipelineExplorer/types';

export const parseLogsStages: Stage[] = [
  {
    title: "Stage 1: Original Input",
    description: "Raw log data from multiple sources in different formats",
    input: {
      "mixed_logs": [
        '{"timestamp":"2025-10-20T14:23:45.123Z","level":"error","service":"api","message":"Database connection failed"}',
        "2025-10-20,temperature,temp-sensor-01,35.5,celsius",
        '203.0.113.45 - - [20/Oct/2025:14:23:45 +0000] "GET /api/users HTTP/1.1" 200 1234',
        "<134>Oct 20 14:23:45 edge-node-01 app[12345]: Database connection established"
      ]
    },
    output: {
      "mixed_logs": [
        '{"timestamp":"2025-10-20T14:23:45.123Z","level":"error","service":"api","message":"Database connection failed"}',
        "2025-10-20,temperature,temp-sensor-01,35.5,celsius", 
        '203.0.113.45 - - [20/Oct/2025:14:23:45 +0000] "GET /api/users HTTP/1.1" 200 1234',
        "<134>Oct 20 14:23:45 edge-node-01 app[12345]: Database connection established"
      ]
    },
    processor: null,
    yaml: ""
  },
  {
    title: "Stage 2: Format Detection",
    description: "Automatically detect log format based on content patterns and add routing metadata",
    input: {
      "mixed_logs": [
        '{"timestamp":"2025-10-20T14:23:45.123Z","level":"error","service":"api","message":"Database connection failed"}',
        "2025-10-20,temperature,temp-sensor-01,35.5,celsius",
        '203.0.113.45 - - [20/Oct/2025:14:23:45 +0000] "GET /api/users HTTP/1.1" 200 1234',
        "<134>Oct 20 14:23:45 edge-node-01 app[12345]: Database connection established"
      ]
    },
    output: {
      "json_log": '{"timestamp":"2025-10-20T14:23:45.123Z","level":"error","service":"api","message":"Database connection failed","detected_format":"json"}',
      "csv_log": '2025-10-20,temperature,temp-sensor-01,35.5,celsius,"detected_format":"csv"',
      "access_log": '203.0.113.45 - - [20/Oct/2025:14:23:45 +0000] "GET /api/users HTTP/1.1" 200 1234,"detected_format":"access_log"',
      "syslog": '<134>Oct 20 14:23:45 edge-node-01 app[12345]: Database connection established,"detected_format":"syslog"'
    },
    processor: "mapping",
    yaml: `processors:
  # Detect log format based on content patterns
  - mapping: |
      root = this
      root.detected_format = if this.string().has_prefix("{") {
        "json"
      } else if this.string().has_prefix("<") {
        "syslog" 
      } else if this.string().contains(" - - [") {
        "access_log"
      } else if this.string().contains(",") {
        "csv"
      } else {
        "unknown"
      }
      meta log_format = root.detected_format`
  },
  {
    title: "Stage 3: JSON Log Parsing", 
    description: "Parse JSON application logs with timestamp normalization and field validation",
    input: {
      "json_log": '{"timestamp":"2025-10-20T14:23:45.123Z","level":"error","service":"api","message":"Database connection failed","detected_format":"json"}'
    },
    output: {
      "parsed_json": {
        "timestamp": "2025-10-20T14:23:45.123Z",
        "~~timestamp_unix~~": "1729433025", 
        "level": "~~ERROR~~",
        "service": "api",
        "message": "Database connection failed",
        "++metadata++": {
          "parsed_by": "++json-parser++",
          "parsed_at": "++1729433025++",
          "source_format": "++json++"
        }
      }
    },
    processor: "json_documents + mapping",
    yaml: `processors:
  # Parse JSON documents
  - json_documents: 
      parts: []
  
  # Normalize timestamp and add metadata  
  - mapping: |
      root = this
      root.timestamp_unix = this.timestamp.parse_timestamp("2006-01-02T15:04:05.999Z07:00").ts_unix()
      root.level = this.level.or("INFO").uppercase()
      root.metadata = {
        "parsed_by": "json-parser",
        "parsed_at": now().ts_unix(),
        "source_format": "json"
      }`
  },
  {
    title: "Stage 4: CSV Data Parsing",
    description: "Parse CSV sensor data with column mapping, type conversion, and validation rules",
    input: {
      "csv_log": "2025-10-20,temperature,temp-sensor-01,35.5,celsius"
    },
    output: {
      "parsed_csv": {
        "timestamp": "2025-10-20",
        "~~timestamp_unix~~": "~~1729433025~~",
        "metric_name": "temperature", 
        "sensor_id": "temp-sensor-01",
        "value": "35.5",
        "++value_numeric++": "++35.5++",
        "unit": "celsius",
        "++sensor_metadata++": {
          "type": "++temperature++",
          "location": "++warehouse++"
        },
        "++alert++": {
          "level": "++critical++",
          "message": "++Temperature exceeds threshold++"
        }
      }
    },
    processor: "csv + mapping",
    yaml: `processors:
  # Parse CSV with named columns
  - csv:
      columns: [timestamp, metric_name, sensor_id, value, unit]
      delimiter: ","
  
  # Convert types and add sensor metadata
  - mapping: |
      root = this 
      root.timestamp_unix = this.timestamp.parse_timestamp("2006-01-02").ts_unix()
      root.value_numeric = this.value.number()
      root.sensor_metadata = if this.sensor_id.has_prefix("temp-") {
        {"type": "temperature", "location": "warehouse"}
      } else {
        {"type": "unknown", "location": "unknown"}
      }
      root.alert = if this.metric_name == "temperature" && this.value_numeric > 30 {
        {"level": "critical", "message": "Temperature exceeds threshold"}
      }`
  },
  {
    title: "Stage 5: Access Log Parsing",
    description: "Parse web server access logs using grok patterns with client analysis and privacy protection",
    input: {
      "access_log": '203.0.113.45 - - [20/Oct/2025:14:23:45 +0000] "GET /api/users HTTP/1.1" 200 1234'
    },
    output: {
      "parsed_access": {
        "~~client_ip_hash~~": "~~7b9d4e2f1c8a6e3b~~",
        "~~timestamp_unix~~": "~~1729433025~~",
        "method": "GET",
        "request": "/api/users",
        "http_version": "1.1",
        "status_code": "~~200~~",
        "bytes": "~~1234~~",
        "++request_category++": "++api++",
        "++is_error++": "++false++",
        "++performance_metrics++": {
          "response_time_ms": "++45++",
          "bandwidth_kb": "++1.2++"
        }
      }
    },
    processor: "grok + mapping",
    yaml: `processors:
  # Parse using grok pattern (Apache Combined Format)
  - grok:
      expressions:
        - '%{IPORHOST:client_ip} %{USER:ident} %{USER:auth} \\[%{HTTPDATE:timestamp}\\] "(?:%{WORD:method} %{NOTSPACE:request}(?: HTTP/%{NUMBER:http_version})?|%{DATA})" %{NUMBER:status_code} (?:%{NUMBER:bytes}|-)'
      named_captures_only: true

  # Convert types and classify requests  
  - mapping: |
      root = this
      root.timestamp_unix = this.timestamp.parse_timestamp("02/Jan/2006:15:04:05 -0700").ts_unix()
      root.status_code = this.status_code.number()
      root.bytes = this.bytes.or("0").number()
      root.request_category = if this.request.contains("/api/") {
        "api"
      } else if this.request.contains("/static/") {
        "static"  
      } else { "page" }
      root.is_error = this.status_code >= 400
      # Hash IP for privacy
      root.client_ip_hash = (this.client_ip + env("IP_SALT")).hash("sha256").slice(0, 16)
      root = this.without("client_ip")`
  },
  {
    title: "Stage 6: Syslog Message Parsing", 
    description: "Parse RFC3164 syslog messages with priority decomposition and severity classification",
    input: {
      "syslog": "<134>Oct 20 14:23:45 edge-node-01 app[12345]: Database connection established"
    },
    output: {
      "parsed_syslog": {
        "~~priority~~": "~~134~~",
        "++facility++": "++16++", 
        "++severity++": "++6++",
        "++severity_name++": "++Informational++",
        "~~timestamp_unix~~": "~~1729433025~~",
        "hostname": "edge-node-01",
        "tag": "app",
        "++process_id++": "++12345++",
        "++application++": "++app++",
        "message": "Database connection established"
      }
    },
    processor: "grok + mapping",
    yaml: `processors:
  # Parse syslog format (RFC3164)
  - grok:
      expressions:
        - '<%{POSINT:priority}>%{SYSLOGTIMESTAMP:timestamp} %{SYSLOGHOST:hostname} %{DATA:tag}(?:\\[%{POSINT:pid}\\])?: %{GREEDYDATA:message}'
      named_captures_only: true

  # Parse priority to facility and severity
  - mapping: |
      root = this
      let pri = this.priority.number()
      root.facility = (pri / 8).floor()
      root.severity = pri % 8
      root.severity_name = if this.severity == 0 {
        "Emergency"
      } else if this.severity <= 2 {
        "Critical"
      } else if this.severity <= 4 {
        "Warning"
      } else {
        "Informational"
      }
      # Parse timestamp (add current year)
      let year = now().ts_format("2006")
      root.timestamp_unix = (year + " " + this.timestamp).parse_timestamp("2006 Jan 02 15:04:05").ts_unix()
      root.application = this.tag
      root.process_id = this.pid.or("").number()`
  }
];
