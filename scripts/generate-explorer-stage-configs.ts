import { createHash } from 'node:crypto';
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, relative, resolve, sep } from 'node:path';

import ts from 'typescript';
import { format } from 'prettier';
import { parseDocument } from 'yaml';

import { EXAMPLE_RECORDS } from '../src/catalog/registry';
import { buildRemovePiiExplorerStages } from '../src/catalog/removePiiFidelity';
import { EXPLORER_EVIDENCE_SCHEMA_DIGEST } from '../src/catalog/schema';

const MANIFEST_PATH = 'content/explorer-stage-bindings-v1.json';
const GENERATED_MODULE_PATH = 'src/catalog/explorerStageConfigs.generated.ts';
const CONFIG_ROOT = 'examples/explorer-stages';
const SCHEMA_VERSION = 'explorer-stage-bindings-v1';
const NORMALIZATION_ID = 'exact-utf8-final-newline-v1';
const SEMANTICS_VERIFIER_PATH = 'scripts/quality/verify-explorer-provenance.ts';

type SourceStage = {
  id: number;
  slug?: string;
  title: string;
  yamlCode?: string;
  yamlFilename?: string;
};

type BoundStage = {
  id: number;
  slug: string;
  title: string;
  configPath: string;
  configSha256: string;
  yamlFilename: string;
};

type ExplorerBinding = {
  exampleId: string;
  sourceKind: 'canonical-fragment-files' | 'remove-pii-canonical-generator';
  stageModule: string;
  stageExport: string;
  canonicalPipelinePath: string;
  pipelineSha256: string;
  stages: BoundStage[];
};

type StageManifest = {
  schemaVersion: typeof SCHEMA_VERSION;
  normalization: typeof NORMALIZATION_ID;
  explorers: ExplorerBinding[];
};

function sha256(bytes: string | Buffer): string {
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
}

function exactBytes(source: string): string {
  return `${source.replace(/\r\n/g, '\n').trimEnd()}\n`;
}

function listYamlFiles(directory: string): string[] {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory()) return listYamlFiles(path);
    return entry.isFile() && entry.name.endsWith('.yaml') ? [path] : [];
  });
}

function slugify(value: string): string {
  const slug = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/^step\s*\d+\s*:\s*/i, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!slug) throw new Error(`Cannot derive a stable stage slug from ${value}`);
  return slug;
}

function parseStageImport(mdxPath: string): {
  stageModule: string;
  stageExport: string;
} {
  const source = readFileSync(mdxPath, 'utf8');
  const match = source.match(
    /import \{ (\w+) \} from ['"]([^'"]+(?:stages|full\.stages)(?:\.ts)?)['"]/
  );
  if (!match) throw new Error(`Stage import is absent from ${mdxPath}`);
  const modulePath = resolve(
    dirname(mdxPath),
    match[2].replace(/\.ts$/, '') + '.ts'
  );
  return {
    stageModule: relative(process.cwd(), modulePath).replaceAll('\\', '/'),
    stageExport: match[1],
  };
}

async function loadStages(binding: {
  stageModule: string;
  stageExport: string;
}): Promise<SourceStage[]> {
  const source = readFileSync(binding.stageModule, 'utf8');
  if (/^import\s+(?!type\b)/m.test(source)) {
    throw new Error(
      `${binding.stageModule} has runtime imports and needs an explicit Node-safe loader`
    );
  }
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: binding.stageModule,
  }).outputText;
  const imported = await import(
    `data:text/javascript;base64,${Buffer.from(transpiled).toString('base64')}`
  );
  const stages = imported[binding.stageExport];
  if (!Array.isArray(stages)) {
    throw new Error(
      `${binding.stageModule} does not export ${binding.stageExport} as an array`
    );
  }
  return stages as SourceStage[];
}

function loadRemovePiiStages(): SourceStage[] {
  return buildRemovePiiExplorerStages(
    readFileSync('examples/data-security/remove-pii-complete.yaml', 'utf8'),
    readFileSync('examples/data-security/remove-pii/sample-data.json', 'utf8'),
    readFileSync(
      'examples/data-security/remove-pii/fixture-environment.json',
      'utf8'
    ),
    readFileSync(
      'examples/data-security/remove-pii/expected-output.jsonl',
      'utf8'
    )
  );
}

