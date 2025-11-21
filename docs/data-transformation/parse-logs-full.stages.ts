import type { Stage } from '@site/src/components/DataPipelineExplorer/types';

export const parseLogsStages: Stage[] = [
  {
    id: 1,
    title: "Original Input",
    description: "Raw log data from multiple sources in different formats",
    yamlFilename: 'input.jsonl',
    yamlCode: `# Raw mixed-format log data
# No processing yet - this shows the heterogeneous input`,
    inputLines: [
      { content: '{', indent: 0 },
      { content: '"timestamp": "2025-10-20T14:23:45.123Z",', indent: 1, key: 'timestamp', valueType: 'string' },
      { content: '"level": "error",', indent: 1, key: 'level', valueType: 'string' },
      { content: '"service": "api",', indent: 1, key: 'service', valueType: 'string' },
      { content: '"message": "Database connection failed"', indent: 1, key: 'message', valueType: 'string' },
      { content: '}', indent: 0 },
    ],
    outputLines: [
      { content: '{', indent: 0 },
      { content: '"timestamp": "2025-10-20T14:23:45.123Z",', indent: 1, key: 'timestamp', valueType: 'string' },
      { content: '"level": "error",', indent: 1, key: 'level', valueType: 'string' },
      { content: '"service": "api",', indent: 1, key: 'service', valueType: 'string' },
      { content: '"message": "Database connection failed"', indent: 1, key: 'message', valueType: 'string' },
      { content: '}', indent: 0 },
    ],
  },
  {
    id: 2,
    title: "Format Detection",
    description: "Automatically detect log format based on content patterns and add routing metadata",
    yamlFilename: 'step-1-format-detection.yaml',
    yamlCode: `pipeline:
  processors:
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
        meta log_format = root.detected_format`,
    inputLines: [
      { content: '{', indent: 0 },
      { content: '"timestamp": "2025-10-20T14:23:45.123Z",', indent: 1, key: 'timestamp', valueType: 'string' },
      { content: '"level": "error",', indent: 1, key: 'level', valueType: 'string' },
      { content: '"service": "api",', indent: 1, key: 'service', valueType: 'string' },
      { content: '"message": "Database connection failed"', indent: 1, key: 'message', valueType: 'string' },
      { content: '}', indent: 0 },
    ],
    outputLines: [
      { content: '{', indent: 0 },
      { content: '"timestamp": "2025-10-20T14:23:45.123Z",', indent: 1, key: 'timestamp', valueType: 'string' },
      { content: '"level": "error",', indent: 1, key: 'level', valueType: 'string' },
      { content: '"service": "api",', indent: 1, key: 'service', valueType: 'string' },
      { content: '"message": "Database connection failed",', indent: 1, key: 'message', valueType: 'string' },
      { content: '"detected_format": "json"', indent: 1, key: 'detected_format', valueType: 'string', type: 'highlighted' },
      { content: '}', indent: 0 },
    ],
  },
  {
    id: 3,
    title: "JSON Log Parsing",
    description: "Parse JSON application logs with timestamp normalization and field validation",
    yamlFilename: 'step-2-json-parsing.yaml',
    yamlCode: `pipeline:
  processors:
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
        }`,
    inputLines: [
      { content: '{', indent: 0 },
      { content: '"timestamp": "2025-10-20T14:23:45.123Z",', indent: 1, key: 'timestamp', valueType: 'string' },
      { content: '"level": "error",', indent: 1, key: 'level', valueType: 'string' },
      { content: '"service": "api",', indent: 1, key: 'service', valueType: 'string' },
      { content: '"message": "Database connection failed",', indent: 1, key: 'message', valueType: 'string' },
      { content: '"detected_format": "json"', indent: 1, key: 'detected_format', valueType: 'string' },
      { content: '}', indent: 0 },
    ],
    outputLines: [
      { content: '{', indent: 0 },
      { content: '"timestamp": "2025-10-20T14:23:45.123Z",', indent: 1, key: 'timestamp', valueType: 'string' },
      { content: '"timestamp_unix": 1729433025,', indent: 1, key: 'timestamp_unix', valueType: 'number', type: 'highlighted' },
      { content: '"level": "ERROR",', indent: 1, key: 'level', valueType: 'string', type: 'highlighted' },
      { content: '"service": "api",', indent: 1, key: 'service', valueType: 'string' },
      { content: '"message": "Database connection failed",', indent: 1, key: 'message', valueType: 'string' },
      { content: '"metadata": {', indent: 1, type: 'highlighted' },
      { content: '"parsed_by": "json-parser",', indent: 2, key: 'parsed_by', valueType: 'string', type: 'highlighted' },
      { content: '"parsed_at": 1729433025,', indent: 2, key: 'parsed_at', valueType: 'number', type: 'highlighted' },
      { content: '"source_format": "json"', indent: 2, key: 'source_format', valueType: 'string', type: 'highlighted' },
      { content: '}', indent: 1, type: 'highlighted' },
      { content: '}', indent: 0 },
    ],
  },
  {
    id: 4,
    title: "CSV Data Parsing",
    description: "Parse CSV sensor data with column mapping, type conversion, and validation rules",
    yamlFilename: 'step-3-csv-parsing.yaml',
    yamlCode: `pipeline:
  processors:
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
        }`,
    inputLines: [
      { content: '2025-10-20,temperature,temp-sensor-01,35.5,celsius', indent: 0 },
    ],
    outputLines: [
      { content: '{', indent: 0 },
      { content: '"timestamp": "2025-10-20",', indent: 1, key: 'timestamp', valueType: 'string' },
      { content: '"timestamp_unix": 1729433025,', indent: 1, key: 'timestamp_unix', valueType: 'number', type: 'highlighted' },
      { content: '"metric_name": "temperature",', indent: 1, key: 'metric_name', valueType: 'string' },
      { content: '"sensor_id": "temp-sensor-01",', indent: 1, key: 'sensor_id', valueType: 'string' },
      { content: '"value": "35.5",', indent: 1, key: 'value', valueType: 'string' },
      { content: '"value_numeric": 35.5,', indent: 1, key: 'value_numeric', valueType: 'number', type: 'highlighted' },
      { content: '"unit": "celsius",', indent: 1, key: 'unit', valueType: 'string' },
      { content: '"sensor_metadata": {', indent: 1, type: 'highlighted' },
      { content: '"type": "temperature",', indent: 2, key: 'type', valueType: 'string', type: 'highlighted' },
      { content: '"location": "warehouse"', indent: 2, key: 'location', valueType: 'string', type: 'highlighted' },
      { content: '},', indent: 1, type: 'highlighted' },
      { content: '"alert": {', indent: 1, type: 'highlighted' },
      { content: '"level": "critical",', indent: 2, key: 'level', valueType: 'string', type: 'highlighted' },
      { content: '"message": "Temperature exceeds threshold"', indent: 2, key: 'message', valueType: 'string', type: 'highlighted' },
      { content: '}', indent: 1, type: 'highlighted' },
      { content: '}', indent: 0 },
    ],
  },
  {
    id: 5,
    title: "Access Log Parsing",
    description: "Parse web server access logs using grok patterns with client analysis and privacy protection",
    yamlFilename: 'step-4-access-log-parsing.yaml',
    yamlCode: `pipeline:
  processors:
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
        root = this.without("client_ip")`,
    inputLines: [
      { content: '203.0.113.45 - - [20/Oct/2025:14:23:45 +0000] "GET /api/users HTTP/1.1" 200 1234', indent: 0 },
    ],
    outputLines: [
      { content: '{', indent: 0 },
      { content: '"client_ip_hash": "7b9d4e2f1c8a6e3b",', indent: 1, key: 'client_ip_hash', valueType: 'string', type: 'highlighted' },
      { content: '"timestamp_unix": 1729433025,', indent: 1, key: 'timestamp_unix', valueType: 'number', type: 'highlighted' },
      { content: '"method": "GET",', indent: 1, key: 'method', valueType: 'string' },
      { content: '"request": "/api/users",', indent: 1, key: 'request', valueType: 'string' },
      { content: '"http_version": "1.1",', indent: 1, key: 'http_version', valueType: 'string' },
      { content: '"status_code": 200,', indent: 1, key: 'status_code', valueType: 'number', type: 'highlighted' },
      { content: '"bytes": 1234,', indent: 1, key: 'bytes', valueType: 'number', type: 'highlighted' },
      { content: '"request_category": "api",', indent: 1, key: 'request_category', valueType: 'string', type: 'highlighted' },
      { content: '"is_error": false', indent: 1, key: 'is_error', valueType: 'boolean', type: 'highlighted' },
      { content: '}', indent: 0 },
    ],
  },
  {
    id: 6,
    title: "Syslog Message Parsing",
    description: "Parse RFC3164 syslog messages with priority decomposition and severity classification",
    yamlFilename: 'step-5-syslog-parsing.yaml',
    yamlCode: `pipeline:
  processors:
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
        root.process_id = this.pid.or("").number()`,
    inputLines: [
      { content: '<134>Oct 20 14:23:45 edge-node-01 app[12345]: Database connection established', indent: 0 },
    ],
    outputLines: [
      { content: '{', indent: 0 },
      { content: '"priority": 134,', indent: 1, key: 'priority', valueType: 'number', type: 'highlighted' },
      { content: '"facility": 16,', indent: 1, key: 'facility', valueType: 'number', type: 'highlighted' },
      { content: '"severity": 6,', indent: 1, key: 'severity', valueType: 'number', type: 'highlighted' },
      { content: '"severity_name": "Informational",', indent: 1, key: 'severity_name', valueType: 'string', type: 'highlighted' },
      { content: '"timestamp_unix": 1729433025,', indent: 1, key: 'timestamp_unix', valueType: 'number', type: 'highlighted' },
      { content: '"hostname": "edge-node-01",', indent: 1, key: 'hostname', valueType: 'string' },
      { content: '"tag": "app",', indent: 1, key: 'tag', valueType: 'string' },
      { content: '"process_id": 12345,', indent: 1, key: 'process_id', valueType: 'number', type: 'highlighted' },
      { content: '"application": "app",', indent: 1, key: 'application', valueType: 'string', type: 'highlighted' },
      { content: '"message": "Database connection established"', indent: 1, key: 'message', valueType: 'string' },
      { content: '}', indent: 0 },
    ],
  }
];
