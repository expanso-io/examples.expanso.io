import { createHash } from 'node:crypto';
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PUBLIC_CATALOG } from '../src/catalog/registry';
import type { ExampleRecord } from '../src/catalog/schema';
import {
  LocalEdgeAgent,
  PINNED_EDGE_VERSION,
  resolveEdgeBinary,
  validateFile,
} from './validation/edge';
import { planRun } from './validation/harness';
import {
  discoverPipelineFiles,
  pipelineConfigOf,
} from './validation/inventory';
import {
  isNumberValue,
  isStringValue,
  isYamlObject,
  type YamlObject,
  type YamlValue,
} from './validation/yaml-value';

const repositoryRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));

const executor = `expanso-edge ${PINNED_EDGE_VERSION}`;

const canonicalPipelinePath = 'examples/data-security/remove-pii-complete.yaml';

const canonicalPipelineSha256 =
  'sha256:d70b31e982b67a9a04c3269ebfa6ed8f6961c0f7664919534a0f4cb760e63b96';

const fixturePath = 'examples/data-security/remove-pii/sample-data.json';

const fixtureSha256 =
  'sha256:f27d41e0954e0501730fd1c718b4b4c885fb839ba73af7971ea0351732d5dab2';

const expectedOutputPath =
  'examples/data-security/remove-pii/expected-output.jsonl';

const expectedOutputSha256 =
  'sha256:189eeefe48eb725e12d480d67e87278db2f588b1b38d18a666e69499fbcf10e3';

const fixtureEnvironmentPath =
  'examples/data-security/remove-pii/fixture-environment.json';

const fixtureEnvironmentSha256 =
  'sha256:829c319c3a1622761164858b140a852927c91d5c65e0e32d373cf878c57a08cf';

interface PipelineExecutionRecord {
  exampleId: string;
  fixturePath: string | null;
  fixtureEnvironmentPath: string | null;
  completePipelinePath: string | null;
  expectedOutputPath: string | null;
  executor: string | null;
  executed: boolean;
  assertedOutput: boolean;
  status: 'PASS' | 'FAIL';
  reason: string;
}

interface PipelineExecutionSummary {
  resultVersion: '2.0.0';
  scope: 'catalog-offline-runnable';
  totalCatalogRecords: number;
  claimedOfflineRunnable: number;
  executed: number;
  assertedOutputs: number;
  status: 'PASS' | 'FAIL';
  reason: string;
  records: PipelineExecutionRecord[];
}

interface FixtureEnvironment {
  schemaVersion: '1.0.0';
  executor: 'expanso-edge-local';
  version: typeof PINNED_EDGE_VERSION;
  pipelineSha256: typeof canonicalPipelineSha256;
  inputSha256: typeof fixtureSha256;
  expectedOutputSha256: typeof expectedOutputSha256;
  environment: {
    IP_SALT: string;
    EMAIL_SALT: string;
    USER_SALT: string;
  };
  timeoutsMs: {
    execution: number;
    output: number;
  };
}

function digest(bytes: Buffer | string): `sha256:${string}` {
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
}

function absoluteRepositoryPath(relativePath: string): string {
  const absolutePath = resolve(repositoryRoot, relativePath);

  if (!absolutePath.startsWith(`${repositoryRoot}${sep}`)) {
    throw new Error(`repository path escapes root: ${relativePath}`);
  }

  return absolutePath;
}

function readRegularFile(relativePath: string, expectedDigest: string): Buffer {
  const absolutePath = absoluteRepositoryPath(relativePath);

  if (!existsSync(absolutePath)) {
    throw new Error(`required fixture artifact is missing: ${relativePath}`);
  }

  const stat = lstatSync(absolutePath);

  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new Error(
      `required fixture artifact must be a regular non-symlink file: ${relativePath}`
    );
  }

  const bytes = readFileSync(absolutePath);
  const actualDigest = digest(bytes);

  if (actualDigest !== expectedDigest) {
    throw new Error(
      `${relativePath} digest mismatch: expected ${expectedDigest}, got ${actualDigest}`
    );
  }

  return bytes;
}

