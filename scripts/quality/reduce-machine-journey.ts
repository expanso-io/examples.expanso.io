import { execFileSync } from 'node:child_process';
import {
  createHash,
  createPublicKey,
  verify as verifySignature,
} from 'node:crypto';
import {
  closeSync,
  constants,
  existsSync,
  fstatSync,
  lstatSync,
  openSync,
  readFileSync,
  realpathSync,
} from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, isAbsolute, posix, relative, resolve, sep } from 'node:path';

import {
  loadContract,
  readJson,
  sha256Bytes,
  type QualityContract,
} from './contract-lib';
import { validateJsonSchema } from './json-schema';

type RecordValue = Record<string, unknown>;
type JourneyStatus = 'PASS' | 'FAIL' | 'UNKNOWN' | 'BLOCKED_CAPABILITY';

const SHA_PATTERN = /^[a-f0-9]{40}$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const ZERO_SHA = '0'.repeat(40);
const RESULT_SCHEMA_ID =
  'https://examples.expanso.io/tests/contracts/schemas/machine-journey-result-v2.schema.json';
const SCORER_SCHEMA_ID =
  'https://examples.expanso.io/tests/contracts/schemas/machine-journey-scorer-output-v2.schema.json';
const RESULT_VERSION = '2.0.0';
const ATTESTATION_VERSION = '1.0.0';
const ORACLE_VERSION = '2.0.0';
const SCORER_OUTPUT_VERSION = '2.0.0';
const TRACE_FIELDS = ['dom', 'network', 'screenshot', 'commands'] as const;
const SCORED_TRACE_FIELDS = ['dom', 'network', 'commands'] as const;

export const REQUIRED_ASSERTIONS_BY_TASK = {
  'find-example': ['family-match', 'route-match'],
  'explain-boundary': ['boundary-oracle-match'],
  'open-shared-stage': [
    'stage-match',
    'semantic-change-match',
    'shared-url-match',
  ],
  'retrieve-pipeline': ['pipeline-path-match', 'pipeline-digest-match'],
  'run-offline-path': [
    'command-match',
    'fixture-match',
    'output-assertions-match',
  ],
} as const;

export interface JourneyVerifierTrust {
  verifierId: string;
  keyId: string;
  publicKeyPath: string;
  publicKeySha256: string;
}

export interface JourneyAgentTrust {
  protocolVersion: string;
  agentId: string;
  publicKeyPath: string;
  publicKeySha256: string;
}

export interface JourneyReductionOptions {
  expectedSubjectSha: string;
  evidenceRoot: string;
  contractPath?: string;
  expectedEnvironmentId?: string;
  trustedVerifier?: JourneyVerifierTrust;
  trustedAgent?: JourneyAgentTrust;
  now?: Date;
}

export interface JourneyReduction {
  schemaVersion: 'machine-journey-reduction-v2';
  resultVersion: string | null;
  contractId: string;
  contractSha256: string;
  subjectSha: string | null;
  environmentId: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  status: JourneyStatus;
  errors: string[];
}

interface ArtifactBinding {
  evidenceVersion: 'journey-artifact-v2';
  path: string;
  sha256: string;
  bytes: number;
}

interface Snapshot {
  bytes: Buffer;
  device: number;
  inode: number;
}

interface ReductionContext {
  root: string;
  usedPaths: Set<string>;
  usedInodes: Set<string>;
  errors: string[];
}

interface DerivedAssertion {
  assertionId: string;
  expected: unknown;
  actual: unknown;
  expectedSha256: string;
  actualSha256: string;
  outcome: 'PASS' | 'FAIL';
}

interface TraceDocuments {
  dom: RecordValue;
  network: RecordValue;
  commands: RecordValue;
}

function isObject(value: unknown): value is RecordValue {
  return value !== null && !Array.isArray(value) && typeof value === 'object';
}

function object(value: unknown, location: string): RecordValue {
  if (!isObject(value)) throw new Error(`${location} must be an object`);
  return value;
}

