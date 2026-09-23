import { createHash, createPublicKey, verify } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

type Stage = 'PRE_DEPLOY_ADMISSION' | 'POST_DEPLOY_FINALIZATION';

type JsonObject = Record<string, unknown>;

export interface CurrentEstateAttestationExpectations {
  stage: Stage;
  repository: string;
  subjectSha: string;
  foundationRunId: string;
  foundationRunAttempt: number;
  releaseRunId: string;
  releaseRunAttempt: number;
  artifactContentSha256: string;
  artifactArchiveSha256: string;
  gateManifestSha256: string;
  reducerPolicySha256: string;
  evidenceSha256: string;
  stageEvidenceSha256: string;
  producerAgentId: string;
  verifierAgentId: string;
  keyId: string;
  publicKeyPem: string | Buffer;
  publicKeySha256: string;
  now?: Date;
}

const SHA_PATTERN = /^[a-f0-9]{40}$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;
const MAX_TTL_MS = 30 * 60 * 1000;
const CLOCK_SKEW_MS = 5 * 60 * 1000;

function isObject(value: unknown): value is JsonObject {
  return value !== null && !Array.isArray(value) && typeof value === 'object';
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

function exactKeys(
  value: JsonObject,
  expected: readonly string[],
  location: string
): void {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (canonicalJson(actual) !== canonicalJson(wanted)) {
    throw new Error(`${location} must contain exactly ${wanted.join(', ')}`);
  }
}

function canonicalTimestamp(value: unknown, location: string): Date {
  if (typeof value !== 'string') {
    throw new Error(`${location} must be a canonical UTC timestamp`);
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString() !== value) {
    throw new Error(`${location} must be a canonical UTC timestamp`);
  }
  return parsed;
}

function requireEqual(
  actual: unknown,
  expected: unknown,
  location: string
): void {
  if (actual !== expected) {
    throw new Error(`${location} does not match the expected release binding`);
  }
}

export function verifyCurrentEstateAttestation(
  value: unknown,
  expected: CurrentEstateAttestationExpectations
): JsonObject {
  if (!isObject(value)) throw new Error('attestation must be an object');
  exactKeys(
    value,
    ['payload', 'signatureAlgorithm', 'signature'],
    'attestation'
  );
  if (!isObject(value.payload)) {
    throw new Error('attestation.payload must be an object');
  }
  const payload = value.payload;
  exactKeys(
    payload,
    [
      'attestationVersion',
      'stage',
      'authorizedAction',
      'target',
      'repository',
      'subjectSha',
      'foundationRunId',
      'foundationRunAttempt',
      'releaseRunId',
      'releaseRunAttempt',
      'artifactContentSha256',
      'artifactArchiveSha256',
      'gateManifestSha256',
      'reducerPolicySha256',
      'evidenceSha256',
      'stageEvidenceSha256',
      'producerAgentId',
      'verdict',
      'verifierAgentId',
      'keyId',
      'publicKeySha256',
      'issuedAt',
      'validUntil',
    ],
    'attestation.payload'
  );

  requireEqual(
    payload.attestationVersion,
    'current-estate-release-attestation-v1',
    'attestation.payload.attestationVersion'
  );
  requireEqual(payload.stage, expected.stage, 'attestation.payload.stage');
  requireEqual(
    payload.authorizedAction,
    expected.stage === 'PRE_DEPLOY_ADMISSION'
      ? 'DEPLOY_CURRENT_ESTATE_CANDIDATE'
      : 'FINALIZE_CURRENT_ESTATE_RELEASE',
    'attestation.payload.authorizedAction'
  );
  requireEqual(
    payload.target,
    'CURRENT_ESTATE_RELEASE',
    'attestation.payload.target'
  );
  requireEqual(
    payload.repository,
    expected.repository,
    'attestation.payload.repository'
  );
  requireEqual(
    payload.subjectSha,
    expected.subjectSha,
    'attestation.payload.subjectSha'
  );
  requireEqual(
    payload.foundationRunId,
    expected.foundationRunId,
    'attestation.payload.foundationRunId'
  );
  requireEqual(
    payload.foundationRunAttempt,
    expected.foundationRunAttempt,
    'attestation.payload.foundationRunAttempt'
  );
  requireEqual(
    payload.releaseRunId,
    expected.releaseRunId,
    'attestation.payload.releaseRunId'
  );
  requireEqual(
    payload.releaseRunAttempt,
    expected.releaseRunAttempt,
    'attestation.payload.releaseRunAttempt'
  );
  requireEqual(
    payload.artifactContentSha256,
    expected.artifactContentSha256,
    'attestation.payload.artifactContentSha256'
  );
  requireEqual(
    payload.artifactArchiveSha256,
    expected.artifactArchiveSha256,
    'attestation.payload.artifactArchiveSha256'
  );
  requireEqual(
    payload.gateManifestSha256,
    expected.gateManifestSha256,
    'attestation.payload.gateManifestSha256'
  );
  requireEqual(
    payload.reducerPolicySha256,
    expected.reducerPolicySha256,
    'attestation.payload.reducerPolicySha256'
  );
  requireEqual(
    payload.evidenceSha256,
    expected.evidenceSha256,
    'attestation.payload.evidenceSha256'
  );
  requireEqual(
    payload.stageEvidenceSha256,
    expected.stageEvidenceSha256,
    'attestation.payload.stageEvidenceSha256'
  );
  requireEqual(
    payload.producerAgentId,
    expected.producerAgentId,
    'attestation.payload.producerAgentId'
  );
  requireEqual(
    payload.verifierAgentId,
    expected.verifierAgentId,
    'attestation.payload.verifierAgentId'
  );
  if (expected.producerAgentId === expected.verifierAgentId) {
    throw new Error('release evidence cannot be self-verified');
  }
  requireEqual(payload.keyId, expected.keyId, 'attestation.payload.keyId');
  requireEqual(
    payload.publicKeySha256,
    expected.publicKeySha256,
    'attestation.payload.publicKeySha256'
  );
  requireEqual(
    payload.verdict,
    expected.stage === 'PRE_DEPLOY_ADMISSION' ? 'ADMIT' : 'PASS',
    'attestation.payload.verdict'
  );

  for (const [valueToCheck, location, pattern] of [
    [expected.subjectSha, 'expected subject SHA', SHA_PATTERN],
    [expected.evidenceSha256, 'expected evidence digest', SHA256_PATTERN],
    [
      expected.stageEvidenceSha256,
      'expected stage evidence digest',
      SHA256_PATTERN,
    ],
    [
      expected.artifactContentSha256,
      'expected artifact digest',
      SHA256_PATTERN,
    ],
    [
      expected.artifactArchiveSha256,
      'expected artifact archive digest',
      SHA256_PATTERN,
    ],
    [
      expected.gateManifestSha256,
      'expected gate manifest digest',
      SHA256_PATTERN,
    ],
    [
      expected.reducerPolicySha256,
      'expected reducer policy digest',
      SHA256_PATTERN,
    ],
    [expected.publicKeySha256, 'expected public key digest', SHA256_PATTERN],
  ] as const) {
    if (typeof valueToCheck !== 'string' || !pattern.test(valueToCheck)) {
      throw new Error(`${location} has an invalid digest or SHA`);
    }
  }
  if (!/^\d+$/.test(expected.foundationRunId)) {
    throw new Error('expected foundation run id is invalid');
  }
  if (!/^\d+$/.test(expected.releaseRunId)) {
    throw new Error('expected release run id is invalid');
  }
  if (
    !Number.isInteger(expected.foundationRunAttempt) ||
    expected.foundationRunAttempt < 1
  ) {
    throw new Error('expected foundation run attempt is invalid');
  }
  if (
    !Number.isInteger(expected.releaseRunAttempt) ||
    expected.releaseRunAttempt < 1
  ) {
    throw new Error('expected release run attempt is invalid');
  }

  const now = expected.now ?? new Date();
  const issuedAt = canonicalTimestamp(payload.issuedAt, 'issuedAt');
  const validUntil = canonicalTimestamp(payload.validUntil, 'validUntil');
  if (issuedAt.valueOf() > now.valueOf() + CLOCK_SKEW_MS) {
    throw new Error('attestation was issued in the future');
  }
  if (validUntil.valueOf() <= now.valueOf()) {
    throw new Error('attestation has expired');
  }
  if (
    validUntil.valueOf() <= issuedAt.valueOf() ||
    validUntil.valueOf() - issuedAt.valueOf() > MAX_TTL_MS
  ) {
    throw new Error('attestation validity window exceeds 30 minutes');
  }

  const publicKeyBytes = Buffer.isBuffer(expected.publicKeyPem)
    ? expected.publicKeyPem
    : Buffer.from(expected.publicKeyPem, 'utf8');
  const publicKeyDigest = createHash('sha256')
    .update(publicKeyBytes)
    .digest('hex');
  if (publicKeyDigest !== expected.publicKeySha256) {
    throw new Error('pinned public key digest mismatch');
  }
  if (
    value.signatureAlgorithm !== 'ed25519' ||
    typeof value.signature !== 'string' ||
    !BASE64_PATTERN.test(value.signature)
  ) {
    throw new Error('attestation signature envelope is invalid');
  }
  const signature = Buffer.from(value.signature, 'base64');
  if (
    !verify(
      null,
      Buffer.from(canonicalJson(payload), 'utf8'),
      createPublicKey(publicKeyBytes),
      signature
    )
  ) {
    throw new Error('attestation signature is invalid');
  }
  return payload;
}

function argumentMap(argv: string[]): Map<string, string> {
  if (argv.length % 2 !== 0)
    throw new Error('arguments must be key/value pairs');
  const values = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith('--') || !value || values.has(key)) {
      throw new Error(`invalid or duplicate argument: ${key ?? '<missing>'}`);
    }
    values.set(key, value);
  }
  return values;
}

