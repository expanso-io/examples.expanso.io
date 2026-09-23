#!/usr/bin/env tsx

import {
  createHash,
  createPublicKey,
  verify as verifySignature,
} from 'node:crypto';
import {
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  openSync,
  readFileSync,
  realpathSync,
} from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { isAbsolute, posix, relative, resolve, sep } from 'node:path';

import { PUBLIC_CATALOG } from '../src/catalog/registry';
import {
  CATALOG_SCHEMA_VERSION,
  VERIFICATION_POLICY,
  VERIFICATION_POLICY_DIGEST,
  type ExampleRecord,
} from '../src/catalog/schema';
import { validatePublicCatalog } from '../src/catalog/validate';

export const HEALTH_V2_VERSION = '2.0.0' as const;
export const MACHINE_RESULT_VERSION = '2.0.0' as const;
export const MACHINE_EVIDENCE_VERSION = '2.0.0' as const;
export const MACHINE_ARTIFACT_VERSION = '1.0.0' as const;
export const MACHINE_RERUN_VERSION = '1.0.0' as const;
export const MACHINE_ATTESTATION_VERSION = '1.0.0' as const;
export const REPOSITORY_ID = 'expanso-io/examples.expanso.io' as const;

export const HEALTH_DIMENSIONS = [
  'catalog',
  'routes',
  'content',
  'pipeline',
  'cli',
  'explorer',
  'accessibility',
  'claims',
  'maintenance',
] as const;

export type HealthDimension = (typeof HEALTH_DIMENSIONS)[number];
export type HealthStatus = 'PASS' | 'FAIL' | 'UNKNOWN' | 'BLOCKED_CAPABILITY';

const MACHINE_DIMENSIONS = new Set<HealthDimension>(HEALTH_DIMENSIONS);
const HEALTH_STATUSES = new Set<HealthStatus>([
  'PASS',
  'FAIL',
  'UNKNOWN',
  'BLOCKED_CAPABILITY',
]);
const SHA_PATTERN = /^[a-f0-9]{40}$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const RESULT_ID_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const ASSERTION_ID_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const IDENTITY_PATTERN = /^[a-z0-9][a-z0-9/_.:@-]*$/i;

export interface MachineExecutionIdentity {
  environment: {
    id: string;
    runner: string;
    os: string;
    architecture: string;
  };
  command: string;
  toolVersions: Record<string, string>;
}

interface ArtifactBinding {
  path: string;
  sha256: string;
}

interface MachineProducerIdentity extends MachineExecutionIdentity {
  id: string;
}

interface MachineVerifierIdentity extends MachineExecutionIdentity {
  id: string;
  keyId: string;
  publicKeySha256: string;
  attestation: ArtifactBinding;
  rerunArtifact: ArtifactBinding;
}

export interface MachineVerifierTrust {
  verifierId: string;
  keyId: string;
  publicKeyPath: string;
  publicKeySha256: string;
}

export interface MachineEvidenceDescriptor {
  evidenceVersion: typeof MACHINE_EVIDENCE_VERSION;
  kind: 'signed-machine-verification';
  subjectSha: string;
  resultId: string;
  resultIdentitySha256: string;
  assertionId: string;
  artifact: ArtifactBinding;
  resultSchema: ArtifactBinding;
  producer: MachineProducerIdentity;
  verifier: MachineVerifierIdentity;
}

export type HealthEvidence = string | MachineEvidenceDescriptor;

export interface MachineHealthResult {
  resultVersion: typeof MACHINE_RESULT_VERSION;
  resultId: string;
  dimension: HealthDimension;
  subject: {
    repository: typeof REPOSITORY_ID;
    sha: string;
    catalogSchemaVersion: typeof CATALOG_SCHEMA_VERSION;
  };
  scope: {
    type: 'catalog-example-ids';
    exampleIds: string[];
  };
  results: Array<{
    exampleId: string;
    status: HealthStatus;
    evidence: MachineEvidenceDescriptor[];
    reasons: string[];
  }>;
}

export interface HealthV2Report {
  schemaVersion: typeof HEALTH_V2_VERSION;
  generatedAt: string;
  subject: {
    repository: typeof REPOSITORY_ID;
    sha: string;
    catalogSchemaVersion: typeof CATALOG_SCHEMA_VERSION;
    exampleIds: string[];
  };
  dimensions: Array<{
    id: HealthDimension;
    status: HealthStatus;
    summary: {
      total: number;
      tested: number;
      testedPercent: number;
      pass: number;
      fail: number;
      unknown: number;
      blockedCapability: number;
    };
    examples: Array<{
      exampleId: string;
      status: HealthStatus;
      source: 'canonical-catalog' | 'machine-result' | 'untested';
      resultId: string | null;
      evidence: HealthEvidence[];
    }>;
  }>;
}

export interface GenerateHealthOptions {
  subjectSha: string;
  generatedAt?: string;
  machineResults?: unknown[];
  evidenceRoot?: string;
  trustedVerifier?: MachineVerifierTrust;
}

interface ExampleHealthCell {
  exampleId: string;
  status: HealthStatus;
  source: 'canonical-catalog' | 'machine-result' | 'untested';
  resultId: string | null;
  evidence: HealthEvidence[];
}

interface FileSnapshot {
  path: string;
  bytes: Buffer;
  device: number;
  inode: number;
}

interface EvidenceValidation {
  descriptor: MachineEvidenceDescriptor;
  trusted: boolean;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function requireExactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
  location: string
): void {
  const expectedSet = new Set(expected);
  const missing = expected.filter((key) => !(key in value));
  const extra = Object.keys(value).filter((key) => !expectedSet.has(key));
  if (missing.length > 0) {
    throw new Error(`${location} is missing fields: ${missing.join(', ')}`);
  }
  if (extra.length > 0) {
    throw new Error(`${location} has unknown fields: ${extra.join(', ')}`);
  }
}

