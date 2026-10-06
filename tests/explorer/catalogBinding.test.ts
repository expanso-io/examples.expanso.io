import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { resolveCatalogExplorerBinding } from '../../src/catalog/explorerBinding';
import { GENERATED_EXPLORER_STAGE_CONFIGS } from '../../src/catalog/explorerStageConfigs.generated';
import { EXAMPLE_RECORDS } from '../../src/catalog/registry';

describe('catalog Explorer binding', () => {
  it('binds every public Explorer to its canonical identity and pipeline', () => {
    const explorerRecords = EXAMPLE_RECORDS.filter(
      (record) => record.routes.explore !== undefined
    );

    assert.equal(explorerRecords.length, 26);
    assert.deepEqual(
      Object.keys(GENERATED_EXPLORER_STAGE_CONFIGS),
      explorerRecords.map(({ id }) => id)
    );
    for (const record of explorerRecords) {
      const binding = resolveCatalogExplorerBinding(record.id);
      assert.deepEqual(
        GENERATED_EXPLORER_STAGE_CONFIGS[record.id].binding,
        binding
      );
      assert.equal(binding.exampleId, record.id);
      assert.equal(binding.canonicalPipelinePath, record.completePipelinePath);
      assert.equal(binding.provenance, record.explorerEvidence.kind);
      assert.equal(binding.executionStatus, record.executionStatus);
      assert.equal(binding.operationalEvidence, record.operationalEvidence);
      assert.equal(
        binding.fixtureLabel,
        record.explorerEvidence.inputCheckpointPath.split('/').at(-1)
      );
      assert.equal(
        binding.comparisonMode,
        record.executionStatus === 'architecture-only' ? 'highlights' : 'diff'
      );
    }
  });

  it('uses authored highlights for architecture and computed diff for Remove PII', () => {
    assert.equal(
      resolveCatalogExplorerBinding('circuit-breakers').comparisonMode,
      'highlights'
    );
    assert.equal(
      resolveCatalogExplorerBinding('remove-pii').comparisonMode,
      'diff'
    );
  });

  it('fails closed instead of synthesizing an Explorer identity', () => {
    assert.throws(
      () => resolveCatalogExplorerBinding('architecture-made-up-title'),
      /catalog record does not exist/
    );
  });

  it('publishes an Explorer for every published catalog family', () => {
    const published = EXAMPLE_RECORDS.filter(
      (record) => record.status === 'published'
    );
    assert.equal(published.length, EXAMPLE_RECORDS.length);
    assert.ok(
      published.every((record) => record.routes.explore !== undefined),
      'every published family must publish an Explorer'
    );
  });
});
