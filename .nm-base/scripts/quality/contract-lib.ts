import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const ZERO_SHA256 = '0'.repeat(64);
export const CONTRACT_PATHS = [
  'tests/contracts/performance-v1.json',
  'tests/contracts/machine-journey-v1.json',
  'tests/contracts/accessibility-v1.json',
] as const;

export type GateStatus = 'PASS' | 'FAIL' | 'UNKNOWN' | 'BLOCKED_CAPABILITY';

export interface QualityContract {
  contractId: string;
  contractVersion: string;
  contractSha256: string;
  digest: {
    algorithm: 'sha256';
    canonicalization: 'sorted-json-utf8-v1';
    selfFieldValue: string;
  };
  tools: Record<string, string>;
  routes: {
    inventory: { source: string; required: true };
    required: Array<{ id: string; path: string; [key: string]: unknown }>;
  };
  fixtures: Array<{ id: string; path: string; sha256: string }>;
  commands: { validate: string; run: string };
  resultSchema: string;
  reducerBehavior: {
    missingManifest: 'FAIL';
    schemaInvalid: 'FAIL';
    digestMismatch: 'FAIL';
    requiredResultMissing: 'FAIL' | 'UNKNOWN';
    contractMismatch: 'FAIL';
    localFailure: 'FAIL';
    optionalCapabilityUnavailable: 'BLOCKED_CAPABILITY';
  };
  [key: string]: unknown;
}

function sortForCanonicalJson(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortForCanonicalJson);
  }

  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
        .map(([key, entry]) => [key, sortForCanonicalJson(entry)])
    );
  }

  return value;
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortForCanonicalJson(value));
}

export function sha256Bytes(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

export function contractDigest(contract: QualityContract): string {
  return sha256Bytes(
    canonicalJson({ ...contract, contractSha256: ZERO_SHA256 })
  );
}

export function readJson(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    throw new Error(
      `Cannot parse JSON at ${path}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

function requireObject(
  value: unknown,
  location: string
): asserts value is Record<string, unknown> {
  if (value === null || Array.isArray(value) || typeof value !== 'object') {
    throw new Error(`${location} must be an object`);
  }
}

function requireString(
  value: unknown,
  location: string,
  pattern?: RegExp
): asserts value is string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${location} must be a non-empty string`);
  }
  if (pattern && !pattern.test(value)) {
    throw new Error(`${location} has an invalid value: ${value}`);
  }
}

function requireStatus(
  value: unknown,
  expected: GateStatus | GateStatus[],
  location: string
): void {
  const accepted = Array.isArray(expected) ? expected : [expected];
  if (!accepted.includes(value as GateStatus)) {
    throw new Error(`${location} must be one of ${accepted.join(', ')}`);
  }
}

