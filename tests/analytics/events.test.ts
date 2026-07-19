import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { globSync } from 'glob';

import {
  ANALYTICS_EVENT_SCHEMA_VERSION,
  PUBLIC_ANALYTICS_EVENT_NAMES,
  assertPublicAnalyticsEvent,
  createExampleFilterChangeEvent,
  createExampleSearchEvent,
  createExampleViewEvent,
  createExplorerCopyEvent,
  createExplorerShareEvent,
  createExplorerStageChangeEvent,
  createExplorerViewChangeEvent,
  createPipelineDownloadEvent,
  createRelatedExampleClickEvent,
  createRunLocalClickEvent,
  type PublicExampleAnalyticsEvent,
} from '../../src/analytics/events';

const events: PublicExampleAnalyticsEvent[] = [
  createExampleViewEvent('remove-pii', 'offline-runnable', 'not-assessed'),
  createExplorerStageChangeEvent('remove-pii', 'hash-email', 'keyboard'),
  createExplorerViewChangeEvent('remove-pii', 'changes'),
  createExplorerCopyEvent('remove-pii', 'hash-email', 'output'),
  createPipelineDownloadEvent('remove-pii', 'hash-email', 'full'),
  createExplorerShareEvent('remove-pii', 'hash-email'),
  createExampleFilterChangeEvent('goal', ['secure-data'], 4),
  createExampleSearchEvent(12, 3),
  createRunLocalClickEvent('remove-pii'),
  createRelatedExampleClickEvent('remove-pii', 'encrypt-data'),
];

describe('analytics event schema v1', () => {
  it('constructs every required public event through the versioned boundary', () => {
    assert.deepEqual(
      events.map((event) => event.event),
      PUBLIC_ANALYTICS_EVENT_NAMES
    );
    for (const event of events) {
      assert.equal(event.event_schema_version, ANALYTICS_EVENT_SCHEMA_VERSION);
      assert.doesNotThrow(() => assertPublicAnalyticsEvent(event));
    }
  });

  it('retains the migration-locked Explorer event ids', () => {
    assert.deepEqual(events.slice(1, 6), [
      {
        event: 'explorer_stage_view',
        event_schema_version: '1.0.0',
        example_id: 'remove-pii',
        stage_id: 'hash-email',
        navigation_method: 'keyboard',
      },
      {
        event: 'explorer_view_toggle',
        event_schema_version: '1.0.0',
        example_id: 'remove-pii',
        view: 'changes',
      },
      {
        event: 'pipeline_copy',
        event_schema_version: '1.0.0',
        example_id: 'remove-pii',
        stage_id: 'hash-email',
        scope: 'output',
      },
      {
        event: 'pipeline_download',
        event_schema_version: '1.0.0',
        example_id: 'remove-pii',
        stage_id: 'hash-email',
        scope: 'full',
      },
      {
        event: 'explorer_share',
        event_schema_version: '1.0.0',
        example_id: 'remove-pii',
        stage_id: 'hash-email',
      },
    ]);
  });

  it('never emits raw search text, payload bytes, or filenames', () => {
    const encoded = JSON.stringify(events);
    for (const forbidden of [
      'private query',
      'raw_query',
      'query_text',
      'payload',
      'copied_value',
      'filename',
      'customer',
      'credential',
    ]) {
      assert.equal(encoded.includes(forbidden), false, forbidden);
    }
  });

  it('rejects unknown fields and non-normalized identifiers', () => {
    assert.throws(
      () =>
        assertPublicAnalyticsEvent({
          ...createExampleSearchEvent(7, 1),
          query: 'secret',
        }),
      /fields do not exactly match/
    );
    assert.throws(
      () => createRunLocalClickEvent('Remove PII'),
      /normalized public id/
    );
    assert.throws(() => createExampleSearchEvent(-1, 2), /non-negative/);
    assert.throws(
      () =>
        assertPublicAnalyticsEvent({
          ...createExampleSearchEvent(7, 1),
          query_length: '7',
        }),
      /non-negative safe integer/
    );
    assert.throws(
      () =>
        assertPublicAnalyticsEvent({
          ...createExampleFilterChangeEvent('goal', ['secure-data'], 1),
          selected_filter_ids: ['secure-data', 'secure-data'],
        }),
      /unique and sorted/
    );
  });

  it('keeps the dataLayer push centralized in the privacy boundary', () => {
    const files = globSync('src/**/*.{ts,tsx}', { nodir: true }).sort();
    const writers = files.filter((path) =>
      /dataLayer\??\.push\(/.test(readFileSync(path, 'utf8'))
    );
    assert.deepEqual(writers, ['src/analytics/events.ts']);
  });
});
