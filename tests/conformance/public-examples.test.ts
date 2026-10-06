import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import { GENERATED_EXPLORER_STAGE_CONFIGS } from '../../src/catalog/explorerStageConfigs.generated';
import { EXAMPLE_RECORDS } from '../../src/catalog/registry';

interface LegacyFeatureAudit {
  auditVersion: string;
  auditedAt: string;
  historyBaseline: string;
  redesignCommit: string;
  features: Array<{
    id: string;
    feature: string;
    historyEvidence: string;
    currentProof: string;
    status: 'retained' | 'restored' | 'pending';
    dependency?: string;
  }>;
}

const published = EXAMPLE_RECORDS.filter(
  (record) => record.status === 'published'
);

function sourcePathForRoute(route: string): string {
  const normalized = route.replace(/^\/+|\/+$/g, '');

  if (normalized.endsWith('/explorer')) return `docs/${normalized}.mdx`;

  return `docs/${normalized}/index.mdx`;
}

function setupSourcePath(overviewRoute: string): string {
  const normalized = overviewRoute.replace(/^\/+|\/+$/g, '');

  return `docs/${normalized}/setup.mdx`;
}

describe('public example conformance', () => {
  it('covers the complete 26-example published class', () => {
    assert.equal(published.length, 26);
    assert.equal(published.length, EXAMPLE_RECORDS.length);
    assert.equal(new Set(published.map(({ id }) => id)).size, 26);
  });

  it('requires a canonical Explorer with real input and output for every example', () => {
    assert.equal(Object.keys(GENERATED_EXPLORER_STAGE_CONFIGS).length, 26);

    for (const record of published) {
      assert.ok(record.routes.explore, `${record.id} publishes an Explorer`);
      assert.ok(
        record.explorerEvidence,
        `${record.id} binds Explorer evidence`
      );
      const family = GENERATED_EXPLORER_STAGE_CONFIGS[record.id];
      assert.ok(family, `${record.id} has generated Explorer stages`);
      assert.ok(
        family.stages.length > 0,
        `${record.id} has at least one stage`
      );
      assert.ok(
        family.stages.some(
          (stage) =>
            JSON.stringify(stage.inputLines) !==
            JSON.stringify(stage.outputLines)
        ),
        `${record.id} includes a material input/output change`
      );

      for (const stage of family.stages) {
        assert.ok(
          stage.description.trim(),
          `${record.id}/${stage.slug} description`
        );
        assert.ok(
          stage.inputLines.length > 0,
          `${record.id}/${stage.slug} input`
        );
        assert.ok(
          stage.outputLines.length > 0,
          `${record.id}/${stage.slug} output`
        );
        assert.ok(stage.yamlCode.trim(), `${record.id}/${stage.slug} YAML`);
        assert.match(stage.slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      }
    }
  });

  it('requires overview, explorer, setup, and complete pipeline sources', () => {
    for (const record of published) {
      const overviewPath = sourcePathForRoute(record.routes.overview);
      const exploreRoute = record.routes.explore;
      assert.ok(exploreRoute, `${record.id} Explorer route`);
      const explorerPath = sourcePathForRoute(exploreRoute);
      const setupPath = setupSourcePath(record.routes.overview);
      assert.ok(existsSync(overviewPath), `${record.id} overview source`);
      assert.ok(existsSync(explorerPath), `${record.id} Explorer source`);
      assert.ok(existsSync(setupPath), `${record.id} setup source`);
      const completePipelinePath = record.completePipelinePath;
      assert.ok(completePipelinePath, `${record.id} complete pipeline path`);
      assert.ok(
        existsSync(completePipelinePath),
        `${record.id} complete pipeline source`
      );
    }
  });

  it('keeps every audited pre-redesign feature retained or restored', () => {
    const audit: LegacyFeatureAudit = JSON.parse(
      readFileSync(
        'validation-reports/conformance/legacy-feature-audit.json',
        'utf8'
      )
    );

    assert.equal(audit.auditVersion, '1.0.0');
    assert.equal(audit.auditedAt, '2026-10-05');
    assert.match(audit.historyBaseline, /^[0-9a-f]{40}$/);
    assert.match(audit.redesignCommit, /^[0-9a-f]{40}$/);
    assert.equal(audit.features.length, 14);
    assert.deepEqual(
      audit.features.map(({ id }) => id).sort(),
      [
        'explanation',
        'page-actions',
        'inline-explorer',
        'explorer-guide',
        'stage-navigation',
        'stage-input-output',
        'stage-configuration',
        'run-deploy-guidance',
        'family-sidebar',
        'setup-guides',
        'step-guides',
        'complete-reference',
        'troubleshooting',
        'related-examples',
      ].sort()
    );

    for (const feature of audit.features) {
      assert.ok(feature.feature.trim(), `${feature.id} feature`);
      assert.ok(feature.historyEvidence.trim(), `${feature.id} history proof`);
      assert.ok(feature.currentProof.trim(), `${feature.id} current proof`);
      assert.ok(
        ['retained', 'restored', 'pending'].includes(feature.status),
        `${feature.id} status`
      );

      if (feature.status === 'pending') {
        assert.match(
          feature.dependency ?? '',
          /^https:\/\/github\.com\/expanso-io\/examples\.expanso\.io\/pull\/\d+$/,
          `${feature.id} dependency`
        );
      }
    }

    const pending = audit.features
      .filter(({ status }) => status === 'pending')
      .map(({ id, dependency }) => `${id}: ${dependency}`);

    assert.deepEqual(
      pending,
      [],
      `Pre-redesign features still pending:\n${pending.join('\n')}`
    );
  });
});
