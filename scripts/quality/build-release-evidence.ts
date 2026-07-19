import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, relative, resolve, sep } from 'node:path';

type JsonObject = Record<string, unknown>;

export interface ReleaseEvidenceOptions {
  repository: string;
  subjectSha: string;
  foundationRunId: string;
  foundationRunAttempt: number;
  evidenceRoot: string;
  outputPath: string;
  generatedAt?: string;
}

const SHA_PATTERN = /^(?!0+$)[a-f0-9]{40}$/;
const SPECS = [
  { id: 'content-estate', path: 'content/content-estate.json' },
  { id: 'explorer-evidence', path: 'explorer/evidence-set-v1.json' },
  {
    id: 'browser-smoke-readiness',
    path: 'browser-smoke/browser-smoke-readiness-v1.json',
  },
  {
    id: 'visual-regression',
    path: 'visual/visual-regression-result-v1.json',
  },
  {
    id: 'accessibility',
    path: 'accessibility/accessibility-reduction.json',
  },
  {
    id: 'performance',
    path: 'performance/performance-result-v1.json',
  },
] as const;

const DIAGNOSTICS = [
  { id: 'health-v2', path: 'health/health-v2.json' },
  {
    id: 'machine-journey-v1',
    path: 'machine-journey/machine-journey-producer-manifest.json',
  },
] as const;

function object(value: unknown, location: string): JsonObject {
  if (value === null || Array.isArray(value) || typeof value !== 'object') {
    throw new Error(`${location} must be an object`);
  }
  return value as JsonObject;
}

function bytesAndJson(path: string): { bytes: Buffer; value: JsonObject } {
  const metadata = lstatSync(path);
  if (!metadata.isFile() || metadata.isSymbolicLink()) {
    throw new Error(`${path} must be a non-symlink regular file`);
  }
  const bytes = readFileSync(path);
  return { bytes, value: object(JSON.parse(bytes.toString('utf8')), path) };
}

