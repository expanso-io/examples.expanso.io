import {
  copyFileSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import { gzipSync } from 'node:zlib';

import { sha256Bytes } from './contract-lib';

export const PERFORMANCE_EVIDENCE_VERSION = '1.0.0';
export const ASSET_INVENTORY_VERSION = '1.0.0';
export const BROWSER_METRICS_VERSION = '1.0.0';

export type EvidenceRole = 'baseline' | 'candidate';
export type ArtifactKind =
  | 'asset-inventory'
  | 'browser-metrics'
  | 'lighthouse-report'
  | 'playwright-trace'
  | 'production-manifest'
  | 'production-asset';

export interface ArtifactRecord {
  id: string;
  kind: ArtifactKind;
  path: string;
  bytes: number;
  sha256: string;
  mediaType: string;
}

export interface PerformanceEvidenceManifest {
  evidenceVersion: '1.0.0';
  role: EvidenceRole;
  contractId: 'performance-v1';
  contractSha256: string;
  subjectSha: string;
  environmentId: string;
  startedAt: string;
  finishedAt: string;
  capability: {
    status: 'AVAILABLE' | 'BLOCKED_CAPABILITY';
    reason?: string;
  };
  fixtureIds: string[];
  stageIds: string[];
  toolVersions: Record<string, string>;
  artifacts: ArtifactRecord[];
}

export interface AssetReference {
  artifactId: string;
  sourceFile: string;
  sha256: string;
  gzipBytes: number;
}

export interface AssetInventory {
  inventoryVersion: '1.0.0';
  attribution: 'docusaurus-production-chunk-manifest-v1';
  explorerRoute: string;
  sourceArtifacts: {
    clientManifest: string;
    routeChunks: string;
  };
  shared: {
    javascript: AssetReference[];
    css: AssetReference[];
  };
  explorer: {
    javascript: AssetReference[];
    css: AssetReference[];
  };
}

export interface PageLoadRun {
  lcpMs: number;
  cls: number;
  overflowCssPixels: number;
}

export interface PageLoadCell {
  routeId: string;
  profileId: string;
  theme: string;
  cacheMode: 'cold-page-load';
  traceArtifactId: string;
  runs: PageLoadRun[];
}

export interface LighthouseCell {
  routeId: string;
  lcpMs: number;
  cls: number;
  reportArtifactId: string;
}

export interface ExplorerMetrics {
  routeId: string;
  stageIds: string[];
  warmups: number;
  measuredTransitions: number;
  scriptingMs: number[];
  eventDurationsMs: number[];
  traceArtifactId: string;
}

export interface BrowserMetrics {
  metricsVersion: '1.0.0';
  subjectSha: string;
  contractSha256: string;
  pageLoadCells: PageLoadCell[];
  lighthouseCells: LighthouseCell[];
  explorer: ExplorerMetrics;
}

type ManifestAsset = {
  file: string;
  hash?: string;
  publicPath?: string;
};

export type ClientManifest = {
  entrypoints: string[];
  origins: Record<string, Array<string | number>>;
  assets: Record<string, { js?: ManifestAsset[]; css?: ManifestAsset[] }>;
};

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function ensureRelativeFile(root: string, path: string): string {
  const absoluteRoot = resolve(root);
  const absolutePath = resolve(path);
  const child = relative(absoluteRoot, absolutePath);
  if (
    child === '' ||
    child === '..' ||
    child.startsWith(`..${sep}`) ||
    child.startsWith(sep)
  ) {
    throw new Error(`Path must be a file below ${root}: ${path}`);
  }
  return child.split(sep).join('/');
}

export function artifactForFile(
  evidenceRoot: string,
  absolutePath: string,
  input: { id: string; kind: ArtifactKind; mediaType: string }
): ArtifactRecord {
  const path = ensureRelativeFile(evidenceRoot, absolutePath);
  const bytes = readFileSync(absolutePath);
  return {
    ...input,
    path,
    bytes: statSync(absolutePath).size,
    sha256: sha256Bytes(bytes),
  };
}

export function writeJsonEvidenceArtifact(
  evidenceRoot: string,
  relativePath: string,
  value: unknown,
  input: { id: string; kind: ArtifactKind }
): ArtifactRecord {
  const absolutePath = resolve(evidenceRoot, relativePath);
  ensureRelativeFile(evidenceRoot, absolutePath);
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, `${JSON.stringify(value, null, 2)}\n`);
  return artifactForFile(evidenceRoot, absolutePath, {
    ...input,
    mediaType: 'application/json',
  });
}

function assetFilesForLogicalNames(
  manifest: ClientManifest,
  logicalNames: string[]
): Array<{ file: string; type: 'js' | 'css' }> {
  const assets = new Map<string, { file: string; type: 'js' | 'css' }>();
  for (const logicalName of logicalNames) {
    const originIds = manifest.origins[logicalName] ?? [logicalName];
    for (const rawOriginId of originIds) {
      const originId = String(rawOriginId);
      const entry = manifest.assets[originId];
      if (!entry) {
        throw new Error(
          `Production client manifest has no asset entry for ${logicalName} origin ${originId}`
        );
      }
      for (const type of ['js', 'css'] as const) {
        for (const asset of entry[type] ?? []) {
          assets.set(asset.file, { file: asset.file, type });
        }
      }
    }
  }
  return [...assets.values()].sort((left, right) =>
    compareText(left.file, right.file)
  );
}

