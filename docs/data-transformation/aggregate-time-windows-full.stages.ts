import type { Stage } from '@site/src/components/DataPipelineExplorer/types';

export const aggregateTimeWindowsStages: Stage[] = [
  {
    title: "Original High-Frequency Events",
    description: "Raw sensor data streaming at 60 events/minute per sensor, creating overwhelming data volume that needs aggregation.",
    input: {
      title: "Raw Sensor Events",
      data: `{"sensor_id":"temp_001","temperature":72.3,"humidity":45.2,"timestamp":"2025-01-15T10:23:45.123Z"}
{"sensor_id":"temp_001","temperature":72.8,"humidity":45.1,"timestamp":"2025-01-15T10:23:47.456Z"}
{"sensor_id":"temp_001","temperature":73.1,"humidity":44.9,"timestamp":"2025-01-15T10:23:50.789Z"}
{"sensor_id":"temp_001","temperature":72.5,"humidity":45.3,"timestamp":"2025-01-15T10:23:52.012Z"}
{"sensor_id":"temp_001","temperature":73.2,"humidity":44.8,"timestamp":"2025-01-15T10:23:55.345Z"}
{"sensor_id":"temp_002","temperature":71.8,"humidity":46.1,"timestamp":"2025-01-15T10:23:46.234Z"}
{"sensor_id":"temp_002","temperature":71.5,"humidity":46.0,"timestamp":"2025-01-15T10:23:48.567Z"}
{"sensor_id":"temp_002","temperature":71.9,"humidity":45.8,"timestamp":"2025-01-15T10:23:51.890Z"}`,
      format: "json"
    },
    output: {
      title: "Same Raw Events (No Processing)",
      data: `{"sensor_id":"temp_001","temperature":72.3,"humidity":45.2,"timestamp":"2025-01-15T10:23:45.123Z"}
{"sensor_id":"temp_001","temperature":72.8,"humidity":45.1,"timestamp":"2025-01-15T10:23:47.456Z"}
{"sensor_id":"temp_001","temperature":73.1,"humidity":44.9,"timestamp":"2025-01-15T10:23:50.789Z"}
{"sensor_id":"temp_001","temperature":72.5,"humidity":45.3,"timestamp":"2025-01-15T10:23:52.012Z"}
{"sensor_id":"temp_001","temperature":73.2,"humidity":44.8,"timestamp":"2025-01-15T10:23:55.345Z"}
{"sensor_id":"temp_002","temperature":71.8,"humidity":46.1,"timestamp":"2025-01-15T10:23:46.234Z"}
{"sensor_id":"temp_002","temperature":71.5,"humidity":46.0,"timestamp":"2025-01-15T10:23:48.567Z"}
{"sensor_id":"temp_002","temperature":71.9,"humidity":45.8,"timestamp":"2025-01-15T10:23:51.890Z"}`,
      format: "json"
    },
    yamlConfig: `# No processing - just input pass-through
input:
  file:
    paths: ["sensor-data.jsonl"]

pipeline:
  processors: []  # No transformation

output:
  stdout:
    codec: lines`,
    processors: []
  },

  {
    title: "Tumbling Window Aggregation",
    description: "Fixed 1-minute windows aggregate events into precise summaries with 98% data reduction.",
    input: {
      title: "Raw Sensor Events (60 events/minute)",
      data: `{"sensor_id":"temp_001","temperature":72.3,"timestamp":"2025-01-15T10:23:45.123Z"}
{"sensor_id":"temp_001","temperature":72.8,"timestamp":"2025-01-15T10:23:47.456Z"}
{"sensor_id":"temp_001","temperature":73.1,"timestamp":"2025-01-15T10:23:50.789Z"}
[... 57 more events in this minute ...]`,
      format: "json"
    },
    output: {
      title: "1-Minute Aggregated Summaries",
      data: `{"sensor_id":"temp_001","time_bucket":"2025-01-15T10:23:00Z","window_start":"2025-01-15T10:23:00Z","window_end":"2025-01-15T10:24:00Z","event_count":60,"temperature_avg":73.05,"temperature_min":70.1,"temperature_max":76.0,"temperature_p95":75.2,"humidity_avg":45.1,"data_quality_score":0.97}
{"sensor_id":"temp_002","time_bucket":"2025-01-15T10:23:00Z","window_start":"2025-01-15T10:23:00Z","window_end":"2025-01-15T10:24:00Z","event_count":58,"temperature_avg":71.84,"temperature_min":69.9,"temperature_max":73.2,"temperature_p95":72.8,"humidity_avg":46.0,"data_quality_score":0.95}`,
      format: "json"
    },
    yamlConfig: `# Tumbling window aggregation (1-minute windows)
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
    processors: [
      "Parse JSON events",
      "Create 1-minute time buckets", 
      "Cache events by group key",
      "Group by sensor + time bucket",
      "Calculate comprehensive statistics"
    ]
  },

  {
    title: "Sliding Window Trends",
    description: "5-minute overlapping windows create smoothed moving averages for trend analysis and anomaly detection.",
    input: {
      title: "Tumbling Window Summaries",
      data: `{"sensor_id":"temp_001","time_bucket":"2025-01-15T10:20:00Z","temperature_avg":72.1}
{"sensor_id":"temp_001","time_bucket":"2025-01-15T10:21:00Z","temperature_avg":74.8}
{"sensor_id":"temp_001","time_bucket":"2025-01-15T10:22:00Z","temperature_avg":71.2}
{"sensor_id":"temp_001","time_bucket":"2025-01-15T10:23:00Z","temperature_avg":75.3}
{"sensor_id":"temp_001","time_bucket":"2025-01-15T10:24:00Z","temperature_avg":73.4}`,
      format: "json"
    },
    output: {
      title: "5-Minute Sliding Window Analytics",
      data: `{"sensor_id":"temp_001","window_start":"2025-01-15T10:20:00Z","window_end":"2025-01-15T10:25:00Z","temperature_5min_avg":73.36,"temperature_trend":"increasing","temperature_slope":0.8,"temperature_volatility":1.76,"anomaly_detected":false,"current_z_score":0.12,"trend_correlation":0.72,"data_points":[{"time":"2025-01-15T10:20:00Z","temperature_avg":72.1},{"time":"2025-01-15T10:21:00Z","temperature_avg":74.8},{"time":"2025-01-15T10:22:00Z","temperature_avg":71.2},{"time":"2025-01-15T10:23:00Z","temperature_avg":75.3},{"time":"2025-01-15T10:24:00Z","temperature_avg":73.4}]}`,
      format: "json"
    },
    yamlConfig: `# Sliding window aggregation (5-minute windows, 1-minute slides)
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
    processors: [
      "Generate sliding window keys",
      "Create overlapping 5-minute windows",
      "Cache events by sliding window",
      "Calculate trend analysis",
      "Detect anomalies with z-scores"
    ]
  },

  {
    title: "Session-Based Activity Clustering", 
    description: "Dynamic windows group events by activity patterns, creating variable-length analytics windows based on 5-minute inactivity gaps.",
    input: {
      title: "Activity Events with Gaps",
      data: `{"sensor_id":"motion_001","activity":"detected","timestamp":"2025-01-15T10:30:00Z"}
{"sensor_id":"motion_001","activity":"detected","timestamp":"2025-01-15T10:30:15Z"}
{"sensor_id":"motion_001","activity":"detected","timestamp":"2025-01-15T10:30:30Z"}
[5-minute gap]
{"sensor_id":"motion_001","activity":"detected","timestamp":"2025-01-15T10:35:45Z"}
{"sensor_id":"motion_001","activity":"detected","timestamp":"2025-01-15T10:36:00Z"}`,
      format: "json"
    },
    output: {
      title: "Activity Sessions",
      data: `{"sensor_id":"motion_001","session_id":"motion_001_20250115_103000_103030","session_start":"2025-01-15T10:30:00Z","session_end":"2025-01-15T10:30:30Z","session_duration_minutes":0.5,"inactivity_gap_after_minutes":5.25,"total_events":3,"activity_intensity":"high","activity_pattern":"continuous","peak_activity_time":"2025-01-15T10:30:15Z"}
{"sensor_id":"motion_001","session_id":"motion_001_20250115_103545_103600","session_start":"2025-01-15T10:35:45Z","session_end":"2025-01-15T10:36:00Z","session_duration_minutes":0.25,"inactivity_gap_before_minutes":5.25,"total_events":2,"activity_intensity":"medium","activity_pattern":"brief","peak_activity_time":"2025-01-15T10:35:45Z"}`,
      format: "json"
    },
    yamlConfig: `# Session window aggregation (5-minute inactivity threshold)
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
    processors: [
      "Cache events by sensor ID",
      "Sort events chronologically", 
      "Detect session boundaries (5-min gaps)",
      "Group events into sessions",
      "Calculate session analytics"
    ]
  },

  {
    title: "Production-Ready Multi-Level Analytics",
    description: "Complete hierarchical aggregation with reliability features: sensor → location → global levels plus memory management, circuit breakers, and monitoring.",
    input: {
      title: "Sensor Aggregations with Hierarchy",
      data: `{"sensor_id":"temp_001","location":"warehouse_a","temperature_avg":72.3,"event_count":60}
{"sensor_id":"temp_002","location":"warehouse_a","temperature_avg":71.8,"event_count":58}
{"sensor_id":"temp_003","location":"warehouse_b","temperature_avg":73.1,"event_count":62}
{"sensor_id":"temp_004","location":"warehouse_b","temperature_avg":72.9,"event_count":59}`,
      format: "json"
    },
    output: {
      title: "Multi-Level Analytics with Production Features",
      data: `{"aggregation_level":"sensor","sensor_id":"temp_001","location":"warehouse_a","temperature_avg":72.3,"event_count":60,"data_quality_score":0.97,"processing_instance":"aggregation-prod-1"}
{"aggregation_level":"location","location":"warehouse_a","sensor_count":2,"temperature_avg":72.05,"temperature_range":0.5,"total_events":118,"data_quality_score":0.96,"completeness_ratio":0.98}
{"aggregation_level":"global","sensor_count":4,"location_count":2,"temperature_avg":72.525,"temperature_range":1.3,"total_events":239,"facilities":["dc_east"],"reliability_score":0.99,"system_health":"excellent","circuit_breaker_state":"closed"}`,
      format: "json"
    },
    yamlConfig: `# Production multi-level aggregation with reliability
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
    processors: [
      "Production input validation",
      "Multi-level grouping (sensor/location/global)",
      "Redis distributed caching",
      "Comprehensive reliability monitoring",
      "Circuit breaker output protection"
    ]
  }
];
