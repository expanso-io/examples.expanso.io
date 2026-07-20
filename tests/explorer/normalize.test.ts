import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  inferPayloadFormat,
  normalizeExplorerStages,
} from '../../src/components/ExplorerV2/normalize';
import { nextMobilePanel } from '../../src/components/ExplorerV2/panelTabs';
import type { CanonicallyBoundStage } from '../../src/components/DataPipelineExplorer/types';

function boundStage(
  overrides: Partial<CanonicallyBoundStage> = {}
): CanonicallyBoundStage {
  return {
    id: 1,
    slug: 'remove-payment-fields',
    title: 'Step 1: Remove payment fields',
    description: 'Remove the selected fields from the synthetic record.',
    inputLines: [
      { content: '"card": "1234"', indent: 1, type: 'removed' },
      { content: '"event": "purchase"', indent: 1 },
    ],
    outputLines: [
      { content: '"event": "purchase"', indent: 1, type: 'highlighted' },
    ],
    yamlCode: 'pipeline: {}',
    yamlFilename: 'remove.yaml',
    ...overrides,
  };
}

describe('Explorer V2 stage normalization', () => {
  it('preserves the canonical slug and color-independent diff states', () => {
    const [stage] = normalizeExplorerStages(
      [boundStage()],
      'curated-explanation'
    );

    assert.equal(stage.slug, 'remove-payment-fields');
    assert.equal(stage.title, 'Remove payment fields');
    assert.deepEqual(
      stage.inputLines.map((line) => line.state),
      ['removed', 'unchanged']
    );
    assert.equal(stage.outputLines[0].state, 'changed');
    assert.equal(stage.provenance, 'curated-explanation');
  });

  it('rejects duplicate slugs instead of silently creating unstable URLs', () => {
    assert.throws(
      () =>
        normalizeExplorerStages(
          [boundStage(), boundStage({ id: 2, title: 'Remove payment fields' })],
          'curated-explanation'
        ),
      /slugs must be unique/
    );
  });

  it('preserves explicit provenance and semantic stages', () => {
    const [stage] = normalizeExplorerStages(
      [
        {
          slug: 'buffer-paused',
          title: 'Buffer paused',
          description: 'The simulated connection is unavailable.',
          inputLines: [],
          outputLines: [],
          yamlCode: '',
          yamlFilename: 'buffer.yaml',
          provenance: 'deterministic-simulation',
        },
      ],
      'curated-explanation'
    );

    assert.equal(stage.slug, 'buffer-paused');
    assert.equal(stage.provenance, 'deterministic-simulation');
    assert.equal(stage.inputFormat, 'text');
    assert.equal(stage.outputFormat, 'text');
  });

  it('treats legacy emphasis as authored highlights when requested', () => {
    const [stage] = normalizeExplorerStages(
      [boundStage()],
      'curated-explanation',
      'highlights'
    );

    assert.deepEqual(
      stage.inputLines.map((line) => line.state),
      ['changed', 'unchanged']
    );
    assert.equal(stage.outputLines[0].state, 'changed');
    assert.equal(stage.comparisonMode, 'highlights');
  });

  it('rejects a missing explicit slug', () => {
    assert.throws(
      () =>
        normalizeExplorerStages(
          [boundStage({ slug: '' })],
          'curated-explanation'
        ),
      /no stable explicit slug/
    );
  });

  it('infers non-JSON payload formats without relabeling them as JSON', () => {
    assert.equal(
      inferPayloadFormat([{ content: 'source -> edge', indent: 0 }]),
      'route'
    );
    assert.equal(
      inferPayloadFormat([{ content: 'id\tstatus', indent: 0 }]),
      'tabular'
    );
    assert.equal(
      inferPayloadFormat([{ content: 'plain text payload', indent: 0 }]),
      'text'
    );
  });
});

describe('Explorer V2 mobile tab navigation', () => {
  it('wraps horizontal arrow navigation across all panels', () => {
    assert.equal(nextMobilePanel('input', 'ArrowLeft'), 'output');
    assert.equal(nextMobilePanel('input', 'ArrowRight'), 'output');
    assert.equal(nextMobilePanel('output', 'ArrowRight'), 'input');
  });

  it('supports Home and End without intercepting unrelated keys', () => {
    assert.equal(nextMobilePanel('output', 'Home'), 'input');
    assert.equal(nextMobilePanel('input', 'End'), 'output');
    assert.equal(nextMobilePanel('output', 'Tab'), null);
    assert.equal(nextMobilePanel('output', 'ArrowDown'), null);
  });
});
