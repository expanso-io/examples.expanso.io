import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { request } from 'node:http';
import { basename, dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PUBLIC_CATALOG } from '../src/catalog/registry';
import type { ExampleRecord } from '../src/catalog/schema';

const repositoryRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const dockerImage =
  'jeffail/benthos:4.13.0@sha256:ec9b635d10bf267eb5b5c4c348b36752af1a5444ba768aefc6ca2c92ae2e22dd';
const dockerRepoDigest =
  'jeffail/benthos@sha256:ec9b635d10bf267eb5b5c4c348b36752af1a5444ba768aefc6ca2c92ae2e22dd';
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
  'sha256:4d2bec15465fdc8731c1d4e205e2aae834faf6ecdaa399f65c6f2c512ddb4c99';

interface PipelineExecutionRecord {
  exampleId: string;
  fixturePath: string | null;
  fixtureEnvironmentPath: string | null;
  completePipelinePath: string | null;
  expectedOutputPath: string | null;
  executorImage: string | null;
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
  executor: 'benthos-http-file';
  image: typeof dockerImage;
  pipelineSha256: typeof canonicalPipelineSha256;
  inputSha256: typeof fixtureSha256;
  expectedOutputSha256: typeof expectedOutputSha256;
  request: {
    method: 'POST';
    path: '/events/ingest';
    contentType: 'application/json';
    expectedStatus: 200;
  };
  environment: {
    IP_SALT: string;
    EMAIL_SALT: string;
    USER_SALT: string;
  };
  timeoutsMs: {
    dockerCommand: number;
    startup: number;
    request: number;
    output: number;
  };
}

interface CommandResult {
  stdout: string;
  stderr: string;
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
  value: unknown,
  label: string
): asserts value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
}

function assertExactKeys(
  value: Record<string, unknown>,
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

function parseFixtureEnvironment(bytes: Buffer): FixtureEnvironment {
  let parsed: unknown;
  try {
    parsed = JSON.parse(bytes.toString('utf8'));
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
      'image',
      'pipelineSha256',
      'inputSha256',
      'expectedOutputSha256',
      'request',
      'environment',
      'timeoutsMs',
    ],
    'fixture environment'
  );
  if (
    parsed.schemaVersion !== '1.0.0' ||
    parsed.executor !== 'benthos-http-file' ||
    parsed.image !== dockerImage ||
    parsed.pipelineSha256 !== canonicalPipelineSha256 ||
    parsed.inputSha256 !== fixtureSha256 ||
    parsed.expectedOutputSha256 !== expectedOutputSha256
  ) {
    throw new Error(
      'fixture environment does not match the pinned executor contract'
    );
  }

  assertObject(parsed.request, 'fixture environment request');
  assertExactKeys(
    parsed.request,
    ['method', 'path', 'contentType', 'expectedStatus'],
    'fixture environment request'
  );
  if (
    parsed.request.method !== 'POST' ||
    parsed.request.path !== '/events/ingest' ||
    parsed.request.contentType !== 'application/json' ||
    parsed.request.expectedStatus !== 200
  ) {
    throw new Error('fixture request does not match the pinned HTTP contract');
  }

  assertObject(parsed.environment, 'fixture environment variables');
  assertExactKeys(
    parsed.environment,
    ['IP_SALT', 'EMAIL_SALT', 'USER_SALT'],
    'fixture environment variables'
  );
  for (const name of ['IP_SALT', 'EMAIL_SALT', 'USER_SALT'] as const) {
    const value = parsed.environment[name];
    if (
      typeof value !== 'string' ||
      !/^remove-pii-fixture-[a-z]+-salt-v1$/.test(value)
    ) {
      throw new Error(`${name} must be an explicit fixture-only salt`);
    }
  }

  assertObject(parsed.timeoutsMs, 'fixture timeouts');
  assertExactKeys(
    parsed.timeoutsMs,
    ['dockerCommand', 'startup', 'request', 'output'],
    'fixture timeouts'
  );
  for (const name of [
    'dockerCommand',
    'startup',
    'request',
    'output',
  ] as const) {
    const value = parsed.timeoutsMs[name];
    if (
      !Number.isInteger(value) ||
      (value as number) < 1 ||
      (value as number) > 120_000
    ) {
      throw new Error(`fixture timeout ${name} must be 1..120000 milliseconds`);
    }
  }

  return parsed as unknown as FixtureEnvironment;
}

