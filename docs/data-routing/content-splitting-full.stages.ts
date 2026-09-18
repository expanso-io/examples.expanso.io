import type { Stage } from '@site/src/components/DataPipelineExplorer/types';

export const contentSplittingStages: Stage[] = [
  {
    id: 1,
    slug: 'original-bundled-message',
    title: 'Original Bundled Message',
    description:
      'Start with one synthetic message containing an array of sensor readings.',

    inputLines: [
      { content: '{', indent: 0 },
      {
        content: '"device_id": "sensor-001",',
        indent: 1,
        key: 'device_id',
        valueType: 'string',
      },
      {
        content: '"timestamp": "2025-10-20T10:00:00Z",',
        indent: 1,
        key: 'timestamp',
        valueType: 'string',
      },
      {
        content: '"location": "warehouse-a",',
        indent: 1,
        key: 'location',
        valueType: 'string',
      },
      { content: '"readings": [', indent: 1 },
      {
        content: '{"sensor": "temp-1", "value": 72.5, "unit": "F"},',
        indent: 2,
      },
      {
        content: '{"sensor": "temp-2", "value": 85.3, "unit": "F"},',
        indent: 2,
      },
      {
        content: '{"sensor": "temp-3", "value": 68.1, "unit": "F"}',
        indent: 2,
      },
      { content: ']', indent: 1 },
      { content: '}', indent: 0 },
    ],
    outputLines: [
      { content: '{', indent: 0 },
      {
        content: '"device_id": "sensor-001",',
        indent: 1,
        key: 'device_id',
        valueType: 'string',
      },
      {
        content: '"timestamp": "2025-10-20T10:00:00Z",',
        indent: 1,
        key: 'timestamp',
        valueType: 'string',
      },
      {
        content: '"location": "warehouse-a",',
        indent: 1,
        key: 'location',
        valueType: 'string',
      },
      { content: '"readings": [', indent: 1 },
      {
        content: '{"sensor": "temp-1", "value": 72.5, "unit": "F"},',
        indent: 2,
      },
      {
        content: '{"sensor": "temp-2", "value": 85.3, "unit": "F"},',
        indent: 2,
      },
      {
        content: '{"sensor": "temp-3", "value": 68.1, "unit": "F"}',
        indent: 2,
      },
      { content: ']', indent: 1 },
      { content: '}', indent: 0 },
    ],
  },
  {
    id: 2,
    slug: 'store-parent-context',
    title: 'Store Parent Context',
    description:
      'Copy selected parent fields to metadata before splitting the array.',

    inputLines: [
      { content: '{', indent: 0 },
      {
        content: '"device_id": "sensor-001",',
        indent: 1,
        key: 'device_id',
        valueType: 'string',
      },
      {
        content: '"timestamp": "2025-10-20T10:00:00Z",',
        indent: 1,
        key: 'timestamp',
        valueType: 'string',
      },
      {
        content: '"location": "warehouse-a",',
        indent: 1,
        key: 'location',
        valueType: 'string',
      },
      { content: '"readings": [', indent: 1 },
      {
        content: '{"sensor": "temp-1", "value": 72.5, "unit": "F"},',
        indent: 2,
      },
      {
        content: '{"sensor": "temp-2", "value": 85.3, "unit": "F"},',
        indent: 2,
      },
      {
        content: '{"sensor": "temp-3", "value": 68.1, "unit": "F"}',
        indent: 2,
      },
      { content: ']', indent: 1 },
      { content: '}', indent: 0 },
    ],
    outputLines: [
      { content: '{', indent: 0 },
      {
        content: '"device_id": "sensor-001",',
        indent: 1,
        key: 'device_id',
        valueType: 'string',
      },
      {
        content: '"timestamp": "2025-10-20T10:00:00Z",',
        indent: 1,
        key: 'timestamp',
        valueType: 'string',
      },
      {
        content: '"location": "warehouse-a",',
        indent: 1,
        key: 'location',
        valueType: 'string',
      },
      { content: '"readings": [', indent: 1 },
      {
        content: '{"sensor": "temp-1", "value": 72.5, "unit": "F"},',
        indent: 2,
      },
      {
        content: '{"sensor": "temp-2", "value": 85.3, "unit": "F"},',
        indent: 2,
      },
      {
        content: '{"sensor": "temp-3", "value": 68.1, "unit": "F"}',
        indent: 2,
      },
      { content: ']', indent: 1 },
      { content: '"_metadata": {', indent: 1, type: 'highlighted' },
      {
        content: '"device_id": "sensor-001",',
        indent: 2,
        key: 'device_id',
        valueType: 'string',
        type: 'highlighted',
      },
      {
        content: '"timestamp": "2025-10-20T10:00:00Z",',
        indent: 2,
        key: 'timestamp',
        valueType: 'string',
        type: 'highlighted',
      },
      {
        content: '"location": "warehouse-a"',
        indent: 2,
        key: 'location',
        valueType: 'string',
        type: 'highlighted',
      },
      { content: '}', indent: 1, type: 'highlighted' },
      { content: '}', indent: 0 },
    ],
  },
  {
    id: 3,
    slug: 'split-array-into-individual-messages',
    title: 'Split Array into Individual Messages',
    description:
      'Use the configured processor to emit one authored message per array element.',

    inputLines: [
      { content: '{', indent: 0 },
      {
        content: '"device_id": "sensor-001",',
        indent: 1,
        key: 'device_id',
        valueType: 'string',
      },
      {
        content: '"timestamp": "2025-10-20T10:00:00Z",',
        indent: 1,
        key: 'timestamp',
        valueType: 'string',
      },
      {
        content: '"location": "warehouse-a",',
        indent: 1,
        key: 'location',
        valueType: 'string',
      },
      { content: '"readings": [', indent: 1 },
      {
        content: '{"sensor": "temp-1", "value": 72.5, "unit": "F"},',
        indent: 2,
      },
      {
        content: '{"sensor": "temp-2", "value": 85.3, "unit": "F"},',
        indent: 2,
      },
      {
        content: '{"sensor": "temp-3", "value": 68.1, "unit": "F"}',
        indent: 2,
      },
      { content: ']', indent: 1 },
      { content: '}', indent: 0 },
    ],
    outputLines: [
      { content: '# Message 1:', indent: 0, type: 'highlighted' },
      {
        content: '{"sensor": "temp-1", "value": 72.5, "unit": "F"}',
        indent: 0,
        type: 'highlighted',
      },
      { content: '', indent: 0 },
      { content: '# Message 2:', indent: 0, type: 'highlighted' },
      {
        content: '{"sensor": "temp-2", "value": 85.3, "unit": "F"}',
        indent: 0,
        type: 'highlighted',
      },
      { content: '', indent: 0 },
      { content: '# Message 3:', indent: 0, type: 'highlighted' },
      {
        content: '{"sensor": "temp-3", "value": 68.1, "unit": "F"}',
        indent: 0,
        type: 'highlighted',
      },
    ],
  },
  {
    id: 4,
    slug: 'restore-parent-context',
    title: 'Restore Parent Context',
    description:
      'Restore explicitly selected parent context from metadata into each authored output.',

    inputLines: [
      { content: '# Message 1:', indent: 0 },
      {
        content: '{"sensor": "temp-1", "value": 72.5, "unit": "F"}',
        indent: 0,
      },
      { content: '', indent: 0 },
      { content: '# Message 2:', indent: 0 },
      {
        content: '{"sensor": "temp-2", "value": 85.3, "unit": "F"}',
        indent: 0,
      },
      { content: '', indent: 0 },
      { content: '# Message 3:', indent: 0 },
      {
        content: '{"sensor": "temp-3", "value": 68.1, "unit": "F"}',
        indent: 0,
      },
    ],
    outputLines: [
      { content: '# Message 1:', indent: 0, type: 'highlighted' },
      { content: '{', indent: 0, type: 'highlighted' },
      {
        content: '"sensor": "temp-1",',
        indent: 1,
        key: 'sensor',
        valueType: 'string',
        type: 'highlighted',
      },
      {
        content: '"value": 72.5,',
        indent: 1,
        key: 'value',
        valueType: 'number',
        type: 'highlighted',
      },
      {
        content: '"unit": "F",',
        indent: 1,
        key: 'unit',
        valueType: 'string',
        type: 'highlighted',
      },
      {
        content: '"device_id": "sensor-001",',
        indent: 1,
        key: 'device_id',
        valueType: 'string',
        type: 'highlighted',
      },
      {
        content: '"timestamp": "2025-10-20T10:00:00Z",',
        indent: 1,
        key: 'timestamp',
        valueType: 'string',
        type: 'highlighted',
      },
      {
        content: '"location": "warehouse-a"',
        indent: 1,
        key: 'location',
        valueType: 'string',
        type: 'highlighted',
      },
      { content: '}', indent: 0, type: 'highlighted' },
      { content: '', indent: 0 },
      { content: '# Message 2 and 3 similarly enriched...', indent: 0 },
    ],
  },
  {
    id: 5,
    slug: 'content-based-routing',
    title: 'Content-Based Routing',
    description:
      'Route the split records to named outputs from an authored temperature threshold.',

    inputLines: [
      { content: '# Message 1:', indent: 0 },
      {
        content:
          '{"sensor": "temp-1", "value": 72.5, "unit": "F", "device_id": "sensor-001", "location": "warehouse-a"}',
        indent: 0,
      },
      { content: '', indent: 0 },
      { content: '# Message 2:', indent: 0 },
      {
        content:
          '{"sensor": "temp-2", "value": 85.3, "unit": "F", "device_id": "sensor-001", "location": "warehouse-a"}',
        indent: 0,
      },
      { content: '', indent: 0 },
      { content: '# Message 3:', indent: 0 },
      {
        content:
          '{"sensor": "temp-3", "value": 68.1, "unit": "F", "device_id": "sensor-001", "location": "warehouse-a"}',
        indent: 0,
      },
    ],
    outputLines: [
      {
        content: '# Critical Alert (temp-2 = 85.3°F):',
        indent: 0,
        type: 'highlighted',
      },
      {
        content: 'Destination: http://alerts.company.com/critical',
        indent: 0,
        type: 'highlighted',
      },
      {
        content:
          '{"sensor": "temp-2", "value": 85.3, "alert_level": "critical", ...}',
        indent: 0,
        type: 'highlighted',
      },
      { content: '', indent: 0 },
      {
        content: '# Normal Storage (temp-1 = 72.5°F, temp-3 = 68.1°F):',
        indent: 0,
      },
      { content: 'Destination: s3://temperature-storage/normal/', indent: 0 },
      {
        content:
          '{"sensor": "temp-1", "value": 72.5, "alert_level": "normal", ...}',
        indent: 0,
      },
      {
        content:
          '{"sensor": "temp-3", "value": 68.1, "alert_level": "normal", ...}',
        indent: 0,
      },
    ],
  },
];