function array(value: unknown, location: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${location} must be an array`);
  return value;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function unique(values: readonly string[]): boolean {
  return new Set(values).size === values.length;
}

function sameValues(
  left: readonly string[],
  right: readonly string[]
): boolean {
  return (
    left.length === right.length &&
    [...left].sort().every((entry, index) => entry === [...right].sort()[index])
  );
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

function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function valueDigest(value: unknown): string {
  return sha256Bytes(canonicalJson(value));
}

export function machineJourneyResultIdentitySha256(input: RecordValue): string {
  const { verifierAttestation: _attestation, ...identity } = input;
  return valueDigest(identity);
}

function validateExpectedSubjectSha(subjectSha: string): void {
  if (!SHA_PATTERN.test(subjectSha) || subjectSha === ZERO_SHA) {
    throw new Error(
      'expectedSubjectSha must be a nonzero lowercase 40-character Git SHA'
    );
  }
}

function reduction(
  contract: { contractId: string; contractSha256: string },
  result: RecordValue | null,
  errors: string[],
  trustMissing: boolean,
  blocked: boolean
): JourneyReduction {
  const status: JourneyStatus =
    errors.length > 0
      ? 'FAIL'
      : trustMissing
        ? 'UNKNOWN'
        : blocked
          ? 'BLOCKED_CAPABILITY'
          : 'PASS';
  return {
    schemaVersion: 'machine-journey-reduction-v2',
    resultVersion: stringOrNull(result?.resultVersion),
    contractId: contract.contractId,
    contractSha256: contract.contractSha256,
    subjectSha: stringOrNull(result?.subjectSha),
    environmentId: stringOrNull(result?.environmentId),
    startedAt: stringOrNull(result?.startedAt),
    finishedAt: stringOrNull(result?.finishedAt),
    status,
    errors,
  };
}

function normalizeArtifactBinding(
  value: unknown,
  location: string,
  errors: string[]
): ArtifactBinding | null {
  if (!isObject(value)) {
    errors.push(`${location} must be an artifact binding object`);
    return null;
  }
  const expectedKeys = ['evidenceVersion', 'path', 'sha256', 'bytes'];
  const keys = Object.keys(value);
  if (!sameValues(keys, expectedKeys)) {
    errors.push(`${location} must contain exactly ${expectedKeys.join(', ')}`);
    return null;
  }
  if (value.evidenceVersion !== 'journey-artifact-v2') {
    errors.push(`${location}.evidenceVersion must be journey-artifact-v2`);
  }
  if (typeof value.path !== 'string' || value.path.length === 0) {
    errors.push(`${location}.path must be a non-empty string`);
  }
  if (typeof value.sha256 !== 'string' || !SHA256_PATTERN.test(value.sha256)) {
    errors.push(`${location}.sha256 must be a lowercase SHA-256 digest`);
  }
  if (!Number.isInteger(value.bytes) || Number(value.bytes) < 1) {
    errors.push(`${location}.bytes must be a positive integer`);
  }
  if (errors.some((error) => error.startsWith(location))) return null;
  return value as unknown as ArtifactBinding;
}

function snapshotArtifact(
  binding: ArtifactBinding,
  location: string,
  context: ReductionContext
): Snapshot | null {
  const rawPath = binding.path;
  if (
    isAbsolute(rawPath) ||
    rawPath.includes('\\') ||
    rawPath !== posix.normalize(rawPath) ||
    rawPath === '.' ||
    rawPath.startsWith('../')
  ) {
    context.errors.push(
      `${location}.path must be normalized and root-relative`
    );
    return null;
  }
  if (context.usedPaths.has(rawPath)) {
    context.errors.push(`${location}.path aliases another evidence artifact`);
    return null;
  }
  context.usedPaths.add(rawPath);

  try {
    const requestedPath = resolve(context.root, rawPath);
    const relativePath = relative(context.root, requestedPath);
    if (
      relativePath === '..' ||
      relativePath.startsWith(`..${sep}`) ||
      isAbsolute(relativePath)
    ) {
      throw new Error('path escapes the evidence root');
    }
    const metadata = lstatSync(requestedPath);
    if (metadata.isSymbolicLink() || !metadata.isFile()) {
      throw new Error('path must be a non-symlink regular file');
    }
    const canonicalPath = realpathSync(requestedPath);
    const canonicalRelative = relative(context.root, canonicalPath);
    if (
      canonicalRelative === '..' ||
      canonicalRelative.startsWith(`..${sep}`) ||
      isAbsolute(canonicalRelative)
    ) {
      throw new Error('canonical path escapes the evidence root');
    }
    const descriptor = openSync(
      requestedPath,
      constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0)
    );
    try {
      const before = fstatSync(descriptor);
      const bytes = readFileSync(descriptor);
      const after = fstatSync(descriptor);
      if (
        !before.isFile() ||
        before.dev !== after.dev ||
        before.ino !== after.ino ||
        before.size !== after.size ||
        bytes.byteLength !== after.size
      ) {
        throw new Error('file changed while being snapshotted');
      }
      const inode = `${after.dev}:${after.ino}`;
      if (context.usedInodes.has(inode)) {
        throw new Error('file inode aliases another evidence artifact');
      }
      context.usedInodes.add(inode);
      if (bytes.byteLength !== binding.bytes) {
        context.errors.push(
          `${location}: byte count mismatch; expected ${binding.bytes}, got ${bytes.byteLength}`
        );
      }
      const digest = sha256Bytes(bytes);
      if (digest !== binding.sha256) {
        context.errors.push(
          `${location}: digest mismatch; expected ${binding.sha256}, got ${digest}`
        );
      }
      return { bytes, device: after.dev, inode: after.ino };
    } finally {
      closeSync(descriptor);
    }
  } catch (error) {
    context.errors.push(
      `${location}: cannot snapshot evidence artifact: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    return null;
  }
}