function sha256(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function requirePass(value: JsonObject, field: string, id: string): void {
  if (value[field] !== 'PASS') {
    throw new Error(`${id}.${field} must be literal PASS`);
  }
}

function requireSubject(
  value: JsonObject,
  field: string,
  sha: string,
  id: string
): void {
  if (value[field] !== sha) {
    throw new Error(`${id}.${field} does not match the release subject`);
  }
}

export function buildReleaseEvidence(
  options: ReleaseEvidenceOptions
): JsonObject {
  if (!options.repository.trim()) throw new Error('repository is required');
  if (!SHA_PATTERN.test(options.subjectSha))
    throw new Error('subjectSha is invalid');
  if (!/^\d+$/.test(options.foundationRunId)) {
    throw new Error('foundationRunId is invalid');
  }
  if (
    !Number.isInteger(options.foundationRunAttempt) ||
    options.foundationRunAttempt < 1
  ) {
    throw new Error('foundationRunAttempt is invalid');
  }

  const root = resolve(options.evidenceRoot);
  const artifacts = SPECS.map((spec) => {
    const absolute = resolve(root, spec.path);
    if (relative(root, absolute).startsWith(`..${sep}`)) {
      throw new Error(`${spec.id} escapes the evidence root`);
    }
    const { bytes, value } = bytesAndJson(absolute);
    if (spec.id === 'content-estate') requirePass(value, 'status', spec.id);
    if (spec.id === 'explorer-evidence') {
      requirePass(value, 'verdict', spec.id);
      requireSubject(value, 'subjectSha', options.subjectSha, spec.id);
    }
    if (
      spec.id === 'browser-smoke-readiness' ||
      spec.id === 'visual-regression'
    ) {
      requirePass(value, 'status', spec.id);
      requireSubject(value, 'subjectSha', options.subjectSha, spec.id);
    }
    if (spec.id === 'accessibility') {
      requirePass(value, 'status', spec.id);
      requirePass(value, 'resultStatus', spec.id);
      requireSubject(value, 'subjectSha', options.subjectSha, spec.id);
      const summary = object(value.summary, 'accessibility.summary');
      if (summary.missingLocalCells !== 0 || summary.missingStateCells !== 0) {
        throw new Error(
          'accessibility local or materially distinct state coverage is incomplete'
        );
      }
    }
    if (spec.id === 'performance') {
      requirePass(value, 'status', spec.id);
      requireSubject(value, 'candidateSha', options.subjectSha, spec.id);
    }
    return {
      id: spec.id,
      path: spec.path,
      bytes: bytes.byteLength,
      sha256: sha256(bytes),
      status: 'PASS',
      ...(spec.id === 'accessibility'
        ? { extendedCoverageStatus: value.coverageStatus }
        : {}),
    };
  });

  const diagnostics = DIAGNOSTICS.map((spec) => {
    const absolute = resolve(root, spec.path);
    if (relative(root, absolute).startsWith(`..${sep}`)) {
      throw new Error(`${spec.id} escapes the evidence root`);
    }
    const { bytes, value } = bytesAndJson(absolute);
    let status: 'PASS' | 'FAIL' | 'UNKNOWN' | 'BLOCKED_CAPABILITY';
    if (spec.id === 'health-v2') {
      const subject = object(value.subject, 'health-v2.subject');
      requireSubject(subject, 'sha', options.subjectSha, spec.id);
      if (value.schemaVersion !== '2.0.0') {
        throw new Error('health-v2.schemaVersion must be 2.0.0');
      }
      const dimensions = Array.isArray(value.dimensions)
        ? value.dimensions
        : [];
      const statuses = dimensions.map(
        (entry, index) => object(entry, `health-v2.dimensions[${index}]`).status
      );
      if (statuses.length === 0) {
        throw new Error('health-v2.dimensions must not be empty');
      }
      status = statuses.includes('FAIL')
        ? 'FAIL'
        : statuses.includes('BLOCKED_CAPABILITY')
          ? 'BLOCKED_CAPABILITY'
          : statuses.includes('UNKNOWN')
            ? 'UNKNOWN'
            : statuses.every((entry) => entry === 'PASS')
              ? 'PASS'
              : 'FAIL';
    } else {
      requireSubject(value, 'subjectSha', options.subjectSha, spec.id);
      if (
        value.status !== 'PASS' &&
        value.status !== 'FAIL' &&
        value.status !== 'UNKNOWN' &&
        value.status !== 'BLOCKED_CAPABILITY'
      ) {
        throw new Error('machine-journey-v1.status is invalid');
      }
      status = value.status;
    }
    return {
      id: spec.id,
      path: spec.path,
      bytes: bytes.byteLength,
      sha256: sha256(bytes),
      status,
      releaseBlocking: false,
    };
  });

  const bindings = [
    'tests/contracts/site-refresh-release-gate-manifest-v1.json',
    'tests/contracts/site-refresh-release-reducer-policy-v1.json',
  ].map((path) => {
    const bytes = readFileSync(resolve(path));
    return { path, bytes: bytes.byteLength, sha256: sha256(bytes) };
  });

  return {
    manifestVersion: 'site-refresh-release-evidence-v1',
    releaseScope: 'viewer-facing-site-refresh',
    repository: options.repository,
    subjectSha: options.subjectSha,
    foundationRunId: options.foundationRunId,
    foundationRunAttempt: options.foundationRunAttempt,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    environment: {
      node: process.versions.node,
      platform: process.platform,
      architecture: process.arch,
    },
    requiredJobs: [
      'format-lint',
      'typecheck',
      'catalog-mdx-schema',
      'route-link-validation',
      'yaml-cli-validation',
      'runnable-fixture-tests',
      'explorer-tests',
      'visual-regression',
      'browser-accessibility',
      'production-build',
    ],
    contractBindings: bindings,
    artifacts,
    diagnostics,
    status: 'PASS',
  };
}

function args(argv: string[]): Map<string, string> {
  if (argv.length % 2 !== 0)
    throw new Error('arguments must be key/value pairs');
  const values = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith('--') || !value || values.has(key)) {
      throw new Error(`invalid argument ${key ?? '<missing>'}`);
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
  const values = args(process.argv.slice(2));
  const outputPath = required(values, '--output');
  const manifest = buildReleaseEvidence({
    repository: required(values, '--repository'),
    subjectSha: required(values, '--subject-sha'),
    foundationRunId: required(values, '--foundation-run-id'),
    foundationRunAttempt: Number(required(values, '--foundation-run-attempt')),
    evidenceRoot: required(values, '--evidence-root'),
    outputPath,
  });
  writeFileSync(resolve(outputPath), `${JSON.stringify(manifest, null, 2)}\n`, {
    flag: 'wx',
  });
  process.stdout.write(
    `${JSON.stringify({ status: 'PASS', output: resolve(outputPath) })}\n`
  );
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : '';
if (fileURLToPath(import.meta.url) === invokedPath) main();