async function loadExplorerStages(
  exampleId: string,
  binding: { stageModule: string; stageExport: string }
): Promise<SourceStage[]> {
  return exampleId === 'remove-pii'
    ? loadRemovePiiStages()
    : loadStages(binding);
}

function assertValidYaml(source: string, location: string): void {
  const document = parseDocument(source, {
    strict: true,
    uniqueKeys: true,
  });
  const findings = [...document.errors, ...document.warnings];
  if (findings.length > 0) {
    throw new Error(
      `${location} is not warning-free YAML:\n${findings
        .map((finding) => `- ${finding.message}`)
        .join('\n')}`
    );
  }
  if (document.contents === null) {
    throw new Error(`${location} is empty YAML`);
  }
}

function validateStageIdentity(
  stages: SourceStage[],
  location: string,
  requireExplicitSlugs = false
): Array<SourceStage & { slug: string; slugWasExplicit: boolean }> {
  const result = stages.map((stage, index) => {
    if (stage.id !== index + 1) {
      throw new Error(
        `${location} stage ${index + 1} has non-sequential id ${stage.id}`
      );
    }
    if (!stage.title?.trim()) {
      throw new Error(`${location} stage ${stage.id} has no title`);
    }
    const slugWasExplicit = Object.hasOwn(stage, 'slug');
    if (requireExplicitSlugs && !slugWasExplicit) {
      throw new Error(`${location} stage ${stage.id} has no explicit slug`);
    }
    const slug = stage.slug ?? slugify(stage.title);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      throw new Error(`${location} stage ${stage.id} has invalid slug ${slug}`);
    }
    return { ...stage, slug, slugWasExplicit };
  });
  const slugs = result.map(({ slug }) => slug);
  if (new Set(slugs).size !== slugs.length) {
    throw new Error(`${location} has duplicate stage slugs`);
  }
  return result;
}