function readBoundJson(
  value: unknown,
  location: string,
  context: ReductionContext
): { binding: ArtifactBinding; value: RecordValue } | null {
  const binding = normalizeArtifactBinding(value, location, context.errors);
  if (!binding) return null;
  const snapshot = snapshotArtifact(binding, location, context);
  if (!snapshot) return null;
  try {
    return {
      binding,
      value: object(JSON.parse(snapshot.bytes.toString('utf8')), location),
    };
  } catch (error) {
    context.errors.push(
      `${location}: artifact must contain a JSON object: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    return null;
  }
}

function expectedAssertions(expectedTask: RecordValue): Map<string, unknown> {
  const taskId = String(expectedTask.taskId);
  const values = new Map<string, unknown>();
  if (taskId === 'find-example') {
    values.set('family-match', expectedTask.intendedFamilyId);
    values.set('route-match', expectedTask.intendedRouteId);
  } else if (taskId === 'explain-boundary') {
    values.set('boundary-oracle-match', expectedTask.boundaryOracle);
  } else if (taskId === 'open-shared-stage') {
    const oracle = object(expectedTask.explorerOracle, 'explorerOracle');
    values.set('stage-match', oracle.stageId);
    values.set('semantic-change-match', oracle.semanticChange);
    values.set('shared-url-match', oracle.sharedUrl);
  } else if (taskId === 'retrieve-pipeline') {
    const oracle = object(expectedTask.pipelineOracle, 'pipelineOracle');
    values.set('pipeline-path-match', oracle.path);
    values.set('pipeline-digest-match', oracle.sha256);
  } else if (taskId === 'run-offline-path') {
    const oracle = object(expectedTask.localRunOracle, 'localRunOracle');
    values.set('command-match', oracle.command);
    values.set('fixture-match', oracle.fixturePath);
    values.set('output-assertions-match', oracle.expectedAssertions);
  }
  return values;
}

function verifyOracleManifest(
  oracle: RecordValue,
  expected: {
    contract: QualityContract;
    subjectSha: string;
    environmentId: string;
    trialId: string;
    taskId: string;
    trace: Record<string, ArtifactBinding>;
  },
  location: string,
  errors: string[]
): void {
  const expectedKeys = [
    'oracleVersion',
    'contractId',
    'contractSha256',
    'subjectSha',
    'environmentId',
    'trialId',
    'taskId',
    'trace',
  ];
  if (!sameValues(Object.keys(oracle), expectedKeys)) {
    errors.push(`${location} has invalid oracle artifact fields`);
    return;
  }
  const exactHeader = {
    oracleVersion: ORACLE_VERSION,
    contractId: expected.contract.contractId,
    contractSha256: expected.contract.contractSha256,
    subjectSha: expected.subjectSha,
    environmentId: expected.environmentId,
    trialId: expected.trialId,
    taskId: expected.taskId,
    trace: expected.trace,
  };
  for (const [field, value] of Object.entries(exactHeader)) {
    if (canonicalJson(oracle[field]) !== canonicalJson(value)) {
      errors.push(
        `${location}.${field} does not match the retained result binding`
      );
    }
  }
}

function derivedAssertions(
  expectedValues: Map<string, unknown>,
  actualValues: Map<string, unknown>
): DerivedAssertion[] {
  return [...expectedValues.entries()].map(([assertionId, expectedValue]) => {
    const actual = actualValues.get(assertionId) ?? null;
    const outcome =
      canonicalJson(actual) === canonicalJson(expectedValue) ? 'PASS' : 'FAIL';
    return {
      assertionId,
      expected: expectedValue,
      actual,
      expectedSha256: valueDigest(expectedValue),
      actualSha256: valueDigest(actual),
      outcome,
    };
  });
}

function validateTraceDocument(
  trace: RecordValue,
  schema: RecordValue,
  format: string,
  expected: {
    contract: QualityContract;
    subjectSha: string;
    environmentId: string;
    trialId: string;
    taskId: string;
  },
  location: string,
  errors: string[]
): boolean {
  const before = errors.length;
  errors.push(...validateJsonSchema(trace, schema, location));
  const exactHeader = {
    traceVersion: format,
    contractId: expected.contract.contractId,
    contractSha256: expected.contract.contractSha256,
    subjectSha: expected.subjectSha,
    environmentId: expected.environmentId,
    trialId: expected.trialId,
    taskId: expected.taskId,
  };
  for (const [field, value] of Object.entries(exactHeader)) {
    if (trace[field] !== value) {
      errors.push(`${location}.${field} does not match the reduced task`);
    }
  }
  return errors.length === before;
}

function boundaryActual(
  snapshots: RecordValue[],
  expectedBoundary: RecordValue
): RecordValue {
  const visible = snapshots
    .flatMap((snapshot) =>
      Array.isArray(snapshot.visibleText) ? snapshot.visibleText : []
    )
    .filter((value): value is string => typeof value === 'string')
    .join('\n')
    .toLocaleLowerCase('en-US');
  return Object.fromEntries(
    Object.entries(expectedBoundary).map(([category, phrases]) => [
      category,
      Array.isArray(phrases)
        ? phrases.filter(
            (phrase): phrase is string =>
              typeof phrase === 'string' &&
              visible.includes(phrase.toLocaleLowerCase('en-US'))
          )
        : [],
    ])
  );
}

function displayedPath(rawUrl: unknown): string | null {
  if (typeof rawUrl !== 'string') return null;
  try {
    const parsed = new URL(rawUrl, 'https://journey.invalid');
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return null;
  }
}

function offlineSummaryActual(
  invocation: RecordValue | null,
  expectedTask: RecordValue
): Map<string, unknown> {
  const actual = new Map<string, unknown>();
  actual.set('command-match', invocation?.command ?? null);
  let summary: RecordValue | null = null;
  try {
    const stdout =
      typeof invocation?.stdout === 'string' ? invocation.stdout : '';
    const npmOutput =
      /^\s*> examples@0\.0\.0 test-pipelines\r?\n> tsx scripts\/test-pipelines\.ts\r?\n\r?\n(\{[\s\S]*\})\s*$/.exec(
        stdout
      );
    if (
      invocation?.exitCode === 0 &&
      invocation.cwd === '.' &&
      invocation.stderr === '' &&
      npmOutput
    ) {
      summary = object(JSON.parse(npmOutput[1]), 'offline stdout');
    }
  } catch {
    summary = null;
  }
  const records = Array.isArray(summary?.records)
    ? summary.records.filter(isObject)
    : [];
  const record = records.length === 1 ? records[0] : null;
  actual.set('fixture-match', record?.fixturePath ?? null);
  const expected = object(expectedTask.localRunOracle, 'localRunOracle');
  const outputPassed =
    summary?.resultVersion === '2.0.0' &&
    summary.scope === 'catalog-offline-runnable' &&
    summary.status === 'PASS' &&
    summary.claimedOfflineRunnable === 1 &&
    summary.executed === 1 &&
    summary.assertedOutputs === 1 &&
    record?.exampleId === 'remove-pii' &&
    record.completePipelinePath ===
      'examples/data-security/remove-pii-complete.yaml' &&
    record.fixturePath === expected.fixturePath &&
    record.fixtureEnvironmentPath ===
      'examples/data-security/remove-pii/fixture-environment.json' &&
    record.expectedOutputPath ===
      'examples/data-security/remove-pii/expected-output.jsonl' &&
    record.executorImage ===
      'jeffail/benthos:4.13.0@sha256:ec9b635d10bf267eb5b5c4c348b36752af1a5444ba768aefc6ca2c92ae2e22dd' &&
    record.executed === true &&
    record.assertedOutput === true &&
    record.status === 'PASS';
  actual.set(
    'output-assertions-match',
    outputPassed ? expected.expectedAssertions : []
  );
  return actual;
}

function deriveAssertionsFromRawTraces(
  traces: TraceDocuments,
  traceSchemas: Record<string, { format: string; schema: RecordValue }>,
  expectedTask: RecordValue,
  expected: {
    contract: QualityContract;
    subjectSha: string;
    environmentId: string;
    trialId: string;
    taskId: string;
  },
  location: string,
  errors: string[]
): DerivedAssertion[] {
  for (const field of SCORED_TRACE_FIELDS) {
    const binding = traceSchemas[field];
    if (
      !binding ||
      !validateTraceDocument(
        traces[field],
        binding.schema,
        binding.format,
        expected,
        `${location}.${field}`,
        errors
      )
    ) {
      return [];
    }
  }

  const snapshots = array(
    traces.dom.snapshots,
    `${location}.dom.snapshots`
  ).map((entry, index) => object(entry, `${location}.dom.snapshots[${index}]`));
  const requests = array(
    traces.network.requests,
    `${location}.network.requests`
  ).map((entry, index) =>
    object(entry, `${location}.network.requests[${index}]`)
  );
  const invocations = array(
    traces.commands.invocations,
    `${location}.commands.invocations`
  ).map((entry, index) =>
    object(entry, `${location}.commands.invocations[${index}]`)
  );

  const expectedValues = expectedAssertions(expectedTask);
  const actual = new Map<string, unknown>();
  if (expected.taskId === 'find-example') {
    const finalSnapshot = snapshots.at(-1);
    actual.set('family-match', finalSnapshot?.familyId ?? null);
    actual.set('route-match', finalSnapshot?.routeId ?? null);
  } else if (expected.taskId === 'explain-boundary') {
    const boundary = object(expectedTask.boundaryOracle, 'boundaryOracle');
    actual.set('boundary-oracle-match', boundaryActual(snapshots, boundary));
  } else if (expected.taskId === 'open-shared-stage') {
    const finalSnapshot = snapshots.at(-1);
    const attributes = isObject(finalSnapshot?.attributes)
      ? finalSnapshot.attributes
      : {};
    actual.set('stage-match', attributes['data-stage-id'] ?? null);
    actual.set(
      'semantic-change-match',
      attributes['data-semantic-change'] ?? null
    );
    actual.set('shared-url-match', displayedPath(finalSnapshot?.url));
  } else if (expected.taskId === 'retrieve-pipeline') {
    const successful = requests.filter(
      (request) => request.status === 200 && request.method === 'GET'
    );
    const response = successful.length === 1 ? successful[0] : null;
    actual.set('pipeline-path-match', response?.repositoryPath ?? null);
    actual.set('pipeline-digest-match', response?.responseSha256 ?? null);
  } else if (expected.taskId === 'run-offline-path') {
    return derivedAssertions(
      expectedValues,
      offlineSummaryActual(
        invocations.length === 1 ? invocations[0] : null,
        expectedTask
      )
    );
  }
  return derivedAssertions(expectedValues, actual);
}

function verifyScorerOutput(
  scorerOutput: RecordValue,
  scorerSchema: RecordValue,
  derived: DerivedAssertion[],
  expected: {
    contract: QualityContract;
    scorerSchemaSha256: string;
    subjectSha: string;
    environmentId: string;
    trialId: string;
    taskId: string;
    execution: RecordValue;
    trace: Record<string, ArtifactBinding>;
    traceSchemaSha256: Record<string, string>;
    oracleEvidence: ArtifactBinding;
  },
  location: string,
  errors: string[]
): boolean {
  errors.push(...validateJsonSchema(scorerOutput, scorerSchema, location));
  const scorer = object(expected.contract.scorer, 'contract.scorer');
  const expectedAssertions = derived.map(
    ({ assertionId, expectedSha256, actualSha256, outcome }) => ({
      assertionId,
      expectedSha256,
      actualSha256,
      outcome,
    })
  );
  const exact = {
    scorerOutputVersion: SCORER_OUTPUT_VERSION,
    scorerVersion: scorer.version,
    scorerSchemaSha256: expected.scorerSchemaSha256,
    contractId: expected.contract.contractId,
    contractSha256: expected.contract.contractSha256,
    subjectSha: expected.subjectSha,
    environmentId: expected.environmentId,
    trialId: expected.trialId,
    taskId: expected.taskId,
    execution: expected.execution,
    trace: expected.trace,
    traceSchemaSha256: expected.traceSchemaSha256,
    oracleEvidence: expected.oracleEvidence,
    assertions: expectedAssertions,
    status:
      derived.length > 0 &&
      derived.every((assertion) => assertion.outcome === 'PASS')
        ? 'PASS'
        : 'FAIL',
  };
  if (canonicalJson(scorerOutput) !== canonicalJson(exact)) {
    errors.push(
      `${location} does not match the independently reduced oracle assertions`
    );
    return false;
  }
  return exact.status === 'PASS';
}

function verifyAttestation(
  result: RecordValue,
  bindingValue: unknown,
  expectedVerdict: JourneyStatus,
  options: JourneyReductionOptions,
  context: ReductionContext
): boolean {
  if (!options.trustedVerifier) return false;
  const trust = options.trustedVerifier;
  if (
    typeof trust.verifierId !== 'string' ||
    typeof trust.keyId !== 'string' ||
    typeof trust.publicKeyPath !== 'string' ||
    !SHA256_PATTERN.test(trust.publicKeySha256)
  ) {
    context.errors.push('trustedVerifier is invalid');
    return true;
  }
  if (result.producerId === trust.verifierId) {
    context.errors.push('producer and verifier identities must differ');
  }
  const attestation = readBoundJson(
    bindingValue,
    'result.verifierAttestation',
    context
  );
  if (!attestation) return true;

  let keySnapshot: Snapshot | null = null;
  const keyBinding: ArtifactBinding = {
    evidenceVersion: 'journey-artifact-v2',
    path: trust.publicKeyPath,
    sha256: trust.publicKeySha256,
    bytes: 1,
  };
  try {
    const keyPath = resolve(context.root, trust.publicKeyPath);
    const keyBytes = readFileSync(keyPath);
    keyBinding.bytes = keyBytes.byteLength;
    keySnapshot = snapshotArtifact(
      keyBinding,
      'trustedVerifier.publicKeyPath',
      context
    );
  } catch (error) {
    context.errors.push(
      `trustedVerifier.publicKeyPath cannot be read: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
  if (!keySnapshot) return true;

  const envelope = attestation.value;
  if (
    !sameValues(Object.keys(envelope), [
      'payload',
      'signatureAlgorithm',
      'signature',
    ])
  ) {
    context.errors.push('verifier attestation envelope has invalid fields');
    return true;
  }
  if (
    envelope.signatureAlgorithm !== 'ed25519' ||
    !isObject(envelope.payload)
  ) {
    context.errors.push('verifier attestation must contain an Ed25519 payload');
    return true;
  }
  const payload = envelope.payload;
  const resultSchemaSha256 = String(result.resultSchemaSha256);
  const scorerSchemaSha256 = String(result.scorerSchemaSha256);
  const expectedPayload = {
    attestationVersion: ATTESTATION_VERSION,
    verifierId: trust.verifierId,
    keyId: trust.keyId,
    publicKeySha256: trust.publicKeySha256,
    signedAt: payload.signedAt,
    producerId: result.producerId,
    subjectSha: result.subjectSha,
    contractId: result.contractId,
    contractSha256: result.contractSha256,
    resultSchemaSha256,
    scorerSchemaSha256,
    environmentId: result.environmentId,
    execution: result.execution,
    resultIdentitySha256: machineJourneyResultIdentitySha256(result),
    verdict: expectedVerdict,
  };
  if (canonicalJson(payload) !== canonicalJson(expectedPayload)) {
    context.errors.push(
      'verifier attestation payload does not bind the exact reduced result'
    );
  }
  const signedAt = new Date(String(payload.signedAt));
  const finishedAt = new Date(String(result.finishedAt));
  if (
    !Number.isFinite(signedAt.valueOf()) ||
    signedAt.toISOString() !== payload.signedAt ||
    signedAt < finishedAt
  ) {
    context.errors.push(
      'verifier attestation signedAt is invalid or predates the result'
    );
  }
  if (
    payload.verifierId !== trust.verifierId ||
    payload.keyId !== trust.keyId ||
    payload.publicKeySha256 !== trust.publicKeySha256
  ) {
    context.errors.push(
      'verifier attestation does not match the pinned trust root'
    );
  }
  const encoded =
    typeof envelope.signature === 'string' ? envelope.signature : '';
  const signature = Buffer.from(encoded, 'base64');
  if (signature.byteLength !== 64 || signature.toString('base64') !== encoded) {
    context.errors.push(
      'verifier attestation signature is not canonical Ed25519 base64'
    );
    return true;
  }
  try {
    const publicKey = createPublicKey(keySnapshot.bytes);
    if (publicKey.asymmetricKeyType !== 'ed25519') {
      throw new Error('pinned public key is not Ed25519');
    }
    if (
      !verifySignature(
        null,
        Buffer.from(canonicalJson(payload), 'utf8'),
        publicKey,
        signature
      )
    ) {
      throw new Error('signature does not verify');
    }
  } catch (error) {
    context.errors.push(
      `verifier attestation signature verification failed: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
  return true;
}

function verifyAgentTrust(
  result: RecordValue,
  options: JourneyReductionOptions,
  context: ReductionContext
): void {
  if (!options.trustedAgent) return;
  const trustedAgent = options.trustedAgent;
  const retained = object(result.agentTrust, 'result.agentTrust');
  const expected = {
    protocolVersion: trustedAgent.protocolVersion,
    agentId: trustedAgent.agentId,
    publicKeyPath: trustedAgent.publicKeyPath,
    publicKeySha256: trustedAgent.publicKeySha256,
  };
  if (canonicalJson(retained) !== canonicalJson(expected)) {
    context.errors.push(
      'result.agentTrust does not match the pinned browser-agent trust root'
    );
  }
  if (
    typeof trustedAgent.agentId !== 'string' ||
    typeof trustedAgent.protocolVersion !== 'string' ||
    typeof trustedAgent.publicKeyPath !== 'string' ||
    !SHA256_PATTERN.test(trustedAgent.publicKeySha256)
  ) {
    context.errors.push('trustedAgent is invalid');
    return;
  }
  if (result.producerId === trustedAgent.agentId) {
    context.errors.push('producer and browser-agent identities must differ');
  }
  if (options.trustedVerifier) {
    if (trustedAgent.agentId === options.trustedVerifier.verifierId) {
      context.errors.push('browser-agent and verifier identities must differ');
    }
    if (
      trustedAgent.publicKeySha256 === options.trustedVerifier.publicKeySha256
    ) {
      context.errors.push('browser-agent and verifier trust roots must differ');
    }
  }
  const keyBinding: ArtifactBinding = {
    evidenceVersion: 'journey-artifact-v2',
    path: trustedAgent.publicKeyPath,
    sha256: trustedAgent.publicKeySha256,
    bytes: 1,
  };
  try {
    const keyBytes = readFileSync(
      resolve(context.root, trustedAgent.publicKeyPath)
    );
    keyBinding.bytes = keyBytes.byteLength;
    const keySnapshot = snapshotArtifact(
      keyBinding,
      'trustedAgent.publicKeyPath',
      context
    );
    if (keySnapshot) {
      const publicKey = createPublicKey(keySnapshot.bytes);
      if (publicKey.asymmetricKeyType !== 'ed25519') {
        context.errors.push('pinned browser-agent public key is not Ed25519');
      }
    }
  } catch (error) {
    context.errors.push(
      `trustedAgent.publicKeyPath cannot be read: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

export function reduceMachineJourney(
  input: unknown,
  options: JourneyReductionOptions
): JourneyReduction {
  const errors: string[] = [];
  const fallbackContract = {
    contractId: 'machine-journey-v1',
    contractSha256: '0'.repeat(64),
  };
  let contract: QualityContract | typeof fallbackContract = fallbackContract;
  let result: RecordValue | null = null;
  let blocked = false;

  try {
    validateExpectedSubjectSha(options.expectedSubjectSha);
    const loadedContract = loadContract(
      options.contractPath ?? 'tests/contracts/machine-journey-v1.json'
    );
    contract = loadedContract;
    result = object(input, 'result');
    const resultSchemaBytes = readFileSync(
      resolve(loadedContract.resultSchema)
    );
    const resultSchema = object(
      JSON.parse(resultSchemaBytes.toString('utf8')),
      'result schema'
    );
    if (resultSchema.$id !== RESULT_SCHEMA_ID) {
      errors.push(`result schema $id must be ${RESULT_SCHEMA_ID}`);
    }
    const schemaProperties = object(
      resultSchema.properties,
      'result schema.properties'
    );
    if (
      object(schemaProperties.resultVersion, 'resultVersion schema').const !==
      RESULT_VERSION
    ) {
      errors.push(`result schema must pin resultVersion ${RESULT_VERSION}`);
    }
    errors.push(...validateJsonSchema(result, resultSchema, 'result'));
    if (errors.length > 0) {
      return reduction(
        contract,
        result,
        errors,
        !options.trustedVerifier,
        blocked
      );
    }

    const resultSchemaSha256 = sha256Bytes(resultSchemaBytes);
    if (result.resultSchemaSha256 !== resultSchemaSha256) {
      errors.push('resultSchemaSha256 mismatch');
    }
    if (result.contractId !== loadedContract.contractId)
      errors.push('contractId mismatch');
    if (result.contractSha256 !== loadedContract.contractSha256) {
      errors.push('contractSha256 mismatch');
    }
    if (result.subjectSha === ZERO_SHA)
      errors.push('subjectSha must not be the all-zero SHA');
    else if (result.subjectSha !== options.expectedSubjectSha)
      errors.push('subjectSha mismatch');
    if (
      options.expectedEnvironmentId !== undefined &&
      result.environmentId !== options.expectedEnvironmentId
    ) {
      errors.push('environmentId mismatch');
    }
    const execution = object(result.execution, 'result.execution');
    const expectedExecution = {
      command: loadedContract.commands.run,
      toolVersions: loadedContract.tools,
    };
    if (canonicalJson(execution) !== canonicalJson(expectedExecution)) {
      errors.push(
        'execution command or tool versions do not match the contract'
      );
    }

    const startedAt = new Date(String(result.startedAt));
    const finishedAt = new Date(String(result.finishedAt));
    if (finishedAt <= startedAt)
      errors.push('finishedAt must be later than startedAt');
    const now = options.now ?? new Date();
    if (finishedAt.valueOf() > now.valueOf() + 5 * 60 * 1000) {
      errors.push(
        'finishedAt must not be more than five minutes in the future'
      );
    }

    const scorer = object(loadedContract.scorer, 'contract.scorer');
    const outputSchemaBinding = object(
      scorer.outputSchema,
      'contract.scorer.outputSchema'
    );
    const scorerSchemaBytes = readFileSync(
      resolve(String(outputSchemaBinding.path))
    );
    const scorerSchemaSha256 = sha256Bytes(scorerSchemaBytes);
    if (scorerSchemaSha256 !== outputSchemaBinding.sha256) {
      errors.push('contract scorer output schema digest mismatch');
    }
    if (result.scorerSchemaSha256 !== scorerSchemaSha256) {
      errors.push('scorerSchemaSha256 mismatch');
    }
    const scorerSchema = object(
      JSON.parse(scorerSchemaBytes.toString('utf8')),
      'scorer schema'
    );
    if (scorerSchema.$id !== SCORER_SCHEMA_ID) {
      errors.push(`scorer schema $id must be ${SCORER_SCHEMA_ID}`);
    }

    const traceSchemaBindings = object(
      loadedContract.traceSchemas,
      'contract.traceSchemas'
    );
    const traceSchemas: Record<
      string,
      { format: string; sha256: string; schema: RecordValue }
    > = {};
    for (const field of SCORED_TRACE_FIELDS) {
      const binding = object(
        traceSchemaBindings[field],
        `contract.traceSchemas.${field}`
      );
      const bytes = readFileSync(resolve(String(binding.path)));
      const digest = sha256Bytes(bytes);
      if (binding.sha256 !== digest) {
        errors.push(`contract trace schema digest mismatch: ${field}`);
      }
      traceSchemas[field] = {
        format: String(binding.format),
        sha256: digest,
        schema: object(
          JSON.parse(bytes.toString('utf8')),
          `contract.traceSchemas.${field}.schema`
        ),
      };
    }

    const blockedTaskIds = array(
      object(loadedContract.aggregation, 'contract.aggregation').blockedTaskIds,
      'contract.aggregation.blockedTaskIds'
    ).map(String);
    const context: ReductionContext = {
      root: realpathSync(options.evidenceRoot),
      usedPaths: new Set(),
      usedInodes: new Set(),
      errors,
    };
    verifyAgentTrust(result, options, context);
    const taskSuccesses = new Map<string, number>();
    const personaTaskSuccesses = new Map<string, number>();
    const expectedTrials = array(loadedContract.trials, 'contract.trials');
    const actualTrials = array(result.trials, 'result.trials');
    const actualTrialIds = actualTrials.map((value) =>
      String(object(value, 'trial').trialId)
    );
    const expectedTrialIds = expectedTrials.map((value) =>
      String(object(value, 'trial').trialId)
    );
    if (
      !unique(actualTrialIds) ||
      !sameValues(actualTrialIds, expectedTrialIds)
    ) {
      errors.push(
        'result.trials must exactly and uniquely match contract trials'
      );
    }
    const actualById = new Map(
      actualTrials.map((value) => {
        const trial = object(value, 'trial');
        return [String(trial.trialId), trial];
      })
    );

    for (const expectedValue of expectedTrials) {
      const expectedTrial = object(expectedValue, 'expected trial');
      const trialId = String(expectedTrial.trialId);
      const actualTrial = actualById.get(trialId);
      if (!actualTrial) continue;
      if (
        actualTrial.persona !== expectedTrial.persona ||
        actualTrial.seed !== expectedTrial.seed
      ) {
        errors.push(`${trialId}: persona or seed mismatch`);
      }
      const expectedTasks = array(
        expectedTrial.tasks,
        `${trialId}.expectedTasks`
      );
      const actualTasksArray = array(actualTrial.tasks, `${trialId}.tasks`);
      const expectedTaskIds = expectedTasks.map((value) =>
        String(object(value, 'task').taskId)
      );
      const actualTaskIds = actualTasksArray.map((value) =>
        String(object(value, 'task').taskId)
      );
      if (
        !unique(actualTaskIds) ||
        !sameValues(actualTaskIds, expectedTaskIds)
      ) {
        errors.push(
          `${trialId}: task cells must exactly and uniquely match contract`
        );
      }
      const actualTasks = new Map(
        actualTasksArray.map((value) => {
          const task = object(value, 'task');
          return [String(task.taskId), task];
        })
      );
      for (const expectedTaskValue of expectedTasks) {
        const expectedTask = object(expectedTaskValue, 'expected task');
        const taskId = String(expectedTask.taskId);
        const actualTask = actualTasks.get(taskId);
        if (!actualTask) continue;
        const location = `${trialId}.${taskId}`;
        if (blockedTaskIds.includes(taskId)) {
          blocked = true;
          errors.push(
            `${location}: blocked task cells are not accepted by the v2 raw-evidence reducer`
          );
          continue;
        }
        if (actualTask.blockedReason !== null) {
          errors.push(`${location}: runnable task blockedReason must be null`);
        }
        const traceValue = object(actualTask.trace, `${location}.trace`);
        if (!sameValues(Object.keys(traceValue), TRACE_FIELDS)) {
          errors.push(
            `${location}.trace must contain exactly ${TRACE_FIELDS.join(', ')}`
          );
        }
        const trace: Record<string, ArtifactBinding> = {};
        const traceDocuments: Partial<TraceDocuments> = {};
        for (const field of TRACE_FIELDS) {
          const binding = normalizeArtifactBinding(
            traceValue[field],
            `${location}.trace.${field}`,
            errors
          );
          if (binding) {
            trace[field] = binding;
            if (field === 'screenshot') {
              snapshotArtifact(binding, `${location}.trace.${field}`, context);
            } else {
              const document = readBoundJson(
                binding,
                `${location}.trace.${field}`,
                context
              );
              if (document) traceDocuments[field] = document.value;
            }
          }
        }
        const oracleEvidence = readBoundJson(
          actualTask.oracleEvidence,
          `${location}.oracleEvidence`,
          context
        );
        const scorerOutput = readBoundJson(
          actualTask.scorerOutput,
          `${location}.scorerOutput`,
          context
        );
        if (
          !oracleEvidence ||
          !scorerOutput ||
          Object.keys(trace).length !== TRACE_FIELDS.length ||
          Object.keys(traceDocuments).length !== SCORED_TRACE_FIELDS.length
        ) {
          continue;
        }
        verifyOracleManifest(
          oracleEvidence.value,
          {
            contract: loadedContract,
            subjectSha: options.expectedSubjectSha,
            environmentId: String(result.environmentId),
            trialId,
            taskId,
            trace,
          },
          `${location}.oracleEvidence`,
          errors
        );
        const derived = deriveAssertionsFromRawTraces(
          traceDocuments as TraceDocuments,
          traceSchemas,
          expectedTask,
          {
            contract: loadedContract,
            subjectSha: options.expectedSubjectSha,
            environmentId: String(result.environmentId),
            trialId,
            taskId,
          },
          `${location}.trace`,
          errors
        );
        const scorerPassed = verifyScorerOutput(
          scorerOutput.value,
          scorerSchema,
          derived,
          {
            contract: loadedContract,
            scorerSchemaSha256,
            subjectSha: options.expectedSubjectSha,
            environmentId: String(result.environmentId),
            trialId,
            taskId,
            execution,
            trace,
            traceSchemaSha256: Object.fromEntries(
              SCORED_TRACE_FIELDS.map((field) => [
                field,
                traceSchemas[field].sha256,
              ])
            ),
            oracleEvidence: oracleEvidence.binding,
          },
          `${location}.scorerOutput`,
          errors
        );
        const elapsedMs = Number(actualTask.elapsedMs);
        const withinTimeout =
          Number.isFinite(elapsedMs) &&
          elapsedMs <= Number(expectedTask.timeoutMs);
        const derivedStatus = scorerPassed && withinTimeout ? 'PASS' : 'FAIL';
        if (actualTask.claimedStatus !== derivedStatus) {
          errors.push(
            `${location}: claimedStatus does not match independently reduced evidence`
          );
        }
        if (derivedStatus === 'PASS') {
          taskSuccesses.set(taskId, (taskSuccesses.get(taskId) ?? 0) + 1);
          const personaKey = `${expectedTrial.persona}:${taskId}`;
          personaTaskSuccesses.set(
            personaKey,
            (personaTaskSuccesses.get(personaKey) ?? 0) + 1
          );
        }
      }
    }

    const aggregation = object(
      loadedContract.aggregation,
      'contract.aggregation'
    );
    for (const taskId of Object.keys(REQUIRED_ASSERTIONS_BY_TASK).filter(
      (id) => !blockedTaskIds.includes(id)
    )) {
      if (
        (taskSuccesses.get(taskId) ?? 0) <
        Number(aggregation.successesRequiredPerTask)
      ) {
        errors.push(
          `${taskId}: fewer than required independently reduced successes`
        );
      }
      for (const persona of [
        'evaluator',
        'practitioner',
        'existing-user-context',
      ]) {
        if (
          (personaTaskSuccesses.get(`${persona}:${taskId}`) ?? 0) <
          Number(aggregation.successesRequiredPerPersona)
        ) {
          errors.push(
            `${persona}/${taskId}: fewer than required independently reduced successes`
          );
        }
      }
    }

    const derivedVerdict: JourneyStatus =
      errors.length > 0 ? 'FAIL' : blocked ? 'BLOCKED_CAPABILITY' : 'PASS';
    verifyAttestation(
      result,
      result.verifierAttestation,
      derivedVerdict,
      options,
      context
    );
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }

  return reduction(
    contract,
    result,
    errors,
    !options.trustedVerifier || !options.trustedAgent,
    blocked
  );
}

function commandLineArguments(argv: string[]): {
  inputPath: string;
  expectedSubjectSha?: string;
  evidenceRoot?: string;
  expectedEnvironmentId?: string;
} {
  const parsed: Record<string, string> = {};
  const mapping: Record<string, string> = {
    '--input': 'inputPath',
    '--subject-sha': 'expectedSubjectSha',
    '--evidence-root': 'evidenceRoot',
    '--environment-id': 'expectedEnvironmentId',
  };
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const key = mapping[flag];
    const value = argv[index + 1];
    if (!key || !value || value.startsWith('--')) {
      throw new Error(`Invalid or missing value for ${flag ?? 'argument'}`);
    }
    if (parsed[key] !== undefined) throw new Error(`${flag} was repeated`);
    parsed[key] = value;
  }
  if (!parsed.inputPath)
    throw new Error('A readable --input journey result is required');
  return parsed as ReturnType<typeof commandLineArguments>;
}

function repositorySha(): string {
  return execFileSync('git', ['rev-parse', 'HEAD'], {
    encoding: 'utf8',
  }).trim();
}

function trustedVerifierFromEnvironment(): JourneyVerifierTrust | undefined {
  const verifierId = process.env.QUALITY_VERIFIER_ID;
  const keyId = process.env.QUALITY_VERIFIER_KEY_ID;
  const publicKeyPath = process.env.QUALITY_VERIFIER_PUBLIC_KEY_PATH;
  const publicKeySha256 = process.env.QUALITY_VERIFIER_PUBLIC_KEY_SHA256;
  if (!verifierId && !keyId && !publicKeyPath && !publicKeySha256)
    return undefined;
  if (!verifierId || !keyId || !publicKeyPath || !publicKeySha256) {
    throw new Error('all QUALITY_VERIFIER_* trust pins are required together');
  }
  return { verifierId, keyId, publicKeyPath, publicKeySha256 };
}

function trustedAgentFromEnvironment(): JourneyAgentTrust | undefined {
  const protocolVersion = process.env.QUALITY_JOURNEY_AGENT_PROTOCOL_VERSION;
  const agentId = process.env.QUALITY_JOURNEY_AGENT_ID;
  const publicKeyPath = process.env.QUALITY_JOURNEY_AGENT_PUBLIC_KEY_PATH;
  const publicKeySha256 = process.env.QUALITY_JOURNEY_AGENT_PUBLIC_KEY_SHA256;
  if (!protocolVersion && !agentId && !publicKeyPath && !publicKeySha256) {
    return undefined;
  }
  if (!protocolVersion || !agentId || !publicKeyPath || !publicKeySha256) {
    throw new Error(
      'all QUALITY_JOURNEY_AGENT_* trust pins are required together'
    );
  }
  return { protocolVersion, agentId, publicKeyPath, publicKeySha256 };
}

function main(argv: string[]): void {
  let output: JourneyReduction;
  try {
    const args = commandLineArguments(argv);
    const inputPath = resolve(args.inputPath);
    if (!existsSync(inputPath))
      throw new Error('A readable --input journey result is required');
    output = reduceMachineJourney(readJson(inputPath), {
      expectedSubjectSha:
        args.expectedSubjectSha ?? process.env.GITHUB_SHA ?? repositorySha(),
      evidenceRoot: resolve(args.evidenceRoot ?? dirname(inputPath)),
      expectedEnvironmentId:
        args.expectedEnvironmentId ?? process.env.QUALITY_ENVIRONMENT_ID,
      trustedVerifier: trustedVerifierFromEnvironment(),
      trustedAgent: trustedAgentFromEnvironment(),
    });
  } catch (error) {
    output = {
      schemaVersion: 'machine-journey-reduction-v2',
      resultVersion: null,
      contractId: 'machine-journey-v1',
      contractSha256: '0'.repeat(64),
      subjectSha: null,
      environmentId: null,
      startedAt: null,
      finishedAt: null,
      status: 'FAIL',
      errors: [error instanceof Error ? error.message : String(error)],
    };
  }
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  if (output.status !== 'PASS') process.exitCode = 1;
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : '';
if (fileURLToPath(import.meta.url) === invokedPath) main(process.argv.slice(2));
