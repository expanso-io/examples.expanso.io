import type { Stage } from '@site/src/components/DataPipelineExplorer/types';

export const medicalDeviceIntelligenceStages: Stage[] = [
  {
    id: 1,
    slug: 'collect-synthetic-fixtures',
    title: 'Collect synthetic fixtures',
    description:
      'Read the maintenance CSV, error events JSON, and technician notes through one broker and tag each message with its source.',
    inputLines: [
      {
        content: '• maintenance-logs.csv (3 synthetic rows)',
        indent: 0,
      },
      {
        content: '• error-events.json (3 synthetic events)',
        indent: 0,
      },
      {
        content: '• technician-notes.txt (free text)',
        indent: 0,
      },
    ],
    outputLines: [
      {
        content: '{',
        indent: 0,
      },
      {
        content: '"data": {',
        indent: 1,
        key: 'data',
        valueType: 'object',
      },
      {
        content:
          '"description": "Synthetic inspection record; repeated status S1 events were attached to a fleet review.",',
        indent: 2,
        key: 'description',
        valueType: 'string',
      },
      {
        content: '"device_id": "PUMP-TEST-02",',
        indent: 2,
        key: 'device_id',
        valueType: 'string',
      },
      {
        content: '"site_zone": "LAB-B",',
        indent: 2,
        key: 'site_zone',
        valueType: 'string',
      },
      {
        content: '"technician_alias": "TECH-02",',
        indent: 2,
        key: 'technician_alias',
        valueType: 'string',
      },
      {
        content: '"timestamp": "2026-02-10T09:32:00Z"',
        indent: 2,
        key: 'timestamp',
        valueType: 'string',
      },
      {
        content: '},',
        indent: 1,
      },
      {
        content: '"device_id": "PUMP-TEST-02",',
        indent: 1,
        key: 'device_id',
        valueType: 'string',
        type: 'added',
      },
      {
        content: '"source": "maintenance_log",',
        indent: 1,
        key: 'source',
        valueType: 'string',
        type: 'added',
      },
      {
        content: '"timestamp": "2026-02-10T09:32:00Z"',
        indent: 1,
        key: 'timestamp',
        valueType: 'string',
        type: 'added',
      },
      {
        content: '}',
        indent: 0,
      },
      {
        content: '{',
        indent: 0,
      },
      {
        content: '"data": [',
        indent: 1,
        key: 'data',
        valueType: 'array',
      },
      {
        content: '{',
        indent: 2,
      },
      {
        content: '"adapter_status": 2,',
        indent: 3,
        key: 'adapter_status',
        valueType: 'number',
      },
      {
        content: '"device_id": "VENT-TEST-01",',
        indent: 3,
        key: 'device_id',
        valueType: 'string',
      },
      {
        content: '"event_code": "SENSOR-STATUS-S2",',
        indent: 3,
        key: 'event_code',
        valueType: 'string',
      },
      {
        content:
          '"message": "Synthetic sensor-status event for architecture testing.",',
        indent: 3,
        key: 'message',
        valueType: 'string',
      },
      {
        content: '"timestamp": "2026-02-10T07:58:22Z"',
        indent: 3,
        key: 'timestamp',
        valueType: 'string',
      },
      {
        content: '}',
        indent: 2,
      },
      {
        content: '],',
        indent: 1,
      },
      {
        content: '"source": "error_events"',
        indent: 1,
        key: 'source',
        valueType: 'string',
        type: 'added',
      },
      {
        content: '}',
        indent: 0,
      },
      {
        content: '{',
        indent: 0,
      },
      {
        content:
          '"data": "Synthetic fixture notes — not customer, patient, or service data.\\n\\nTECH-01: VENT-TEST-01 prod...",',
        indent: 1,
        key: 'data',
        valueType: 'string',
      },
      {
        content: '"source": "technician_notes"',
        indent: 1,
        key: 'source',
        valueType: 'string',
        type: 'added',
      },
      {
        content: '}',
        indent: 0,
      },
    ],
  },
  {
    id: 2,
    slug: 'tag-each-input-message',
    title: 'Tag each input message',
    description:
      'Set a batch id and site label as message metadata; the message body passes through unchanged.',
    inputLines: [
      {
        content: '{',
        indent: 0,
      },
      {
        content: '"data": {',
        indent: 1,
        key: 'data',
        valueType: 'object',
      },
      {
        content:
          '"description": "Synthetic inspection record; repeated status S1 events were attached to a fleet review.",',
        indent: 2,
        key: 'description',
        valueType: 'string',
      },
      {
        content: '"device_id": "PUMP-TEST-02",',
        indent: 2,
        key: 'device_id',
        valueType: 'string',
      },
      {
        content: '"site_zone": "LAB-B",',
        indent: 2,
        key: 'site_zone',
        valueType: 'string',
      },
      {
        content: '"technician_alias": "TECH-02",',
        indent: 2,
        key: 'technician_alias',
        valueType: 'string',
      },
      {
        content: '"timestamp": "2026-02-10T09:32:00Z"',
        indent: 2,
        key: 'timestamp',
        valueType: 'string',
      },
      {
        content: '},',
        indent: 1,
      },
      {
        content: '"device_id": "PUMP-TEST-02",',
        indent: 1,
        key: 'device_id',
        valueType: 'string',
      },
      {
        content: '"source": "maintenance_log",',
        indent: 1,
        key: 'source',
        valueType: 'string',
      },
      {
        content: '"timestamp": "2026-02-10T09:32:00Z"',
        indent: 1,
        key: 'timestamp',
        valueType: 'string',
      },
      {
        content: '}',
        indent: 0,
      },
    ],
    outputLines: [
      {
        content: '{',
        indent: 0,
      },
      {
        content: '"data": {',
        indent: 1,
        key: 'data',
        valueType: 'object',
      },
      {
        content:
          '"description": "Synthetic inspection record; repeated status S1 events were attached to a fleet review.",',
        indent: 2,
        key: 'description',
        valueType: 'string',
      },
      {
        content: '"device_id": "PUMP-TEST-02",',
        indent: 2,
        key: 'device_id',
        valueType: 'string',
      },
      {
        content: '"site_zone": "LAB-B",',
        indent: 2,
        key: 'site_zone',
        valueType: 'string',
      },
      {
        content: '"technician_alias": "TECH-02",',
        indent: 2,
        key: 'technician_alias',
        valueType: 'string',
      },
      {
        content: '"timestamp": "2026-02-10T09:32:00Z"',
        indent: 2,
        key: 'timestamp',
        valueType: 'string',
      },
      {
        content: '},',
        indent: 1,
      },
      {
        content: '"device_id": "PUMP-TEST-02",',
        indent: 1,
        key: 'device_id',
        valueType: 'string',
      },
      {
        content: '"source": "maintenance_log",',
        indent: 1,
        key: 'source',
        valueType: 'string',
      },
      {
        content: '"timestamp": "2026-02-10T09:32:00Z"',
        indent: 1,
        key: 'timestamp',
        valueType: 'string',
      },
      {
        content: '}',
        indent: 0,
      },
      {
        content: '',
        indent: 0,
      },
      {
        content: '# metadata batch_id = "BATCH-" + timestamp',
        indent: 0,
        type: 'highlighted',
      },
      {
        content: '# metadata site = "Synthetic lab"',
        indent: 0,
        type: 'highlighted',
      },
    ],
  },
  {
    id: 3,
    slug: 'invoke-custom-analysis-code',
    title: 'Invoke custom analysis code',
    description:
      'Run the checked-in analyzer, which reloads the fixtures and returns review candidates as JSON.',
    inputLines: [
      {
        content: '{',
        indent: 0,
      },
      {
        content: '"data": {',
        indent: 1,
        key: 'data',
        valueType: 'object',
        type: 'removed',
      },
      {
        content:
          '"description": "Synthetic inspection record; repeated status S1 events were attached to a fleet review.",',
        indent: 2,
        key: 'description',
        valueType: 'string',
        type: 'removed',
      },
      {
        content: '"device_id": "PUMP-TEST-02",',
        indent: 2,
        key: 'device_id',
        valueType: 'string',
        type: 'removed',
      },
      {
        content: '"site_zone": "LAB-B",',
        indent: 2,
        key: 'site_zone',
        valueType: 'string',
        type: 'removed',
      },
      {
        content: '"technician_alias": "TECH-02",',
        indent: 2,
        key: 'technician_alias',
        valueType: 'string',
        type: 'removed',
      },
      {
        content: '"timestamp": "2026-02-10T09:32:00Z"',
        indent: 2,
        key: 'timestamp',
        valueType: 'string',
        type: 'removed',
      },
      {
        content: '},',
        indent: 1,
        type: 'removed',
      },
      {
        content: '"device_id": "PUMP-TEST-02",',
        indent: 1,
        key: 'device_id',
        valueType: 'string',
        type: 'removed',
      },
      {
        content: '"source": "maintenance_log",',
        indent: 1,
        key: 'source',
        valueType: 'string',
        type: 'removed',
      },
      {
        content: '"timestamp": "2026-02-10T09:32:00Z"',
        indent: 1,
        key: 'timestamp',
        valueType: 'string',
        type: 'removed',
      },
      {
        content: '}',
        indent: 0,
      },
    ],
    outputLines: [
      {
        content: '{',
        indent: 0,
      },
      {
        content: '"fixture_batch_id": "medical-device-synthetic-v1",',
        indent: 1,
        key: 'fixture_batch_id',
        valueType: 'string',
        type: 'added',
      },
      {
        content: '"limitations": [',
        indent: 1,
        key: 'limitations',
        valueType: 'array',
        type: 'added',
      },
      {
        content: '"Synthetic fixtures only",',
        indent: 2,
        type: 'added',
      },
      {
        content: '"Human review required",',
        indent: 2,
        type: 'added',
      },
      {
        content: '"No diagnostic, clinical, safety, or maintenance conclusion"',
        indent: 2,
        type: 'added',
      },
      {
        content: '],',
        indent: 1,
        type: 'added',
      },
      {
        content: '"review_candidates": [',
        indent: 1,
        key: 'review_candidates',
        valueType: 'array',
        type: 'added',
      },
      {
        content: '{',
        indent: 2,
        type: 'added',
      },
      {
        content: '"candidate_id": "CANDIDATE-001",',
        indent: 3,
        key: 'candidate_id',
        valueType: 'string',
        type: 'added',
      },
      {
        content: '"device_id": "VENT-TEST-01",',
        indent: 3,
        key: 'device_id',
        valueType: 'string',
        type: 'added',
      },
      {
        content: '"evidence_refs": ["SENSOR-STATUS-S2", "TECH-01"],',
        indent: 3,
        key: 'evidence_refs',
        valueType: 'array',
        type: 'added',
      },
      {
        content: '"review_reason": "Repeated synthetic status S2",',
        indent: 3,
        key: 'review_reason',
        valueType: 'string',
        type: 'added',
      },
      {
        content: '"source_signals": ["adapter-status", "maintenance-note"]',
        indent: 3,
        key: 'source_signals',
        valueType: 'array',
        type: 'added',
      },
      {
        content: '},',
        indent: 2,
        type: 'added',
      },
      {
        content: '{',
        indent: 2,
        type: 'added',
      },
      {
        content: '"candidate_id": "CANDIDATE-002",',
        indent: 3,
        key: 'candidate_id',
        valueType: 'string',
        type: 'added',
      },
      {
        content: '"device_id": "PUMP-TEST-02",',
        indent: 3,
        key: 'device_id',
        valueType: 'string',
        type: 'added',
      },
      {
        content: '"evidence_refs": ["FLOW-STATUS-S1", "TECH-02"],',
        indent: 3,
        key: 'evidence_refs',
        valueType: 'array',
        type: 'added',
      },
      {
        content: '"review_reason": "Repeated synthetic status S1",',
        indent: 3,
        key: 'review_reason',
        valueType: 'string',
        type: 'added',
      },
      {
        content: '"source_signals": ["adapter-status", "fixture-change"]',
        indent: 3,
        key: 'source_signals',
        valueType: 'array',
        type: 'added',
      },
      {
        content: '}',
        indent: 2,
        type: 'added',
      },
      {
        content: ']',
        indent: 1,
        type: 'added',
      },
      {
        content: '}',
        indent: 0,
      },
    ],
  },
  {
    id: 4,
    slug: 'shape-the-output',
    title: 'Shape the output',
    description:
      'Add the pipeline version and processing time to the analyzer result.',
    inputLines: [
      {
        content: '{',
        indent: 0,
      },
      {
        content: '"fixture_batch_id": "medical-device-synthetic-v1",',
        indent: 1,
        key: 'fixture_batch_id',
        valueType: 'string',
      },
      {
        content: '"limitations": [',
        indent: 1,
        key: 'limitations',
        valueType: 'array',
      },
      {
        content: '"Synthetic fixtures only",',
        indent: 2,
      },
      {
        content: '"Human review required",',
        indent: 2,
      },
      {
        content: '"No diagnostic, clinical, safety, or maintenance conclusion"',
        indent: 2,
      },
      {
        content: '],',
        indent: 1,
      },
      {
        content: '"review_candidates": [',
        indent: 1,
        key: 'review_candidates',
        valueType: 'array',
      },
      {
        content: '{',
        indent: 2,
      },
      {
        content: '"candidate_id": "CANDIDATE-001",',
        indent: 3,
        key: 'candidate_id',
        valueType: 'string',
      },
      {
        content: '"device_id": "VENT-TEST-01",',
        indent: 3,
        key: 'device_id',
        valueType: 'string',
      },
      {
        content: '"evidence_refs": ["SENSOR-STATUS-S2", "TECH-01"],',
        indent: 3,
        key: 'evidence_refs',
        valueType: 'array',
      },
      {
        content: '"review_reason": "Repeated synthetic status S2",',
        indent: 3,
        key: 'review_reason',
        valueType: 'string',
      },
      {
        content: '"source_signals": ["adapter-status", "maintenance-note"]',
        indent: 3,
        key: 'source_signals',
        valueType: 'array',
      },
      {
        content: '},',
        indent: 2,
      },
      {
        content: '{',
        indent: 2,
      },
      {
        content: '"candidate_id": "CANDIDATE-002",',
        indent: 3,
        key: 'candidate_id',
        valueType: 'string',
      },
      {
        content: '"device_id": "PUMP-TEST-02",',
        indent: 3,
        key: 'device_id',
        valueType: 'string',
      },
      {
        content: '"evidence_refs": ["FLOW-STATUS-S1", "TECH-02"],',
        indent: 3,
        key: 'evidence_refs',
        valueType: 'array',
      },
      {
        content: '"review_reason": "Repeated synthetic status S1",',
        indent: 3,
        key: 'review_reason',
        valueType: 'string',
      },
      {
        content: '"source_signals": ["adapter-status", "fixture-change"]',
        indent: 3,
        key: 'source_signals',
        valueType: 'array',
      },
      {
        content: '}',
        indent: 2,
      },
      {
        content: ']',
        indent: 1,
      },
      {
        content: '}',
        indent: 0,
      },
    ],
    outputLines: [
      {
        content: '{',
        indent: 0,
      },
      {
        content: '"fixture_batch_id": "medical-device-synthetic-v1",',
        indent: 1,
        key: 'fixture_batch_id',
        valueType: 'string',
      },
      {
        content: '"limitations": [',
        indent: 1,
        key: 'limitations',
        valueType: 'array',
      },
      {
        content: '"Synthetic fixtures only",',
        indent: 2,
      },
      {
        content: '"Human review required",',
        indent: 2,
      },
      {
        content: '"No diagnostic, clinical, safety, or maintenance conclusion"',
        indent: 2,
      },
      {
        content: '],',
        indent: 1,
      },
      {
        content: '"pipeline_version": "1.0.0",',
        indent: 1,
        key: 'pipeline_version',
        valueType: 'string',
        type: 'added',
      },
      {
        content: '"processed_at": "2026-10-05T17:40:34.197731-07:00",',
        indent: 1,
        key: 'processed_at',
        valueType: 'string',
        type: 'added',
      },
      {
        content: '"review_candidates": [',
        indent: 1,
        key: 'review_candidates',
        valueType: 'array',
      },
      {
        content: '{',
        indent: 2,
      },
      {
        content: '"candidate_id": "CANDIDATE-001",',
        indent: 3,
        key: 'candidate_id',
        valueType: 'string',
      },
      {
        content: '"device_id": "VENT-TEST-01",',
        indent: 3,
        key: 'device_id',
        valueType: 'string',
      },
      {
        content: '"evidence_refs": ["SENSOR-STATUS-S2", "TECH-01"],',
        indent: 3,
        key: 'evidence_refs',
        valueType: 'array',
      },
      {
        content: '"review_reason": "Repeated synthetic status S2",',
        indent: 3,
        key: 'review_reason',
        valueType: 'string',
      },
      {
        content: '"source_signals": ["adapter-status", "maintenance-note"]',
        indent: 3,
        key: 'source_signals',
        valueType: 'array',
      },
      {
        content: '},',
        indent: 2,
      },
      {
        content: '{',
        indent: 2,
      },
      {
        content: '"candidate_id": "CANDIDATE-002",',
        indent: 3,
        key: 'candidate_id',
        valueType: 'string',
      },
      {
        content: '"device_id": "PUMP-TEST-02",',
        indent: 3,
        key: 'device_id',
        valueType: 'string',
      },
      {
        content: '"evidence_refs": ["FLOW-STATUS-S1", "TECH-02"],',
        indent: 3,
        key: 'evidence_refs',
        valueType: 'array',
      },
      {
        content: '"review_reason": "Repeated synthetic status S1",',
        indent: 3,
        key: 'review_reason',
        valueType: 'string',
      },
      {
        content: '"source_signals": ["adapter-status", "fixture-change"]',
        indent: 3,
        key: 'source_signals',
        valueType: 'array',
      },
      {
        content: '}',
        indent: 2,
      },
      {
        content: ']',
        indent: 1,
      },
      {
        content: '}',
        indent: 0,
      },
    ],
  },
  {
    id: 5,
    slug: 'fan-out-review-candidates',
    title: 'Fan out review candidates',
    description:
      'Write a local review copy and post the same JSON to the fleet endpoint. Delivery has not been exercised.',
    inputLines: [
      {
        content: '[Shaped review candidates]',
        indent: 0,
      },
    ],
    outputLines: [
      {
        content: '# Local copy: ./output/review-candidates.json',
        indent: 0,
        type: 'highlighted',
      },
      {
        content:
          '# Fleet endpoint: POST http://localhost:8089/api/v1/review-candidates',
        indent: 0,
        type: 'highlighted',
      },
      {
        content: '# Retries: 3 with 1s to 10s backoff',
        indent: 0,
        type: 'highlighted',
      },
      {
        content: '# Delivery behavior: not assessed',
        indent: 0,
        type: 'highlighted',
      },
    ],
  },
];
