import type { Stage } from '@site/src/components/DataPipelineExplorer/types';

export const contentSplittingStages: Stage[] = [
  {
    stage: 1,
    title: "Original Bundled Message",
    description: "Single message containing multiple sensor readings bundled in an array. This format is efficient for transport but prevents individual routing and processing.",
    yaml: `# Original input - bundled sensor array
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
    input: {
      "device_id": "sensor-001",
      "timestamp": "2025-10-20T10:00:00Z", 
      "location": "warehouse-a",
      "readings": [
        {"sensor": "temp-1", "value": 72.5, "unit": "F"},
        {"sensor": "temp-2", "value": 85.3, "unit": "F"}, 
        {"sensor": "temp-3", "value": 68.1, "unit": "F"}
      ]
    },
    output: {
      "device_id": "sensor-001",
      "timestamp": "2025-10-20T10:00:00Z",
      "location": "warehouse-a", 
      "readings": [
        {"sensor": "temp-1", "value": 72.5, "unit": "F"},
        {"sensor": "temp-2", "value": 85.3, "unit": "F"},
        {"sensor": "temp-3", "value": 68.1, "unit": "F"}
      ]
    }
  },
  {
    stage: 2,
    title: "Store Parent Context",
    description: "Before splitting, store the parent message context (device_id, timestamp, location) in metadata. This ensures child messages retain critical information.",
    yaml: `# Store parent context before splitting
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
    input: {
      "device_id": "sensor-001",
      "timestamp": "2025-10-20T10:00:00Z",
      "location": "warehouse-a",
      "readings": [
        {"sensor": "temp-1", "value": 72.5, "unit": "F"},
        {"sensor": "temp-2", "value": 85.3, "unit": "F"},
        {"sensor": "temp-3", "value": 68.1, "unit": "F"}
      ]
    },
    output: {
      "device_id": "sensor-001",
      "timestamp": "2025-10-20T10:00:00Z",
      "location": "warehouse-a",
      "readings": [
        {"sensor": "temp-1", "value": 72.5, "unit": "F"},
        {"sensor": "temp-2", "value": 85.3, "unit": "F"}, 
        {"sensor": "temp-3", "value": 68.1, "unit": "F"}
      ],
      "_metadata": {
        "device_id": "sensor-001",
        "timestamp": "2025-10-20T10:00:00Z",
        "location": "warehouse-a"
      }
    }
  },
  {
    stage: 3,
    title: "Split Array into Individual Messages",
    description: "Use the unarchive processor to split the readings array. Each array element becomes a separate message. The original message structure is replaced.",
    yaml: `pipeline:
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
    input: {
      "device_id": "sensor-001",
      "timestamp": "2025-10-20T10:00:00Z",
      "location": "warehouse-a",
      "readings": [
        {"sensor": "temp-1", "value": 72.5, "unit": "F"},
        {"sensor": "temp-2", "value": 85.3, "unit": "F"},
        {"sensor": "temp-3", "value": 68.1, "unit": "F"}
      ]
    },
    output: [
      {"sensor": "temp-1", "value": 72.5, "unit": "F"},
      {"sensor": "temp-2", "value": 85.3, "unit": "F"},
      {"sensor": "temp-3", "value": 68.1, "unit": "F"}
    ]
  },
  {
    stage: 4,
    title: "Restore Parent Context",
    description: "After splitting, each message only contains the array element data. Restore the parent context from metadata to create complete individual messages.",
    yaml: `pipeline:
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
    input: [
      {"sensor": "temp-1", "value": 72.5, "unit": "F"},
      {"sensor": "temp-2", "value": 85.3, "unit": "F"},
      {"sensor": "temp-3", "value": 68.1, "unit": "F"}
    ],
    output: [
      {
        "sensor": "temp-1",
        "value": 72.5, 
        "unit": "F",
        "device_id": "sensor-001",
        "timestamp": "2025-10-20T10:00:00Z",
        "location": "warehouse-a"
      },
      {
        "sensor": "temp-2",
        "value": 85.3,
        "unit": "F", 
        "device_id": "sensor-001",
        "timestamp": "2025-10-20T10:00:00Z",
        "location": "warehouse-a"
      },
      {
        "sensor": "temp-3", 
        "value": 68.1,
        "unit": "F",
        "device_id": "sensor-001",
        "timestamp": "2025-10-20T10:00:00Z",
        "location": "warehouse-a"
      }
    ]
  },
  {
    stage: 5,
    title: "Content-Based Routing",
    description: "Now that each reading is a separate message with full context, route based on temperature value. High temperatures go to alerts, normal temperatures to storage.",
    yaml: `pipeline:
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
    input: [
      {
        "sensor": "temp-1",
        "value": 72.5,
        "unit": "F", 
        "device_id": "sensor-001",
        "timestamp": "2025-10-20T10:00:00Z",
        "location": "warehouse-a"
      },
      {
        "sensor": "temp-2",
        "value": 85.3,
        "unit": "F",
        "device_id": "sensor-001", 
        "timestamp": "2025-10-20T10:00:00Z",
        "location": "warehouse-a"
      },
      {
        "sensor": "temp-3",
        "value": 68.1,
        "unit": "F",
        "device_id": "sensor-001",
        "timestamp": "2025-10-20T10:00:00Z",
        "location": "warehouse-a"
      }
    ],
    output: {
      "critical_alerts": [
        {
          "sensor": "temp-2",
          "value": 85.3,
          "unit": "F",
          "device_id": "sensor-001",
          "timestamp": "2025-10-20T10:00:00Z", 
          "location": "warehouse-a",
          "alert_level": "critical",
          "destination": "http://alerts.company.com/critical"
        }
      ],
      "normal_storage": [
        {
          "sensor": "temp-1", 
          "value": 72.5,
          "unit": "F",
          "device_id": "sensor-001",
          "timestamp": "2025-10-20T10:00:00Z",
          "location": "warehouse-a",
          "alert_level": "normal",
          "destination": "s3://temperature-storage/normal/"
        },
        {
          "sensor": "temp-3",
          "value": 68.1,
          "unit": "F", 
          "device_id": "sensor-001",
          "timestamp": "2025-10-20T10:00:00Z",
          "location": "warehouse-a",
          "alert_level": "normal",
          "destination": "s3://temperature-storage/normal/"
        }
      ]
    }
  }
];
