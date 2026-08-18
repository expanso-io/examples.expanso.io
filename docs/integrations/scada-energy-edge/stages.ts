import type { Stage } from '@site/src/components/DataPipelineExplorer/types';

export const scadaEnergyEdgeStages: Stage[] = [
  {
    id: 1,
    slug: 'adapter-output',
    title: 'Adapter output',
    description:
      'A gateway has already decoded the device protocol into a synthetic line record.',
    inputLines: [
      {
        content:
          'REG=40001;VAL=14823;UNIT=V_x100;TS=1708290845;DEVICE=RTU-07A;STATUS=0',
        indent: 0,
      },
    ],
    outputLines: [
      {
        content:
          'REG=40001;VAL=14823;UNIT=V_x100;TS=1708290845;DEVICE=RTU-07A;STATUS=0',
        indent: 0,
      },
    ],
  },
  {
    id: 2,
    slug: 'parse-decoded-fields',
    title: 'Parse decoded fields',
    description:
      'The mapping applies the example register map and scaling; it does not decode Modbus.',
    inputLines: [
      {
        content:
          'REG=40001;VAL=14823;UNIT=V_x100;TS=1708290845;DEVICE=RTU-07A;STATUS=0',
        indent: 0,
      },
    ],
    outputLines: [
      { content: '{', indent: 0 },
      {
        content: '"voltage_kv": 148.23,',
        indent: 1,
        key: 'voltage_kv',
        valueType: 'number',
        type: 'added',
      },
      {
        content: '"device_id": "RTU-07A",',
        indent: 1,
        key: 'device_id',
        valueType: 'string',
        type: 'added',
      },
      {
        content: '"register": 40001,',
        indent: 1,
        key: 'register',
        valueType: 'number',
        type: 'added',
      },
      {
        content: '"raw_value": 14823,',
        indent: 1,
        key: 'raw_value',
        valueType: 'number',
        type: 'added',
      },
      {
        content: '"status": 0,',
        indent: 1,
        key: 'status',
        valueType: 'number',
        type: 'added',
      },
      {
        content: '"@timestamp": 1708290845',
        indent: 1,
        key: '@timestamp',
        valueType: 'number',
        type: 'added',
      },
      { content: '}', indent: 0 },
    ],
  },
  {
    id: 3,
    slug: 'select-and-label',
    title: 'Select and label',
    description:
      'A nonzero adapter status retains this synthetic record and receives a neutral review label.',
    inputLines: [
      { content: '{', indent: 0 },
      {
        content: '"voltage_kv": 104.5,',
        indent: 1,
        key: 'voltage_kv',
        valueType: 'number',
      },
      {
        content: '"device_id": "RTU-07A",',
        indent: 1,
        key: 'device_id',
        valueType: 'string',
      },
      {
        content: '"adapter_status": 2',
        indent: 1,
        key: 'adapter_status',
        valueType: 'number',
      },
      { content: '}', indent: 0 },
    ],
    outputLines: [
      { content: '{', indent: 0 },
      {
        content: '"voltage_kv": 104.5,',
        indent: 1,
        key: 'voltage_kv',
        valueType: 'number',
      },
      {
        content: '"device_id": "RTU-07A",',
        indent: 1,
        key: 'device_id',
        valueType: 'string',
      },
      {
        content: '"adapter_status": 2,',
        indent: 1,
        key: 'adapter_status',
        valueType: 'number',
      },
      {
        content: '"review_class": "status-2"',
        indent: 1,
        key: 'review_class',
        valueType: 'string',
        type: 'added',
      },
      { content: '}', indent: 0 },
    ],
  },
  {
    id: 4,
    slug: 'route-selected-records',
    title: 'Route selected records',
    description:
      'The reference sends selected records to Kafka and writes the same records to a local archive.',
    inputLines: [
      { content: '{', indent: 0 },
      {
        content: '"review_class": "status-2",',
        indent: 1,
        key: 'review_class',
        valueType: 'string',
      },
      {
        content: '"device_id": "RTU-07A"',
        indent: 1,
        key: 'device_id',
        valueType: 'string',
      },
      { content: '}', indent: 0 },
    ],
    outputLines: [
      {
        content: 'Kafka: scada-review-events',
        indent: 0,
        type: 'highlighted',
      },
      {
        content: 'Local file: scada-review-events.jsonl',
        indent: 0,
        type: 'added',
      },
      {
        content: 'Delivery remains untested in this architecture example',
        indent: 0,
        type: 'comment',
      },
    ],
  },
];
