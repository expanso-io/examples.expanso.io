import type { Stage } from '@site/src/components/DataPipelineExplorer/types';

export const normalizeTimestampsStages: Stage[] = [
  {
    id: 1,
    title: 'Mixed Timestamp Formats',
    description: 'IoT devices, APIs, and logs use different timestamp formats (ISO 8601, Unix epoch, RFC 3339, custom). This breaks time-based queries, corrupts aggregations, and causes timezone confusion.',
    yamlFilename: 'step-0-mixed-formats.yaml',
    yamlCode: `# No timestamp normalization`,
    inputLines: [
      { content: '{"event":"login","time":"2024-01-15T10:30:00Z"}', indent: 0 },
      { content: '{"event":"purchase","time":1705317000}', indent: 0 },
      { content: '{"event":"logout","time":"15/01/2024 10:30"}', indent: 0 },
    ],
    outputLines: [
      { content: '❌ Query Failures:', indent: 0, type: 'highlighted' },
      { content: 'Cannot sort by time (mixed types)', indent: 1 },
      { content: 'Time-range filters fail', indent: 1 },
      { content: 'Aggregation by hour broken', indent: 1 },
    ],
  },
  {
    id: 2,
    title: 'Parse Multiple Formats',
    description: 'Detect and parse ISO 8601, Unix epoch, and custom formats. Use `.parse_timestamp()` with fallback patterns to handle any format your data sources produce.',
    yamlFilename: 'step-1-parse-formats.yaml',
    yamlCode: `pipeline:
  processors:
    - mapping: |
        root = this
        # Try ISO 8601 first
        root.parsed_time = this.time.parse_timestamp("2006-01-02T15:04:05Z").catch(
          # Fallback to Unix epoch
          this.time.number().timestamp_unix().catch(
            # Fallback to custom format
            this.time.parse_timestamp("02/01/2006 15:04")
          )
        )`,
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
    title: 'Normalize to UTC + Metadata',
    description: 'Convert all timestamps to ISO 8601 UTC format. Add metadata (timezone, epoch, day_of_week, hour) for time-based analytics. Now all events are queryable, sortable, and aggregatable.',
    yamlFilename: 'step-2-normalize-utc.yaml',
    yamlCode: `pipeline:
  processors:
    - mapping: |
        root = this
        let ts = this.time.parse_timestamp("2006-01-02T15:04:05Z")

        # Normalize to ISO 8601 UTC
        root.timestamp = ts.ts_format("2006-01-02T15:04:05Z")
        root.timestamp_epoch = ts.ts_unix()

        # Add time-based metadata
        root.metadata.hour = ts.ts_format("15", "UTC").number()
        root.metadata.day_of_week = ts.ts_format("Monday", "UTC")
        root.metadata.date = ts.ts_format("2006-01-02", "UTC")`,
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