function requireString(value: unknown, location: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${location} must be a non-empty string`);
  }
  return value;
}

function requireStringArray(value: unknown, location: string): string[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${location} must be a non-empty array`);
  }
  return value.map((entry, index) =>
    requireString(entry, `${location}[${index}]`)
  );
}

function requireArray(value: unknown, location: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`${location} must be an array`);
  }
  return value;
}

function requireUnique(values: readonly string[], location: string): void {
  if (new Set(values).size !== values.length) {
    throw new Error(`${location} must not contain duplicates`);
  }
}

function sameValues(
  left: readonly string[],
  right: readonly string[]
): boolean {
  if (left.length !== right.length) return false;
  const leftSorted = [...left].sort();
  const rightSorted = [...right].sort();
  return leftSorted.every((value, index) => value === rightSorted[index]);
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (isObject(value)) {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalize(entry)])
    );
  }
  return value;
}

/**
 * Digest the immutable identity and verdict cells of a machine result. Evidence
 * descriptors bind to this value, so copying evidence between results, SHAs,
 * scopes, dimensions, or verdicts fails closed.
 */
export function machineResultIdentitySha256(
  result: Pick<
    MachineHealthResult,
    'resultVersion' | 'resultId' | 'dimension' | 'subject' | 'scope' | 'results'
  >
): string {
  const identity = {
    resultVersion: result.resultVersion,
    resultId: result.resultId,
    dimension: result.dimension,
    subject: result.subject,
    scope: {
      type: result.scope.type,
      exampleIds: [...result.scope.exampleIds].sort(),
    },
    results: result.results
      .map(({ exampleId, status }) => ({ exampleId, status }))
      .sort((left, right) => left.exampleId.localeCompare(right.exampleId)),
  };
  return createHash('sha256')
    .update(JSON.stringify(canonicalize(identity)))
    .digest('hex');
}

