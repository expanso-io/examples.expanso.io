import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import { resolveCatalogExplorerBinding } from '../../src/catalog/explorerBinding';
import { bindCanonicalExplorerStages } from '../../src/catalog/explorerStageBinding';
import {
  GENERATED_EXPLORER_STAGE_CONFIGS,
  type GeneratedExplorerStageFamily,
} from '../../src/catalog/explorerStageConfigs.generated';
import { EXAMPLE_RECORDS } from '../../src/catalog/registry';
import type { Stage } from '../../src/components/DataPipelineExplorer/types';

const exampleId = 'circuit-breakers';
const binding = resolveCatalogExplorerBinding(exampleId);
const family = GENERATED_EXPLORER_STAGE_CONFIGS[exampleId];

function sourceStages(
  generatedFamily: GeneratedExplorerStageFamily = family
): Stage[] {
  return generatedFamily.stages.map((stage) => ({
    id: stage.id,
    slug: stage.slug,
    title: stage.title,
    description: `Description for ${stage.slug}`,
    inputLines: [{ content: '{', indent: 0 }],
    outputLines: [{ content: '}', indent: 0 }],
  }));
}

function bind(
  stages: readonly Stage[] = sourceStages(),
  generatedFamily: GeneratedExplorerStageFamily | undefined = family,
  fullYaml = family.fullYaml,
  fullYamlFilename = family.fullYamlFilename
) {
  return bindCanonicalExplorerStages(
    binding,
    stages,
    fullYaml,
    fullYamlFilename,
    generatedFamily
  );
}

describe('canonical Explorer stage binding', () => {
  it('binds all 21 Explorers to exact full-pipeline and stage YAML bytes', () => {
    const explorerRecords = EXAMPLE_RECORDS.filter(
      ({ routes }) => routes.explore !== undefined
    );
    assert.equal(explorerRecords.length, 21);

    for (const record of explorerRecords) {
      const generatedFamily = GENERATED_EXPLORER_STAGE_CONFIGS[record.id];
      assert.ok(generatedFamily, `${record.id} has a generated family`);
      assert.equal(
        generatedFamily.fullYaml,
        readFileSync(record.completePipelinePath!, 'utf8'),
        `${record.id} full-pipeline bytes`
      );
      const bound = bindCanonicalExplorerStages(
        resolveCatalogExplorerBinding(record.id),
        sourceStages(generatedFamily),
        generatedFamily.fullYaml,
        generatedFamily.fullYamlFilename,
        generatedFamily
      );
      assert.deepEqual(
        bound.map(({ yamlCode }) => yamlCode),
        generatedFamily.stages.map(({ yamlCode }) => yamlCode)
      );
    }
  });

  it('ignores authored YAML and overwrites it with canonical bytes', () => {
    const stages = sourceStages().map((stage) => ({
      ...stage,
      yamlCode: 'tampered: true',
      yamlFilename: 'tampered.yaml',
    }));
    const bound = bind(stages);
    assert.equal(bound[0].yamlCode, family.stages[0].yamlCode);
    assert.equal(bound[0].yamlFilename, family.stages[0].yamlFilename);
  });

  it('rejects a missing generated family', () => {
    assert.throws(
      () =>
        bindCanonicalExplorerStages(
          { ...binding, exampleId: 'missing-generated-family' },
          sourceStages(),
          family.fullYaml,
          family.fullYamlFilename
        ),
      /no generated stage/
    );
  });

  it('rejects missing, extra, or reordered source stages', () => {
    const stages = sourceStages();
    assert.throws(() => bind(stages.slice(1)), /stage count is stale/);
    assert.throws(() => bind([...stages, stages[0]]), /stage count is stale/);
    assert.throws(
      () => bind([stages[1], stages[0], ...stages.slice(2)]),
      /identity is stale or reordered/
    );
  });

  it('rejects duplicate, missing, or mismatched source slugs', () => {
    const duplicate = sourceStages();
    duplicate[1] = { ...duplicate[1], slug: duplicate[0].slug };
    assert.throws(() => bind(duplicate), /slugs are duplicated/);

    const missing = sourceStages();
    missing[0] = { ...missing[0], slug: undefined as unknown as string };
    assert.throws(() => bind(missing), /no stable explicit slug/);

    const mismatch = sourceStages();
    mismatch[0] = { ...mismatch[0], slug: 'wrong-slug' };
    assert.throws(() => bind(mismatch), /identity is stale or reordered/);
  });

  it('rejects mismatched IDs, titles, and generated order', () => {
    const wrongId = sourceStages();
    wrongId[0] = { ...wrongId[0], id: 7 };
    assert.throws(() => bind(wrongId), /identity is stale or reordered/);

    const wrongTitle = sourceStages();
    wrongTitle[0] = { ...wrongTitle[0], title: 'Changed title' };
    assert.throws(() => bind(wrongTitle), /identity is stale or reordered/);

    const reorderedFamily = {
      ...family,
      stages: [family.stages[1], family.stages[0], ...family.stages.slice(2)],
    };
    assert.throws(
      () => bind(sourceStages(reorderedFamily), reorderedFamily),
      /generated stage order is invalid/
    );
  });

  it('rejects duplicate generated slugs and missing generated YAML', () => {
    const duplicateFamily = {
      ...family,
      stages: family.stages.map((stage, index) =>
        index === 1 ? { ...stage, slug: family.stages[0].slug } : stage
      ),
    };
    assert.throws(
      () => bind(sourceStages(), duplicateFamily),
      /generated stage slugs are duplicated/
    );

    const missingYamlFamily = {
      ...family,
      stages: family.stages.map((stage, index) =>
        index === 0 ? { ...stage, yamlCode: '' } : stage
      ),
    };
    assert.throws(
      () => bind(sourceStages(missingYamlFamily), missingYamlFamily),
      /stage configuration is missing/
    );
  });

  it('rejects stale full-pipeline path, bytes, and filename', () => {
    assert.throws(
      () => bind(sourceStages(), { ...family, canonicalPipelinePath: 'wrong' }),
      /pipeline path is stale/
    );
    assert.throws(
      () => bind(sourceStages(), family, `${family.fullYaml}# drift`),
      /pipeline bytes are stale/
    );
    assert.throws(
      () => bind(sourceStages(), family, family.fullYaml, 'wrong.yaml'),
      /pipeline filename is stale/
    );
  });
});
