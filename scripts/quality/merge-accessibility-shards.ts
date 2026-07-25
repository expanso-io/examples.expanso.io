import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  loadAccessibilityContract,
  parseAccessibilityRoutes,
  validateObservationManifest,
  type AccessibilityObservation,
  type AccessibilityObservationManifest,
} from './accessibility-lib';
import { sha256Bytes } from './contract-lib';

const SHA_PATTERN = /^[a-f0-9]{40}$/;
const SHARD_MANIFEST_VERSION = 'accessibility-shard-v1';

interface AccessibilityShardManifest {
  manifestVersion: typeof SHARD_MANIFEST_VERSION;
  subjectSha: string;
  environmentId: string;
  contractSha256: string;
  routeInventorySha256: string;
  shardIndex: number;
  shardTotal: number;
  observationFile: 'playwright-observations.json';
  observationSha256: string;
  observationCount: number;
}

export interface WriteAccessibilityShardOptions {
  subjectSha: string;
  environmentId: string;
  shardIndex: number;
  shardTotal: number;
  observationPath: string;
  outputPath: string;
}

export interface MergeAccessibilityShardsOptions {
  inputRoot: string;
  outputPath: string;
  subjectSha: string;
  environmentId: string;
  shardTotal: number;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && !Array.isArray(value) && typeof value === 'object';
}

function assertSubjectSha(subjectSha: string): void {
  if (!SHA_PATTERN.test(subjectSha) || subjectSha === '0'.repeat(40)) {
    throw new Error(
      'subjectSha must be a nonzero lowercase 40-character Git SHA'
    );
  }
}

function assertShardCoordinates(index: number, total: number): void {
  if (!Number.isInteger(total) || total < 1 || total > 16) {
    throw new Error('shardTotal must be an integer between 1 and 16');
  }
  if (!Number.isInteger(index) || index < 1 || index > total) {
    throw new Error(`shardIndex must be an integer between 1 and ${total}`);
  }
}

function observationKey(observation: AccessibilityObservation): string {
  return JSON.stringify([
    observation.routePath,
    observation.oracleId,
    observation.environmentIds,
    observation.themes,
    observation.interactionModes,
    observation.stateIds,
    observation.projectName,
  ]);
}

function readValidatedObservations(
  path: string
): AccessibilityObservationManifest {
  if (!existsSync(path)) {
    throw new Error(`Accessibility observation manifest is missing: ${path}`);
  }
  const contract = loadAccessibilityContract();
  const routes = parseAccessibilityRoutes(contract);
  const raw = JSON.parse(readFileSync(path, 'utf8'));
  const validated = validateObservationManifest(raw, contract, routes);
  if (!validated.manifest) {
    throw new Error(
      `Accessibility observation manifest is invalid:\n${validated.errors.map((error) => `- ${error}`).join('\n')}`
    );
  }
  return validated.manifest;
}

export function writeAccessibilityShardManifest(
  options: WriteAccessibilityShardOptions
): AccessibilityShardManifest {
  assertSubjectSha(options.subjectSha);
  if (!options.environmentId) {
    throw new Error('environmentId must be a non-empty string');
  }
  assertShardCoordinates(options.shardIndex, options.shardTotal);

  const observationPath = resolve(options.observationPath);
  const observations = readValidatedObservations(observationPath);
  const contract = loadAccessibilityContract();
  const inventoryPath = resolve(contract.routes.inventory.source);
  const manifest: AccessibilityShardManifest = {
    manifestVersion: SHARD_MANIFEST_VERSION,
    subjectSha: options.subjectSha,
    environmentId: options.environmentId,
    contractSha256: contract.contractSha256,
    routeInventorySha256: sha256Bytes(readFileSync(inventoryPath)),
    shardIndex: options.shardIndex,
    shardTotal: options.shardTotal,
    observationFile: 'playwright-observations.json',
    observationSha256: sha256Bytes(readFileSync(observationPath)),
    observationCount: observations.observations.length,
  };
  mkdirSync(dirname(resolve(options.outputPath)), { recursive: true });
  writeFileSync(
    resolve(options.outputPath),
    `${JSON.stringify(manifest, null, 2)}\n`
  );
  return manifest;
}

