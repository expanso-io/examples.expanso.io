import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

import { EXAMPLE_RECORDS } from '../../src/catalog/registry';
import {
  EXPLORER_EVIDENCE_SCHEMA_DIGEST,
  type ExplorerEvidence,
} from '../../src/catalog/schema';
import { verifyExplorerProvenanceBindings } from './verify-explorer-provenance';

const ZERO_SHA256 = '0'.repeat(64);
const SHA_PATTERN = /^[a-f0-9]{40}$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const MAX_EVIDENCE_AGE_MS = 6 * 60 * 60 * 1000;
const CLOCK_SKEW_MS = 5 * 60 * 1000;
const GATE_PATH = 'scripts/quality/verify-explorer-provenance.ts';

type JsonObject = Record<string, unknown>;

export interface ExplorerEvidenceSetRecord {
  exampleId: string;
  verificationId: string;
  evidenceSha256: string;
  producerLane: string;
  verifierLane: string;
}

export interface ExplorerEvidenceSet {
  evidenceSetVersion: 'explorer-evidence-set-v1';
  evidenceSetSha256: string;
  repository: string;
  subjectSha: string;
  foundationRunId: string;
  foundationRunAttempt: number;
  producerAgentId: string;
  verifierAgentId: string;
  explorerSchemaSha256: string;
  explorerGateSha256: string;
  command: string;
  exitStatus: number;
  verdict: 'PASS';
  startedAt: string;
  completedAt: string;
  records: ExplorerEvidenceSetRecord[];
}

export interface ExplorerEvidenceSetExpectations {
  repository: string;
  subjectSha: string;
  foundationRunId: string;
  foundationRunAttempt: number;
  producerAgentId: string;
  verifierAgentId: string;
  now?: Date;
}

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

export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function sha256(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

function evidenceSetDigest(value: ExplorerEvidenceSet): string {
  return sha256(canonicalJson({ ...value, evidenceSetSha256: ZERO_SHA256 }));
}

function canonicalTimestamp(value: string, location: string): Date {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString() !== value) {
    throw new Error(`${location} must be a canonical UTC timestamp`);
  }
  return parsed;
}

function evidenceRecords(
  producerAgentId: string,
  verifierAgentId: string
): ExplorerEvidenceSetRecord[] {
  if (!producerAgentId || !verifierAgentId) {
    throw new Error('producer and verifier agent identities are required');
  }
  if (producerAgentId === verifierAgentId) {
    throw new Error('Explorer evidence cannot be self-verified');
  }
  verifyExplorerProvenanceBindings();
  const records = EXAMPLE_RECORDS.filter(
    (record) => record.routes.explore !== undefined
  ).map((record) => {
    const evidence = record.explorerEvidence as ExplorerEvidence | undefined;
    if (!evidence) throw new Error(`${record.id} has no Explorer evidence`);
    if (record.producerLane === record.verifierLane) {
      throw new Error(`${record.id} has the same producer and verifier lane`);
    }
    return {
      exampleId: record.id,
      verificationId: evidence.verificationId,
      evidenceSha256: sha256(canonicalJson(evidence)),
      producerLane: record.producerLane,
      verifierLane: record.verifierLane,
    };
  });
  const ids = records.map(({ verificationId }) => verificationId);
  if (new Set(ids).size !== ids.length) {
    throw new Error('Explorer verification IDs must be unique');
  }
  return records;
}

export function buildExplorerEvidenceSet(input: {
  repository: string;
  subjectSha: string;
  foundationRunId: string;
  foundationRunAttempt: number;
  producerAgentId: string;
  verifierAgentId: string;
  command: string;
  exitStatus: number;
  startedAt: string;
  completedAt: string;
}): ExplorerEvidenceSet {
  if (!SHA_PATTERN.test(input.subjectSha) || /^0+$/.test(input.subjectSha)) {
    throw new Error('subject SHA is invalid');
  }
  if (!/^\d+$/.test(input.foundationRunId)) {
    throw new Error('foundation run id is invalid');
  }
  if (
    !Number.isInteger(input.foundationRunAttempt) ||
    input.foundationRunAttempt < 1
  ) {
    throw new Error('foundation run attempt is invalid');
  }
  if (input.exitStatus !== 0) {
    throw new Error('Explorer evidence command did not pass');
  }
  if (!input.command.trim())
    throw new Error('Explorer evidence command is required');
  const startedAt = canonicalTimestamp(input.startedAt, 'startedAt');
  const completedAt = canonicalTimestamp(input.completedAt, 'completedAt');
  if (completedAt.valueOf() < startedAt.valueOf()) {
    throw new Error('Explorer evidence completion precedes its start');
  }
  const value: ExplorerEvidenceSet = {
    evidenceSetVersion: 'explorer-evidence-set-v1',
    evidenceSetSha256: ZERO_SHA256,
    repository: input.repository,
    subjectSha: input.subjectSha,
    foundationRunId: input.foundationRunId,
    foundationRunAttempt: input.foundationRunAttempt,
    producerAgentId: input.producerAgentId,
    verifierAgentId: input.verifierAgentId,
    explorerSchemaSha256: EXPLORER_EVIDENCE_SCHEMA_DIGEST.replace(
      'sha256:',
      ''
    ),
    explorerGateSha256: sha256(readFileSync(resolve(GATE_PATH))),
    command: input.command,
    exitStatus: input.exitStatus,
    verdict: 'PASS',
    startedAt: input.startedAt,
    completedAt: input.completedAt,
    records: evidenceRecords(input.producerAgentId, input.verifierAgentId),
  };
  value.evidenceSetSha256 = evidenceSetDigest(value);
  return value;
}