function assertObject(
  value: YamlValue,
  label: string
): asserts value is YamlObject {
  if (!isYamlObject(value)) {
    throw new Error(`${label} must be an object`);
  }
}

function assertExactKeys(
  value: YamlObject,
  expected: readonly string[],
  label: string
): void {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();

  if (JSON.stringify(actual) !== JSON.stringify(wanted)) {
    throw new Error(
      `${label} keys must be exactly ${wanted.join(', ')}; got ${actual.join(', ')}`
    );
  }
}

function fixtureSalt(value: YamlValue, name: string): string {
  if (
    !isStringValue(value) ||
    !/^remove-pii-fixture-[a-z]+-salt-v1$/.test(value)
  ) {
    throw new Error(`${name} must be an explicit fixture-only salt`);
  }

  return value;
}

function fixtureTimeout(value: YamlValue, name: string): number {
  if (
    !isNumberValue(value) ||
    !Number.isInteger(value) ||
    value < 1 ||
    value > 120_000
  ) {
    throw new Error(`fixture timeout ${name} must be 1..120000 milliseconds`);
  }

  return value;
}

function parseFixtureEnvironment(bytes: Buffer): FixtureEnvironment {
  let parsed: YamlValue;

  try {
    // SAFETY: JSON values are a subset of YamlValue and the complete fixture
    // contract is checked before any field is returned.
    parsed = JSON.parse(bytes.toString('utf8')) as YamlValue;
  } catch (error) {
    throw new Error(
      `fixture environment is not valid JSON: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  assertObject(parsed, 'fixture environment');
  assertExactKeys(
    parsed,
    [
      'schemaVersion',
      'executor',
      'version',
      'pipelineSha256',
      'inputSha256',
      'expectedOutputSha256',
      'environment',
      'timeoutsMs',
    ],
    'fixture environment'
  );

  if (
    parsed.schemaVersion !== '1.0.0' ||
    parsed.executor !== 'expanso-edge-local' ||
    parsed.version !== PINNED_EDGE_VERSION ||
    parsed.pipelineSha256 !== canonicalPipelineSha256 ||
    parsed.inputSha256 !== fixtureSha256 ||
    parsed.expectedOutputSha256 !== expectedOutputSha256
  ) {
    throw new Error(
      'fixture environment does not match the pinned executor contract'
    );
  }

  assertObject(parsed.environment, 'fixture environment variables');
  assertExactKeys(
    parsed.environment,
    ['IP_SALT', 'EMAIL_SALT', 'USER_SALT'],
    'fixture environment variables'
  );

  const ipSalt = fixtureSalt(parsed.environment.IP_SALT, 'IP_SALT');

  const emailSalt = fixtureSalt(parsed.environment.EMAIL_SALT, 'EMAIL_SALT');

  const userSalt = fixtureSalt(parsed.environment.USER_SALT, 'USER_SALT');

  assertObject(parsed.timeoutsMs, 'fixture timeouts');
  assertExactKeys(
    parsed.timeoutsMs,
    ['execution', 'output'],
    'fixture timeouts'
  );

  const executionTimeout = fixtureTimeout(
    parsed.timeoutsMs.execution,
    'execution'
  );

  const outputTimeout = fixtureTimeout(parsed.timeoutsMs.output, 'output');

  return {
    schemaVersion: '1.0.0',
    executor: 'expanso-edge-local',
    version: PINNED_EDGE_VERSION,
    pipelineSha256: canonicalPipelineSha256,
    inputSha256: fixtureSha256,
    expectedOutputSha256,
    environment: {
      IP_SALT: ipSalt,
      EMAIL_SALT: emailSalt,
      USER_SALT: userSalt,
    },
    timeoutsMs: {
      execution: executionTimeout,
      output: outputTimeout,
    },
  };
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolvePromise) =>
    setTimeout(resolvePromise, milliseconds)
  );
}

async function waitForExactOutput(
  actualPath: string,
  expected: Buffer,
  timeoutMs: number
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let actual: Buffer | null = null;

  while (Date.now() < deadline) {
    if (existsSync(actualPath)) {
      const stat = lstatSync(actualPath);

      if (!stat.isFile() || stat.isSymbolicLink()) {
        throw new Error('pipeline output is not a regular non-symlink file');
      }

      actual = readFileSync(actualPath);

      if (actual.equals(expected)) return;
    }

    await sleep(50);
  }

  if (actual === null) {
    throw new Error(`pipeline produced no output within ${timeoutMs}ms`);
  }

  throw new Error(
    `pipeline output mismatch: expected ${digest(expected)} (${expected.length} bytes), got ${digest(actual)} (${actual.length} bytes)`
  );
}

function baseRecord(record: ExampleRecord): PipelineExecutionRecord {
  return {
    exampleId: record.id,
    fixturePath: record.fixturePath ?? null,
    fixtureEnvironmentPath: null,
    completePipelinePath: record.completePipelinePath ?? null,
    expectedOutputPath: record.expectedOutputPath ?? null,
    executor: null,
    executed: false,
    assertedOutput: false,
    status: 'FAIL',
    reason: 'Execution did not start.',
  };
}

async function executeRemovePii(
  record: ExampleRecord
): Promise<PipelineExecutionRecord> {
  const result = baseRecord(record);
  result.fixtureEnvironmentPath = fixtureEnvironmentPath;
  result.executor = executor;
  let runtimeRoot: string | null = null;
  let agent: LocalEdgeAgent | null = null;
  let jobId: string | null = null;

  try {
    if (
      record.completePipelinePath !== canonicalPipelinePath ||
      record.fixturePath !== fixturePath ||
      record.expectedOutputPath !== expectedOutputPath
    ) {
      throw new Error(
        'catalog paths do not match the registered Remove PII executor'
      );
    }

    if (record.operationalEvidence !== 'not-assessed') {
      throw new Error(
        `one synthetic fixture does not justify ${record.operationalEvidence} operational evidence`
      );
    }

    readRegularFile(canonicalPipelinePath, canonicalPipelineSha256);

    const inputBytes = readRegularFile(fixturePath, fixtureSha256);

    const expectedBytes = readRegularFile(
      expectedOutputPath,
      expectedOutputSha256
    );

    const environmentBytes = readRegularFile(
      fixtureEnvironmentPath,
      fixtureEnvironmentSha256
    );

    const fixture = parseFixtureEnvironment(environmentBytes);

    const edge = resolveEdgeBinary(repositoryRoot, {
      install: true,
      log: () => {},
    });

    const validation = validateFile(
      edge,
      repositoryRoot,
      canonicalPipelinePath,
      fixture.environment
    );

    if (validation.status !== 'PASS') {
      throw new Error(
        `expanso-edge validation failed: ${validation.errors.map((error) => error.message).join('; ')}`
      );
    }

    const pipeline = discoverPipelineFiles(repositoryRoot).find(
      (file) => file.path === canonicalPipelinePath
    );

    const config = pipelineConfigOf(pipeline?.document);

    if (!pipeline || !config) {
      throw new Error('canonical Remove PII pipeline could not be loaded');
    }

    runtimeRoot = mkdtempSync(join(repositoryRoot, '.pipeline-fixture-'));
    const inputPath = join(runtimeRoot, 'input.jsonl');

    const outputDirectory = join(runtimeRoot, 'output');

    mkdirSync(outputDirectory);

    // SAFETY: the fixture digest is pinned above and JSON.parse accepts the
    // checked-in JSON object before it is serialized as one JSONL record.
    const inputRecord = JSON.parse(inputBytes.toString('utf8')) as YamlValue;

    writeFileSync(inputPath, `${JSON.stringify(inputRecord)}\n`, 'utf8');

    const plan = planRun(config, inputPath, outputDirectory);

    if (plan.outputFiles.length !== 1) {
      throw new Error(
        `expected one local output, got ${plan.outputFiles.length}`
      );
    }

    agent = new LocalEdgeAgent(
      edge,
      join(runtimeRoot, 'agent'),
      fixture.environment
    );

    await agent.start();

    const deployed = await agent.deploy({
      name: 'remove-pii-fixture',
      type: 'pipeline',
      config: plan.config,
    });

    if (deployed.ok === false) {
      throw new Error(`expanso-edge rejected the pipeline: ${deployed.error}`);
    }

    jobId = deployed.jobId;

    const deadline = Date.now() + fixture.timeoutsMs.execution;

    let finalState = 'unknown';

    while (Date.now() < deadline) {
      const status = await agent.executionStatus(jobId);

      if (status) {
        finalState = status.state;

        if (status.state === 'failed') {
          throw new Error(`expanso-edge execution failed: ${status.message}`);
        }

        if (status.state === 'completed') break;
      }

      await sleep(100);
    }

    if (finalState !== 'completed') {
      throw new Error(
        `expanso-edge did not complete within ${fixture.timeoutsMs.execution}ms (state ${finalState})`
      );
    }

    result.executed = true;

    await waitForExactOutput(
      plan.outputFiles[0],
      expectedBytes,
      fixture.timeoutsMs.output
    );

    result.assertedOutput = true;

    const outputFiles = readdirSync(outputDirectory).sort();

    if (JSON.stringify(outputFiles) !== JSON.stringify(['01-file.jsonl'])) {
      throw new Error(
        `pipeline output directory contains unexpected files: ${outputFiles.join(', ')}`
      );
    }

    result.status = 'PASS';
    result.reason = `Pinned expanso-edge ${PINNED_EDGE_VERSION} validated and executed the canonical pipeline and produced the exact expected JSONL bytes.`;
  } catch (error) {
    result.status = 'FAIL';
    result.reason = error instanceof Error ? error.message : String(error);
  } finally {
    if (agent && jobId) await agent.deleteJob(jobId);

    if (agent) await agent.stop();

    if (runtimeRoot) rmSync(runtimeRoot, { recursive: true, force: true });
  }

  return result;
}

async function main(): Promise<void> {
  const claimed = PUBLIC_CATALOG.records.filter(
    (record) => record.executionStatus === 'offline-runnable'
  );

  const records: PipelineExecutionRecord[] = [];

  for (const record of claimed) {
    if (record.id !== 'remove-pii') {
      const unsupported = baseRecord(record);

      unsupported.reason =
        'No pinned deterministic executor is registered for this offline-runnable record.';
      records.push(unsupported);
    } else {
      records.push(await executeRemovePii(record));
    }
  }

  const executed = records.filter((record) => record.executed).length;

  const assertedOutputs = records.filter(
    (record) => record.assertedOutput
  ).length;

  const passed =
    claimed.length === 1 &&
    records.length === 1 &&
    records[0].exampleId === 'remove-pii' &&
    records[0].status === 'PASS' &&
    executed === 1 &&
    assertedOutputs === 1;

  const summary: PipelineExecutionSummary = {
    resultVersion: '2.0.0',
    scope: 'catalog-offline-runnable',
    totalCatalogRecords: PUBLIC_CATALOG.records.length,
    claimedOfflineRunnable: claimed.length,
    executed,
    assertedOutputs,
    status: passed ? 'PASS' : 'FAIL',
    reason: passed
      ? 'Exactly one catalog record was executed by pinned expanso-edge and matched its exact output oracle.'
      : claimed.length === 0
        ? 'No catalog record has a verified offline-runnable path; the required fixture gate cannot pass vacuously.'
        : 'The gate requires exactly one registered Remove PII execution with an exact asserted output.',
    records,
  };

  const output = `${JSON.stringify(summary, null, 2)}\n`;

  if (summary.status === 'FAIL') {
    process.stderr.write(output);
    process.exitCode = 1;
  } else {
    process.stdout.write(output);
  }
}

void main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`
  );
  process.exitCode = 1;
});
