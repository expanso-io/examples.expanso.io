import type { Stage } from '@site/src/components/DataPipelineExplorer/types';

export const fanOutPatternStages: Stage[] = [
  {
    id: 1,
    title: "Stage 1: Single Destination",
    description: "Basic pipeline with single file output - the typical starting point before implementing fan-out pattern.",
    yamlFilename: "single-destination.yaml",
    yamlCode: `name: single-destination-pipeline
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
    inputLines: [

      { content: '{
  "event_id": "sensor-001", 
  "sensor_id": "temp-sensor-42",
  "timestamp": "2025-01-20T10:30:00Z",
  "temperature": 23.5,
  "humidity": 65.2,
  "device_type": "environmental_sensor"
}', indent: 0 }

    ],
    outputLines: [

      { content: 'name: single-destination-pipeline
type: pipeline

config:
  input:
    http_server:
      address: 0.0.0.0:8080
      path: /events

  output:
    file:
      path: /var/data/events.jsonl
      codec: lines', indent: 0 }

    ],
  },
  {
    id: 2,
    title: "Stage 2: Broker Fan-Out Foundation",
    description: "Introduction of broker output with fan_out pattern enabling concurrent delivery to multiple destinations.",
    yamlFilename: "fan-out-foundation.yaml",
    yamlCode: `name: fan-out-foundation
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
    inputLines: [

      { content: '{
  "event_id": "sensor-001",
  "sensor_id": "temp-sensor-42", 
  "timestamp": "2025-01-20T10:30:00Z",
  "temperature": 23.5,
  "humidity": 65.2,
  "device_type": "environmental_sensor"
}', indent: 0 }

    ],
    outputLines: [

      { content: 'name: fan-out-foundation
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
            batching: {count: 1000, period: 30s}', indent: 0 }

    ],
  },
  {
    id: 3,
    title: "Stage 3: Kafka Real-Time Streaming",
    description: "Real-time streaming destination added with optimized batching for low-latency message delivery.",
    yamlFilename: "kafka-fan-out.yaml",
    yamlCode: `name: kafka-fan-out
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
    inputLines: [

      { content: '{
  "event_id": "sensor-001",
  "sensor_id": "temp-sensor-42",
  "timestamp": "2025-01-20T10:30:00Z", 
  "temperature": 23.5,
  "humidity": 65.2,
  "device_type": "environmental_sensor",
  "edge_node_id": "edge-01"
}', indent: 0 }

    ],
    outputLines: [

      { content: 'name: kafka-fan-out
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
            batching: {count: 1000, period: 30s}', indent: 0 }

    ],
  },
  {
    id: 4,
    title: "Stage 4: S3 Long-Term Archive",
    description: "Long-term storage destination with large batches and compression for cost-efficient archival and compliance.",
    yamlFilename: "s3-fan-out.yaml",
    yamlCode: `name: s3-fan-out
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
    inputLines: [

      { content: '{
  "event_id": "sensor-001",
  "sensor_id": "temp-sensor-42",
  "timestamp": "2025-01-20T10:30:00Z",
  "temperature": 23.5, 
  "humidity": 65.2,
  "device_type": "environmental_sensor",
  "edge_node_id": "edge-01"
}', indent: 0 }

    ],
    outputLines: [

      { content: 'name: s3-fan-out
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
              secret: \${AWS_SECRET_ACCESS_KEY}', indent: 0 }

    ],
  },
  {
    id: 5,
    title: "Stage 5: Elasticsearch Search & Analytics",
    description: "Search and analytics destination with balanced batching for near real-time indexing and operational monitoring.",
    yamlFilename: "complete-fan-out.yaml",
    yamlCode: `name: complete-fan-out
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
    inputLines: [

      { content: '{
  "event_id": "sensor-001",
  "sensor_id": "temp-sensor-42",
  "timestamp": "2025-01-20T10:30:00Z",
  "temperature": 23.5,
  "humidity": 65.2,
  "device_type": "environmental_sensor", 
  "edge_node_id": "edge-01"
}', indent: 0 }

    ],
    outputLines: [

      { content: 'name: complete-fan-out
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
              password: \${ES_PASSWORD}', indent: 0 }

    ],
  }
];