function extractBenthosConfig(pipelineBytes: Buffer): string {
  const text = pipelineBytes.toString('utf8');
  const lines = text.split('\n');
  const starts = lines
    .map((line, index) => (line === 'config:' ? index : -1))
    .filter((index) => index >= 0);
  if (starts.length !== 1) {
    throw new Error(
      `canonical YAML must contain exactly one top-level config block`
    );
  }

  const block: string[] = [];
  for (let index = starts[0] + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (line !== '' && !line.startsWith(' ')) break;
    if (line !== '' && !line.startsWith('  ')) {
      throw new Error(
        `canonical config contains an invalid indentation boundary`
      );
    }
    block.push(line === '' ? '' : line.slice(2));
  }
  while (block.at(-1) === '') block.pop();
  const config = `${block.join('\n')}\n`;
  for (const required of [
    'input:',
    'http_server:',
    'pipeline:',
    'processors:',
    'output:',
    'file:',
  ]) {
    if (!config.includes(required)) {
      throw new Error(`canonical config is missing ${required}`);
    }
  }
  if (/^logger:|^metrics:/m.test(config)) {
    throw new Error(`executor config escaped the canonical config block`);
  }
  return config;
}

async function runDocker(
  args: string[],
  timeoutMs: number,
  label: string
): Promise<CommandResult> {
  return await new Promise((resolvePromise, rejectPromise) => {
    const child = spawn('docker', args, {
      cwd: repositoryRoot,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let settled = false;
    const finish = (error?: Error, result?: CommandResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) rejectPromise(error);
      else resolvePromise(result!);
    };
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      finish(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    child.stdout.on('data', (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on('data', (chunk: Buffer) => stderr.push(chunk));
    child.on('error', (error) => {
      finish(new Error(`${label} could not start Docker: ${error.message}`));
    });
    child.on('close', (code, signal) => {
      const result = {
        stdout: Buffer.concat(stdout).toString('utf8'),
        stderr: Buffer.concat(stderr).toString('utf8'),
      };
      if (signal) {
        finish(new Error(`${label} terminated by signal ${signal}`));
      } else if (code !== 0) {
        finish(
          new Error(
            `${label} exited ${code}: ${result.stderr.trim() || result.stdout.trim() || 'no diagnostic output'}`
          )
        );
      } else if (result.stderr.length > 0) {
        finish(new Error(`${label} wrote to stderr: ${result.stderr.trim()}`));
      } else {
        finish(undefined, result);
      }
    });
  });
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolvePromise) =>
    setTimeout(resolvePromise, milliseconds)
  );
}

async function waitForBenthos(
  containerName: string,
  timeoutMs: number,
  dockerTimeoutMs: number
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const logs = await runDocker(
      ['logs', containerName],
      Math.min(dockerTimeoutMs, 5_000),
      'Benthos readiness logs'
    );
    if (/\blevel=(error|fatal|panic|warn)\b/i.test(logs.stdout)) {
      throw new Error(
        `Benthos emitted a non-success log: ${logs.stdout.trim()}`
      );
    }
    if (
      logs.stdout.includes(
        'Receiving HTTP messages at: http://0.0.0.0:8080/events/ingest'
      )
    ) {
      return;
    }
    await sleep(100);
  }
  throw new Error(`Benthos did not become ready within ${timeoutMs}ms`);
}

async function postFixture(
  port: number,
  body: Buffer,
  fixture: FixtureEnvironment
): Promise<void> {
  await new Promise<void>((resolvePromise, rejectPromise) => {
    const httpRequest = request(
      {
        host: '127.0.0.1',
        port,
        path: fixture.request.path,
        method: fixture.request.method,
        agent: false,
        headers: {
          'content-type': fixture.request.contentType,
          'content-length': String(body.length),
          connection: 'close',
        },
      },
      (response) => {
        const responseBytes: Buffer[] = [];
        response.on('data', (chunk: Buffer) => responseBytes.push(chunk));
        response.on('end', () => {
          const responseBody = Buffer.concat(responseBytes);
          if (response.statusCode !== fixture.request.expectedStatus) {
            rejectPromise(
              new Error(
                `fixture POST returned HTTP ${response.statusCode ?? 'unknown'} instead of ${fixture.request.expectedStatus}`
              )
            );
          } else if (responseBody.length !== 0) {
            rejectPromise(
              new Error(
                `fixture POST returned an unexpected ${responseBody.length}-byte body`
              )
            );
          } else {
            resolvePromise();
          }
        });
      }
    );
    httpRequest.setTimeout(fixture.timeoutsMs.request, () => {
      httpRequest.destroy(
        new Error(
          `fixture POST timed out after ${fixture.timeoutsMs.request}ms`
        )
      );
    });
    httpRequest.on('error', rejectPromise);
    httpRequest.end(body);
  });
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
        throw new Error(`pipeline output is not a regular non-symlink file`);
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
    executorImage: null,
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
  result.executorImage = dockerImage;
  let runtimeRoot: string | null = null;
  let containerName: string | null = null;
  let primaryError: Error | null = null;

  try {
    if (
      record.completePipelinePath !== canonicalPipelinePath ||
      record.fixturePath !== fixturePath ||
      record.expectedOutputPath !== expectedOutputPath
    ) {
      throw new Error(
        `catalog paths do not match the registered Remove PII executor`
      );
    }
    if (record.operationalEvidence !== 'not-assessed') {
      throw new Error(
        `one synthetic fixture does not justify ${record.operationalEvidence} operational evidence`
      );
    }

    const pipelineBytes = readRegularFile(
      canonicalPipelinePath,
      canonicalPipelineSha256
    );
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
    const config = extractBenthosConfig(pipelineBytes);

    runtimeRoot = mkdtempSync(join(repositoryRoot, '.pipeline-fixture-'));
    chmodSync(runtimeRoot, 0o755);
    const outputDirectory = join(runtimeRoot, 'output');
    mkdirSync(outputDirectory);
    chmodSync(outputDirectory, 0o777);
    const configPath = join(runtimeRoot, 'benthos.yaml');
    writeFileSync(configPath, config, { encoding: 'utf8', mode: 0o444 });

    await runDocker(
      ['pull', fixture.image],
      Math.max(fixture.timeoutsMs.dockerCommand, 60_000),
      'pinned Benthos image pull'
    );
    const imageDigests = await runDocker(
      ['image', 'inspect', fixture.image, '--format', '{{json .RepoDigests}}'],
      fixture.timeoutsMs.dockerCommand,
      'pinned Benthos image digest inspection'
    );
    let repoDigests: unknown;
    try {
      repoDigests = JSON.parse(imageDigests.stdout.trim());
    } catch {
      throw new Error(`Docker returned malformed image digest metadata`);
    }
    if (
      !Array.isArray(repoDigests) ||
      !repoDigests.includes(dockerRepoDigest)
    ) {
      throw new Error(
        `Docker image does not expose the pinned repository digest`
      );
    }
    const imageId = (
      await runDocker(
        ['image', 'inspect', fixture.image, '--format', '{{.Id}}'],
        fixture.timeoutsMs.dockerCommand,
        'pinned Benthos image ID inspection'
      )
    ).stdout.trim();
    if (!/^sha256:[0-9a-f]{64}$/.test(imageId)) {
      throw new Error(`Docker returned a malformed image ID`);
    }

    containerName = `remove-pii-fixture-${process.pid}-${Date.now()}`;
    const run = await runDocker(
      [
        'run',
        '--detach',
        '--name',
        containerName,
        '--publish',
        '127.0.0.1::8080',
        '--mount',
        `type=bind,source=${configPath},target=/fixture/benthos.yaml,readonly`,
        '--mount',
        `type=bind,source=${outputDirectory},target=/var/log/expanso`,
        '--env',
        `IP_SALT=${fixture.environment.IP_SALT}`,
        '--env',
        `EMAIL_SALT=${fixture.environment.EMAIL_SALT}`,
        '--env',
        `USER_SALT=${fixture.environment.USER_SALT}`,
        fixture.image,
        '-c',
        '/fixture/benthos.yaml',
      ],
      fixture.timeoutsMs.dockerCommand,
      'Benthos container start'
    );
    if (!/^[0-9a-f]{64}\n$/.test(run.stdout)) {
      throw new Error(`Docker returned a malformed container ID`);
    }

    const containerImageId = (
      await runDocker(
        ['inspect', containerName, '--format', '{{.Image}}'],
        fixture.timeoutsMs.dockerCommand,
        'Benthos container image inspection'
      )
    ).stdout.trim();
    if (containerImageId !== imageId) {
      throw new Error(
        `running container image ID does not match the pinned image`
      );
    }

    const portOutput = (
      await runDocker(
        ['port', containerName, '8080/tcp'],
        fixture.timeoutsMs.dockerCommand,
        'Benthos HTTP port inspection'
      )
    ).stdout.trim();
    const portMatch = /^127\.0\.0\.1:([0-9]{1,5})$/.exec(portOutput);
    const port = portMatch ? Number(portMatch[1]) : 0;
    if (port < 1 || port > 65_535) {
      throw new Error(`Docker returned an invalid HTTP port mapping`);
    }

    await waitForBenthos(
      containerName,
      fixture.timeoutsMs.startup,
      fixture.timeoutsMs.dockerCommand
    );
    await postFixture(port, inputBytes, fixture);
    result.executed = true;

    const actualOutputPath = join(outputDirectory, 'pii-removed.jsonl');
    await waitForExactOutput(
      actualOutputPath,
      expectedBytes,
      fixture.timeoutsMs.output
    );
    result.assertedOutput = true;
    const outputFiles = readdirSync(outputDirectory).sort();
    if (JSON.stringify(outputFiles) !== JSON.stringify(['pii-removed.jsonl'])) {
      throw new Error(
        `pipeline output directory contains unexpected files: ${outputFiles.join(', ')}`
      );
    }
    if (
      basename(actualOutputPath) !== 'pii-removed.jsonl' ||
      dirname(actualOutputPath) !== outputDirectory
    ) {
      throw new Error(`pipeline output path escaped its fixture directory`);
    }

    const stateText = (
      await runDocker(
        ['inspect', containerName, '--format', '{{json .State}}'],
        fixture.timeoutsMs.dockerCommand,
        'Benthos container state inspection'
      )
    ).stdout.trim();
    let state: unknown;
    try {
      state = JSON.parse(stateText);
    } catch {
      throw new Error(`Docker returned malformed container state metadata`);
    }
    assertObject(state, 'Benthos container state');
    if (
      state.Running !== true ||
      state.OOMKilled !== false ||
      state.Error !== ''
    ) {
      throw new Error(
        `Benthos container was not healthy after fixture execution`
      );
    }
    const finalLogs = await runDocker(
      ['logs', containerName],
      fixture.timeoutsMs.dockerCommand,
      'Benthos final logs'
    );
    if (/\blevel=(error|fatal|panic|warn)\b/i.test(finalLogs.stdout)) {
      throw new Error(
        `Benthos emitted a non-success log: ${finalLogs.stdout.trim()}`
      );
    }

    result.status = 'PASS';
    result.reason =
      'Pinned Benthos executed the canonical HTTP-to-file config and produced the exact expected JSONL bytes.';
  } catch (error) {
    primaryError = error instanceof Error ? error : new Error(String(error));
  } finally {
    if (containerName !== null) {
      try {
        await runDocker(
          ['rm', '--force', containerName],
          30_000,
          'Benthos container cleanup'
        );
      } catch (error) {
        if (primaryError === null) {
          primaryError =
            error instanceof Error ? error : new Error(String(error));
        }
      }
    }
    if (runtimeRoot !== null) {
      rmSync(runtimeRoot, { recursive: true, force: true });
    }
  }

  if (primaryError !== null) {
    result.status = 'FAIL';
    result.reason = primaryError.message;
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
      ? 'Exactly one catalog record was executed by its pinned offline runner and matched its exact output oracle.'
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
