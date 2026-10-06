/**
 * Discover and classify every pipeline YAML file in the repository.
 *
 * A file is a complete pipeline when it carries both an `input` and an `output`,
 * either at the top level (bare config) or inside an Expanso job `config`
 * block. Everything else that parses is a fragment: a processor list, a single
 * output block, or a tutorial step file. Fragments are still validated, but
 * never executed.
 */

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { basename, dirname } from 'node:path';
import { globSync } from 'glob';
import { parse as parseYaml } from 'yaml';

import { PUBLIC_CATALOG } from '../../src/catalog/registry';
import type { PipelineFile, PipelineKind } from './types';
import {
  isStringValue,
  isYamlObject,
  type YamlObject,
  type YamlValue,
} from './yaml-value';

const INVENTORY_GLOBS = [
  'examples/**/*.{yaml,yml}',
  'static/files/**/*.{yaml,yml}',
  'static/pipelines/**/*.{yaml,yml}',
  'docs/**/pipeline.yaml',
];

/** The pipeline config carried by a document, whether bare or wrapped in a job. */
export function pipelineConfigOf(
  document: YamlValue | undefined
): YamlObject | null {
  if (document === undefined || !isYamlObject(document)) return null;

  if (document.config !== undefined && isYamlObject(document.config)) {
    const config = { ...document.config };

    for (const key of ['buffer', 'cache_resources', 'rate_limit_resources']) {
      if (document[key] !== undefined && config[key] === undefined)
        config[key] = document[key];
    }

    return config;
  }

  return document;
}

export function classify(document: YamlValue): PipelineKind {
  if (!isYamlObject(document)) return 'fragment';

  if (document.config !== undefined && isYamlObject(document.config)) {
    return document.config.input !== undefined &&
      document.config.output !== undefined
      ? 'complete-job'
      : 'fragment';
  }

  if (document.input !== undefined && document.output !== undefined)
    return 'complete-bare';

  if (isStringValue(document.apiVersion) && isStringValue(document.kind))
    return 'manifest';

  return 'fragment';
}

function familyFromPath(path: string): string {
  const name = basename(path).replace(/\.(yaml|yml)$/, '');

  if (path.startsWith('examples/explorer-stages/')) {
    return path.split('/')[2];
  }

  return name
    .replace(/^complete-/, '')
    .replace(/-complete$/, '')
    .replace(/-foundation$/, '')
    .replace(/-step-\d+$/, '');
}

function categoryFromPath(path: string): string {
  const segments = path.split('/');

  if (segments[0] === 'static' && segments[1] === 'pipelines')
    return 'integrations';

  if (segments[0] === 'static') return segments[2] ?? 'static';

  if (segments[0] === 'docs') return segments[1] ?? 'docs';

  return segments[1] ?? basename(dirname(path));
}

export function discoverPipelineFiles(repositoryRoot: string): PipelineFile[] {
  const catalogFamilies = new Map<string, string>();

  for (const record of PUBLIC_CATALOG.records) {
    if (record.completePipelinePath)
      catalogFamilies.set(record.completePipelinePath, record.id);
  }

  const paths = new Set<string>();

  for (const pattern of INVENTORY_GLOBS) {
    for (const match of globSync(pattern, {
      cwd: repositoryRoot,
      nodir: true,
      posix: true,
    })) {
      paths.add(match);
    }
  }

  for (const path of catalogFamilies.keys()) paths.add(path);

  const files: PipelineFile[] = [];

  for (const path of [...paths].sort()) {
    const category = categoryFromPath(path);
    const family = catalogFamilies.get(path) ?? familyFromPath(path);
    let source: string;

    try {
      source = readFileSync(`${repositoryRoot}/${path}`, 'utf8');
    } catch (error) {
      files.push({
        path,
        kind: 'invalid-yaml',
        category,
        family,
        parseError: error instanceof Error ? error.message : String(error),
      });
      continue;
    }

    try {
      // SAFETY: YAML pipeline documents are data-only values; functions and
      // symbols cannot be produced by the parser configuration used here.
      const document = parseYaml(source, {
        strict: true,
        uniqueKeys: true,
      }) as YamlValue;

      files.push({
        path,
        kind: classify(document),
        category,
        family,
        document,
      });
    } catch (error) {
      files.push({
        path,
        kind: 'invalid-yaml',
        category,
        family,
        parseError:
          error instanceof Error ? error.message.split('\n')[0] : String(error),
      });
    }
  }

  return files;
}

/** Digest over every inventoried file so identical content yields an identical report. */
export function inventoryDigest(
  repositoryRoot: string,
  files: readonly PipelineFile[]
): string {
  const hash = createHash('sha256');

  for (const file of files) {
    hash.update(file.path);
    hash.update('\0');

    try {
      hash.update(readFileSync(`${repositoryRoot}/${file.path}`));
    } catch {
      hash.update('<unreadable>');
    }

    hash.update('\n');
  }

  return `sha256:${hash.digest('hex')}`;
}
