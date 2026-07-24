import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  ANALYTICS_EVENT_SCHEMA_VERSION,
  CATALOG_ANALYTICS_FILTER_IDS,
  createExampleFilterChangeEvent,
  createExampleSearchEvent,
  exampleAnalyticsClassification,
  exampleIdFromCatalogPath,
  isRunLocalPath,
} from '../../src/analytics/events';
import { PUBLIC_CATALOG } from '../../src/catalog/registry';
import {
  EMPTY_SELECTIONS,
  FILTER_KEYS,
  FILTER_OPTIONS,
  catalogShareUrl,
  filterCatalog,
  parseCatalogQuery,
  portfolioType,
  serializeCatalogQuery,
  topologyComponentIds,
  type CatalogSelections,
  type FilterKey,
} from '../../src/components/CatalogExplorer/model';

function idsFor(key: FilterKey, values: string[]): string[] {
  const selections: CatalogSelections = {
    ...EMPTY_SELECTIONS,
    [key]: values,
  };
  return filterCatalog(PUBLIC_CATALOG.records, selections, '').map(
    (record) => record.id
  );
}

describe('catalog explorer model', () => {
  it('canonicalizes every normalized filter and reports unknown values', () => {
    const parsed = parseCatalogQuery(
      '?status=architecture-only&goal=secure-data,route-data&goal=secure-data&type=scenario&boundary=cloud-account&industry=retail&source=db2&destination=google-bigquery&difficulty=advanced&evidence=not-assessed&interaction=architecture&time=deep&interaction=unknown'
    );

    assert.deepEqual(parsed.selections.goal, ['route-data', 'secure-data']);
    assert.deepEqual(parsed.selections.boundary, ['cloud-account']);
    assert.deepEqual(parsed.selections.interaction, ['architecture']);
    assert.deepEqual(parsed.unknownValues, ['interaction=unknown']);
    assert.equal(
      serializeCatalogQuery(parsed.selections),
      '?goal=route-data%2Csecure-data&type=scenario&boundary=cloud-account&industry=retail&source=db2&destination=google-bigquery&difficulty=advanced&status=architecture-only&evidence=not-assessed&interaction=architecture&time=deep'
    );
  });

  it('publishes stable labels and definitions for every filter value', () => {
    assert.deepEqual(CATALOG_ANALYTICS_FILTER_IDS, FILTER_KEYS);
    for (const key of FILTER_KEYS) {
      assert.ok(FILTER_OPTIONS[key].length > 0, `${key} has no options`);
      for (const option of FILTER_OPTIONS[key]) {
        assert.match(option.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
        assert.ok(option.label.length > 0);
        assert.ok(option.definition.length > 0);
      }
    }
  });

  it('uses OR within a facet and AND across active facets', () => {
    const results = filterCatalog(
      PUBLIC_CATALOG.records,
      {
        ...EMPTY_SELECTIONS,
        goal: ['route-data', 'secure-data'],
        interaction: ['transform'],
      },
      ''
    );

    assert.ok(results.length > 1);
    assert.ok(
      results.every(
        (record) =>
          record.interaction === 'transform' &&
          record.goals.some((goal) =>
            ['route-data', 'secure-data'].includes(goal)
          )
      )
    );
  });

  it('filters required facets from registry fields and topology endpoints', () => {
    assert.deepEqual(idsFor('industry', ['retail']), [
      'motherduck-retail-analytics',
    ]);
    assert.deepEqual(idsFor('source', ['db2']), ['db2-to-bigquery']);
    assert.deepEqual(idsFor('destination', ['google-bigquery']), [
      'db2-to-bigquery',
    ]);
    assert.ok(
      idsFor('boundary', ['remote-site']).includes('scada-energy-edge')
    );
    assert.ok(idsFor('difficulty', ['advanced']).length > 1);
    assert.deepEqual(idsFor('status', ['offline-runnable']), ['remove-pii']);
    assert.equal(
      idsFor('evidence', ['not-assessed']).length,
      PUBLIC_CATALOG.records.length
    );
    assert.ok(idsFor('interaction', ['architecture']).length > 1);
  });

  it('derives sources and destinations without a parallel authored list', () => {
    const migration = PUBLIC_CATALOG.records.find(
      (record) => record.id === 'db2-to-bigquery'
    );
    assert.ok(migration);
    assert.deepEqual(topologyComponentIds(migration, 'source'), ['db2']);
    assert.deepEqual(topologyComponentIds(migration, 'destination'), [
      'google-bigquery',
    ]);
  });

  it('offers a deterministic recipes versus scenario architectures view', () => {
    const recipe = PUBLIC_CATALOG.records.find(
      (record) => record.id === 'remove-pii'
    );
    const scenario = PUBLIC_CATALOG.records.find(
      (record) => record.id === 'db2-to-bigquery'
    );
    assert.ok(recipe && scenario);
    assert.equal(portfolioType(recipe), 'recipe');
    assert.equal(portfolioType(scenario), 'scenario');
    assert.ok(idsFor('type', ['recipe']).length > 1);
    assert.ok(idsFor('type', ['scenario']).length > 1);
  });

  it('searches public outcomes, aliases, components, and topology labels', () => {
    const splunk = filterCatalog(
      PUBLIC_CATALOG.records,
      EMPTY_SELECTIONS,
      'splunk'
    );
    const privacy = filterCatalog(
      PUBLIC_CATALOG.records,
      EMPTY_SELECTIONS,
      'privacy'
    );

    assert.ok(splunk.some((record) => record.id === 'splunk-edge-processing'));
    assert.ok(privacy.some((record) => record.id === 'remove-pii'));
  });

  it('shares canonical facets while omitting free-form search and hashes', () => {
    const selections = {
      ...EMPTY_SELECTIONS,
      goal: ['secure-data', 'route-data'],
      difficulty: ['advanced'],
    };
    assert.equal(
      catalogShareUrl(
        'https://examples.expanso.io',
        '/#catalog-results',
        selections
      ),
      'https://examples.expanso.io/?goal=route-data%2Csecure-data&difficulty=advanced'
    );
  });
});

describe('privacy-safe example analytics', () => {
  it('emits only query length and result count for search', () => {
    const event = createExampleSearchEvent('private query'.length, 4);
    assert.deepEqual(event, {
      event: 'example_search',
      event_schema_version: ANALYTICS_EVENT_SCHEMA_VERSION,
      query_length: 13,
      result_count: 4,
    });
    assert.equal(JSON.stringify(event).includes('private query'), false);
  });

  it('sorts normalized filter ids in a versioned event', () => {
    assert.deepEqual(
      createExampleFilterChangeEvent('goal', ['secure-data', 'route-data'], 8),
      {
        event: 'example_filter_change',
        event_schema_version: ANALYTICS_EVENT_SCHEMA_VERSION,
        filter_id: 'goal',
        selected_filter_ids: ['route-data', 'secure-data'],
        result_count: 8,
      }
    );
  });

  it('derives public example ids and run-local routes without page text', () => {
    assert.equal(
      exampleIdFromCatalogPath('/data-security/remove-pii/setup/'),
      'remove-pii'
    );
    assert.equal(isRunLocalPath('/data-security/remove-pii/setup/'), true);
    assert.equal(isRunLocalPath('/data-security/remove-pii/explorer/'), false);
    assert.equal(exampleIdFromCatalogPath('/getting-started/services/'), null);
    for (const record of PUBLIC_CATALOG.records) {
      for (const route of Object.values(record.routes).filter(
        (value): value is string => value !== undefined
      )) {
        assert.deepEqual(exampleAnalyticsClassification(route), {
          exampleId: record.id,
          executionStatus: record.executionStatus,
          operationalEvidence: record.operationalEvidence,
        });
      }
    }
  });
});