function parseShardManifest(
  value: unknown,
  expectedIndex: number,
  options: MergeAccessibilityShardsOptions,
  expectedContractSha256: string,
  expectedInventorySha256: string
): AccessibilityShardManifest {
  if (!isObject(value)) {
    throw new Error(`Shard ${expectedIndex} manifest must be an object`);
  }
  const expectedKeys = [
    'contractSha256',
    'environmentId',
    'manifestVersion',
    'observationCount',
    'observationFile',
    'observationSha256',
    'routeInventorySha256',
    'shardIndex',
    'shardTotal',
    'subjectSha',
  ];
  const receivedKeys = Object.keys(value).sort();
  if (JSON.stringify(receivedKeys) !== JSON.stringify(expectedKeys)) {
    throw new Error(
      `Shard ${expectedIndex} manifest fields do not match the strict contract`
    );
  }
  const checks: Array<[string, unknown, unknown]> = [
    ['manifestVersion', value.manifestVersion, SHARD_MANIFEST_VERSION],
    ['subjectSha', value.subjectSha, options.subjectSha],
    ['environmentId', value.environmentId, options.environmentId],
    ['contractSha256', value.contractSha256, expectedContractSha256],
    [
      'routeInventorySha256',
      value.routeInventorySha256,
      expectedInventorySha256,
    ],
    ['shardIndex', value.shardIndex, expectedIndex],
    ['shardTotal', value.shardTotal, options.shardTotal],
    ['observationFile', value.observationFile, 'playwright-observations.json'],
  ];
  for (const [field, received, expected] of checks) {
    if (received !== expected) {
      throw new Error(
        `Shard ${expectedIndex} ${field} mismatch: expected ${String(expected)}, received ${String(received)}`
      );
    }
  }
  if (
    typeof value.observationSha256 !== 'string' ||
    !/^[a-f0-9]{64}$/.test(value.observationSha256)
  ) {
    throw new Error(`Shard ${expectedIndex} observationSha256 is invalid`);
  }
  if (
    typeof value.observationCount !== 'number' ||
    !Number.isInteger(value.observationCount) ||
    value.observationCount < 0
  ) {
    throw new Error(`Shard ${expectedIndex} observationCount is invalid`);
  }
  return value as unknown as AccessibilityShardManifest;
}