async function renderGeneratedModule(
  manifest: StageManifest,
  manifestBytes: string,
  configBytes: ReadonlyMap<string, string>,
  pipelineBytes: ReadonlyMap<string, string>
): Promise<string> {
  const entries = manifest.explorers.map((explorer) => {
    const stages = explorer.stages.map((stage) => ({
      id: stage.id,
      slug: stage.slug,
      title: stage.title,
      yamlFilename: stage.yamlFilename,
      yamlCode: configBytes.get(stage.configPath),
      configSha256: stage.configSha256,
    }));
    if (stages.some(({ yamlCode }) => yamlCode === undefined)) {
      throw new Error(`Generated bytes are missing for ${explorer.exampleId}`);
    }
    const fullYaml = pipelineBytes.get(explorer.canonicalPipelinePath);
    if (fullYaml === undefined) {
      throw new Error(
        `Generated pipeline bytes are missing for ${explorer.exampleId}`
      );
    }
    return `  ${JSON.stringify(explorer.exampleId)}: ${JSON.stringify({
      canonicalPipelinePath: explorer.canonicalPipelinePath,
      pipelineSha256: explorer.pipelineSha256,
      fullYamlFilename: basename(explorer.canonicalPipelinePath),
      fullYaml,
      stages,
    })},`;
  });
  const recordById = new Map(
    EXAMPLE_RECORDS.map((record) => [record.id, record])
  );
  const evidenceEntries = manifest.explorers.flatMap((explorer) => {
    const record = recordById.get(explorer.exampleId);
    if (!record) {
      throw new Error(`Catalog record is missing for ${explorer.exampleId}`);
    }
    if (record.executionStatus !== 'architecture-only') return [];
    const firstStage = explorer.stages.at(0);
    const lastStage = explorer.stages.at(-1);
    if (!firstStage || !lastStage) {
      throw new Error(`${explorer.exampleId} has no evidence checkpoints`);
    }
    const evidence = {
      exampleId: record.id,
      kind: 'curated-explanation',
      verificationId: `${record.id}-curated-stage-binding-v1`,
      schemaDigest: EXPLORER_EVIDENCE_SCHEMA_DIGEST,
      canonicalPipelinePath: explorer.canonicalPipelinePath,
      pipelineSha256: explorer.pipelineSha256,
      bindingManifestPath: MANIFEST_PATH,
      bindingManifestSha256: sha256(manifestBytes),
      authoredStageModulePath: explorer.stageModule,
      authoredStageModuleSha256: sha256(readFileSync(explorer.stageModule)),
      inputCheckpointPath: firstStage.configPath,
      inputCheckpointSha256: firstStage.configSha256,
      outputCheckpointPath: lastStage.configPath,
      outputCheckpointSha256: lastStage.configSha256,
      fidelityOraclePath: 'scripts/generate-explorer-stage-configs.ts',
      fidelityOracleSha256: sha256(
        readFileSync('scripts/generate-explorer-stage-configs.ts')
      ),
      semanticsVerifierPath: SEMANTICS_VERIFIER_PATH,
      semanticsVerifierSha256: sha256(readFileSync(SEMANTICS_VERIFIER_PATH)),
      stageCount: explorer.stages.length,
      command: 'npm run validate-catalog',
      environment: 'phase1-foundation-node-20.19.4',
      toolVersions: {
        docusaurus: '3.9.2',
        node: '20.19.4',
      },
      generatedAt: `${record.lastTechnicalVerification}T00:00:00Z`,
      verifierLane: record.verifierLane,
      executionStatus: record.executionStatus,
      operationalEvidence: record.operationalEvidence,
    };
    return [
      `  ${JSON.stringify(explorer.exampleId)}: ${JSON.stringify(evidence)},`,
    ];
  });
  return format(
    `/**
 * Generated by scripts/generate-explorer-stage-configs.ts.
 * Do not edit: canonical source bytes live under examples/explorer-stages/.
 */
import type { ExplorerEvidence } from './schema';

export interface GeneratedExplorerStageConfig {
  readonly id: number;
  readonly slug: string;
  readonly title: string;
  readonly yamlFilename: string;
  readonly yamlCode: string;
  readonly configSha256: \`sha256:\${string}\`;
}

export interface GeneratedExplorerStageFamily {
  readonly canonicalPipelinePath: string;
  readonly pipelineSha256: \`sha256:\${string}\`;
  readonly fullYamlFilename: string;
  readonly fullYaml: string;
  readonly stages: readonly GeneratedExplorerStageConfig[];
}

export const GENERATED_EXPLORER_STAGE_CONFIGS: Readonly<
  Record<string, GeneratedExplorerStageFamily>
> = {
${entries.join('\n')}
};

export const GENERATED_ARCHITECTURE_EXPLORER_EVIDENCE: Readonly<
  Record<string, ExplorerEvidence>
> = {
${evidenceEntries.join('\n')}
};
`,
    { parser: 'typescript' }
  );
}

function insertExplicitStageSlugs(
  source: string,
  stages: readonly (SourceStage & {
    slug: string;
    slugWasExplicit: boolean;
  })[],
  location: string
): string {
  let result = source;
  for (const stage of stages) {
    if (stage.slugWasExplicit) continue;
    const pattern = new RegExp(`^(\\s*)id:\\s*${stage.id},\\r?$`, 'm');
    const matches = result.match(new RegExp(pattern.source, 'gm')) ?? [];
    if (matches.length !== 1) {
      throw new Error(
        `${location} stage ${stage.id} has ${matches.length} literal id anchors`
      );
    }
    result = result.replace(
      pattern,
      `$&\n$1slug: ${JSON.stringify(stage.slug)},`
    );
  }
  return result;
}

function stripLegacyYamlOwnership(
  source: string,
  expectedStages: number,
  location: string
): string {
  const filenamePattern = /^[ \t]*yamlFilename:\s*['"][^'"\r\n]+['"],\r?\n/gm;
  const codePattern = /^[ \t]*yamlCode:\s*`[\s\S]*?`,\r?\n/gm;
  const filenameCount = source.match(filenamePattern)?.length ?? 0;
  const codeCount = source.match(codePattern)?.length ?? 0;
  const alreadyMigrated = filenameCount === 0 && codeCount === 0;
  if (
    !alreadyMigrated &&
    (filenameCount !== expectedStages || codeCount !== expectedStages)
  ) {
    throw new Error(
      `${location} has ${filenameCount} yamlFilename and ${codeCount} yamlCode literals for ${expectedStages} stages`
    );
  }
  return source.replace(filenamePattern, '').replace(codePattern, '');
}

