#!/usr/bin/env tsx

/**
 * Generate a fail-closed Explorer V2 draft.
 *
 * The output is deliberately unpublished until catalog, fixture, provenance,
 * fidelity, content, claims, browser, and accessibility gates pass.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export type DraftExecutionStatus = 'requires-integration' | 'architecture-only';
export type DraftPayloadFormat =
  | 'json'
  | 'text'
  | 'binary'
  | 'tabular'
  | 'route';

export interface ExplorerConfig {
  name: string;
  category: string;
  stages: number;
  title: string;
  executionStatus: DraftExecutionStatus;
  integration: string | null;
  payloadFormat: DraftPayloadFormat;
}

export interface ExplorerDraftFiles {
  stages: string;
  overview: string;
  explorer: string;
  reference: string;
  pipeline: string;
}

export interface ExplorerDraftResult {
  status: 'DRAFT_CREATED';
  exampleId: string;
  files: string[];
  catalogRecord: 'present' | 'required';
  sidebar: 'registry-driven; no direct edit made';
  publication: 'blocked until every listed gate passes';
}

const CLAIMS_POLICY_DIGEST =
  'sha256:8d1c6ede95f42b16f4068c7997e7d46d38736d2f93bbf193543b2a52b4e340ab';

const ALLOWED_ARGUMENTS = new Set([
  'name',
  'category',
  'stages',
  'title',
  'execution-status',
  'integration',
  'payload-format',
]);

export function parseArguments(args: string[]): ExplorerConfig {
  const values = new Map<string, string>();
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index];
    const value = args[index + 1];
    if (!flag?.startsWith('--') || !value) {
      throw new Error(`Invalid argument pair at ${flag ?? '<end>'}`);
    }
    const name = flag.slice(2);
    if (!ALLOWED_ARGUMENTS.has(name)) {
      throw new Error(`Unknown argument: --${name}`);
    }
    if (values.has(name)) {
      throw new Error(`Duplicate argument: --${name}`);
    }
    values.set(name, value);
  }

  const name = values.get('name') ?? '';
  const category = values.get('category') ?? '';
  const title = values.get('title') ?? '';
  const stages = Number(values.get('stages'));
  const executionStatus = values.get('execution-status') ?? 'architecture-only';
  const payloadFormat = values.get('payload-format') ?? 'json';
  const integration = values.get('integration')?.trim() || null;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) {
    throw new Error('--name must be a kebab-case id');
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(category)) {
    throw new Error('--category must be a kebab-case docs category');
  }
  if (!title.trim()) throw new Error('--title is required');
  if (!Number.isInteger(stages) || stages < 1 || stages > 8) {
    throw new Error('--stages must be an integer from 1 through 8');
  }
  if (
    executionStatus !== 'requires-integration' &&
    executionStatus !== 'architecture-only'
  ) {
    throw new Error(
      '--execution-status must be requires-integration or architecture-only'
    );
  }
  if (
    payloadFormat !== 'json' &&
    payloadFormat !== 'text' &&
    payloadFormat !== 'binary' &&
    payloadFormat !== 'tabular' &&
    payloadFormat !== 'route'
  ) {
    throw new Error(
      '--payload-format must be json, text, binary, tabular, or route'
    );
  }
  if (executionStatus === 'requires-integration' && integration === null) {
    throw new Error('--integration is required for requires-integration');
  }
  return {
    name,
    category,
    stages,
    title: title.trim(),
    executionStatus,
    integration,
    payloadFormat,
  };
}

function exportName(name: string): string {
  return `${name
    .split('-')
    .map((part) => `${part[0]?.toUpperCase()}${part.slice(1)}`)
    .join('')}Stages`;
}

function payloadPlaceholder(format: DraftPayloadFormat): {
  input: string;
  output: string;
} {
  switch (format) {
    case 'json':
      return {
        input: '{"replace":"with generated fixture checkpoint"}',
        output: '{"replace":"with verified output checkpoint"}',
      };
    case 'text':
      return {
        input: 'replace with generated text fixture checkpoint',
        output: 'replace with verified text output checkpoint',
      };
    case 'binary':
      return {
        input: 'base64:cmVwbGFjZS13aXRoLWJpbmFyeS1maXh0dXJl',
        output: 'base64:cmVwbGFjZS13aXRoLWJpbmFyeS1vdXRwdXQ=',
      };
    case 'tabular':
      return {
        input: 'device_id\tstatus\nreplace-me\traw',
        output: 'device_id\tstatus\nreplace-me\tverified',
      };
    case 'route':
      return {
        input: 'source -> edge processor',
        output: 'edge processor -> replace-with-verified-destination',
      };
  }
}

function quoteTypeScript(value: string): string {
  return JSON.stringify(value);
}

export function stagesModule(config: ExplorerConfig): string {
  const placeholder = payloadPlaceholder(config.payloadFormat);
  const stages = Array.from({ length: config.stages }, (_, index) => {
    const position = index + 1;
    return `  {
    slug: 'stage-${position}',
    title: 'Name stage ${position}',
    description: 'State the observable change and its limit.',
    provenance: 'curated-explanation',
    yamlFilename: 'pipeline.yaml',
    yamlCode: '# Bind this fragment to the canonical pipeline before publishing.',
    inputFormat: '${config.payloadFormat}',
    outputFormat: '${config.payloadFormat}',
    rawInput: ${quoteTypeScript(placeholder.input)},
    rawOutput: ${quoteTypeScript(placeholder.output)},
    inputLines: [
      { content: ${quoteTypeScript(placeholder.input)}, indent: 0, state: 'unchanged' },
    ],
    outputLines: [
      { content: ${quoteTypeScript(placeholder.output)}, indent: 0, state: 'changed' },
    ],
  }`;
  });

  return `import type { ExplorerStage } from '@site/src/components/ExplorerV2';

type DraftPayloadFormat = 'json' | 'text' | 'binary' | 'tabular' | 'route';

interface DraftExplorerStage extends ExplorerStage {
  inputFormat: DraftPayloadFormat;
  outputFormat: DraftPayloadFormat;
}

/** Draft display data. Publish only after the fidelity gate regenerates or verifies every checkpoint. */
export const ${exportName(config.name)}: DraftExplorerStage[] = [
${stages.join(',\n')},
];
`;
}

function frontmatter(config: ExplorerConfig, archetype: string): string {
  return `---
