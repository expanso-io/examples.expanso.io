export const fanOutPatternStages = [
  {
    title: "Stage 1: Single Destination",
    description: "Basic pipeline with single file output - the typical starting point before implementing fan-out pattern.",
    input: `{
  "event_id": "sensor-001", 
  "sensor_id": "temp-sensor-42",
  "timestamp": "2025-01-20T10:30:00Z",
  "temperature": 23.5,
  "humidity": 65.2,
  "device_type": "environmental_sensor"
}`,
    output: `name: single-destination-pipeline
type: pipeline

config:
  input:
    http_server:
      address: 0.0.0.0:8080
      path: /events

  output:
    file:
      path: /var/data/events.jsonl
      codec: lines`,
    yamlStage: "Single File Output",
    explanation: "Traditional single-destination pipeline sends all data to one output. Limited scalability and no redundancy."
  },
  {
    title: "Stage 2: Broker Fan-Out Foundation", 
    description: "Introduction of broker output with fan_out pattern enabling concurrent delivery to multiple destinations.",
    input: `{
  "event_id": "sensor-001",
  "sensor_id": "temp-sensor-42", 
  "timestamp": "2025-01-20T10:30:00Z",
  "temperature": 23.5,
  "humidity": 65.2,
  "device_type": "environmental_sensor"
}`,
    output: `name: fan-out-foundation
type: pipeline

config:
  input:
    http_server:
      address: 0.0.0.0:8080
      path: /events

  output:
    broker:
      pattern: fan_out
      outputs:
        - file:
            path: /var/data/realtime.jsonl
            batching: {count: 100, period: 5s}
        - file:
            path: /var/data/archive.jsonl
            batching: {count: 1000, period: 30s}`,
    yamlStage: "Broker Fan-Out",
    explanation: "Broker pattern enables concurrent delivery to multiple outputs. Each destination operates independently with custom batching."
  },
  {
    title: "Stage 3: Kafka Real-Time Streaming",
    description: "Real-time streaming destination added with optimized batching for low-latency message delivery.",
    input: `{
  "event_id": "sensor-001",
  "sensor_id": "temp-sensor-42",
  "timestamp": "2025-01-20T10:30:00Z", 
  "temperature": 23.5,
  "humidity": 65.2,
  "device_type": "environmental_sensor",
  "edge_node_id": "edge-01"
}`,
    output: `name: kafka-fan-out
type: pipeline

config:
  input:
    http_server:
      address: 0.0.0.0:8080
      path: /events

  pipeline:
    processors:
      - mapping: |
          root = this
          root.edge_node_id = env("NODE_ID")
          root.processing_timestamp = now()

  output:
    broker:
      pattern: fan_out
      outputs:
        - kafka:
            addresses: [kafka-1.example.com:9092]
            topic: sensor-events
            key: \${!json("sensor_id")}
            batching: {count: 100, period: 2s}
            compression: snappy
            sasl:
              mechanism: SCRAM-SHA-512
              user: \${KAFKA_USERNAME}
              password: \${KAFKA_PASSWORD}
        - file:
            path: /var/data/archive.jsonl
            batching: {count: 1000, period: 30s}`,
    yamlStage: "Kafka Integration", 
    explanation: "Kafka destination provides high-throughput real-time streaming with small batches (100 msgs/2s) for low latency and reliable delivery."
  },
  {
    title: "Stage 4: S3 Long-Term Archive",
    description: "Long-term storage destination with large batches and compression for cost-efficient archival and compliance.",
    input: `{
  "event_id": "sensor-001",
  "sensor_id": "temp-sensor-42",
  "timestamp": "2025-01-20T10:30:00Z",
  "temperature": 23.5, 
  "humidity": 65.2,
  "device_type": "environmental_sensor",
  "edge_node_id": "edge-01"
}`,
    output: `name: s3-fan-out
type: pipeline

config:
  input:
    http_server:
      address: 0.0.0.0:8080
      path: /events

  pipeline:
    processors:
      - mapping: |
          root = this
          root.edge_node_id = env("NODE_ID")
          root.processing_timestamp = now()

  output:
    broker:
      pattern: fan_out
      outputs:
        - kafka:
            addresses: [kafka-1.example.com:9092]
            topic: sensor-events
            batching: {count: 100, period: 2s}
        - aws_s3:
            bucket: sensor-data-archive
            path: "data/dt=\${!timestamp_unix_date(\\"2006-01-02\\")}/events.jsonl.gz"
            batching: {count: 10000, period: 30m}
            content_encoding: gzip
            storage_class: INTELLIGENT_TIERING
            credentials:
              id: \${AWS_ACCESS_KEY_ID}
              secret: \${AWS_SECRET_ACCESS_KEY}`,
    yamlStage: "S3 Archive",
    explanation: "S3 destination uses large batches (10k msgs/30min) and compression for cost-effective long-term storage with intelligent tiering."
  },
  {
    title: "Stage 5: Elasticsearch Search & Analytics", 
    description: "Search and analytics destination with balanced batching for near real-time indexing and operational monitoring.",
    input: `{
  "event_id": "sensor-001",
  "sensor_id": "temp-sensor-42",
  "timestamp": "2025-01-20T10:30:00Z",
  "temperature": 23.5,
  "humidity": 65.2,
  "device_type": "environmental_sensor", 
  "edge_node_id": "edge-01"
}`,
    output: `name: complete-fan-out
type: pipeline

config:
  input:
    http_server:
      address: 0.0.0.0:8080
      path: /events

  pipeline:
    processors:
      - mapping: |
          root = this
          root.edge_node_id = env("NODE_ID")
          root.processing_timestamp = now()
          root.analytics = {
            "event_hour": this.timestamp.parse_timestamp().ts_hour(),
            "temperature_status": if this.temperature > 35 { "high" } else { "normal" }
          }

  output:
    broker:
      pattern: fan_out
      outputs:
        - kafka:
            addresses: [kafka-1.example.com:9092]
            topic: sensor-events
            batching: {count: 100, period: 2s}
        - aws_s3:
            bucket: sensor-data-archive  
            path: "data/dt=\${!timestamp_unix_date(\\"2006-01-02\\")}/events.jsonl.gz"
            batching: {count: 10000, period: 30m}
        - elasticsearch:
            urls: [https://es-1.example.com:9200]
            index: "sensor-events-\${!timestamp_unix_date(\\"2006-01-02\\")}"
            id: \${!json("event_id")}
            batching: {count: 250, period: 10s}
            basic_auth:
              username: \${ES_USERNAME}
              password: \${ES_PASSWORD}`,
    yamlStage: "Complete Fan-Out",
    explanation: "Complete multi-destination pipeline with Kafka (real-time), S3 (archive), and Elasticsearch (search). Each optimized for its use case."
  }
];
