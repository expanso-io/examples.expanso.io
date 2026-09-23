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
  firstResultDownloadEvent,
  createExplorerCopyEvent,
  createExplorerShareEvent,
  createExplorerStageChangeEvent,
  createExplorerViewChangeEvent,
  createPipelineDownloadEvent,
  createRelatedExampleClickEvent,
  createOutboundClickEvent,
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
  createOutboundClickEvent('https://expanso.io/contact', 'remove-pii')!,
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

  it('keeps dataLayer writes centralized in analytics privacy boundaries', () => {
    const files = globSync('src/**/*.{ts,tsx}', { nodir: true }).sort();
    const writers = files.filter((path) =>
      /dataLayer\??\.push\(/.test(readFileSync(path, 'utf8'))
    );
    assert.deepEqual(writers, [
      'src/analytics/events.ts',
      'src/lib/analytics.ts',
    ]);
  });
});

describe('outbound privacy boundary', () => {
  it('records public destination and source while removing query strings and fragments', () => {
    const event = createOutboundClickEvent(
      'https://expanso.io/contact/?email=private@example.com#token',
      'remove-pii'
    );
    assert.deepEqual(event, {
      event: 'outbound_click',
      event_schema_version: ANALYTICS_EVENT_SCHEMA_VERSION,
      example_id: 'remove-pii',
      destination_host: 'expanso.io',
      destination_path: '/contact',
    });
    assert.doesNotThrow(() => assertPublicAnalyticsEvent(event));
  });
  it('rejects arbitrary paths, hosts, protocols, ports and credentials', () => {
    for (const url of [
      'https://expanso.io/person/private',
      'https://evil.test/contact',
      'https://constructor/',
      'https://expanso.io.evil.test/contact',
      'http://expanso.io/contact',
      'https://expanso.io:444/contact',
      'https://user:secret@expanso.io/contact',
      'mailto:private@example.com',
    ])
      assert.equal(createOutboundClickEvent(url, 'remove-pii'), null);
    assert.throws(() =>
      assertPublicAnalyticsEvent({
        ...createOutboundClickEvent('https://expanso.io/', 'remove-pii'),
        destination_path: '/private',
      })
    );
  });
});

it('covers every authored company, docs and console destination', () => {
  const source = [
    'docusaurus.config.ts',
    ...globSync(['docs/**/*.{md,mdx}', 'src/**/*.{ts,tsx}'], {
      ignore: ['**/*.test.*'],
      nodir: true,
    }),
  ]
    .map((path) => readFileSync(path, 'utf8'))
    .join('\n');
  const destinations = [
    ...source.matchAll(/https:\/\/(?:docs\.|cloud\.)?expanso\.io[^\s"'<>)]*/g),
  ].map((match) => match[0]);
  assert.ok(destinations.length >= 10);
  for (const href of destinations)
    assert.ok(createOutboundClickEvent(href, 'site-navigation'), href);
});

it('measures first-result Docs links without retaining query or fragment data', () => {
  for (const path of [
    '/getting-started/installation',
    '/getting-started/local-mode/quick-start',
  ]) {
    const event = createOutboundClickEvent(
      'https://docs.expanso.io' + path + '/?email=private@example.com#token',
      'remove-pii'
    );
    assert.ok(event);
    assert.equal(event.destination_host, 'docs.expanso.io');
    assert.equal(event.destination_path, path);
    assertPublicAnalyticsEvent(event);
  }
});

it('attributes only the three bounded downloads to stable first-result journeys', () => {
  for (const [file, id] of [
    ['remove-pii', 'remove-pii'],
    ['filter-logs', 'filter-severity'],
    ['process-locally', 'process-data-locally'],
  ]) {
    assert.deepEqual(
      firstResultDownloadEvent('/files/first-results/' + file + '.yaml'),
      createPipelineDownloadEvent(id, 'first-result', 'full')
    );
  }
  for (const path of [
    '/files/private.yaml',
    '/files/first-results/unknown.yaml',
    '/files/first-results/remove-pii.yaml/private',
    '/files/first-results/remove-pii.yaml?email=private',
  ]) {
    assert.equal(firstResultDownloadEvent(path), null);
  }
});
