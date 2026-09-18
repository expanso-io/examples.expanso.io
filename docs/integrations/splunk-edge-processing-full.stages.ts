import type { Stage } from '@site/src/components/DataPipelineExplorer/types';

export const splunkEdgeProcessingStages: Stage[] = [
  {
    id: 1,
    slug: 'authored-log-fixture',
    title: 'Authored log fixture',
    description:
      'Inspect the synthetic application lines before any parse or retention policy is applied.',
    inputLines: [
      {
        content:
          '2024-01-15 10:30:15 INFO  [main] Application started successfully',
        indent: 0,
      },
      {
        content:
          '2024-01-15 10:30:16 DEBUG [worker-1] Initializing connection pool',
        indent: 0,
      },
      {
        content:
          '2024-01-15 10:30:16 DEBUG [worker-1] Pool size: 10, timeout: 30s',
        indent: 0,
      },
      {
        content:
          '2024-01-15 10:30:17 WARN  [auth] Failed login attempt: user=admin ip=192.168.1.100',
        indent: 0,
      },
      {
        content:
          '2024-01-15 10:30:18 ERROR [db] Connection timeout to database server',
        indent: 0,
      },
      {
        content:
          '2024-01-15 10:30:19 DEBUG [health] Health check passed - all services OK',
        indent: 0,
      },
    ],
    outputLines: [
      {
        content:
          '2024-01-15 10:30:15 INFO  [main] Application started successfully',
        indent: 0,
      },
      {
        content:
          '2024-01-15 10:30:16 DEBUG [worker-1] Initializing connection pool',
        indent: 0,
      },
      {
        content:
          '2024-01-15 10:30:16 DEBUG [worker-1] Pool size: 10, timeout: 30s',
        indent: 0,
      },
      {
        content:
          '2024-01-15 10:30:17 WARN  [auth] Failed login attempt: user=admin ip=192.168.1.100',
        indent: 0,
      },
      {
        content:
          '2024-01-15 10:30:18 ERROR [db] Connection timeout to database server',
        indent: 0,
      },
      {
        content:
          '2024-01-15 10:30:19 DEBUG [health] Health check passed - all services OK',
        indent: 0,
      },
    ],
  },
  {
    id: 2,
    slug: 'parse-selected-fields',
    title: 'Parse selected fields',
    description:
      'Map the narrow fixture format into timestamp, level, thread, message, and raw fields.',
    inputLines: [
      {
        content:
          '2024-01-15 10:30:15 INFO  [main] Application started successfully',
        indent: 0,
      },
      {
        content:
          '2024-01-15 10:30:16 DEBUG [worker-1] Initializing connection pool',
        indent: 0,
      },
      {
        content:
          '2024-01-15 10:30:17 WARN  [auth] Failed login attempt: user=admin ip=192.168.1.100',
        indent: 0,
      },
    ],
    outputLines: [
      { content: '{', indent: 0 },
      {
        content: '"timestamp": "2024-01-15 10:30:15",',
        indent: 1,
        key: 'timestamp',
        valueType: 'string',
        type: 'added',
      },
      {
        content: '"level": "INFO",',
        indent: 1,
        key: 'level',
        valueType: 'string',
        type: 'added',
      },
      {
        content: '"thread": "main",',
        indent: 1,
        key: 'thread',
        valueType: 'string',
        type: 'added',
      },
      {
        content: '"message": "Application started successfully",',
        indent: 1,
        key: 'message',
        valueType: 'string',
        type: 'added',
      },
      {
        content:
          '"raw": "2024-01-15 10:30:15 INFO  [main] Application started successfully"',
        indent: 1,
        key: 'raw',
        valueType: 'string',
        type: 'added',
      },
      { content: '}', indent: 0 },
    ],
  },
  {
    id: 3,
    slug: 'apply-a-retention-policy',
    title: 'Apply a retention policy',
    description:
      'Delete the fixture records selected by this authored policy. Real retention rules require security, audit, and investigation review.',
    inputLines: [
      { content: '[Authored log fixture]', indent: 0, type: 'comment' },
      { content: '• INFO: Application started successfully', indent: 0 },
      {
        content: '• DEBUG: Initializing connection pool',
        indent: 0,
        type: 'removed',
      },
      {
        content: '• DEBUG: Pool size: 10, timeout: 30s',
        indent: 0,
        type: 'removed',
      },
      {
        content: '• WARN: Failed login attempt: user=admin ip=192.168.1.100',
        indent: 0,
      },
      { content: '• ERROR: Connection timeout to database server', indent: 0 },
      {
        content: '• DEBUG: Health check passed - all services OK',
        indent: 0,
        type: 'removed',
      },
    ],
    outputLines: [
      {
        content: '[Retained fixture messages]',
        indent: 0,
        type: 'highlighted',
      },
      { content: '• INFO: Application started successfully', indent: 0 },
      {
        content: '• WARN: Failed login attempt: user=admin ip=192.168.1.100',
        indent: 0,
      },
      { content: '• ERROR: Connection timeout to database server', indent: 0 },
      { content: '', indent: 0 },
      {
        content: 'Filtering is irreversible at this boundary.',
        indent: 0,
        type: 'highlighted',
      },
    ],
  },
  {
    id: 4,
    slug: 'add-hec-metadata',
    title: 'Add HEC metadata',
    description:
      'Wrap each retained event and add authored source, host, sourcetype, and index values.',
    inputLines: [
      { content: '{', indent: 0 },
      {
        content: '"timestamp": "2024-01-15 10:30:17",',
        indent: 1,
        key: 'timestamp',
        valueType: 'string',
      },
      {
        content: '"level": "ERROR",',
        indent: 1,
        key: 'level',
        valueType: 'string',
      },
      {
        content: '"thread": "db",',
        indent: 1,
        key: 'thread',
        valueType: 'string',
      },
      {
        content: '"message": "Connection timeout to database server",',
        indent: 1,
        key: 'message',
        valueType: 'string',
      },
      {
        content:
          '"raw": "2024-01-15 10:30:18 ERROR [db] Connection timeout..."',
        indent: 1,
        key: 'raw',
        valueType: 'string',
      },
      { content: '}', indent: 0 },
    ],
    outputLines: [
      { content: '{', indent: 0 },
      { content: '"event": {', indent: 1, type: 'highlighted' },
      {
        content: '"timestamp": "2024-01-15 10:30:17",',
        indent: 2,
        key: 'timestamp',
        valueType: 'string',
      },
      {
        content: '"level": "ERROR",',
        indent: 2,
        key: 'level',
        valueType: 'string',
      },
      {
        content: '"thread": "db",',
        indent: 2,
        key: 'thread',
        valueType: 'string',
      },
      {
        content: '"message": "Connection timeout to database server",',
        indent: 2,
        key: 'message',
        valueType: 'string',
      },
      {
        content:
          '"raw": "2024-01-15 10:30:18 ERROR [db] Connection timeout..."',
        indent: 2,
        key: 'raw',
        valueType: 'string',
      },
      { content: '},', indent: 1, type: 'highlighted' },
      {
        content: '"sourcetype": "app:custom",',
        indent: 1,
        key: 'sourcetype',
        valueType: 'string',
        type: 'added',
      },
      {
        content: '"index": "security",',
        indent: 1,
        key: 'index',
        valueType: 'string',
        type: 'added',
      },
      {
        content: '"host": "edge-node-01",',
        indent: 1,
        key: 'host',
        valueType: 'string',
        type: 'added',
      },
      {
        content: '"source": "/var/log/app/application.log"',
        indent: 1,
        key: 'source',
        valueType: 'string',
        type: 'added',
      },
      { content: '}', indent: 0 },
    ],
  },
  {
    id: 5,
    slug: 'route-to-splunk-hec',
    title: 'Route to Splunk HEC',
    description:
      'Configure an external HEC endpoint, token header, and example batch policy. Delivery has not been exercised.',
    inputLines: [{ content: '[Retained messages]', indent: 0 }],
    outputLines: [
      {
        content:
          '# HEC Endpoint: https://splunk.company.com:8088/services/collector/event',
        indent: 0,
        type: 'highlighted',
      },
      {
        content: '# Batching: 100 events or 10 seconds',
        indent: 0,
        type: 'highlighted',
      },
      {
        content: '# Index routing: security (errors), main (info/warn)',
        indent: 0,
        type: 'highlighted',
      },
      {
        content: '# Delivery behavior: not assessed',
        indent: 0,
        type: 'highlighted',
      },
      {
        content: '# Retention policy: requires environment review',
        indent: 0,
        type: 'highlighted',
      },
    ],
  },
];