function sha256Bytes(value: Buffer | string): string {
  return createHash('sha256').update(value).digest('hex');
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function requireSha256(value: unknown, location: string): string {
  const digest = requireString(value, location);
  if (!SHA256_PATTERN.test(digest)) {
    throw new Error(`${location} must be a lowercase SHA-256 digest`);
  }
  return digest;
}

function requireIdentity(value: unknown, location: string): string {
  const identity = requireString(value, location);
  if (!IDENTITY_PATTERN.test(identity)) {
    throw new Error(`${location} must be a stable machine identity`);
  }
  return identity;
}

function validateArtifactBinding(
  value: unknown,
  location: string
): ArtifactBinding {
  if (!isObject(value)) throw new Error(`${location} must be an object`);
  requireExactKeys(value, ['path', 'sha256'], location);
  return {
    path: requireString(value.path, `${location}.path`),
    sha256: requireSha256(value.sha256, `${location}.sha256`),
  };
}

function validateEnvironment(
  value: unknown,
  location: string
): MachineExecutionIdentity['environment'] {
  if (!isObject(value)) throw new Error(`${location} must be an object`);
  requireExactKeys(value, ['id', 'runner', 'os', 'architecture'], location);
  return {
    id: requireIdentity(value.id, `${location}.id`),
    runner: requireString(value.runner, `${location}.runner`),
    os: requireString(value.os, `${location}.os`),
    architecture: requireString(value.architecture, `${location}.architecture`),
  };
}

function validateToolVersions(
  value: unknown,
  location: string
): Record<string, string> {
  if (!isObject(value) || Object.keys(value).length === 0) {
    throw new Error(`${location} must pin at least one exact tool version`);
  }
  const tools: Record<string, string> = {};
  for (const [tool, rawVersion] of Object.entries(value).sort(
    ([left], [right]) => left.localeCompare(right)
  )) {
    if (!RESULT_ID_PATTERN.test(tool)) {
      throw new Error(`${location}.${tool} has an invalid tool id`);
    }
    const version = requireString(rawVersion, `${location}.${tool}`);
    if (/(?:latest|[~^*]|(?:^|[.\-])x(?:$|[.\-])|[<>]|\|\|)/i.test(version)) {
      throw new Error(`${location}.${tool} must be an exact version`);
    }
    tools[tool] = version;
  }
  return tools;
}

function validateExecutionIdentity(
  value: Record<string, unknown>,
  expectedKeys: readonly string[],
  location: string
): MachineExecutionIdentity {
  requireExactKeys(value, expectedKeys, location);
  return {
    environment: validateEnvironment(
      value.environment,
      `${location}.environment`
    ),
    command: requireString(value.command, `${location}.command`),
    toolVersions: validateToolVersions(
      value.toolVersions,
      `${location}.toolVersions`
    ),
  };
}

function validateProducerIdentity(
  value: unknown,
  location: string
): MachineProducerIdentity {
  if (!isObject(value)) throw new Error(`${location} must be an object`);
  const execution = validateExecutionIdentity(
    value,
    ['id', 'environment', 'command', 'toolVersions'],
    location
  );
  return {
    id: requireIdentity(value.id, `${location}.id`),
    ...execution,
  };
}

function validateVerifierIdentity(
  value: unknown,
  location: string
): MachineVerifierIdentity {
  if (!isObject(value)) throw new Error(`${location} must be an object`);
  const execution = validateExecutionIdentity(
    value,
    [
      'id',
      'keyId',
      'publicKeySha256',
      'environment',
      'command',
      'toolVersions',
      'attestation',
      'rerunArtifact',
    ],
    location
  );
  return {
    id: requireIdentity(value.id, `${location}.id`),
    keyId: requireIdentity(value.keyId, `${location}.keyId`),
    publicKeySha256: requireSha256(
      value.publicKeySha256,
      `${location}.publicKeySha256`
    ),
    ...execution,
    attestation: validateArtifactBinding(
      value.attestation,
      `${location}.attestation`
    ),
    rerunArtifact: validateArtifactBinding(
      value.rerunArtifact,
      `${location}.rerunArtifact`
    ),
  };
}

function snapshotRegularFile(
  root: string,
  rawPath: string,
  location: string
): FileSnapshot {
  if (
    isAbsolute(rawPath) ||
    rawPath.includes('\\') ||
    rawPath !== posix.normalize(rawPath) ||
    rawPath === '.' ||
    rawPath.startsWith('../')
  ) {
    throw new Error(`${location} must be a normalized root-relative path`);
  }

  try {
    const canonicalRoot = realpathSync(root);
    const requestedPath = resolve(canonicalRoot, rawPath);
    const requestedMetadata = lstatSync(requestedPath);
    if (requestedMetadata.isSymbolicLink() || !requestedMetadata.isFile()) {
      throw new Error('path must be a non-symlink regular file');
    }
    const canonicalPath = realpathSync(requestedPath);
    const relativePath = relative(canonicalRoot, canonicalPath);
    if (
      relativePath === '..' ||
      relativePath.startsWith(`..${sep}`) ||
      isAbsolute(relativePath)
    ) {
      throw new Error('path escapes the evidence root');
    }

    const descriptor = openSync(
      requestedPath,
      constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0)
    );
    try {
      const before = fstatSync(descriptor);
      if (!before.isFile())
        throw new Error('opened path is not a regular file');
      const bytes = readFileSync(descriptor);
      const after = fstatSync(descriptor);
      if (
        before.dev !== after.dev ||
        before.ino !== after.ino ||
        before.size !== after.size ||
        bytes.byteLength !== after.size
      ) {
        throw new Error('file changed while it was being snapshotted');
      }
      return {
        path: canonicalPath,
        bytes,
        device: after.dev,
        inode: after.ino,
      };
    } finally {
      closeSync(descriptor);
    }
  } catch (error) {
    throw new Error(
      `${location} cannot be snapshotted: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

function parseJsonSnapshot(snapshot: FileSnapshot, location: string): unknown {
  try {
    return JSON.parse(snapshot.bytes.toString('utf8'));
  } catch (error) {
    throw new Error(
      `${location} must contain JSON: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

function requireSameValue(
  actual: unknown,
  expected: unknown,
  location: string
): void {
  if (canonicalJson(actual) !== canonicalJson(expected)) {
    throw new Error(`${location} does not match the signed evidence binding`);
  }
}

function requireCanonicalTimestamp(value: unknown, location: string): Date {
  const timestamp = requireString(value, location);
  const date = new Date(timestamp);
  if (!Number.isFinite(date.valueOf()) || date.toISOString() !== timestamp) {
    throw new Error(`${location} must be a canonical ISO 8601 timestamp`);
  }
  return date;
}

function validateEvidenceDescriptor(
  input: unknown,
  expected: {
    subjectSha: string;
    resultId: string;
    resultIdentitySha256: string;
    dimension: HealthDimension;
    exampleId: string;
  },
  location: string,
  evidenceRoot: string,
  trustedVerifier?: MachineVerifierTrust
): EvidenceValidation {
  if (!isObject(input)) {
    throw new Error(`${location} must be a structured evidence descriptor`);
  }
  requireExactKeys(
    input,
    [
      'evidenceVersion',
      'kind',
      'subjectSha',
      'resultId',
      'resultIdentitySha256',
      'assertionId',
      'artifact',
      'resultSchema',
      'producer',
      'verifier',
    ],
    location
  );
  if (input.evidenceVersion !== MACHINE_EVIDENCE_VERSION) {
    throw new Error(
      `${location}.evidenceVersion must be ${MACHINE_EVIDENCE_VERSION}`
    );
  }
  if (input.kind !== 'signed-machine-verification') {
    throw new Error(`${location}.kind must be signed-machine-verification`);
  }
  if (input.subjectSha !== expected.subjectSha) {
    throw new Error(`${location}.subjectSha does not match the result subject`);
  }
  if (input.resultId !== expected.resultId) {
    throw new Error(`${location}.resultId does not match the result identity`);
  }
  if (input.resultIdentitySha256 !== expected.resultIdentitySha256) {
    throw new Error(
      `${location}.resultIdentitySha256 does not match the exact result identity`
    );
  }
  const assertionId = requireString(
    input.assertionId,
    `${location}.assertionId`
  );
  if (!ASSERTION_ID_PATTERN.test(assertionId)) {
    throw new Error(`${location}.assertionId must be stable kebab-case`);
  }
  const artifact = validateArtifactBinding(
    input.artifact,
    `${location}.artifact`
  );
  const resultSchema = validateArtifactBinding(
    input.resultSchema,
    `${location}.resultSchema`
  );
  const producer = validateProducerIdentity(
    input.producer,
    `${location}.producer`
  );
  const verifier = validateVerifierIdentity(
    input.verifier,
    `${location}.verifier`
  );
  if (producer.id === verifier.id) {
    throw new Error(`${location} producer and verifier identities must differ`);
  }

  const descriptor: MachineEvidenceDescriptor = {
    evidenceVersion: MACHINE_EVIDENCE_VERSION,
    kind: 'signed-machine-verification',
    subjectSha: expected.subjectSha,
    resultId: expected.resultId,
    resultIdentitySha256: expected.resultIdentitySha256,
    assertionId,
    artifact,
    resultSchema,
    producer,
    verifier,
  };

  // A well-formed author claim is not proof. Without a separately configured
  // trust root the caller can inspect it, but it can never enter Health as PASS.
  if (!trustedVerifier) return { descriptor, trusted: false };

  if (!isObject(trustedVerifier)) {
    throw new Error('trustedVerifier must be an object');
  }
  requireExactKeys(
    trustedVerifier as unknown as Record<string, unknown>,
    ['verifierId', 'keyId', 'publicKeyPath', 'publicKeySha256'],
    'trustedVerifier'
  );
  const trustedVerifierId = requireIdentity(
    trustedVerifier.verifierId,
    'trustedVerifier.verifierId'
  );
  const trustedKeyId = requireIdentity(
    trustedVerifier.keyId,
    'trustedVerifier.keyId'
  );
  const trustedPublicKeyPath = requireString(
    trustedVerifier.publicKeyPath,
    'trustedVerifier.publicKeyPath'
  );
  const trustedPublicKeySha256 = requireSha256(
    trustedVerifier.publicKeySha256,
    'trustedVerifier.publicKeySha256'
  );
  if (
    verifier.id !== trustedVerifierId ||
    verifier.keyId !== trustedKeyId ||
    verifier.publicKeySha256 !== trustedPublicKeySha256
  ) {
    throw new Error(
      `${location}.verifier does not match the pinned trust root`
    );
  }

  const snapshots = {
    artifact: snapshotRegularFile(
      evidenceRoot,
      artifact.path,
      `${location}.artifact.path`
    ),
    resultSchema: snapshotRegularFile(
      evidenceRoot,
      resultSchema.path,
      `${location}.resultSchema.path`
    ),
    rerunArtifact: snapshotRegularFile(
      evidenceRoot,
      verifier.rerunArtifact.path,
      `${location}.verifier.rerunArtifact.path`
    ),
    attestation: snapshotRegularFile(
      evidenceRoot,
      verifier.attestation.path,
      `${location}.verifier.attestation.path`
    ),
    publicKey: snapshotRegularFile(
      evidenceRoot,
      trustedPublicKeyPath,
      'trustedVerifier.publicKeyPath'
    ),
  };
  const fileIdentities = Object.entries(snapshots).map(
    ([id, snapshot]) => `${id}:${snapshot.device}:${snapshot.inode}`
  );
  const inodeIdentities = Object.values(snapshots).map(
    (snapshot) => `${snapshot.device}:${snapshot.inode}`
  );
  if (new Set(inodeIdentities).size !== inodeIdentities.length) {
    throw new Error(
      `${location} producer, schema, rerun, attestation, and trust files must be distinct`
    );
  }
  if (new Set(fileIdentities).size !== fileIdentities.length) {
    throw new Error(`${location} evidence files must not alias one another`);
  }

  for (const [bindingLocation, binding, snapshot] of [
    [`${location}.artifact`, artifact, snapshots.artifact],
    [`${location}.resultSchema`, resultSchema, snapshots.resultSchema],
    [
      `${location}.verifier.rerunArtifact`,
      verifier.rerunArtifact,
      snapshots.rerunArtifact,
    ],
    [
      `${location}.verifier.attestation`,
      verifier.attestation,
      snapshots.attestation,
    ],
  ] as const) {
    const actualDigest = sha256Bytes(snapshot.bytes);
    if (binding.sha256 !== actualDigest) {
      throw new Error(
        `${bindingLocation}.sha256 does not match snapshotted file bytes`
      );
    }
  }
  if (sha256Bytes(snapshots.publicKey.bytes) !== trustedPublicKeySha256) {
    throw new Error('trustedVerifier.publicKeySha256 does not match key bytes');
  }

  const producerArtifact = parseJsonSnapshot(
    snapshots.artifact,
    `${location}.artifact`
  );
  if (!isObject(producerArtifact)) {
    throw new Error(`${location}.artifact must contain an object`);
  }
  requireExactKeys(
    producerArtifact,
    [
      'artifactVersion',
      'subjectSha',
      'resultId',
      'resultIdentitySha256',
      'assertionId',
      'dimension',
      'exampleId',
      'status',
      'producer',
      'resultSchema',
    ],
    `${location}.artifact`
  );
  requireSameValue(
    producerArtifact,
    {
      artifactVersion: MACHINE_ARTIFACT_VERSION,
      subjectSha: expected.subjectSha,
      resultId: expected.resultId,
      resultIdentitySha256: expected.resultIdentitySha256,
      assertionId,
      dimension: expected.dimension,
      exampleId: expected.exampleId,
      status: 'PASS',
      producer,
      resultSchema,
    },
    `${location}.artifact`
  );

  const schema = parseJsonSnapshot(
    snapshots.resultSchema,
    `${location}.resultSchema`
  );
  if (!isObject(schema) || schema.type !== 'object') {
    throw new Error(`${location}.resultSchema must declare an object schema`);
  }

  const rerun = parseJsonSnapshot(
    snapshots.rerunArtifact,
    `${location}.verifier.rerunArtifact`
  );
  if (!isObject(rerun)) {
    throw new Error(
      `${location}.verifier.rerunArtifact must contain an object`
    );
  }
  requireExactKeys(
    rerun,
    [
      'rerunVersion',
      'subjectSha',
      'resultId',
      'resultIdentitySha256',
      'assertionId',
      'dimension',
      'exampleId',
      'verifier',
      'evidenceArtifact',
      'resultSchema',
      'startedAt',
      'endedAt',
      'exitCode',
      'verdict',
      'checks',
    ],
    `${location}.verifier.rerunArtifact`
  );
  const expectedRerunVerifier = {
    id: verifier.id,
    keyId: verifier.keyId,
    environment: verifier.environment,
    command: verifier.command,
    toolVersions: verifier.toolVersions,
  };
  const startedAt = requireCanonicalTimestamp(
    rerun.startedAt,
    `${location}.verifier.rerunArtifact.startedAt`
  );
  const endedAt = requireCanonicalTimestamp(
    rerun.endedAt,
    `${location}.verifier.rerunArtifact.endedAt`
  );
  if (endedAt < startedAt) {
    throw new Error(
      `${location}.verifier.rerunArtifact ended before it started`
    );
  }
  const checks = requireStringArray(
    rerun.checks,
    `${location}.verifier.rerunArtifact.checks`
  );
  requireSameValue(
    rerun,
    {
      rerunVersion: MACHINE_RERUN_VERSION,
      subjectSha: expected.subjectSha,
      resultId: expected.resultId,
      resultIdentitySha256: expected.resultIdentitySha256,
      assertionId,
      dimension: expected.dimension,
      exampleId: expected.exampleId,
      verifier: expectedRerunVerifier,
      evidenceArtifact: artifact,
      resultSchema,
      startedAt: startedAt.toISOString(),
      endedAt: endedAt.toISOString(),
      exitCode: 0,
      verdict: 'PASS',
      checks,
    },
    `${location}.verifier.rerunArtifact`
  );

  const signedAssertion = {
    evidenceVersion: MACHINE_EVIDENCE_VERSION,
    subjectSha: expected.subjectSha,
    resultId: expected.resultId,
    resultIdentitySha256: expected.resultIdentitySha256,
    assertionId,
    dimension: expected.dimension,
    exampleId: expected.exampleId,
    status: 'PASS',
    artifact,
    resultSchema,
    producer,
    verifier: {
      id: verifier.id,
      keyId: verifier.keyId,
      publicKeySha256: verifier.publicKeySha256,
      environment: verifier.environment,
      command: verifier.command,
      toolVersions: verifier.toolVersions,
      rerunArtifact: verifier.rerunArtifact,
    },
    rerunExitCode: 0,
    rerunVerdict: 'PASS',
  };
  const envelope = parseJsonSnapshot(
    snapshots.attestation,
    `${location}.verifier.attestation`
  );
  if (!isObject(envelope)) {
    throw new Error(`${location}.verifier.attestation must contain an object`);
  }
  requireExactKeys(
    envelope,
    ['payload', 'signatureAlgorithm', 'signature'],
    `${location}.verifier.attestation`
  );
  if (envelope.signatureAlgorithm !== 'ed25519') {
    throw new Error(
      `${location}.verifier.attestation.signatureAlgorithm must be ed25519`
    );
  }
  if (!isObject(envelope.payload)) {
    throw new Error(
      `${location}.verifier.attestation.payload must be an object`
    );
  }
  requireExactKeys(
    envelope.payload,
    [
      'attestationVersion',
      'verifierId',
      'keyId',
      'publicKeySha256',
      'signedAt',
      'assertion',
    ],
    `${location}.verifier.attestation.payload`
  );
  const signedAt = requireCanonicalTimestamp(
    envelope.payload.signedAt,
    `${location}.verifier.attestation.payload.signedAt`
  );
  requireSameValue(
    envelope.payload,
    {
      attestationVersion: MACHINE_ATTESTATION_VERSION,
      verifierId: verifier.id,
      keyId: verifier.keyId,
      publicKeySha256: verifier.publicKeySha256,
      signedAt: signedAt.toISOString(),
      assertion: signedAssertion,
    },
    `${location}.verifier.attestation.payload`
  );
  if (signedAt < endedAt) {
    throw new Error(`${location}.verifier.attestation predates verifier rerun`);
  }

  const encodedSignature = requireString(
    envelope.signature,
    `${location}.verifier.attestation.signature`
  );
  const signature = Buffer.from(encodedSignature, 'base64');
  if (
    signature.byteLength !== 64 ||
    signature.toString('base64') !== encodedSignature
  ) {
    throw new Error(
      `${location}.verifier.attestation.signature must be canonical padded Ed25519 base64`
    );
  }
  try {
    const publicKey = createPublicKey(snapshots.publicKey.bytes);
    if (publicKey.asymmetricKeyType !== 'ed25519') {
      throw new Error('pinned public key is not Ed25519');
    }
    if (
      !verifySignature(
        null,
        Buffer.from(canonicalJson(envelope.payload), 'utf8'),
        publicKey,
        signature
      )
    ) {
      throw new Error('signature is invalid for the canonical payload');
    }
  } catch (error) {
    throw new Error(
      `${location}.verifier.attestation signature verification failed: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }

  return { descriptor, trusted: true };
}

/**
 * Validate a machine result and bind it to the exact repository SHA and the
 * exact set of catalog examples it claims to cover. A partial scope is valid,
 * but examples outside that scope remain UNKNOWN.
 */
export function validateMachineResult(
  input: unknown,
  subjectSha: string,
  catalogExampleIds: ReadonlySet<string>,
  location = 'machine result',
  evidenceRoot = process.cwd(),
  trustedVerifier?: MachineVerifierTrust
): MachineHealthResult {
  if (!isObject(input)) throw new Error(`${location} must be an object`);
  requireExactKeys(
    input,
    ['resultVersion', 'resultId', 'dimension', 'subject', 'scope', 'results'],
    location
  );

  if (input.resultVersion !== MACHINE_RESULT_VERSION) {
    throw new Error(
      `${location}.resultVersion must be ${MACHINE_RESULT_VERSION}`
    );
  }
  const resultId = requireString(input.resultId, `${location}.resultId`);
  if (!RESULT_ID_PATTERN.test(resultId)) {
    throw new Error(`${location}.resultId must be stable kebab-case`);
  }
  const dimension = requireString(input.dimension, `${location}.dimension`);
  if (!MACHINE_DIMENSIONS.has(dimension as HealthDimension)) {
    throw new Error(
      `${location}.dimension must be a machine-supplied Health V2 dimension`
    );
  }

  if (!isObject(input.subject)) {
    throw new Error(`${location}.subject must be an object`);
  }
  requireExactKeys(
    input.subject,
    ['repository', 'sha', 'catalogSchemaVersion'],
    `${location}.subject`
  );
  if (input.subject.repository !== REPOSITORY_ID) {
    throw new Error(`${location}.subject.repository does not match`);
  }
  if (input.subject.sha !== subjectSha) {
    throw new Error(`${location}.subject.sha does not match ${subjectSha}`);
  }
  if (input.subject.catalogSchemaVersion !== CATALOG_SCHEMA_VERSION) {
    throw new Error(
      `${location}.subject.catalogSchemaVersion does not match ${CATALOG_SCHEMA_VERSION}`
    );
  }

  if (!isObject(input.scope)) {
    throw new Error(`${location}.scope must be an object`);
  }
  requireExactKeys(input.scope, ['type', 'exampleIds'], `${location}.scope`);
  if (input.scope.type !== 'catalog-example-ids') {
    throw new Error(`${location}.scope.type must be catalog-example-ids`);
  }
  const scopeIds = requireStringArray(
    input.scope.exampleIds,
    `${location}.scope.exampleIds`
  );
  requireUnique(scopeIds, `${location}.scope.exampleIds`);
  for (const exampleId of scopeIds) {
    if (!catalogExampleIds.has(exampleId)) {
      throw new Error(
        `${location}.scope.exampleIds contains unknown catalog id ${exampleId}`
      );
    }
  }

  if (!Array.isArray(input.results) || input.results.length === 0) {
    throw new Error(`${location}.results must be a non-empty array`);
  }
  const resultIds: string[] = [];
  const unverifiedResults = input.results.map((entry, index) => {
    const resultLocation = `${location}.results[${index}]`;
    if (!isObject(entry)) {
      throw new Error(`${resultLocation} must be an object`);
    }
    requireExactKeys(
      entry,
      ['exampleId', 'status', 'evidence', 'reasons'],
      resultLocation
    );
    const exampleId = requireString(
      entry.exampleId,
      `${resultLocation}.exampleId`
    );
    resultIds.push(exampleId);
    if (!HEALTH_STATUSES.has(entry.status as HealthStatus)) {
      throw new Error(`${resultLocation}.status is not a Health V2 status`);
    }
    const evidence = requireArray(entry.evidence, `${resultLocation}.evidence`);
    const reasons = requireArray(
      entry.reasons,
      `${resultLocation}.reasons`
    ).map((reason, reasonIndex) =>
      requireString(reason, `${resultLocation}.reasons[${reasonIndex}]`)
    );
    if (entry.status === 'PASS') {
      if (evidence.length === 0) {
        throw new Error(
          `${resultLocation}.evidence must contain structured evidence for PASS`
        );
      }
      if (reasons.length !== 0) {
        throw new Error(`${resultLocation}.reasons must be empty for PASS`);
      }
    } else if (reasons.length === 0) {
      throw new Error(
        `${resultLocation}.reasons must explain a non-PASS result`
      );
    }
    return {
      exampleId,
      status: entry.status as HealthStatus,
      evidence,
      reasons: [...reasons].sort(),
    };
  });
  requireUnique(resultIds, `${location}.results[].exampleId`);
  if (!sameValues(scopeIds, resultIds)) {
    throw new Error(
      `${location}.results must bind exactly the ids declared by scope.exampleIds`
    );
  }

  const resultIdentitySha256 = machineResultIdentitySha256({
    resultVersion: MACHINE_RESULT_VERSION,
    resultId,
    dimension: dimension as MachineHealthResult['dimension'],
    subject: {
      repository: REPOSITORY_ID,
      sha: subjectSha,
      catalogSchemaVersion: CATALOG_SCHEMA_VERSION,
    },
    scope: {
      type: 'catalog-example-ids',
      exampleIds: [...scopeIds],
    },
    results: unverifiedResults as MachineHealthResult['results'],
  });
  const results = unverifiedResults.map((entry, resultIndex) => {
    const evidenceValidations = entry.evidence.map(
      (descriptor, evidenceIndex) =>
        validateEvidenceDescriptor(
          descriptor,
          {
            subjectSha,
            resultId,
            resultIdentitySha256,
            dimension: dimension as HealthDimension,
            exampleId: entry.exampleId,
          },
          `${location}.results[${resultIndex}].evidence[${evidenceIndex}]`,
          evidenceRoot,
          trustedVerifier
        )
    );
    const evidence = evidenceValidations.map(
      (validation) => validation.descriptor
    );
    requireUnique(
      evidence.map((descriptor) => descriptor.assertionId),
      `${location}.results[${resultIndex}].evidence[].assertionId`
    );
    if (entry.status === 'PASS') {
      const hasTrustedEnvelope = evidenceValidations.every(
        (validation) => validation.trusted
      );
      return {
        ...entry,
        status: 'UNKNOWN' as const,
        evidence,
        reasons: [
          hasTrustedEnvelope
            ? 'claimed PASS uses the validation-only Health V2 evidence format; raw oracle output, bounded freshness, and a substantive rerun contract are not yet supported'
            : 'claimed PASS has no independently configured trusted verifier',
        ],
      };
    }
    return { ...entry, evidence };
  });

  return {
    resultVersion: MACHINE_RESULT_VERSION,
    resultId,
    dimension: dimension as MachineHealthResult['dimension'],
    subject: {
      repository: REPOSITORY_ID,
      sha: subjectSha,
      catalogSchemaVersion: CATALOG_SCHEMA_VERSION,
    },
    scope: {
      type: 'catalog-example-ids',
      exampleIds: [...scopeIds].sort(),
    },
    results: results.sort((left, right) =>
      left.exampleId.localeCompare(right.exampleId)
    ),
  };
}

function reviewExpiry(reviewDate: string, months: number): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(reviewDate);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const review = new Date(Date.UTC(year, month, day));
  if (
    review.getUTCFullYear() !== year ||
    review.getUTCMonth() !== month ||
    review.getUTCDate() !== day
  ) {
    return null;
  }
  const expiry = new Date(review);
  expiry.setUTCMonth(expiry.getUTCMonth() + months);
  return expiry;
}

function maintenanceCell(record: ExampleRecord, asOf: Date): ExampleHealthCell {
  const failures: string[] = [];
  const technicalExpiry = reviewExpiry(
    record.lastTechnicalVerification,
    VERIFICATION_POLICY.technicalReviewExpiresAfterMonths
  );
  const editorialExpiry = reviewExpiry(
    record.lastEditorialVerification,
    VERIFICATION_POLICY.editorialReviewExpiresAfterMonths
  );
  const technicalReview = new Date(
    `${record.lastTechnicalVerification}T00:00:00.000Z`
  );
  const editorialReview = new Date(
    `${record.lastEditorialVerification}T00:00:00.000Z`
  );

  if (record.producerLane === record.verifierLane) {
    failures.push('producer and verifier lanes are not independent');
  }
  if (record.verificationPolicyDigest !== VERIFICATION_POLICY_DIGEST) {
    failures.push('verification policy digest is stale');
  }
  if (
    technicalExpiry === null ||
    technicalReview > asOf ||
    technicalExpiry < asOf
  ) {
    failures.push('technical verification date is invalid, future, or expired');
  }
  if (
    editorialExpiry === null ||
    editorialReview > asOf ||
    editorialExpiry < asOf
  ) {
    failures.push('editorial verification date is invalid, future, or expired');
  }

  return {
    exampleId: record.id,
    status: failures.length === 0 ? 'UNKNOWN' : 'FAIL',
    source: 'canonical-catalog',
    resultId: null,
    evidence:
      failures.length === 0
        ? [
            'private verification evidence join unavailable; registry dates alone cannot prove maintenance PASS',
          ]
        : failures.sort(),
  };
}

function reduceStatus(cells: readonly ExampleHealthCell[]): HealthStatus {
  if (cells.some((cell) => cell.status === 'FAIL')) return 'FAIL';
  if (cells.some((cell) => cell.status === 'BLOCKED_CAPABILITY')) {
    return 'BLOCKED_CAPABILITY';
  }
  if (cells.some((cell) => cell.status === 'UNKNOWN')) return 'UNKNOWN';
  return 'PASS';
}

function dimensionReport(
  id: HealthDimension,
  cells: ExampleHealthCell[]
): HealthV2Report['dimensions'][number] {
  const examples = [...cells].sort((left, right) =>
    left.exampleId.localeCompare(right.exampleId)
  );
  const pass = examples.filter((cell) => cell.status === 'PASS').length;
  const fail = examples.filter((cell) => cell.status === 'FAIL').length;
  const unknown = examples.filter((cell) => cell.status === 'UNKNOWN').length;
  const blockedCapability = examples.filter(
    (cell) => cell.status === 'BLOCKED_CAPABILITY'
  ).length;
  const tested = pass + fail;

  return {
    id,
    status: reduceStatus(examples),
    summary: {
      total: examples.length,
      tested,
      testedPercent:
        examples.length === 0
          ? 0
          : Math.round((tested / examples.length) * 100),
      pass,
      fail,
      unknown,
      blockedCapability,
    },
    examples,
  };
}

export function generateHealthV2(
  options: GenerateHealthOptions
): HealthV2Report {
  if (
    !SHA_PATTERN.test(options.subjectSha) ||
    options.subjectSha === '0'.repeat(40)
  ) {
    throw new Error(
      'subjectSha must be a nonzero lowercase 40-character Git SHA'
    );
  }
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const asOf = new Date(generatedAt);
  if (!Number.isFinite(asOf.valueOf()) || asOf.toISOString() !== generatedAt) {
    throw new Error('generatedAt must be a canonical ISO 8601 timestamp');
  }

  const records = [...PUBLIC_CATALOG.records].sort((left, right) =>
    left.id.localeCompare(right.id)
  );
  const exampleIds = records.map((record) => record.id);
  const catalogExampleIds = new Set(exampleIds);
  const catalogValidation = validatePublicCatalog(PUBLIC_CATALOG);
  const maintenanceCells = records.map((record) =>
    maintenanceCell(record, asOf)
  );

  const machineCells = new Map<string, ExampleHealthCell>();
  for (const [index, input] of (options.machineResults ?? []).entries()) {
    const result = validateMachineResult(
      input,
      options.subjectSha,
      catalogExampleIds,
      `machineResults[${index}]`,
      options.evidenceRoot ?? process.cwd(),
      options.trustedVerifier
    );
    for (const cell of result.results) {
      const key = `${result.dimension}:${cell.exampleId}`;
      if (machineCells.has(key)) {
        throw new Error(
          `multiple machine results cover ${result.dimension}:${cell.exampleId}`
        );
      }
      machineCells.set(key, {
        exampleId: cell.exampleId,
        status: cell.status,
        source: 'machine-result',
        resultId: result.resultId,
        evidence:
          cell.status === 'PASS'
            ? [...cell.evidence]
            : cell.evidence.length > 0
              ? [...cell.evidence, ...cell.reasons]
              : [...cell.reasons],
      });
    }
  }

  const verifiedMaintenanceCells = maintenanceCells.map((cell) => {
    if (cell.status === 'FAIL') return cell;
    return machineCells.get(`maintenance:${cell.exampleId}`) ?? cell;
  });
  const catalogCells: ExampleHealthCell[] = records.map((record, index) => {
    const maintenance = maintenanceCells[index];
    if (!catalogValidation.valid) {
      return {
        exampleId: record.id,
        status: 'FAIL',
        source: 'canonical-catalog',
        resultId: null,
        evidence: [...catalogValidation.errors].sort(),
      };
    }
    if (maintenance.status === 'FAIL') {
      return {
        exampleId: record.id,
        status: 'FAIL',
        source: 'canonical-catalog',
        resultId: null,
        evidence: maintenance.evidence.map(
          (entry) => `catalog metadata: ${String(entry)}`
        ),
      };
    }
    return (
      machineCells.get(`catalog:${record.id}`) ?? {
        exampleId: record.id,
        status: 'UNKNOWN',
        source: 'canonical-catalog',
        resultId: null,
        evidence: [
          'canonical schema is valid, but the private evidence join required for catalog PASS was not supplied',
        ],
      }
    );
  });

  const dimensions = HEALTH_DIMENSIONS.map((dimension) => {
    if (dimension === 'catalog') {
      return dimensionReport(dimension, catalogCells);
    }
    if (dimension === 'maintenance') {
      return dimensionReport(dimension, verifiedMaintenanceCells);
    }
    return dimensionReport(
      dimension,
      records.map(
        (record): ExampleHealthCell =>
          machineCells.get(`${dimension}:${record.id}`) ?? {
            exampleId: record.id,
            status: 'UNKNOWN',
            source: 'untested',
            resultId: null,
            evidence: ['no bound machine result supplied'],
          }
      )
    );
  });

  return {
    schemaVersion: HEALTH_V2_VERSION,
    generatedAt,
    subject: {
      repository: REPOSITORY_ID,
      sha: options.subjectSha,
      catalogSchemaVersion: CATALOG_SCHEMA_VERSION,
      exampleIds,
    },
    dimensions,
  };
}

function usage(): string {
  return [
    'Usage:',
    '  tsx scripts/generate-health-v2.ts --subject-sha <40-char-sha> [--result <json>]... [--trusted-verifier <json>] [--generated-at <iso>]',
    '',
    'Each --result file must use MachineHealthResult and bind its exact subject SHA',
    'and catalog-example-ids scope. PASS also requires an independently configured',
    'Ed25519 trusted-verifier policy matching the out-of-band HEALTH_VERIFIER_ID,',
    'HEALTH_VERIFIER_KEY_ID, and HEALTH_VERIFIER_PUBLIC_KEY_SHA256 pins. Without',
    'that external trust root, claimed PASS cells remain UNKNOWN.',
    'The report is written as JSON to stdout.',
  ].join('\n');
}

async function main(argv: string[]): Promise<void> {
  let subjectSha: string | undefined;
  let generatedAt: string | undefined;
  let trustedVerifierPath: string | undefined;
  const resultPaths: string[] = [];

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--help') {
      process.stdout.write(`${usage()}\n`);
      return;
    }
    if (
      argument !== '--subject-sha' &&
      argument !== '--result' &&
      argument !== '--trusted-verifier' &&
      argument !== '--generated-at'
    ) {
      throw new Error(`Unknown argument: ${argument}\n${usage()}`);
    }
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) {
      throw new Error(`Missing value for ${argument}`);
    }
    if (argument === '--subject-sha') {
      if (subjectSha !== undefined)
        throw new Error('--subject-sha was repeated');
      subjectSha = value;
    } else if (argument === '--generated-at') {
      if (generatedAt !== undefined)
        throw new Error('--generated-at was repeated');
      generatedAt = value;
    } else if (argument === '--trusted-verifier') {
      if (trustedVerifierPath !== undefined)
        throw new Error('--trusted-verifier was repeated');
      trustedVerifierPath = value;
    } else {
      resultPaths.push(value);
    }
    index += 1;
  }

  if (!subjectSha) throw new Error(`--subject-sha is required\n${usage()}`);
  const machineResults: unknown[] = [];
  for (const path of resultPaths) {
    try {
      machineResults.push(JSON.parse(await readFile(resolve(path), 'utf8')));
    } catch (error) {
      throw new Error(
        `Cannot read machine result ${path}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }
  let trustedVerifier: MachineVerifierTrust | undefined;
  if (trustedVerifierPath) {
    try {
      trustedVerifier = JSON.parse(
        await readFile(resolve(trustedVerifierPath), 'utf8')
      ) as MachineVerifierTrust;
    } catch (error) {
      throw new Error(
        `Cannot read trusted verifier policy ${trustedVerifierPath}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
    const externalPins = {
      verifierId: process.env.HEALTH_VERIFIER_ID,
      keyId: process.env.HEALTH_VERIFIER_KEY_ID,
      publicKeySha256: process.env.HEALTH_VERIFIER_PUBLIC_KEY_SHA256,
    };
    if (Object.values(externalPins).some((value) => !value)) {
      throw new Error(
        '--trusted-verifier requires out-of-band HEALTH_VERIFIER_ID, HEALTH_VERIFIER_KEY_ID, and HEALTH_VERIFIER_PUBLIC_KEY_SHA256 pins'
      );
    }
    if (
      trustedVerifier.verifierId !== externalPins.verifierId ||
      trustedVerifier.keyId !== externalPins.keyId ||
      trustedVerifier.publicKeySha256 !== externalPins.publicKeySha256
    ) {
      throw new Error(
        'trusted verifier policy does not match the out-of-band verifier trust pins'
      );
    }
  }

  process.stdout.write(
    `${JSON.stringify(
      generateHealthV2({
        subjectSha,
        generatedAt,
        machineResults,
        trustedVerifier,
      }),
      null,
      2
    )}\n`
  );
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : '';
if (fileURLToPath(import.meta.url) === invokedPath) {
  main(process.argv.slice(2)).catch((error) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`
    );
    process.exitCode = 1;
  });
}