export function validateCommonContract(
  value: unknown,
  sourcePath: string
): QualityContract {
  requireObject(value, sourcePath);
  requireString(
    value.contractId,
    `${sourcePath}.contractId`,
    /^[a-z][a-z0-9-]*-v\d+$/
  );
  requireString(
    value.contractVersion,
    `${sourcePath}.contractVersion`,
    /^\d+\.\d+\.\d+$/
  );
  requireString(
    value.contractSha256,
    `${sourcePath}.contractSha256`,
    /^[a-f0-9]{64}$/
  );

  requireObject(value.digest, `${sourcePath}.digest`);
  if (
    value.digest.algorithm !== 'sha256' ||
    value.digest.canonicalization !== 'sorted-json-utf8-v1' ||
    value.digest.selfFieldValue !== ZERO_SHA256
  ) {
    throw new Error(
      `${sourcePath}.digest does not define the v1 self-digest rule`
    );
  }

  requireObject(value.tools, `${sourcePath}.tools`);
  if (Object.keys(value.tools).length < 2) {
    throw new Error(`${sourcePath}.tools must pin at least two tools`);
  }
  for (const [tool, version] of Object.entries(value.tools)) {
    requireString(version, `${sourcePath}.tools.${tool}`);
    if (/\b(latest|\^|~|\*|x)\b/i.test(version)) {
      throw new Error(`${sourcePath}.tools.${tool} must be exact`);
    }
  }

  requireObject(value.routes, `${sourcePath}.routes`);
  requireObject(value.routes.inventory, `${sourcePath}.routes.inventory`);
  requireString(
    value.routes.inventory.source,
    `${sourcePath}.routes.inventory.source`
  );
  if (value.routes.inventory.required !== true) {
    throw new Error(`${sourcePath}.routes.inventory.required must be true`);
  }
  if (
    !Array.isArray(value.routes.required) ||
    value.routes.required.length === 0
  ) {
    throw new Error(`${sourcePath}.routes.required must be a non-empty array`);
  }
  for (const [index, route] of value.routes.required.entries()) {
    requireObject(route, `${sourcePath}.routes.required[${index}]`);
    requireString(route.id, `${sourcePath}.routes.required[${index}].id`);
    requireString(
      route.path,
      `${sourcePath}.routes.required[${index}].path`,
      /^\//
    );
  }

  if (!Array.isArray(value.fixtures)) {
    throw new Error(`${sourcePath}.fixtures must be an array`);
  }
  for (const [index, fixture] of value.fixtures.entries()) {
    requireObject(fixture, `${sourcePath}.fixtures[${index}]`);
    requireString(fixture.id, `${sourcePath}.fixtures[${index}].id`);
    requireString(fixture.path, `${sourcePath}.fixtures[${index}].path`);
    requireString(
      fixture.sha256,
      `${sourcePath}.fixtures[${index}].sha256`,
      /^[a-f0-9]{64}$/
    );
    const fixturePath = resolve(String(fixture.path));
    if (!existsSync(fixturePath)) {
      throw new Error(`${sourcePath}: fixture does not exist: ${fixture.path}`);
    }
    const actualFixtureDigest = sha256Bytes(readFileSync(fixturePath));
    if (actualFixtureDigest !== fixture.sha256) {
      throw new Error(
        `${sourcePath}: fixture digest mismatch for ${fixture.path}; expected ${fixture.sha256}, got ${actualFixtureDigest}`
      );
    }
  }

  requireObject(value.commands, `${sourcePath}.commands`);
  requireString(value.commands.validate, `${sourcePath}.commands.validate`);
  requireString(value.commands.run, `${sourcePath}.commands.run`);
  requireString(value.resultSchema, `${sourcePath}.resultSchema`);
  if (!existsSync(resolve(value.resultSchema))) {
    throw new Error(
      `${sourcePath}: result schema does not exist: ${value.resultSchema}`
    );
  }

  requireObject(value.reducerBehavior, `${sourcePath}.reducerBehavior`);
  requireStatus(
    value.reducerBehavior.missingManifest,
    'FAIL',
    `${sourcePath}.reducerBehavior.missingManifest`
  );
  requireStatus(
    value.reducerBehavior.schemaInvalid,
    'FAIL',
    `${sourcePath}.reducerBehavior.schemaInvalid`
  );
  requireStatus(
    value.reducerBehavior.digestMismatch,
    'FAIL',
    `${sourcePath}.reducerBehavior.digestMismatch`
  );
  requireStatus(
    value.reducerBehavior.requiredResultMissing,
    ['FAIL', 'UNKNOWN'],
    `${sourcePath}.reducerBehavior.requiredResultMissing`
  );
  requireStatus(
    value.reducerBehavior.contractMismatch,
    'FAIL',
    `${sourcePath}.reducerBehavior.contractMismatch`
  );
  requireStatus(
    value.reducerBehavior.localFailure,
    'FAIL',
    `${sourcePath}.reducerBehavior.localFailure`
  );
  requireStatus(
    value.reducerBehavior.optionalCapabilityUnavailable,
    'BLOCKED_CAPABILITY',
    `${sourcePath}.reducerBehavior.optionalCapabilityUnavailable`
  );

  const contract = value as unknown as QualityContract;
  const actualDigest = contractDigest(contract);
  if (contract.contractSha256 !== actualDigest) {
    throw new Error(
      `${sourcePath}: contract digest mismatch; expected ${contract.contractSha256}, got ${actualDigest}`
    );
  }

  return contract;
}

export function loadContract(path: string): QualityContract {
  const absolutePath = resolve(path);
  if (!existsSync(absolutePath)) {
    throw new Error(`Required contract is missing: ${path}`);
  }
  return validateCommonContract(readJson(absolutePath), path);
}

export function percentile(values: number[], quantile: number): number {
  if (values.length === 0) {
    throw new Error('Cannot calculate a percentile from an empty set');
  }
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.ceil(quantile * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(sorted.length - 1, index))];
}