export function mergeAccessibilityShards(
  options: MergeAccessibilityShardsOptions
): AccessibilityObservationManifest {
  assertSubjectSha(options.subjectSha);
  if (!options.environmentId) {
    throw new Error('environmentId must be a non-empty string');
  }
  assertShardCoordinates(1, options.shardTotal);
  const inputRoot = resolve(options.inputRoot);
  if (!existsSync(inputRoot)) {
    throw new Error(`Accessibility shard input root is missing: ${inputRoot}`);
  }
  const expectedDirectories = Array.from(
    { length: options.shardTotal },
    (_, index) => String(index + 1)
  );
  const receivedDirectories = readdirSync(inputRoot, {
    withFileTypes: true,
  })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((left, right) => Number(left) - Number(right));
  if (
    JSON.stringify(receivedDirectories) !== JSON.stringify(expectedDirectories)
  ) {
    throw new Error(
      `Accessibility shards are missing or unexpected: expected ${expectedDirectories.join(',')}; received ${receivedDirectories.join(',') || '<none>'}`
    );
  }

  const contract = loadAccessibilityContract();
  const inventorySha256 = sha256Bytes(
    readFileSync(resolve(contract.routes.inventory.source))
  );
  const observations: AccessibilityObservation[] = [];
  const runnerErrors: string[] = [];
  const capabilityBlocks: string[] = [];
  const startedAt: string[] = [];
  const finishedAt: string[] = [];
  let environment: AccessibilityObservationManifest['environment'] | null =
    null;
  const observationKeys = new Set<string>();

  for (let index = 1; index <= options.shardTotal; index += 1) {
    const shardRoot = join(inputRoot, String(index));
    const manifestPath = join(shardRoot, 'accessibility-shard-manifest.json');
    if (!existsSync(manifestPath)) {
      throw new Error(`Shard ${index} manifest is missing: ${manifestPath}`);
    }
    const shardManifest = parseShardManifest(
      JSON.parse(readFileSync(manifestPath, 'utf8')),
      index,
      options,
      contract.contractSha256,
      inventorySha256
    );
    const observationPath = join(shardRoot, shardManifest.observationFile);
    if (!existsSync(observationPath)) {
      throw new Error(`Shard ${index} observation file is missing`);
    }
    const observationBytes = readFileSync(observationPath);
    if (sha256Bytes(observationBytes) !== shardManifest.observationSha256) {
      throw new Error(`Shard ${index} observation digest mismatch`);
    }
    const shardObservations = readValidatedObservations(observationPath);
    if (
      shardObservations.observations.length !== shardManifest.observationCount
    ) {
      throw new Error(`Shard ${index} observation count mismatch`);
    }
    if (
      environment !== null &&
      JSON.stringify(shardObservations.environment) !==
        JSON.stringify(environment)
    ) {
      throw new Error(`Shard ${index} observation environment mismatch`);
    }
    environment ??= shardObservations.environment;
    startedAt.push(shardObservations.startedAt);
    finishedAt.push(shardObservations.finishedAt);
    runnerErrors.push(...shardObservations.runnerErrors);
    capabilityBlocks.push(...shardObservations.capabilityBlocks);
    for (const observation of shardObservations.observations) {
      const key = observationKey(observation);
      if (observationKeys.has(key)) {
        throw new Error(
          `Duplicate accessibility observation across shards for ${observation.oracleId} on ${observation.routePath}`
        );
      }
      observationKeys.add(key);
      observations.push(observation);
    }
  }

  if (!environment) {
    throw new Error('Accessibility shard set did not provide an environment');
  }
  const merged: AccessibilityObservationManifest = {
    manifestVersion: 'accessibility-observations-v1',
    startedAt: startedAt.sort()[0],
    finishedAt: finishedAt.sort().at(-1)!,
    environment,
    observations: observations.sort((left, right) =>
      observationKey(left).localeCompare(observationKey(right))
    ),
    runnerErrors: [...new Set(runnerErrors)].sort(),
    capabilityBlocks: [...new Set(capabilityBlocks)].sort(),
  };
  const validated = validateObservationManifest(
    merged,
    contract,
    parseAccessibilityRoutes(contract)
  );
  if (!validated.manifest) {
    throw new Error(
      `Merged accessibility observation manifest is invalid:\n${validated.errors.map((error) => `- ${error}`).join('\n')}`
    );
  }
  mkdirSync(dirname(resolve(options.outputPath)), { recursive: true });
  writeFileSync(
    resolve(options.outputPath),
    `${JSON.stringify(merged, null, 2)}\n`
  );
  return merged;
}

function parseArguments(argv: string[]): MergeAccessibilityShardsOptions {
  const values = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith('--') || !value || values.has(key)) {
      throw new Error(`Invalid argument sequence near ${key ?? '<end>'}`);
    }
    values.set(key, value);
  }
  const subjectSha =
    values.get('--subject-sha') ?? process.env.QUALITY_SUBJECT_SHA;
  const environmentId =
    values.get('--environment-id') ?? process.env.QUALITY_ENVIRONMENT_ID;
  if (!subjectSha) throw new Error('--subject-sha is required');
  if (!environmentId) throw new Error('--environment-id is required');
  return {
    inputRoot:
      values.get('--input-root') ?? 'test-results/accessibility-shards',
    outputPath:
      values.get('--output') ??
      'test-results/quality/accessibility/playwright-observations.json',
    subjectSha,
    environmentId,
    shardTotal: Number(values.get('--shard-total') ?? '4'),
  };
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : '';
if (invokedPath && fileURLToPath(import.meta.url) === invokedPath) {
  const options = parseArguments(process.argv.slice(2));
  const merged = mergeAccessibilityShards(options);
  process.stdout.write(
    `${JSON.stringify({
      status: 'PASS',
      shardTotal: options.shardTotal,
      observationCount: merged.observations.length,
      output: basename(resolve(options.outputPath)),
    })}\n`
  );
}