title: ${config.title}${archetype === 'explorer' ? ' Explorer' : ''}
draft: true
contentArchetype: ${archetype}
executionStatus: ${config.executionStatus}
operationalEvidence: not-assessed
${archetype === 'overview' ? "difficulty: advanced\nverificationDate: '2026-07-18'\nexpectedTime: 5 minutes\n" : ''}localNavigation: true
uniqueTasks: [complete-machine-draft]
claimIds: []
claimsVerifiedBy: codex/content-claims-verifier-v1
claimsVerifiedAt: '2026-07-18'
claimsPolicyDigest: ${CLAIMS_POLICY_DIGEST}
---`;
}

function overviewPage(config: ExplorerConfig): string {
  const executionLimit =
    config.executionStatus === 'requires-integration'
      ? `- This generated route requires ${config.integration}; no maintained-environment evidence is bound.`
      : '- This generated route is architecture-only and has no runtime evidence.';
  return `${frontmatter(config, 'overview')}

import { ExampleHeader, Limitations } from '@site/src/components/ExamplePage';

<ExampleHeader
  title="${config.title}"
  outcome="Replace this sentence with one bounded, inspectable outcome."
  primaryAction={{ href: './explorer', label: 'Inspect the pipeline' }}
  difficulty="advanced"
  executionStatus="${config.executionStatus}"
  operationalEvidence="not-assessed"
  expectedTime={{ inspectMinutes: 5 }}
  verifiedAt="2026-07-18"
/>

## System boundary

Define native, adapter, custom-code, and external nodes in the typed catalog before publishing.

## Limitations

<Limitations>

${executionLimit}
- Replace placeholder content with machine-verified fixture, topology, and claim records.

</Limitations>
`;
}

function explorerPage(config: ExplorerConfig): string {
  return `${frontmatter(config, 'explorer')}

import ExplorerV2 from '@site/src/components/ExplorerV2';
import fullYaml from '!!raw-loader!@site/examples/${config.category}/${config.name}/pipeline.yaml';
import { ${exportName(config.name)} } from '../${config.name}-full.stages';

# ${config.title} Explorer

This unpublished ${config.payloadFormat} payload draft must be bound to canonical fixture checkpoints before it can enter discovery.

