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
import matter from 'gray-matter';
import {
  classifyPipelineCode,
  extractYamlCodeBlocks,
  hasUnclassifiedExpansoCode,
} from '../../src/lib/pipelineCode';

import { PUBLIC_CATALOG } from '../../src/catalog/registry';
import { completePipelineRouteForFamily } from '../../src/catalog/completePipelineRoutes';
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
  'docs/**/*.{yaml,yml}',
];

/** The pipeline config carried by a document, whether bare or wrapped in a job. */
export function pipelineConfigOf(
  document: YamlValue | undefined
): YamlObject | null {
  if (document === undefined || !isYamlObject(document)) return null;

  if (document.config !== undefined && isYamlObject(document.config)) {
    const config = { ...document.config };

    for (const key of [
      'buffer',
      'cache_resources',
      'rate_limit_resources',
      'processor_resources',
    ]) {
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

  if (path.startsWith('docs/')) return path.split('/')[2] ?? name;

  if (path.startsWith('examples/integrations/')) {
    if (path.startsWith('examples/integrations/scada-energy-edge/'))
      return 'scada-energy-edge';

    if (name.startsWith('oran-')) return 'oran-telco-pipeline';

    if (name.startsWith('scada-')) return 'scada-energy-edge';

    if (name.startsWith('splunk-')) return 'splunk-edge-processing';
  }

  if (path.startsWith('examples/data-transformation/step-')) {
    if (/hash-based|fingerprint-based|id-based/.test(name))
      return 'deduplicate-events';

    if (/tumbling-window|sliding-window|session-window/.test(name))
      return 'aggregate-time-windows';

    if (/json-to-avro|avro-to-parquet|auto-detect/.test(name))
      return 'transform-formats';

    if (
      /format-detection|parse-formats|json-parsing|csv-parsing|access-log|syslog/.test(
        name
      )
    )
      return 'parse-logs';

    if (/normalize-utc/.test(name)) return 'normalize-timestamps';
  }

  if (path.startsWith('examples/data-security/step-')) {
    if (/define-schema|validate-route|quality-metrics|no-validation/.test(name))
      return 'enforce-schema';

    if (
      /payment-encryption|pii-encryption|address-encryption|temporal-encryption/.test(
        name
      )
    )
      return 'encryption-patterns';

    if (
      /encrypt-card|encrypt-pii|encrypt-address|add-metadata|production/.test(
        name
      )
    )
      return 'encrypt-data';

    if (/delete-|hash-|pseudonymize|generalize/.test(name)) return 'remove-pii';
  }

  if (path.startsWith('examples/data-routing/step-')) {
    if (/circuit-breakers|fallback|no-protection/.test(name))
      return 'circuit-breakers';

    if (
      /severity-routing|geographic-routing|event-type-routing|priority-routing/.test(
        name
      )
    )
      return 'content-routing';

    if (
      /classify|tier-enhancement|multi-criteria|priority-output|starvation/.test(
        name
      )
    )
      return 'priority-queues';
  }

  if (path.startsWith('examples/log-processing/step-')) {
    if (/lineage|restructure|batching/.test(name)) return 'enrich-export';

    if (/unfiltered|parse-classify|filter-route/.test(name))
      return 'filter-severity';

    return 'production-pipeline';
  }

  const aliases = new Map([
    ['complete-fan-out', 'fan-out-pattern'],
    ['database-circuit-breaker-foundation', 'circuit-breakers'],
    ['fan-out-complete', 'fan-out-pattern'],
    ['fan-out-foundation', 'fan-out-pattern'],
    ['fan-out-kafka', 'fan-out-pattern'],
    ['fan-out-s3', 'fan-out-pattern'],
    ['kafka-fan-out', 'fan-out-pattern'],
    ['s3-fan-out', 'fan-out-pattern'],
    ['single-destination', 'fan-out-pattern'],
    ['encryption-foundation', 'encrypt-data'],
    ['schema-validation-foundation', 'enforce-schema'],
    ['deduplication-foundation', 'deduplicate-events'],
    ['format-transform-foundation', 'transform-formats'],
    ['log-parsing-foundation', 'parse-logs'],
    ['normalization-foundation', 'normalize-timestamps'],
    ['tumbling-windows-foundation', 'aggregate-time-windows'],
    ['enrichment-foundation', 'enrich-export'],
    ['filtering-foundation', 'filter-severity'],
  ]);

  const alias = aliases.get(name);

  if (alias) return alias;

  if (path === 'examples/data-routing/foundation.yaml')
    return 'smart-buffering';

  if (path === 'examples/data-routing/input.yaml') return 'priority-queues';

  if (
    path === 'examples/data-routing/pipeline.yaml' ||
    path === 'examples/data-routing/order-processing-foundation.yaml'
  )
    return 'content-splitting';

  if (path === 'examples/data-routing/step-0-original.yaml')
    return 'content-routing';

  if (path === 'examples/data-transformation/step-4-production.yaml')
    return 'aggregate-time-windows';

  if (path === 'examples/log-processing/input.yaml')
    return 'production-pipeline';

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
  const liveRoutes = new Map<string, string>();

  for (const record of PUBLIC_CATALOG.records) {
    liveRoutes.set(record.id, record.routes.explore ?? record.routes.overview);

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

      const classified = classify(document);

      const kind =
        classified === 'fragment' && !classifyPipelineCode(source)
          ? 'manifest'
          : classified;

      const standaloneRoute =
        path === 'examples/getting-started/quickstart-complete.yaml'
          ? '/getting-started/local-development/'
          : path === 'static/files/first-results/filter-logs.yaml'
            ? '/getting-started/process-data-locally/'
            : path === 'static/files/first-results/process-locally.yaml'
              ? '/getting-started/process-data-locally/'
              : undefined;

      files.push({
        path,
        sourcePath: path,
        source,
        surface: 'file',
        kind,
        category,
        family,
        liveRoute:
          standaloneRoute ??
          (kind === 'fragment'
            ? liveRoutes.get(family)
            : (completePipelineRouteForFamily(family) ??
              liveRoutes.get(family))),
        canonicalPath: [...catalogFamilies].find(
          ([, id]) => id === family
        )?.[0],
        document,
      });
    } catch (error) {
      files.push({
        path,
        kind: 'invalid-yaml',
        category,
        family,
        liveRoute: liveRoutes.get(family),
        parseError:
          error instanceof Error ? error.message.split('\n')[0] : String(error),
      });
    }
  }

  for (const path of globSync('docs/**/*.mdx', {
    cwd: repositoryRoot,
    nodir: true,
    posix: true,
  }).sort()) {
    const page = readFileSync(`${repositoryRoot}/${path}`, 'utf8');
    const metadata = matter(page).data;

    if (metadata.draft === true) continue;
    const family = familyFromPath(path);

    const canonicalPath = [...catalogFamilies].find(
      ([, id]) => id === family
    )?.[0];

    const route = isStringValue(metadata.slug)
      ? metadata.slug
      : path
          .replace(/^docs\//, '')
          .replace(/\.mdx$/, '')
          .replace(/\/index$/, '');

    for (const block of extractYamlCodeBlocks(page)) {
      const renderedKind = classifyPipelineCode(block.source);
      const unclassified = hasUnclassifiedExpansoCode(block.source);

      if (!renderedKind && !unclassified) continue;

      const file: PipelineFile = {
        path: `${path}#L${block.line}`,
        sourcePath: path,
        sourceLine: block.line,
        source: block.source,
        surface: 'page',
        category: categoryFromPath(path),
        family,
        canonicalPath,
        liveRoute: `/${route.replace(/^\/+|\/+$/g, '')}/`,
        kind: unclassified ? 'invalid-yaml' : 'fragment',
        parseError: unclassified
          ? 'YAML could not be classified as a complete pipeline, supported fragment, or infrastructure document'
          : undefined,
      };

      try {
        // SAFETY: rendered YAML fences are parsed as data-only values and the
        // strict parser cannot produce values outside the YamlValue contract.
        file.document = parseYaml(block.source, {
          strict: true,
          uniqueKeys: true,
        }) as YamlValue;

        if (renderedKind === 'complete') file.kind = classify(file.document);
        else if (renderedKind === 'fragment') file.kind = 'fragment';
      } catch (error) {
        file.parseError =
          error instanceof Error ? error.message : String(error);
      }

      files.push(file);
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

    if (file.source !== undefined) hash.update(file.source);
    else {
      try {
        hash.update(
          readFileSync(`${repositoryRoot}/${file.sourcePath ?? file.path}`)
        );
      } catch {
        hash.update('<unreadable>');
      }
    }

    hash.update('\n');
  }

  return `sha256:${hash.digest('hex')}`;
}
