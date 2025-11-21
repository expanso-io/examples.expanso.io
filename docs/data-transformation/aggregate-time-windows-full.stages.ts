import type { Stage } from '@site/src/components/DataPipelineExplorer/types';

export const aggregateTimeWindowsStages: Stage[] = [
  {
    id: 1,
    title: "Original High-Frequency Events",
    description: "Raw sensor data streaming at 60 events/minute per sensor, creating overwhelming data volume that needs aggregation.",
    yamlFilename: 'input.jsonl',
    yamlCode: `# No processing - just input pass-through
input:
  file:
    paths: ["sensor-data.jsonl"]

pipeline:
  processors: []  # No transformation

output:
  stdout:
    codec: lines`,
    inputLines: [
      { content: '{', indent: 0 },
      { content: '"sensor_id": "temp_001",', indent: 1, key: 'sensor_id', valueType: 'string' },
      { content: '"temperature": 72.3,', indent: 1, key: 'temperature', valueType: 'number' },
      { content: '"humidity": 45.2,', indent: 1, key: 'humidity', valueType: 'number' },
      { content: '"timestamp": "2025-01-15T10:23:45.123Z"', indent: 1, key: 'timestamp', valueType: 'string' },
      { content: '}', indent: 0 },
    ],
    outputLines: [
      { content: '{', indent: 0 },
      { content: '"sensor_id": "temp_001",', indent: 1, key: 'sensor_id', valueType: 'string' },
      { content: '"temperature": 72.3,', indent: 1, key: 'temperature', valueType: 'number' },
      { content: '"humidity": 45.2,', indent: 1, key: 'humidity', valueType: 'number' },
      { content: '"timestamp": "2025-01-15T10:23:45.123Z"', indent: 1, key: 'timestamp', valueType: 'string' },
      { content: '}', indent: 0 },
    ],
  },
  {
    id: 2,
    title: "Tumbling Window Aggregation",
    description: "Fixed 1-minute windows aggregate events into precise summaries with 98% data reduction.",
    yamlFilename: 'step-1-tumbling-window.yaml',
    yamlCode: `# Tumbling window aggregation (1-minute windows)
resources:
  caches:
    tumbling_cache:
      memory:
        default_ttl: "90s"
        max_items: 50000

pipeline:
  processors:
    - json: {}
    - mapping: |
        root = this
        let parsed_time = this.timestamp.parse_timestamp("2006-01-02T15:04:05.000Z")
        let window_start = parsed_time.ts_format("2006-01-02T15:04:00Z")
        root.group_key = this.sensor_id + "|" + window_start
        root.window_start = window_start
        root.window_end = (parsed_time + duration("1m")).ts_format("2006-01-02T15:04:00Z")

    - cache:
        resource: tumbling_cache
        key: \${! this.group_key }
        value: \${! this }

    - group_by:
        - key: \${! this.group_key }
          value: \${! this }

    - mapping: |
        let events = this
        let first_event = events[0]
        root.sensor_id = first_event.sensor_id
        root.time_bucket = first_event.window_start
        root.window_start = first_event.window_start
        root.window_end = first_event.window_end
        root.event_count = events.length()

        let temperatures = events.map_each(e -> e.temperature)
        root.temperature_avg = temperatures.mean().round(2)
        root.temperature_min = temperatures.min()
        root.temperature_max = temperatures.max()`,
    inputLines: [
      { content: '{', indent: 0 },
      { content: '"sensor_id": "temp_001",', indent: 1, key: 'sensor_id', valueType: 'string' },
      { content: '"temperature": 72.3,', indent: 1, key: 'temperature', valueType: 'number' },
      { content: '"timestamp": "2025-01-15T10:23:45.123Z"', indent: 1, key: 'timestamp', valueType: 'string' },
      { content: '}', indent: 0 },
    ],
    outputLines: [
      { content: '{', indent: 0 },
      { content: '"sensor_id": "temp_001",', indent: 1, key: 'sensor_id', valueType: 'string' },
      { content: '"time_bucket": "2025-01-15T10:23:00Z",', indent: 1, key: 'time_bucket', valueType: 'string', type: 'highlighted' },
      { content: '"window_start": "2025-01-15T10:23:00Z",', indent: 1, key: 'window_start', valueType: 'string', type: 'highlighted' },
      { content: '"window_end": "2025-01-15T10:24:00Z",', indent: 1, key: 'window_end', valueType: 'string', type: 'highlighted' },
      { content: '"event_count": 60,', indent: 1, key: 'event_count', valueType: 'number', type: 'highlighted' },
      { content: '"temperature_avg": 73.05,', indent: 1, key: 'temperature_avg', valueType: 'number', type: 'highlighted' },
      { content: '"temperature_min": 70.1,', indent: 1, key: 'temperature_min', valueType: 'number', type: 'highlighted' },
      { content: '"temperature_max": 76.0', indent: 1, key: 'temperature_max', valueType: 'number', type: 'highlighted' },
      { content: '}', indent: 0 },
    ],
  },
  {
    id: 3,
    title: "Sliding Window Trends",
    description: "5-minute overlapping windows create smoothed moving averages for trend analysis and anomaly detection.",
    yamlFilename: 'step-2-sliding-window.yaml',
    yamlCode: `# Sliding window aggregation (5-minute windows, 1-minute slides)
resources:
  caches:
    sliding_cache:
      memory:
        default_ttl: "360s"
        max_items: 100000

pipeline:
  processors:
    - json: {}
    - mapping: |
        let event_time = this.time_bucket.parse_timestamp("2006-01-02T15:04:05Z")
        let window_starts = range(0, 5).map(offset -> {
          (event_time - duration(offset.string() + "m")).ts_format("2006-01-02T15:04:00Z")
        })

        root.sliding_windows = window_starts.map(start_time -> {
          this.merge({
            "group_key": this.sensor_id + "|" + start_time + "|5min",
            "window_start": start_time,
            "window_end": (start_time.parse_timestamp("2006-01-02T15:04:05Z") + duration("5m")).ts_format("2006-01-02T15:04:05Z")
          })
        })

    - mapping: 'root = this.sliding_windows'
    - unarchive:
        format: json_array

    - cache:
        resource: sliding_cache
        key: \${! this.group_key }
        value: \${! this }

    - group_by:
        - key: \${! this.group_key }
          value: \${! this }

    - mapping: |
        let sorted_events = this.sort_by(event -> event.time_bucket)
        let temperatures = sorted_events.map_each(e -> e.temperature_avg)

        root.sensor_id = sorted_events[0].sensor_id
        root.window_start = sorted_events[0].window_start
        root.window_end = sorted_events[0].window_end
        root.temperature_5min_avg = temperatures.mean().round(2)
        root.temperature_volatility = temperatures.stddev().round(2)

        # Trend analysis
        let first_temp = temperatures[0]
        let last_temp = temperatures[temperatures.length()-1]
        root.temperature_slope = ((last_temp - first_temp) / 5.0).round(3)
        root.temperature_trend = match {
          root.temperature_slope > 0.1 => "increasing",
          root.temperature_slope < -0.1 => "decreasing",
          _ => "stable"
        }`,
    inputLines: [
      { content: '{', indent: 0 },
      { content: '"sensor_id": "temp_001",', indent: 1, key: 'sensor_id', valueType: 'string' },
      { content: '"time_bucket": "2025-01-15T10:20:00Z",', indent: 1, key: 'time_bucket', valueType: 'string' },
      { content: '"temperature_avg": 72.1', indent: 1, key: 'temperature_avg', valueType: 'number' },
      { content: '}', indent: 0 },
    ],
    outputLines: [
      { content: '{', indent: 0 },
      { content: '"sensor_id": "temp_001",', indent: 1, key: 'sensor_id', valueType: 'string' },
      { content: '"window_start": "2025-01-15T10:20:00Z",', indent: 1, key: 'window_start', valueType: 'string', type: 'highlighted' },
      { content: '"window_end": "2025-01-15T10:25:00Z",', indent: 1, key: 'window_end', valueType: 'string', type: 'highlighted' },
      { content: '"temperature_5min_avg": 73.36,', indent: 1, key: 'temperature_5min_avg', valueType: 'number', type: 'highlighted' },
      { content: '"temperature_trend": "increasing",', indent: 1, key: 'temperature_trend', valueType: 'string', type: 'highlighted' },
      { content: '"temperature_slope": 0.8,', indent: 1, key: 'temperature_slope', valueType: 'number', type: 'highlighted' },
      { content: '"temperature_volatility": 1.76,', indent: 1, key: 'temperature_volatility', valueType: 'number', type: 'highlighted' },
      { content: '"anomaly_detected": false', indent: 1, key: 'anomaly_detected', valueType: 'boolean', type: 'highlighted' },
      { content: '}', indent: 0 },
    ],
  },
  {
    id: 4,
    title: "Session-Based Activity Clustering",
    description: "Dynamic windows group events by activity patterns, creating variable-length analytics windows based on 5-minute inactivity gaps.",
    yamlFilename: 'step-3-session-window.yaml',
    yamlCode: `# Session window aggregation (5-minute inactivity threshold)
resources:
  caches:
    session_cache:
      memory:
        default_ttl: "3600s"
        max_items: 10000

pipeline:
  processors:
    - json: {}
    - cache:
        resource: session_cache
        key: \${! this.sensor_id }
        value: \${! this }

    - group_by:
        - key: \${! this.sensor_id }
          value: \${! this }

    - mapping: |
        let sorted_events = this.sort_by(event -> event.timestamp)
        let inactivity_threshold_minutes = 5

        # Session detection algorithm
        let sessions = []
        let current_session = []
        let last_event_time = null

        sorted_events.map_each(event -> {
          let event_time = event.timestamp.parse_timestamp("2006-01-02T15:04:05Z").timestamp_unix()
          let gap_minutes = if last_event_time != null {
            (event_time - last_event_time) / 60.0
          } else {
            0
          }

          if gap_minutes > inactivity_threshold_minutes && current_session.length() > 0 {
            # Complete current session, start new one
            sessions = sessions + [current_session]
            current_session = [event]
          } else {
            current_session = current_session + [event]
          }

          last_event_time = event_time
        })

        # Add final session
        if current_session.length() > 0 {
          sessions = sessions + [current_session]
        }

        root = sessions

    - mapping: 'root = this'
    - unarchive:
        format: json_array

    - mapping: |
        let session_events = this.sort_by(event -> event.timestamp)
        let first_event = session_events[0]
        let last_event = session_events[session_events.length()-1]

        root.sensor_id = first_event.sensor_id
        root.session_start = first_event.timestamp
        root.session_end = last_event.timestamp
        root.total_events = session_events.length()

        let duration_seconds = last_event.timestamp.parse_timestamp("2006-01-02T15:04:05Z").timestamp_unix() -
                              first_event.timestamp.parse_timestamp("2006-01-02T15:04:05Z").timestamp_unix()
        root.session_duration_minutes = (duration_seconds / 60.0).round(2)

        root.activity_intensity = match {
          root.total_events / root.session_duration_minutes > 2 => "high",
          root.total_events / root.session_duration_minutes > 0.5 => "medium",
          _ => "low"
        }`,
    inputLines: [
      { content: '{', indent: 0 },
      { content: '"sensor_id": "motion_001",', indent: 1, key: 'sensor_id', valueType: 'string' },
      { content: '"activity": "detected",', indent: 1, key: 'activity', valueType: 'string' },
      { content: '"timestamp": "2025-01-15T10:30:00Z"', indent: 1, key: 'timestamp', valueType: 'string' },
      { content: '}', indent: 0 },
    ],
    outputLines: [
      { content: '{', indent: 0 },
      { content: '"sensor_id": "motion_001",', indent: 1, key: 'sensor_id', valueType: 'string' },
      { content: '"session_id": "motion_001_20250115_103000_103030",', indent: 1, key: 'session_id', valueType: 'string', type: 'highlighted' },
      { content: '"session_start": "2025-01-15T10:30:00Z",', indent: 1, key: 'session_start', valueType: 'string', type: 'highlighted' },
      { content: '"session_end": "2025-01-15T10:30:30Z",', indent: 1, key: 'session_end', valueType: 'string', type: 'highlighted' },
      { content: '"session_duration_minutes": 0.5,', indent: 1, key: 'session_duration_minutes', valueType: 'number', type: 'highlighted' },
      { content: '"total_events": 3,', indent: 1, key: 'total_events', valueType: 'number', type: 'highlighted' },
      { content: '"activity_intensity": "high",', indent: 1, key: 'activity_intensity', valueType: 'string', type: 'highlighted' },
      { content: '"activity_pattern": "continuous"', indent: 1, key: 'activity_pattern', valueType: 'string', type: 'highlighted' },
      { content: '}', indent: 0 },
    ],
  },
  {
    id: 5,
    title: "Production-Ready Multi-Level Analytics",
    description: "Complete hierarchical aggregation with reliability features: sensor → location → global levels plus memory management, circuit breakers, and monitoring.",
    yamlFilename: 'step-4-production.yaml',
    yamlCode: `# Production multi-level aggregation with reliability
input:
  kafka:
    addresses: ["kafka-broker-1:9092", "kafka-broker-2:9092"]
    topics: ["sensor-events"]
    consumer_group: "aggregation-pipeline"

resources:
  caches:
    production_cache:
      redis:
        url: "redis://redis-cluster:6379"
        sentinel:
          master_name: "aggregation-cache"
  rate_limits:
    input_limit:
      count: 100000
      per: "1s"

pipeline:
  processors:
    - try:
        processors:
          - json: {}
          - mapping: |
              if !this.exists("sensor_id") { error("Missing sensor_id") }
              if this.temperature < -50 || this.temperature > 100 {
                error("Temperature out of range")
              }
              root = this
              root.processing_instance = "aggregation-instance-1"
        catch:
          - http_client:
              url: "https://errors.company.com/validation-errors"
          - mapping: 'deleted()'

    - branch:
        request_map: |
          root = [
            this.merge({"aggregation_level": "sensor", "group_key": this.sensor_id}),
            this.merge({"aggregation_level": "location", "group_key": this.location}),
            this.merge({"aggregation_level": "global", "group_key": "global"})
          ]
        processors:
          - cache:
              resource: production_cache
              key: \${! this.group_key + "|" + this.aggregation_level }
              value: \${! this }
          - group_by:
              - key: \${! this.group_key }
                value: \${! this }
          - mapping: |
              let level = this[0].aggregation_level
              if level == "global" {
                root.aggregation_level = "global"
                root.sensor_count = this.map_each(e -> e.sensor_id).unique().length()
                root.location_count = this.map_each(e -> e.location).unique().length()
                root.temperature_avg = this.map_each(e -> e.temperature).mean().round(2)
                root.system_health = "excellent"
                root.circuit_breaker_state = "closed"
                root.reliability_score = 0.99
              }

output:
  circuit_breaker:
    failure_threshold: 5
    outputs:
      - http_client:
          url: "https://analytics.company.com/aggregations"
          batching:
            count: 500
            period: "10s"
      fallback:
        - file:
            path: "/var/buffer/aggregations.jsonl"

metrics:
  prometheus:
    use_histogram_timing: true
    static_labels:
      service: "time-window-aggregation"`,
    inputLines: [
      { content: '{', indent: 0 },
      { content: '"sensor_id": "temp_001",', indent: 1, key: 'sensor_id', valueType: 'string' },
      { content: '"location": "warehouse_a",', indent: 1, key: 'location', valueType: 'string' },
      { content: '"temperature_avg": 72.3,', indent: 1, key: 'temperature_avg', valueType: 'number' },
      { content: '"event_count": 60', indent: 1, key: 'event_count', valueType: 'number' },
      { content: '}', indent: 0 },
    ],
    outputLines: [
      { content: '{', indent: 0 },
      { content: '"aggregation_level": "global",', indent: 1, key: 'aggregation_level', valueType: 'string', type: 'highlighted' },
      { content: '"sensor_count": 4,', indent: 1, key: 'sensor_count', valueType: 'number', type: 'highlighted' },
      { content: '"location_count": 2,', indent: 1, key: 'location_count', valueType: 'number', type: 'highlighted' },
      { content: '"temperature_avg": 72.525,', indent: 1, key: 'temperature_avg', valueType: 'number', type: 'highlighted' },
      { content: '"total_events": 239,', indent: 1, key: 'total_events', valueType: 'number', type: 'highlighted' },
      { content: '"system_health": "excellent",', indent: 1, key: 'system_health', valueType: 'string', type: 'highlighted' },
      { content: '"circuit_breaker_state": "closed",', indent: 1, key: 'circuit_breaker_state', valueType: 'string', type: 'highlighted' },
      { content: '"reliability_score": 0.99', indent: 1, key: 'reliability_score', valueType: 'number', type: 'highlighted' },
      { content: '}', indent: 0 },
    ],
  }
];