export function verifyExplorerEvidenceSet(
  value: unknown,
  expected: ExplorerEvidenceSetExpectations
): ExplorerEvidenceSet {
  if (!isObject(value))
    throw new Error('Explorer evidence set must be an object');
  const candidate = value as unknown as ExplorerEvidenceSet;
  if (candidate.evidenceSetVersion !== 'explorer-evidence-set-v1') {
    throw new Error('Explorer evidence set version is unsupported');
  }
  for (const [actual, wanted, location] of [
    [candidate.repository, expected.repository, 'repository'],
    [candidate.subjectSha, expected.subjectSha, 'subjectSha'],
    [candidate.foundationRunId, expected.foundationRunId, 'foundationRunId'],
    [
      candidate.foundationRunAttempt,
      expected.foundationRunAttempt,
      'foundationRunAttempt',
    ],
    [candidate.producerAgentId, expected.producerAgentId, 'producerAgentId'],
    [candidate.verifierAgentId, expected.verifierAgentId, 'verifierAgentId'],
  ] as const) {
    if (actual !== wanted)
      throw new Error(`Explorer evidence ${location} mismatch`);
  }
  if (candidate.producerAgentId === candidate.verifierAgentId) {
    throw new Error('Explorer evidence cannot be self-verified');
  }
  if (candidate.exitStatus !== 0 || candidate.verdict !== 'PASS') {
    throw new Error('Explorer evidence command did not pass');
  }
  if (!SHA256_PATTERN.test(candidate.evidenceSetSha256)) {
    throw new Error('Explorer evidence set digest is invalid');
  }
  if (candidate.evidenceSetSha256 !== evidenceSetDigest(candidate)) {
    throw new Error('Explorer evidence set digest mismatch');
  }
  const fresh = buildExplorerEvidenceSet({
    repository: candidate.repository,
    subjectSha: candidate.subjectSha,
    foundationRunId: candidate.foundationRunId,
    foundationRunAttempt: candidate.foundationRunAttempt,
    producerAgentId: candidate.producerAgentId,
    verifierAgentId: candidate.verifierAgentId,
    command: candidate.command,
    exitStatus: candidate.exitStatus,
    startedAt: candidate.startedAt,
    completedAt: candidate.completedAt,
  });
  if (canonicalJson(candidate.records) !== canonicalJson(fresh.records)) {
    throw new Error(
      'Explorer evidence records do not match the exact source estate'
    );
  }
  if (
    candidate.explorerSchemaSha256 !== fresh.explorerSchemaSha256 ||
    candidate.explorerGateSha256 !== fresh.explorerGateSha256
  ) {
    throw new Error('Explorer schema or gate digest mismatch');
  }
  const completedAt = canonicalTimestamp(candidate.completedAt, 'completedAt');
  const now = expected.now ?? new Date();
  if (completedAt.valueOf() > now.valueOf() + CLOCK_SKEW_MS) {
    throw new Error('Explorer evidence was completed in the future');
  }
  if (now.valueOf() - completedAt.valueOf() > MAX_EVIDENCE_AGE_MS) {
    throw new Error('Explorer evidence is stale');
  }
  return candidate;
}

function argumentMap(argv: string[]): Map<string, string> {
  if (argv.length % 2 !== 0)
    throw new Error('arguments must be key/value pairs');
  const result = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const entry = argv[index + 1];
    if (!key?.startsWith('--') || !entry || result.has(key)) {
      throw new Error(`invalid or duplicate argument: ${key ?? '<missing>'}`);
    }
    result.set(key, entry);
  }
  return result;
}

function required(args: Map<string, string>, key: string): string {
  const value = args.get(key);
  if (!value) throw new Error(`${key} is required`);
  return value;
}

function expectations(
  args: Map<string, string>
): ExplorerEvidenceSetExpectations {
  return {
    repository: required(args, '--repository'),
    subjectSha: required(args, '--subject-sha'),
    foundationRunId: required(args, '--foundation-run-id'),
    foundationRunAttempt: Number(required(args, '--foundation-run-attempt')),
    producerAgentId: required(args, '--producer-agent-id'),
    verifierAgentId: required(args, '--verifier-agent-id'),
  };
}

function main(): void {
  const [operation, ...argv] = process.argv.slice(2);
  const args = argumentMap(argv);
  const expected = expectations(args);
  if (operation === 'produce') {
    const value = buildExplorerEvidenceSet({
      ...expected,
      command: required(args, '--command'),
      exitStatus: Number(required(args, '--exit-status')),
      startedAt: required(args, '--started-at'),
      completedAt: required(args, '--completed-at'),
    });
    writeFileSync(
      required(args, '--output'),
      `${JSON.stringify(value, null, 2)}\n`,
      {
        flag: 'wx',
      }
    );
    process.stdout.write(
      `${JSON.stringify({ status: 'PASS', evidenceSetSha256: value.evidenceSetSha256, records: value.records.length })}\n`
    );
    return;
  }
  if (operation === 'verify') {
    const value = verifyExplorerEvidenceSet(
      JSON.parse(readFileSync(required(args, '--input'), 'utf8')),
      expected
    );
    process.stdout.write(
      `${JSON.stringify({ status: 'PASS', evidenceSetSha256: value.evidenceSetSha256, records: value.records.length })}\n`
    );
    return;
  }
  throw new Error('operation must be produce or verify');
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : '';
if (fileURLToPath(import.meta.url) === invokedPath) main();