function readManifest(): StageManifest {
  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) as unknown;
  if (
    typeof manifest !== 'object' ||
    manifest === null ||
    !('schemaVersion' in manifest) ||
    manifest.schemaVersion !== SCHEMA_VERSION ||
    !('normalization' in manifest) ||
    manifest.normalization !== NORMALIZATION_ID ||
    !('explorers' in manifest) ||
    !Array.isArray(manifest.explorers)
  ) {
    throw new Error(`${MANIFEST_PATH} does not use ${SCHEMA_VERSION}`);
  }
  const digestPattern = /^sha256:[a-f0-9]{64}$/;
  for (const [explorerIndex, explorer] of manifest.explorers.entries()) {
    const location = `${MANIFEST_PATH} Explorer ${explorerIndex + 1}`;
    if (
      typeof explorer !== 'object' ||
      explorer === null ||
      !('exampleId' in explorer) ||
      typeof explorer.exampleId !== 'string' ||
      !('sourceKind' in explorer) ||
      !['canonical-fragment-files', 'remove-pii-canonical-generator'].includes(
        String(explorer.sourceKind)
      ) ||
      !('stageModule' in explorer) ||
      typeof explorer.stageModule !== 'string' ||
      !('stageExport' in explorer) ||
      typeof explorer.stageExport !== 'string' ||
      !('canonicalPipelinePath' in explorer) ||
      typeof explorer.canonicalPipelinePath !== 'string' ||
      !('pipelineSha256' in explorer) ||
      typeof explorer.pipelineSha256 !== 'string' ||
      !digestPattern.test(explorer.pipelineSha256) ||
      !('stages' in explorer) ||
      !Array.isArray(explorer.stages)
    ) {
      throw new Error(`${location} is structurally invalid`);
    }
    for (const [stageIndex, stage] of explorer.stages.entries()) {
      if (
        typeof stage !== 'object' ||
        stage === null ||
        !('id' in stage) ||
        !Number.isInteger(stage.id) ||
        Number(stage.id) < 1 ||
        !('slug' in stage) ||
        typeof stage.slug !== 'string' ||
        !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(stage.slug) ||
        !('title' in stage) ||
        typeof stage.title !== 'string' ||
        !stage.title.trim() ||
        !('configPath' in stage) ||
        typeof stage.configPath !== 'string' ||
        !('configSha256' in stage) ||
        typeof stage.configSha256 !== 'string' ||
        !digestPattern.test(stage.configSha256) ||
        !('yamlFilename' in stage) ||
        typeof stage.yamlFilename !== 'string' ||
        !stage.yamlFilename
      ) {
        throw new Error(
          `${location} stage ${stageIndex + 1} is structurally invalid`
        );
      }
    }
  }
  return manifest as StageManifest;
}

