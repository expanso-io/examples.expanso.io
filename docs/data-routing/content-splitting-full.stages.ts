import type { Stage } from '@site/src/components/DataPipelineExplorer/types';

export const contentSplittingStages: Stage[] = [
  {
    id: 1,
    title: "Original Bundled Message",
    description: "Single message containing multiple sensor readings bundled in an array. This format is efficient for transport but prevents individual routing and processing.",
    yamlFilename: 'pipeline.yaml',

    yamlCode: `# Original input - bundled sensor array
input:
  http_server:
    address: 0.0.0.0:8080
    path: /sensors/bulk

# No processing yet - raw input
pipeline:
  processors: []

output:
  file:
    path: /var/log/raw-input.jsonl`,
    inputLines: [
      { content: '{', indent: 0 },
      { content: '"device_id": "sensor-001",', indent: 1, key: 'device_id', valueType: 'string' },
      { content: '"timestamp": "2025-10-20T10:00:00Z",', indent: 1, key: 'timestamp', valueType: 'string' },
      { content: '"location": "warehouse-a",', indent: 1, key: 'location', valueType: 'string' },
      { content: '"readings": [', indent: 1 },
      { content: '{"sensor": "temp-1", "value": 72.5, "unit": "F"},', indent: 2 },
      { content: '{"sensor": "temp-2", "value": 85.3, "unit": "F"},', indent: 2 },
      { content: '{"sensor": "temp-3", "value": 68.1, "unit": "F"}', indent: 2 },
      { content: ']', indent: 1 },
      { content: '}', indent: 0 },
    ],
    outputLines: [
      { content: '{', indent: 0 },
      { content: '"device_id": "sensor-001",', indent: 1, key: 'device_id', valueType: 'string' },
      { content: '"timestamp": "2025-10-20T10:00:00Z",', indent: 1, key: 'timestamp', valueType: 'string' },
      { content: '"location": "warehouse-a",', indent: 1, key: 'location', valueType: 'string' },
      { content: '"readings": [', indent: 1 },
      { content: '{"sensor": "temp-1", "value": 72.5, "unit": "F"},', indent: 2 },
      { content: '{"sensor": "temp-2", "value": 85.3, "unit": "F"},', indent: 2 },
      { content: '{"sensor": "temp-3", "value": 68.1, "unit": "F"}', indent: 2 },
      { content: ']', indent: 1 },
      { content: '}', indent: 0 },
    ],
  },
  {
    id: 2,
    title: "Store Parent Context",
    description: "Before splitting, store the parent message context (device_id, timestamp, location) in metadata. This ensures child messages retain critical information.",
    yamlFilename: 'pipeline.yaml',

    yamlCode: `# Store parent context before splitting
pipeline:
  processors:
    # Store critical parent context
    - mapping: |
        meta device_id = this.device_id
        meta timestamp = this.timestamp
        meta location = this.location
        root = this

output:
  file:
    path: /var/log/context-stored.jsonl`,
    inputLines: [
      { content: '{', indent: 0 },
      { content: '"device_id": "sensor-001",', indent: 1, key: 'device_id', valueType: 'string' },
      { content: '"timestamp": "2025-10-20T10:00:00Z",', indent: 1, key: 'timestamp', valueType: 'string' },
      { content: '"location": "warehouse-a",', indent: 1, key: 'location', valueType: 'string' },
      { content: '"readings": [', indent: 1 },
      { content: '{"sensor": "temp-1", "value": 72.5, "unit": "F"},', indent: 2 },
      { content: '{"sensor": "temp-2", "value": 85.3, "unit": "F"},', indent: 2 },
      { content: '{"sensor": "temp-3", "value": 68.1, "unit": "F"}', indent: 2 },
      { content: ']', indent: 1 },
      { content: '}', indent: 0 },
    ],
    outputLines: [
      { content: '{', indent: 0 },
      { content: '"device_id": "sensor-001",', indent: 1, key: 'device_id', valueType: 'string' },
      { content: '"timestamp": "2025-10-20T10:00:00Z",', indent: 1, key: 'timestamp', valueType: 'string' },
      { content: '"location": "warehouse-a",', indent: 1, key: 'location', valueType: 'string' },
      { content: '"readings": [', indent: 1 },
      { content: '{"sensor": "temp-1", "value": 72.5, "unit": "F"},', indent: 2 },
      { content: '{"sensor": "temp-2", "value": 85.3, "unit": "F"},', indent: 2 },
      { content: '{"sensor": "temp-3", "value": 68.1, "unit": "F"}', indent: 2 },
      { content: ']', indent: 1 },
      { content: '"_metadata": {', indent: 1, type: 'highlighted' },
      { content: '"device_id": "sensor-001",', indent: 2, key: 'device_id', valueType: 'string', type: 'highlighted' },
      { content: '"timestamp": "2025-10-20T10:00:00Z",', indent: 2, key: 'timestamp', valueType: 'string', type: 'highlighted' },
      { content: '"location": "warehouse-a"', indent: 2, key: 'location', valueType: 'string', type: 'highlighted' },
      { content: '}', indent: 1, type: 'highlighted' },
      { content: '}', indent: 0 },
    ],
  },
  {
    id: 3,
    title: "Split Array into Individual Messages",
    description: "Use the unarchive processor to split the readings array. Each array element becomes a separate message. The original message structure is replaced.",
    yamlFilename: 'pipeline.yaml',

    yamlCode: `pipeline:
  processors:
    - mapping: |
        meta device_id = this.device_id
        meta timestamp = this.timestamp  
        meta location = this.location
        root = this
        
    # Split the readings array
    - unarchive:
        format: json_array
        field: readings

output:
  file:
    path: /var/log/split-messages.jsonl`,
    inputLines: [
      { content: '{', indent: 0 },
      { content: '"device_id": "sensor-001",', indent: 1, key: 'device_id', valueType: 'string' },
      { content: '"timestamp": "2025-10-20T10:00:00Z",', indent: 1, key: 'timestamp', valueType: 'string' },
      { content: '"location": "warehouse-a",', indent: 1, key: 'location', valueType: 'string' },
      { content: '"readings": [', indent: 1 },
      { content: '{"sensor": "temp-1", "value": 72.5, "unit": "F"},', indent: 2 },
      { content: '{"sensor": "temp-2", "value": 85.3, "unit": "F"},', indent: 2 },
      { content: '{"sensor": "temp-3", "value": 68.1, "unit": "F"}', indent: 2 },
      { content: ']', indent: 1 },
      { content: '}', indent: 0 },
    ],
    outputLines: [
      { content: '# Message 1:', indent: 0, type: 'highlighted' },
      { content: '{"sensor": "temp-1", "value": 72.5, "unit": "F"}', indent: 0, type: 'highlighted' },
      { content: '', indent: 0 },
      { content: '# Message 2:', indent: 0, type: 'highlighted' },
      { content: '{"sensor": "temp-2", "value": 85.3, "unit": "F"}', indent: 0, type: 'highlighted' },
      { content: '', indent: 0 },
      { content: '# Message 3:', indent: 0, type: 'highlighted' },
      { content: '{"sensor": "temp-3", "value": 68.1, "unit": "F"}', indent: 0, type: 'highlighted' },
    ],
  },
  {
    id: 4,
    title: "Restore Parent Context",
    description: "After splitting, each message only contains the array element data. Restore the parent context from metadata to create complete individual messages.",
    yamlFilename: 'pipeline.yaml',

    yamlCode: `pipeline:
  processors:
    - mapping: |
        meta device_id = this.device_id
        meta timestamp = this.timestamp
        meta location = this.location
        root = this
        
    - unarchive:
        format: json_array
        field: readings
        
    # Restore parent context to each split message
    - mapping: |
        root = this
        root.device_id = meta("device_id")
        root.timestamp = meta("timestamp") 
        root.location = meta("location")

output:
  file:
    path: /var/log/enriched-messages.jsonl`,
    inputLines: [
      { content: '# Message 1:', indent: 0 },
      { content: '{"sensor": "temp-1", "value": 72.5, "unit": "F"}', indent: 0 },
      { content: '', indent: 0 },
      { content: '# Message 2:', indent: 0 },
      { content: '{"sensor": "temp-2", "value": 85.3, "unit": "F"}', indent: 0 },
      { content: '', indent: 0 },
      { content: '# Message 3:', indent: 0 },
      { content: '{"sensor": "temp-3", "value": 68.1, "unit": "F"}', indent: 0 },
    ],
    outputLines: [
      { content: '# Message 1:', indent: 0, type: 'highlighted' },
      { content: '{', indent: 0, type: 'highlighted' },
      { content: '"sensor": "temp-1",', indent: 1, key: 'sensor', valueType: 'string', type: 'highlighted' },
      { content: '"value": 72.5,', indent: 1, key: 'value', valueType: 'number', type: 'highlighted' },
      { content: '"unit": "F",', indent: 1, key: 'unit', valueType: 'string', type: 'highlighted' },
      { content: '"device_id": "sensor-001",', indent: 1, key: 'device_id', valueType: 'string', type: 'highlighted' },
      { content: '"timestamp": "2025-10-20T10:00:00Z",', indent: 1, key: 'timestamp', valueType: 'string', type: 'highlighted' },
      { content: '"location": "warehouse-a"', indent: 1, key: 'location', valueType: 'string', type: 'highlighted' },
      { content: '}', indent: 0, type: 'highlighted' },
      { content: '', indent: 0 },
      { content: '# Message 2 and 3 similarly enriched...', indent: 0 },
    ],
  },
  {
    id: 5,
    title: "Content-Based Routing",
    description: "Now that each reading is a separate message with full context, route based on temperature value. High temperatures go to alerts, normal temperatures to storage.",
    yamlFilename: 'pipeline.yaml',

    yamlCode: `pipeline:
  processors:
    - mapping: |
        meta device_id = this.device_id
        meta timestamp = this.timestamp
        meta location = this.location
        root = this
        
    - unarchive:
        format: json_array
        field: readings
        
    - mapping: |
        root = this
        root.device_id = meta("device_id")
        root.timestamp = meta("timestamp")
        root.location = meta("location")
        
        # Add alert classification
        root.alert_level = match {
          this.value >= 80 => "critical"
          this.value >= 75 => "warning"  
          _ => "normal"
        }

# Route based on individual temperature values
output:
  switch:
    cases:
      - check: this.alert_level == "critical"
        output:
          http_client:
            url: http://alerts.company.com/critical
            verb: POST
      - check: this.alert_level == "warning" 
        output:
          kafka:
            topic: temperature-warnings
            addresses: ["kafka:9092"]
      - output:
          s3:
            bucket: temperature-storage
            path: normal/\${timestamp_date()}/`,
    inputLines: [
      { content: '# Message 1:', indent: 0 },
      { content: '{"sensor": "temp-1", "value": 72.5, "unit": "F", "device_id": "sensor-001", "location": "warehouse-a"}', indent: 0 },
      { content: '', indent: 0 },
      { content: '# Message 2:', indent: 0 },
      { content: '{"sensor": "temp-2", "value": 85.3, "unit": "F", "device_id": "sensor-001", "location": "warehouse-a"}', indent: 0 },
      { content: '', indent: 0 },
      { content: '# Message 3:', indent: 0 },
      { content: '{"sensor": "temp-3", "value": 68.1, "unit": "F", "device_id": "sensor-001", "location": "warehouse-a"}', indent: 0 },
    ],
    outputLines: [
      { content: '# Critical Alert (temp-2 = 85.3°F):', indent: 0, type: 'highlighted' },
      { content: 'Destination: http://alerts.company.com/critical', indent: 0, type: 'highlighted' },
      { content: '{"sensor": "temp-2", "value": 85.3, "alert_level": "critical", ...}', indent: 0, type: 'highlighted' },
      { content: '', indent: 0 },
      { content: '# Normal Storage (temp-1 = 72.5°F, temp-3 = 68.1°F):', indent: 0 },
      { content: 'Destination: s3://temperature-storage/normal/', indent: 0 },
      { content: '{"sensor": "temp-1", "value": 72.5, "alert_level": "normal", ...}', indent: 0 },
      { content: '{"sensor": "temp-3", "value": 68.1, "alert_level": "normal", ...}', indent: 0 },
    ],
  }
];
