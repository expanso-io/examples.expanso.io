import type { Stage } from '@site/src/components/DataPipelineExplorer/types';

/**
 * 3-Stage Log Filtering Pipeline
 * Demonstrates severity-based filtering:
 * 1. Original - All log levels mixed (DEBUG, INFO, WARN, ERROR)
 * 2. Parse & Classify - Extract severity from log messages
 * 3. Filter & Route - Drop DEBUG/TRACE, route ERROR/WARN/INFO to appropriate destinations
 */

export const filterSeverityStages: Stage[] = [
  // ============================================================================
  // STAGE 1: Original - All Log Levels Mixed
  // ============================================================================
  {
    id: 1,
    slug: 'all-log-levels-mixed',
    title: 'All Log Levels Mixed',
    description:
      'The synthetic input mixes DEBUG, INFO, WARN, and ERROR records before selection.',
    inputLines: [
      {
        content: '{"level":"DEBUG","msg":"Cache hit","user_id":42}',
        indent: 0,
      },
      {
        content: '{"level":"DEBUG","msg":"SQL query: SELECT *","user_id":42}',
        indent: 0,
      },
      {
        content: '{"level":"INFO","msg":"User login","user_id":42}',
        indent: 0,
      },
      {
        content: '{"level":"DEBUG","msg":"Memory usage: 45%","user_id":42}',
        indent: 0,
      },
      {
        content: '{"level":"WARN","msg":"Slow query 2.3s","user_id":42}',
        indent: 0,
      },
      {
        content: '{"level":"ERROR","msg":"Payment failed","user_id":42}',
        indent: 0,
      },
      {
        content: '{"level":"DEBUG","msg":"Request finished","user_id":42}',
        indent: 0,
      },
    ],
    outputLines: [
      {
        content: '{"level":"DEBUG","msg":"Cache hit","user_id":42}',
        indent: 0,
      },
      {
        content: '{"level":"DEBUG","msg":"SQL query: SELECT *","user_id":42}',
        indent: 0,
      },
      {
        content: '{"level":"INFO","msg":"User login","user_id":42}',
        indent: 0,
      },
      {
        content: '{"level":"DEBUG","msg":"Memory usage: 45%","user_id":42}',
        indent: 0,
      },
      {
        content: '{"level":"WARN","msg":"Slow query 2.3s","user_id":42}',
        indent: 0,
      },
      {
        content: '{"level":"ERROR","msg":"Payment failed","user_id":42}',
        indent: 0,
      },
      {
        content: '{"level":"DEBUG","msg":"Request finished","user_id":42}',
        indent: 0,
      },
    ],
  },

  // ============================================================================
  // STAGE 2: Parse & Classify
  // ============================================================================
  {
    id: 2,
    slug: 'parse-classify',
    title: 'Parse & Classify',
    description:
      'Normalize the source level and assign the configured priority label.',
    inputLines: [
      {
        content: '{"level":"DEBUG","msg":"Cache hit"}',
        indent: 0,
        type: 'removed',
      },
      {
        content: '{"level":"DEBUG","msg":"SQL query"}',
        indent: 0,
        type: 'removed',
      },
      { content: '{"level":"INFO","msg":"User login"}', indent: 0 },
      {
        content: '{"level":"DEBUG","msg":"Memory usage"}',
        indent: 0,
        type: 'removed',
      },
      { content: '{"level":"WARN","msg":"Slow query"}', indent: 0 },
      { content: '{"level":"ERROR","msg":"Payment failed"}', indent: 0 },
      {
        content: '{"level":"DEBUG","msg":"Request finished"}',
        indent: 0,
        type: 'removed',
      },
    ],
    outputLines: [
      { content: '✅ Parsed & Classified:', indent: 0, type: 'highlighted' },
      { content: '{"severity":"DEBUG","priority":"low"}', indent: 1 },
      { content: '{"severity":"DEBUG","priority":"low"}', indent: 1 },
      { content: '{"severity":"INFO","priority":"medium"}', indent: 1 },
      { content: '{"severity":"DEBUG","priority":"low"}', indent: 1 },
      { content: '{"severity":"WARN","priority":"high"}', indent: 1 },
      { content: '{"severity":"ERROR","priority":"critical"}', indent: 1 },
      { content: '{"severity":"DEBUG","priority":"low"}', indent: 1 },
      { content: '', indent: 0 },
      { content: '📊 Priority Distribution:', indent: 0, type: 'highlighted' },
      { content: 'low: 4 logs (57%)', indent: 1 },
      { content: 'medium: 1 log (14%)', indent: 1 },
      { content: 'high: 1 log (14%)', indent: 1 },
      { content: 'critical: 1 log (14%)', indent: 1 },
    ],
  },

  // ============================================================================
  // STAGE 3: Filter & Route
  // ============================================================================
  {
    id: 3,
    slug: 'filter-route',
    title: 'Filter & Route',
    description:
      'Apply the authored predicate, then configure separate outputs for retained severity groups.',
    inputLines: [
      {
        content: '{"level":"DEBUG","msg":"Cache hit"}',
        indent: 0,
        type: 'removed',
      },
      {
        content: '{"level":"DEBUG","msg":"SQL query"}',
        indent: 0,
        type: 'removed',
      },
      { content: '{"level":"INFO","msg":"User login"}', indent: 0 },
      {
        content: '{"level":"DEBUG","msg":"Memory usage"}',
        indent: 0,
        type: 'removed',
      },
      { content: '{"level":"WARN","msg":"Slow query"}', indent: 0 },
      { content: '{"level":"ERROR","msg":"Payment failed"}', indent: 0 },
      {
        content: '{"level":"DEBUG","msg":"Request finished"}',
        indent: 0,
        type: 'removed',
      },
    ],
    outputLines: [
      { content: '✅ Filtering Results:', indent: 0, type: 'highlighted' },
      { content: 'DEBUG logs: 4 dropped', indent: 1 },
      { content: 'INFO logs: 1 → S3 archival', indent: 1 },
      { content: 'WARN logs: 1 → Elasticsearch', indent: 1 },
      { content: 'ERROR logs: 1 → Elasticsearch', indent: 1 },
      { content: '', indent: 0 },
      {
        content: '✅ Elasticsearch (Real-Time Alerts):',
        indent: 0,
        type: 'highlighted',
      },
      { content: '{"severity":"WARN","msg":"Slow query"}', indent: 1 },
      { content: '{"severity":"ERROR","msg":"Payment failed"}', indent: 1 },
      { content: '', indent: 0 },
      {
        content: '✅ S3 Archival (Long-Term Storage):',
        indent: 0,
        type: 'highlighted',
      },
      { content: '{"severity":"INFO","msg":"User login"}', indent: 1 },
    ],
  },
];