async function bootstrap(): Promise<void> {
  if (existsSync(MANIFEST_PATH)) {
    throw new Error(
      `${MANIFEST_PATH} already exists; bootstrap is a one-time migration`
    );
  }
  const explorers: ExplorerBinding[] = [];
  const configBytes = new Map<string, string>();
  const pipelineBytes = new Map<string, string>();
  const configWrites = new Map<string, string>();
  const moduleWrites = new Map<string, string>();

  for (const record of EXAMPLE_RECORDS.filter(({ routes }) => routes.explore)) {
    if (!record.completePipelinePath) {
      throw new Error(`${record.id} has no canonical complete pipeline`);
    }
    const mdxPath = `docs${record.routes.explore.replace(/\/$/, '')}.mdx`;
    const stageSource = parseStageImport(mdxPath);
    const stages = validateStageIdentity(
      await loadExplorerStages(record.id, stageSource),
      record.id
    );
    const canonicalPipelineBytes = readFileSync(
      record.completePipelinePath,
      'utf8'
    );
    pipelineBytes.set(record.completePipelinePath, canonicalPipelineBytes);

    if (record.id === 'remove-pii') {
      const boundStages = stages.map((stage) => {
        if (!stage.yamlCode || !stage.yamlFilename) {
          throw new Error(`remove-pii stage ${stage.id} has no canonical YAML`);
        }
        const bytes = exactBytes(stage.yamlCode);
        assertValidYaml(bytes, `remove-pii/${stage.slug}`);
        const configPath = `${record.completePipelinePath}#${stage.slug}`;
        configBytes.set(configPath, bytes);
        return {
          id: stage.id,
          slug: stage.slug,
          title: stage.title,
          configPath,
          configSha256: sha256(bytes),
          yamlFilename: stage.yamlFilename,
        };
      });
      explorers.push({
        exampleId: record.id,
        sourceKind: 'remove-pii-canonical-generator',
        ...stageSource,
        canonicalPipelinePath: record.completePipelinePath,
        pipelineSha256: sha256(canonicalPipelineBytes),
        stages: boundStages,
      });
      continue;
    }

    const boundStages = stages.map((stage) => {
      const yamlFilename = `${String(stage.id).padStart(2, '0')}-${stage.slug}.yaml`;
      const configPath = `${CONFIG_ROOT}/${record.id}/${yamlFilename}`;
      const bytes = stage.yamlCode
        ? exactBytes(stage.yamlCode)
        : existsSync(configPath)
          ? readFileSync(configPath, 'utf8')
          : undefined;
      if (bytes === undefined) {
        throw new Error(
          `${record.id} stage ${stage.id} has neither legacy nor canonical YAML`
        );
      }
      const canonicalBytes = exactBytes(bytes);
      assertValidYaml(canonicalBytes, `${record.id}/${stage.slug}`);
      if (
        existsSync(configPath) &&
        readFileSync(configPath, 'utf8') !== canonicalBytes
      ) {
        throw new Error(`${configPath} conflicts with the legacy stage YAML`);
      }
      configWrites.set(configPath, canonicalBytes);
      configBytes.set(configPath, canonicalBytes);
      return {
        id: stage.id,
        slug: stage.slug,
        title: stage.title,
        configPath,
        configSha256: sha256(canonicalBytes),
        yamlFilename,
      };
    });

    const sourcePath = resolve(stageSource.stageModule);
    const source = readFileSync(sourcePath, 'utf8');
    const withSlugs = insertExplicitStageSlugs(
      source,
      stages,
      stageSource.stageModule
    );
    moduleWrites.set(
      sourcePath,
      stripLegacyYamlOwnership(
        withSlugs,
        stages.length,
        stageSource.stageModule
      )
    );

    explorers.push({
      exampleId: record.id,
      sourceKind: 'canonical-fragment-files',
      ...stageSource,
      canonicalPipelinePath: record.completePipelinePath,
      pipelineSha256: sha256(canonicalPipelineBytes),
      stages: boundStages,
    });
  }

  const manifest: StageManifest = {
    schemaVersion: SCHEMA_VERSION,
    normalization: NORMALIZATION_ID,
    explorers,
  };
  const plannedConfigPaths = new Set(configWrites.keys());
  const preexistingUnbound = listYamlFiles(CONFIG_ROOT).filter(
    (path) => !plannedConfigPaths.has(path)
  );
  if (preexistingUnbound.length > 0) {
    throw new Error(
      `Bootstrap found unbound canonical stage files:\n${preexistingUnbound.join('\n')}`
    );
  }
  const generated = await renderGeneratedModule(
    manifest,
    `${JSON.stringify(manifest, null, 2)}\n`,
    configBytes,
    pipelineBytes
  );
  for (const [path, bytes] of configWrites) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, bytes);
  }
  for (const [path, source] of moduleWrites) {
    writeFileSync(path, source);
  }
  mkdirSync(dirname(MANIFEST_PATH), { recursive: true });
  writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
  writeFileSync(GENERATED_MODULE_PATH, generated);
}