function required(values: Map<string, string>, key: string): string {
  const value = values.get(key);
  if (!value) throw new Error(`${key} is required`);
  return value;
}

function main(): void {
  const args = argumentMap(process.argv.slice(2));
  const attestationPath = required(args, '--attestation');
  const publicKeyPath = required(args, '--public-key');
  const payload = verifyCurrentEstateAttestation(
    JSON.parse(readFileSync(attestationPath, 'utf8')),
    {
      stage: required(args, '--stage') as Stage,
      repository: required(args, '--repository'),
      subjectSha: required(args, '--subject-sha'),
      foundationRunId: required(args, '--foundation-run-id'),
      foundationRunAttempt: Number(required(args, '--foundation-run-attempt')),
      releaseRunId: required(args, '--release-run-id'),
      releaseRunAttempt: Number(required(args, '--release-run-attempt')),
      artifactContentSha256: required(args, '--artifact-content-sha256'),
      artifactArchiveSha256: required(args, '--artifact-archive-sha256'),
      gateManifestSha256: required(args, '--gate-manifest-sha256'),
      reducerPolicySha256: required(args, '--reducer-policy-sha256'),
      evidenceSha256: required(args, '--evidence-sha256'),
      stageEvidenceSha256: required(args, '--stage-evidence-sha256'),
      producerAgentId: required(args, '--producer-agent-id'),
      verifierAgentId: required(args, '--verifier-agent-id'),
      keyId: required(args, '--key-id'),
      publicKeyPem: readFileSync(publicKeyPath),
      publicKeySha256: required(args, '--public-key-sha256'),
    }
  );
  process.stdout.write(
    `${JSON.stringify({ status: 'PASS', stage: payload.stage, target: payload.target, subjectSha: payload.subjectSha, evidenceSha256: payload.evidenceSha256 })}\n`
  );
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : '';
if (fileURLToPath(import.meta.url) === invokedPath) main();
