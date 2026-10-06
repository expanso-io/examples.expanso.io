import assert from 'node:assert/strict';
import { it } from 'node:test';

import { GENERATED_EXPLORER_STAGES } from '../../src/catalog/explorerStageFamilies.generated/motherduck-retail-analytics';
import { normalizeExplorerStages } from '../../src/components/ExplorerV2/normalize';

it('keeps retail stage results visible in Highlights only mode', () => {
  const stages = normalizeExplorerStages(
    GENERATED_EXPLORER_STAGES,
    'curated-explanation',
    'highlights'
  );

  for (const stage of stages) {
    assert.ok(
      stage.outputLines.some((line) => line.state === 'changed'),
      `${stage.slug} has a visible highlighted result`
    );
  }

  const enrichment = stages[1].outputLines;
  assert.equal(
    enrichment.find((line) => line.content === '"store_region": "SW",')?.state,
    'changed'
  );
  assert.equal(
    enrichment.find((line) => line.content === '"store_id": 6,')?.state,
    'unchanged'
  );
  assert.equal(
    stages[2].outputLines.find(
      (line) => line.content === '"is_anomaly": false,'
    )?.state,
    'changed'
  );
});

it('shows GDPR verification additions without highlighting preserved PII field names', async () => {
  const { GENERATED_EXPLORER_STAGES: gdpr } = await import(
    '../../src/catalog/explorerStageFamilies.generated/cross-border-gdpr'
  );
  const [stage] = normalizeExplorerStages(
    [gdpr[5]],
    'curated-explanation',
    'highlights'
  );
  const timestampIndex = gdpr[5].outputLines.findIndex(
    (line) => 'key' in line && line.key === 'verification_timestamp'
  );
  assert.ok(timestampIndex >= 0);
  assert.equal(stage.outputLines[timestampIndex].state, 'changed');
  assert.deepEqual(
    stage.outputLines
      .filter((line) => line.content === '"customer_id",')
      .map((line) => line.state),
    ['changed', 'unchanged']
  );
  const removedIndex = gdpr[5].outputLines.findIndex(
    (line) => 'key' in line && line.key === 'fields_removed'
  );
  assert.ok(removedIndex >= 0);
  assert.ok(
    stage.outputLines
      .slice(removedIndex, removedIndex + 4)
      .every((line) => line.state === 'changed')
  );
});