<ExplorerV2
  exampleId="${config.name}"
  stages={${exportName(config.name)}}
  title="${config.title}"
  subtitle="Draft evidence surface"
  fullYaml={fullYaml}
  fullYamlFilename="pipeline.yaml"
/>
`;
}

function referencePage(config: ExplorerConfig): string {
  const statusGate =
    config.executionStatus === 'requires-integration'
      ? `Bind a maintained-environment result for ${config.integration} before changing evidence state.`
      : 'Keep architecture-only status until the required execution evidence exists.';
  return `${frontmatter(config, 'reference')}

import CodeBlock from '@theme/CodeBlock';
import pipelineYaml from '!!raw-loader!@site/examples/${config.category}/${config.name}/pipeline.yaml';

# ${config.title} Reference

<CodeBlock language="yaml" title="pipeline.yaml">
  {pipelineYaml}
</CodeBlock>

## Publication gates

- Register the family, topology, fixture, and canonical pipeline.
- Generate checkpoints and pass independent fidelity verification.
- ${statusGate}
- Pass content, claims, browser, accessibility, route, and privacy gates.
`;
}

function pipelineDraft(config: ExplorerConfig): string {
  const placeholder = payloadPlaceholder(config.payloadFormat).input;
  const mapping =
    config.payloadFormat === 'json'
      ? `'root = {"fixture": "replace-me"}'`
      : `'root = ${JSON.stringify(placeholder).replaceAll("'", "''")}'`;
  return `name: ${config.name}
type: pipeline
description: Draft configuration; replace and verify before publication.
namespace: examples
# Draft payload format: ${config.payloadFormat}

config:
  input:
    generate:
      mapping: ${mapping}
      interval: 1s
      count: 1
  pipeline:
    processors:
      - mapping: |
          root = this
  output:
    stdout: {}
`;
}

function assertAbsent(paths: string[]): void {
  const existing = paths.filter((path) => existsSync(path));
  if (existing.length > 0) {
    throw new Error(`Refusing to overwrite: ${existing.join(', ')}`);
  }
}

export function renderExplorerDraft(
  config: ExplorerConfig
): ExplorerDraftFiles {
  return {
    stages: stagesModule(config),
    overview: overviewPage(config),
    explorer: explorerPage(config),
    reference: referencePage(config),
    pipeline: pipelineDraft(config),
  };
}

export function createExplorerDraft(
  args: string[],
  repositoryRoot = process.cwd()
): ExplorerDraftResult {
  const config = parseArguments(args);
  const catalog = readFileSync(
    resolve(repositoryRoot, 'src/catalog/registry.ts'),
    'utf8'
  );
  const docsDirectory = resolve(
    repositoryRoot,
    'docs',
    config.category,
    config.name
  );
  const exampleDirectory = resolve(
    repositoryRoot,
    'examples',
    config.category,
    config.name
  );
  const paths = {
    stages: resolve(
      repositoryRoot,
      'docs',
      config.category,
      `${config.name}-full.stages.ts`
    ),
    overview: resolve(docsDirectory, 'index.mdx'),
    explorer: resolve(docsDirectory, 'explorer.mdx'),
    reference: resolve(docsDirectory, 'reference.mdx'),
    pipeline: resolve(exampleDirectory, 'pipeline.yaml'),
  };
  assertAbsent(Object.values(paths));
  const files = renderExplorerDraft(config);
  mkdirSync(docsDirectory, { recursive: true });
  mkdirSync(exampleDirectory, { recursive: true });
  writeFileSync(paths.stages, files.stages);
  writeFileSync(paths.overview, files.overview);
  writeFileSync(paths.explorer, files.explorer);
  writeFileSync(paths.reference, files.reference);
  writeFileSync(paths.pipeline, files.pipeline);

  const catalogState = catalog.includes(`id: '${config.name}'`)
    ? 'present'
    : 'required';
  return {
    status: 'DRAFT_CREATED',
    exampleId: config.name,
    files: Object.values(paths),
    catalogRecord: catalogState,
    sidebar: 'registry-driven; no direct edit made',
    publication: 'blocked until every listed gate passes',
  };
}

function main(): void {
  const result = createExplorerDraft(process.argv.slice(2));
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

const isEntrypoint =
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isEntrypoint) main();