async function validateAndRender(
  manifest: StageManifest
): Promise<{ generated: string; explorerCount: number; stageCount: number }> {
  const catalogExplorers = EXAMPLE_RECORDS.filter(
    ({ routes }) => routes.explore
  );
  if (manifest.explorers.length !== catalogExplorers.length) {
    throw new Error(
      `Manifest has ${manifest.explorers.length} explorers; catalog has ${catalogExplorers.length}`
    );
  }
  const manifestIds = manifest.explorers.map(({ exampleId }) => exampleId);
  if (new Set(manifestIds).size !== manifestIds.length) {
    throw new Error('Manifest has duplicate Explorer ids');
  }
  const configPaths = new Set<string>();
  const canonicalFilePaths = new Set<string>();
  const configBytes = new Map<string, string>();
  const pipelineBytes = new Map<string, string>();
  let stageCount = 0;

  for (const [recordIndex, record] of catalogExplorers.entries()) {
    const binding = manifest.explorers[recordIndex];
    if (binding?.exampleId !== record.id) {
      throw new Error(
        `Manifest Explorer ${recordIndex + 1} must be ${record.id}; found ${binding?.exampleId ?? 'missing'}`
      );
    }
    if (!record.completePipelinePath) {
      throw new Error(`${record.id} has no canonical complete pipeline`);
    }
    const expectedSourceKind =
      record.id === 'remove-pii'
        ? 'remove-pii-canonical-generator'
        : 'canonical-fragment-files';
    if (binding.sourceKind !== expectedSourceKind) {
      throw new Error(
        `${record.id} has invalid source kind ${binding.sourceKind}`
      );
    }
    const mdxPath = `docs${record.routes.explore!.replace(/\/$/, '')}.mdx`;
    const currentStageSource = parseStageImport(mdxPath);
    if (
      binding.stageModule !== currentStageSource.stageModule ||
      binding.stageExport !== currentStageSource.stageExport
    ) {
      throw new Error(`${record.id} stage module binding is stale`);
    }
    const canonicalPipelineBytes = readFileSync(
      record.completePipelinePath,
      'utf8'
    );
    if (
      binding.canonicalPipelinePath !== record.completePipelinePath ||
      binding.pipelineSha256 !== sha256(canonicalPipelineBytes)
    ) {
      throw new Error(`${record.id} canonical pipeline binding is stale`);
    }
    pipelineBytes.set(record.completePipelinePath, canonicalPipelineBytes);
    const sourceStages = validateStageIdentity(
      await loadExplorerStages(record.id, binding),
      record.id,
      true
    );
    if (sourceStages.length !== binding.stages.length) {
      throw new Error(`${record.id} stage count does not match its manifest`);
    }
    if (
      new Set(binding.stages.map(({ slug }) => slug)).size !==
      binding.stages.length
    ) {
      throw new Error(`${record.id} manifest has duplicate stage slugs`);
    }

    for (const [index, stage] of binding.stages.entries()) {
      stageCount += 1;
      const sourceStage = sourceStages[index];
      if (
        stage.id !== sourceStage.id ||
        stage.slug !== sourceStage.slug ||
        stage.title !== sourceStage.title
      ) {
        throw new Error(`${record.id} stage ${index + 1} identity is stale`);
      }
      if (configPaths.has(stage.configPath)) {
        throw new Error(`Duplicate stage config path: ${stage.configPath}`);
      }
      configPaths.add(stage.configPath);
      if (binding.sourceKind === 'canonical-fragment-files') {
        if (
          Object.hasOwn(sourceStage, 'yamlCode') ||
          Object.hasOwn(sourceStage, 'yamlFilename')
        ) {
          throw new Error(
            `${record.id} stage ${stage.id} still controls displayed YAML`
          );
        }
        const expectedFilename = `${String(stage.id).padStart(2, '0')}-${stage.slug}.yaml`;
        const expectedPath = `${CONFIG_ROOT}/${record.id}/${expectedFilename}`;
        if (
          stage.configPath !== expectedPath ||
          stage.yamlFilename !== expectedFilename
        ) {
          throw new Error(
            `${record.id} stage ${stage.id} canonical path is stale`
          );
        }
        canonicalFilePaths.add(stage.configPath);
        const absolutePath = resolve(stage.configPath);
        const absoluteRoot = resolve(CONFIG_ROOT);
        if (!absolutePath.startsWith(`${absoluteRoot}${sep}`)) {
          throw new Error(`${stage.configPath} escapes ${CONFIG_ROOT}`);
        }
        if (!existsSync(absolutePath)) {
          throw new Error(`${stage.configPath} does not exist`);
        }
        const stats = lstatSync(absolutePath);
        if (!stats.isFile() || stats.isSymbolicLink()) {
          throw new Error(`${stage.configPath} is not a regular file`);
        }
        const bytes = readFileSync(absolutePath, 'utf8');
        if (bytes !== exactBytes(bytes)) {
          throw new Error(`${stage.configPath} is not canonically normalized`);
        }
        assertValidYaml(bytes, stage.configPath);
        if (stage.configSha256 !== sha256(bytes)) {
          throw new Error(`${stage.configPath} digest is stale`);
        }
        configBytes.set(stage.configPath, bytes);
      } else {
        const expectedPath = `${record.completePipelinePath}#${stage.slug}`;
        const bytes = sourceStage.yamlCode
          ? exactBytes(sourceStage.yamlCode)
          : undefined;
        if (
          bytes === undefined ||
          !sourceStage.yamlFilename ||
          stage.configPath !== expectedPath ||
          stage.yamlFilename !== sourceStage.yamlFilename ||
          stage.configSha256 !== sha256(bytes)
        ) {
          throw new Error(
            `remove-pii stage ${stage.id} generator binding is stale`
          );
        }
        assertValidYaml(bytes, expectedPath);
        configBytes.set(stage.configPath, bytes);
      }
    }
  }

  const inventoriedFiles = listYamlFiles(CONFIG_ROOT);
  const inventoriedSet = new Set(inventoriedFiles);
  const unbound = inventoriedFiles.filter(
    (path) => !canonicalFilePaths.has(path)
  );
  const missing = [...canonicalFilePaths].filter(
    (path) => !inventoriedSet.has(path)
  );
  if (unbound.length > 0 || missing.length > 0) {
    throw new Error(
      `Canonical stage inventory drift: ${unbound.length} unbound, ${missing.length} missing` +
        `${unbound.length ? `\nUnbound:\n${unbound.join('\n')}` : ''}` +
        `${missing.length ? `\nMissing:\n${missing.join('\n')}` : ''}`
    );
  }

  return {
    generated: await renderGeneratedModule(
      manifest,
      readFileSync(MANIFEST_PATH, 'utf8'),
      configBytes,
      pipelineBytes
    ),
    explorerCount: manifest.explorers.length,
    stageCount,
  };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const bootstrapMode = args.includes('--bootstrap-from-legacy');
  const writeMode = args.includes('--write');
  if (
    args.some((arg) => !['--bootstrap-from-legacy', '--write'].includes(arg))
  ) {
    throw new Error(`Unknown argument: ${args.join(' ')}`);
  }
  if (bootstrapMode) {
    await bootstrap();
  }

  const manifest = readManifest();
  const result = await validateAndRender(manifest);
  if (result.stageCount !== 100) {
    throw new Error(`Expected 100 bound stages, received ${result.stageCount}`);
  }
  if (writeMode || bootstrapMode) {
    writeFileSync(GENERATED_MODULE_PATH, result.generated);
  } else if (
    !existsSync(GENERATED_MODULE_PATH) ||
    readFileSync(GENERATED_MODULE_PATH, 'utf8') !== result.generated
  ) {
    throw new Error(
      `${GENERATED_MODULE_PATH} is stale; run npm run stages:canonical:write`
    );
  }
  process.stdout.write(
    `Canonical Explorer stages PASS: ${result.explorerCount} explorers / ${result.stageCount} stages / ${result.stageCount} canonical-bound / 0 unbound / 0 duplicate output paths.\n`
  );
}

main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`
  );
  process.exitCode = 1;
});
