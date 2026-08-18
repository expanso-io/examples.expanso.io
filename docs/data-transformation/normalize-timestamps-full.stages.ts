import type { Stage } from '@site/src/components/DataPipelineExplorer/types';

export const normalizeTimestampsStages: Stage[] = [
  {
    id: 1,
    slug: 'mixed-timestamp-formats',
    title: 'Mixed Timestamp Formats',
    description:
      'Representative records carry timestamp strings and epoch values with different source assumptions.',
    inputLines: [
      { content: '{"event":"login","time":"2024-01-15T10:30:00Z"}', indent: 0 },
      { content: '{"event":"purchase","time":1705317000}', indent: 0 },
      { content: '{"event":"logout","time":"15/01/2024 10:30"}', indent: 0 },
    ],
    outputLines: [
      { content: 'Source values differ:', indent: 0, type: 'highlighted' },
      { content: 'String and numeric representations are mixed', indent: 1 },
      { content: 'One custom string has no explicit zone', indent: 1 },
    ],
  },
  {
    id: 2,
    slug: 'parse-multiple-formats',
    title: 'Parse Multiple Formats',
    description:
      'The authored mapping attempts the declared ISO 8601, Unix epoch, and custom-format branches.',
    inputLines: [
      { content: '{"event":"login","time":"2024-01-15T10:30:00Z"}', indent: 0 },
      { content: '{"event":"purchase","time":1705317000}', indent: 0 },
      { content: '{"event":"logout","time":"15/01/2024 10:30"}', indent: 0 },
    ],
    outputLines: [
      { content: '✅ Parsed Successfully:', indent: 0, type: 'highlighted' },
      { content: 'ISO 8601: 2024-01-15T10:30:00Z', indent: 1 },
      { content: 'Unix epoch: 2024-01-15T10:30:00Z', indent: 1 },
      { content: 'Custom: 2024-01-15T10:30:00Z', indent: 1 },
    ],
  },
  {
    id: 3,
    slug: 'normalize-to-utc-metadata',
    title: 'Normalize to UTC + Metadata',
    description:
      'The authored mapping emits a UTC field and derives configured calendar metadata for the fixture.',
    inputLines: [
      { content: '{"event":"login","time":"2024-01-15T10:30:00Z"}', indent: 0 },
      { content: '{"event":"purchase","time":1705317000}', indent: 0 },
      { content: '{"event":"logout","time":"15/01/2024 10:30"}', indent: 0 },
    ],
    outputLines: [
      { content: '✅ Normalized Output:', indent: 0, type: 'highlighted' },
      { content: '{"timestamp":"2024-01-15T10:30:00Z",', indent: 1 },
      { content: '"timestamp_epoch":1705317000,', indent: 1 },
      { content: '"metadata":{"hour":10,"day_of_week":"Monday"}}', indent: 1 },
      { content: '', indent: 0 },
      { content: '✅ Now Queryable:', indent: 0, type: 'highlighted' },
      { content: 'SELECT * WHERE hour = 10 ✓', indent: 1 },
      { content: 'SELECT * WHERE day_of_week = "Monday" ✓', indent: 1 },
      { content: 'ORDER BY timestamp ✓', indent: 1 },
    ],
  },
];