function normalizedRoute(route: string): string {
  if (!route.startsWith('/'))
    throw new Error(`Route must start with /: ${route}`);
  if (route === '/') return route;
  return route.replace(/\/+$/, '');
}

export function productionAssetAttribution(
  clientManifest: ClientManifest,
  routeChunks: Record<string, Record<string, string>>,
  explorerRoute: string
): {
  route: string;
  sharedFiles: Array<{ file: string; type: 'js' | 'css' }>;
  explorerFiles: Array<{ file: string; type: 'js' | 'css' }>;
} {
  const route = normalizedRoute(explorerRoute);
  const matchingRoutes = Object.entries(routeChunks).filter(
    ([key]) => key.slice(0, key.lastIndexOf('/-')) === route
  );
  if (matchingRoutes.length !== 1) {
    throw new Error(
      `Expected one production chunk-manifest entry for ${route}, found ${matchingRoutes.length}`
    );
  }

  const sharedFiles = assetFilesForLogicalNames(
    clientManifest,
    clientManifest.entrypoints
  );
  const routeFiles = assetFilesForLogicalNames(
    clientManifest,
    Object.values(matchingRoutes[0][1])
  );
  const sharedPaths = new Set(sharedFiles.map((asset) => asset.file));
  return {
    route,
    sharedFiles,
    explorerFiles: routeFiles.filter((asset) => !sharedPaths.has(asset.file)),
  };
}

export function collectProductionAssetEvidence(input: {
  buildRoot: string;
  docusaurusRoot: string;
  evidenceRoot: string;
  explorerRoute: string;
}): { inventory: AssetInventory; artifacts: ArtifactRecord[] } {
  const buildRoot = resolve(input.buildRoot);
  const docusaurusRoot = resolve(input.docusaurusRoot);
  const evidenceRoot = resolve(input.evidenceRoot);
  mkdirSync(evidenceRoot, { recursive: true });

  const clientManifestSource = resolve(docusaurusRoot, 'client-manifest.json');
  const routeChunksSource = resolve(docusaurusRoot, 'routesChunkNames.json');
  const clientManifest = JSON.parse(
    readFileSync(clientManifestSource, 'utf8')
  ) as ClientManifest;
  const routeChunks = JSON.parse(
    readFileSync(routeChunksSource, 'utf8')
  ) as Record<string, Record<string, string>>;

  const { route, sharedFiles, explorerFiles } = productionAssetAttribution(
    clientManifest,
    routeChunks,
    input.explorerRoute
  );

  const artifacts: ArtifactRecord[] = [];
  const copyManifest = (source: string, name: string, id: string) => {
    const target = resolve(evidenceRoot, 'raw/production-manifests', name);
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(source, target);
    const artifact = artifactForFile(evidenceRoot, target, {
      id,
      kind: 'production-manifest',
      mediaType: 'application/json',
    });
    artifacts.push(artifact);
    return artifact;
  };
  const clientManifestArtifact = copyManifest(
    clientManifestSource,
    'client-manifest.json',
    'production-manifest:client'
  );
  const routeChunksArtifact = copyManifest(
    routeChunksSource,
    'routesChunkNames.json',
    'production-manifest:routes'
  );

  const copiedAssets = new Map<string, AssetReference>();
  const copyAsset = (file: string): AssetReference => {
    const existing = copiedAssets.get(file);
    if (existing) return existing;
    const source = resolve(buildRoot, file);
    ensureRelativeFile(buildRoot, source);
    const target = resolve(evidenceRoot, 'raw/production-assets', file);
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(source, target);
    const artifact = artifactForFile(evidenceRoot, target, {
      id: `production-asset:${file}`,
      kind: 'production-asset',
      mediaType: file.endsWith('.css') ? 'text/css' : 'text/javascript',
    });
    artifacts.push(artifact);
    const bytes = readFileSync(target);
    const reference = {
      artifactId: artifact.id,
      sourceFile: file,
      sha256: artifact.sha256,
      gzipBytes: gzipSync(bytes, { level: 9 }).length,
    };
    copiedAssets.set(file, reference);
    return reference;
  };

  const references = (
    assets: Array<{ file: string; type: 'js' | 'css' }>,
    type: 'js' | 'css'
  ) =>
    assets
      .filter((asset) => asset.type === type)
      .map((asset) => copyAsset(asset.file));

  const inventory: AssetInventory = {
    inventoryVersion: ASSET_INVENTORY_VERSION,
    attribution: 'docusaurus-production-chunk-manifest-v1',
    explorerRoute: route,
    sourceArtifacts: {
      clientManifest: clientManifestArtifact.id,
      routeChunks: routeChunksArtifact.id,
    },
    shared: {
      javascript: references(sharedFiles, 'js'),
      css: references(sharedFiles, 'css'),
    },
    explorer: {
      javascript: references(explorerFiles, 'js'),
      css: references(explorerFiles, 'css'),
    },
  };
  artifacts.push(
    writeJsonEvidenceArtifact(
      evidenceRoot,
      'raw/asset-inventory.json',
      inventory,
      { id: 'asset-inventory', kind: 'asset-inventory' }
    )
  );

  return {
    inventory,
    artifacts: artifacts.sort((left, right) => compareText(left.id, right.id)),
  };
}

export function writePerformanceEvidenceManifest(
  evidenceRoot: string,
  manifest: PerformanceEvidenceManifest
): string {
  const path = resolve(evidenceRoot, 'evidence-manifest-v1.json');
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`);
  return path;
}
