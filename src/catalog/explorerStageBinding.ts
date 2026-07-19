import {
  GENERATED_EXPLORER_STAGE_CONFIGS,
  type GeneratedExplorerStageFamily,
} from './explorerStageConfigs.generated';
import type { CatalogExplorerBinding } from './explorerBinding';
import type {
  CanonicallyBoundStage,
  Stage,
} from '../components/DataPipelineExplorer/types';

function assertStableSlug(
  slug: unknown,
  location: string
): asserts slug is string {
  if (typeof slug !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new Error(`${location} has no stable explicit slug`);
  }
}

/**
 * Bind presentation-only stage data to generated canonical configuration.
 *
 * The authored stage modules own explanations and sample input/output only.
 * Canonical YAML, filenames, ordering, and stable URLs come from the generated
 * stage family. Every mismatch throws instead of producing a partial Explorer.
 */
export function bindCanonicalExplorerStages(
  binding: CatalogExplorerBinding,
  rawStages: readonly Stage[],
  fullYaml: string,
  fullYamlFilename: string,
  generatedFamily:
    | GeneratedExplorerStageFamily
    | undefined = GENERATED_EXPLORER_STAGE_CONFIGS[binding.exampleId]
): CanonicallyBoundStage[] {
  if (!generatedFamily) {
    throw new Error(
      `Explorer has no generated stage configuration: ${binding.exampleId}`
    );
  }
  if (generatedFamily.canonicalPipelinePath !== binding.canonicalPipelinePath) {
    throw new Error(
      `Explorer canonical pipeline path is stale: ${binding.exampleId}`
    );
  }
  if (fullYaml !== generatedFamily.fullYaml) {
    throw new Error(
      `Explorer canonical pipeline bytes are stale: ${binding.exampleId}`
    );
  }
  if (fullYamlFilename !== generatedFamily.fullYamlFilename) {
    throw new Error(
      `Explorer canonical pipeline filename is stale: ${binding.exampleId}`
    );
  }
  if (rawStages.length !== generatedFamily.stages.length) {
    throw new Error(
      `Explorer stage count is stale: ${binding.exampleId} has ${rawStages.length}; expected ${generatedFamily.stages.length}`
    );
  }

  const rawSlugs = rawStages.map(({ slug }, index) => {
    assertStableSlug(slug, `${binding.exampleId} source stage ${index + 1}`);
    return slug;
  });
  if (new Set(rawSlugs).size !== rawSlugs.length) {
    throw new Error(
      `Explorer source stage slugs are duplicated: ${binding.exampleId}`
    );
  }
  const generatedSlugs = generatedFamily.stages.map(({ slug }, index) => {
    assertStableSlug(slug, `${binding.exampleId} generated stage ${index + 1}`);
    return slug;
  });
  if (new Set(generatedSlugs).size !== generatedSlugs.length) {
    throw new Error(
      `Explorer generated stage slugs are duplicated: ${binding.exampleId}`
    );
  }

  return rawStages.map((rawStage, index) => {
    const generatedStage = generatedFamily.stages[index];
    if (generatedStage.id !== index + 1) {
      throw new Error(
        `Explorer generated stage order is invalid: ${binding.exampleId} stage ${index + 1}`
      );
    }
    if (
      rawStage.id !== generatedStage.id ||
      rawStage.slug !== generatedStage.slug ||
      rawStage.title !== generatedStage.title
    ) {
      throw new Error(
        `Explorer stage identity is stale or reordered: ${binding.exampleId} stage ${index + 1}`
      );
    }
    if (!generatedStage.yamlCode || !generatedStage.yamlFilename) {
      throw new Error(
        `Explorer stage configuration is missing: ${binding.exampleId} stage ${index + 1}`
      );
    }
    return {
      ...rawStage,
      slug: generatedStage.slug,
      yamlCode: generatedStage.yamlCode,
      yamlFilename: generatedStage.yamlFilename,
    };
  });
}
