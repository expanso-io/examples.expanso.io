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
