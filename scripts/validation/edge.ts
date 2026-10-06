/**
 * Expanso Edge driver for the validation harness.
 *
 * Two responsibilities:
 *   1. Provide a pinned `expanso-edge` binary (installed into `.bin/` when the
 *      pinned version is not already there) and run `expanso-edge validate`.
 *   2. Drive a throwaway local-mode agent over its HTTP API so pipelines can be
 *      executed against fixtures without a control plane, a global profile, or
 *      credentials. All agent state lives in a temporary data directory.
 *
 * Validation and execution both go through the pinned expanso-edge release.
 */

import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { join } from 'node:path';

import type { ValidateResult, ValidationError } from './types';
import type { YamlObject } from './yaml-value';

/** The expanso-edge release every report is produced with. Bump deliberately. */
export const PINNED_EDGE_VERSION = 'v2.1.22';

const INSTALLER_URL = 'https://get.expanso.io/edge/install.sh';

const INSTALL_TIMEOUT_MS = 240_000;

export interface EdgeBinary {
  path: string;
  version: string;
}

function readVersion(binary: string): string | null {
  const result = spawnSync(binary, ['version'], { encoding: 'utf8' });

  if (result.status !== 0) return null;
  const match = /v\d+\.\d+\.\d+[^\s]*/.exec(result.stdout);

  return match ? match[0] : null;
}

/**
 * Resolve the pinned expanso-edge binary.
 *
 * Order: `EXPANSO_EDGE_BIN` env override (must still match the pin), then
 * `.bin/expanso-edge`, then a fresh pinned install into `.bin/`.
 */
export function resolveEdgeBinary(
  repositoryRoot: string,
  options: { install: boolean; log: (line: string) => void }
): EdgeBinary {
  const override = process.env.EXPANSO_EDGE_BIN;

  if (override) {
    const version = readVersion(override);

    if (version === null) {
      throw new Error(
        `EXPANSO_EDGE_BIN=${override} is not a runnable expanso-edge binary`
      );
    }

    if (version !== PINNED_EDGE_VERSION) {
      throw new Error(
        `EXPANSO_EDGE_BIN reports ${version}; this harness is pinned to ${PINNED_EDGE_VERSION}`
      );
    }

    return { path: override, version };
  }

  const binDir = join(repositoryRoot, '.bin');
  const binary = join(binDir, 'expanso-edge');

  if (existsSync(binary)) {
    const version = readVersion(binary);

    if (version === PINNED_EDGE_VERSION) return { path: binary, version };
    options.log(
      `.bin/expanso-edge reports ${version ?? 'no version'}; reinstalling pinned ${PINNED_EDGE_VERSION}`
    );
  }

  if (!options.install) {
    throw new Error(
      `pinned expanso-edge ${PINNED_EDGE_VERSION} is not installed in .bin/ and --no-install was given`
    );
  }

  mkdirSync(binDir, { recursive: true });
  options.log(`installing expanso-edge ${PINNED_EDGE_VERSION} into .bin/`);
  const installer = join(binDir, 'install-expanso-edge.sh');

  const download = spawnSync(
    'curl',
    [
      '--fail',
      '--location',
      '--silent',
      '--show-error',
      '--connect-timeout',
      '15',
      '--max-time',
      '180',
      '--retry',
      '3',
      '--retry-delay',
      '2',
      INSTALLER_URL,
      '--output',
      installer,
    ],
    { encoding: 'utf8' }
  );

  if (download.status !== 0) {
    throw new Error(
      `could not download the expanso-edge installer: ${download.stderr.trim()}`
    );
  }

  const install = spawnSync(
    'bash',
    [installer, '--version', PINNED_EDGE_VERSION, '--dir', binDir],
    {
      encoding: 'utf8',
      timeout: INSTALL_TIMEOUT_MS,
      env: {
        ...process.env,
        EXPANSO_INSTALL_DIR: binDir,
        USE_SUDO: 'false',
        EXPANSO_DISABLEANALYTICS: 'true',
      },
    }
  );

  if (install.status !== 0 || !existsSync(binary)) {
    throw new Error(
      `expanso-edge installer failed: ${(install.stderr || install.stdout).trim().slice(-2000)}`
    );
  }

  chmodSync(binary, 0o755);
  const version = readVersion(binary);

  if (version !== PINNED_EDGE_VERSION) {
    throw new Error(
      `installer produced expanso-edge ${version ?? 'unknown'} instead of ${PINNED_EDGE_VERSION}`
    );
  }

  return { path: binary, version };
}

interface ValidatorRecord {
  source?: string;
  valid?: boolean;
  kind?: string;
  hint?: string;
  errors?: Array<{
    path?: string;
    message?: string;
    suggestion?: string;
    line?: number;
    column?: number;
  }>;
}

function compareValidationErrors(
  left: ValidationError,
  right: ValidationError
): number {
  const lineDifference =
    (left.line ?? Number.MAX_SAFE_INTEGER) -
    (right.line ?? Number.MAX_SAFE_INTEGER);

  if (lineDifference !== 0) return lineDifference;

  const columnDifference =
    (left.column ?? Number.MAX_SAFE_INTEGER) -
    (right.column ?? Number.MAX_SAFE_INTEGER);

  if (columnDifference !== 0) return columnDifference;

  for (const field of ['path', 'message', 'suggestion'] as const) {
    const leftValue = left[field] ?? '';
    const rightValue = right[field] ?? '';

    if (leftValue < rightValue) return -1;

    if (leftValue > rightValue) return 1;
  }

  return 0;
}

function parseValidatorOutput(
  stdout: string,
  stderr: string,
  status: number | null
): ValidateResult['errors'] | null {
  const start = stdout.indexOf('[');

  if (start < 0) return null;
  let records: ValidatorRecord[];

  try {
    // SAFETY: expanso-edge --output json returns the documented validator
    // record array; unexpected shapes are converted into validation failures.
    records = JSON.parse(
      stdout.slice(start, stdout.lastIndexOf(']') + 1)
    ) as ValidatorRecord[];
  } catch {
    return null;
  }

  const errors: ValidationError[] = [];

  for (const record of records) {
    if (record.valid === true) continue;

    for (const error of record.errors ?? []) {
      errors.push({
        path: error.path,
        message: error.message ?? 'validation error',
        suggestion: error.suggestion,
        line: error.line,
        column: error.column,
      });
    }

    if ((record.errors ?? []).length === 0) {
      errors.push({
        message:
          record.hint ??
          (stderr.trim() || `validator exited ${status ?? 'unknown'}`),
      });
    }
  }

  return errors.sort(compareValidationErrors);
}

/** Validate a pipeline file in place with `expanso-edge validate`. */
export function validateFile(
  edge: EdgeBinary,
  cwd: string,
  relativePath: string,
  validationEnv: Readonly<Record<string, string>> = {}
): ValidateResult {
  const isolatedHome = join(cwd, '.bin', 'validation-home');
  mkdirSync(isolatedHome, { recursive: true });

  const result = spawnSync(
    edge.path,
    ['validate', '--output', 'json', relativePath],
    {
      cwd,
      encoding: 'utf8',
      env: {
        ...process.env,
        ...validationEnv,
        HOME: isolatedHome,
        EXPANSO_DISABLEANALYTICS: 'true',
      },
      timeout: 60_000,
    }
  );

  const errors = parseValidatorOutput(
    result.stdout,
    result.stderr,
    result.status
  );

  if (errors === null) {
    return {
      status: 'FAIL',
      mode: 'file',
      errors: [{ message: 'validator output could not be parsed' }],
      raw: `${result.stdout}\n${result.stderr}`.trim(),
    };
  }

  return {
    status: result.status === 0 && errors.length === 0 ? 'PASS' : 'FAIL',
    mode: 'file',
    errors,
  };
}

/** Validate a synthesized YAML document (used for fragments) through stdin. */
export function validateSource(
  edge: EdgeBinary,
  cwd: string,
  source: string,
  validationEnv: Readonly<Record<string, string>> = {}
): ValidateResult {
  const isolatedHome = join(cwd, '.bin', 'validation-home');
  mkdirSync(isolatedHome, { recursive: true });

  const result = spawnSync(edge.path, ['validate', '--output', 'json', '-'], {
    cwd,
    encoding: 'utf8',
    env: {
      ...process.env,
      ...validationEnv,
      HOME: isolatedHome,
      EXPANSO_DISABLEANALYTICS: 'true',
    },
    input: source,
    timeout: 60_000,
  });

  const errors = parseValidatorOutput(
    result.stdout,
    result.stderr,
    result.status
  );

  if (errors === null) {
    return {
      status: 'FAIL',
      mode: 'wrapped',
      errors: [{ message: 'validator output could not be parsed' }],
      raw: `${result.stdout}\n${result.stderr}`.trim(),
    };
  }

  return {
    status: result.status === 0 && errors.length === 0 ? 'PASS' : 'FAIL',
    mode: 'wrapped',
    errors,
  };
}

async function freePort(): Promise<number> {
  return await new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();

      const port =
        address !== null && address instanceof Object && 'port' in address
          ? address.port
          : 0;

      server.close(() => resolve(port));
    });
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface ExecutionStatus {
  state: string;
  message: string;
}

export interface JobSpec {
  name: string;
  type: 'pipeline';
  config: YamlObject;
}

/**
 * A throwaway local-mode expanso-edge agent.
 *
 * The agent keeps every byte of state under `dataDir`: identity, store, and the
 * per-execution `pipeline.log`. It never reads a bootstrap profile because it
 * runs with `--local` and an explicit `--config` file.
 */
export class LocalEdgeAgent {
  private child: ChildProcess | null = null;
  private apiPort = 0;
  readonly dataDir: string;
  readonly logPath: string;

  constructor(
    private readonly edge: EdgeBinary,
    private readonly workDir: string,
    private readonly runtimeEnv: Readonly<Record<string, string>> = {}
  ) {
    this.dataDir = join(workDir, 'edge-data');
    this.logPath = join(workDir, 'edge.log');
  }

  get apiBase(): string {
    return `http://127.0.0.1:${this.apiPort}/api/v1`;
  }

  get pid(): number | undefined {
    return this.child?.pid;
  }

  async start(): Promise<void> {
    mkdirSync(this.dataDir, { recursive: true });
    const configPath = join(this.workDir, 'agent.yaml');
    writeFileSync(configPath, 'name: examples-validation\n', 'utf8');
    this.apiPort = await freePort();
    const logChunks: string[] = [];
    this.child = spawn(
      this.edge.path,
      [
        'run',
        '--local',
        '--no-watch',
        '--config',
        configPath,
        '--data-dir',
        this.dataDir,
        '--api-listen',
        `127.0.0.1:${this.apiPort}`,
        '--log-format',
        'json',
        '--log-level',
        'info',
        '--name',
        'examples-validation',
      ],
      {
        cwd: this.workDir,
        env: {
          ...process.env,
          ...this.runtimeEnv,
          HOME: this.workDir,
          EXPANSO_DATA_DIR: this.dataDir,
          EXPANSO_DISABLEANALYTICS: 'true',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      }
    );

    const append = (chunk: Buffer) => {
      logChunks.push(chunk.toString('utf8'));
    };

    this.child.stdout?.on('data', append);
    this.child.stderr?.on('data', append);

    const exited = new Promise<number | null>((resolve) => {
      this.child?.on('exit', (code) => resolve(code));
    });

    const deadline = Date.now() + 30_000;

    while (Date.now() < deadline) {
      const raced = await Promise.race([
        exited,
        sleep(200).then(() => 'alive' as const),
      ]);

      if (raced !== 'alive') {
        writeFileSync(this.logPath, logChunks.join(''), 'utf8');
        throw new Error(
          `expanso-edge exited early (code ${raced}); see ${this.logPath}`
        );
      }

      try {
        const response = await fetch(`${this.apiBase}/jobs`);

        if (response.ok) {
          this.child.stdout?.removeListener('data', append);
          this.child.stderr?.removeListener('data', append);
          this.child.stdout?.on('data', (chunk: Buffer) => {
            logChunks.push(chunk.toString('utf8'));
          });
          this.child.stderr?.on('data', (chunk: Buffer) => {
            logChunks.push(chunk.toString('utf8'));
          });
          this.flushLog = () =>
            writeFileSync(this.logPath, logChunks.join(''), 'utf8');

          return;
        }
      } catch {
        // API not up yet.
      }
    }

    await this.stop();
    writeFileSync(this.logPath, logChunks.join(''), 'utf8');
    throw new Error(
      `expanso-edge API did not become ready within 30s; see ${this.logPath}`
    );
  }

  private flushLog: () => void = () => {};

  async stop(): Promise<void> {
    const child = this.child;
    this.child = null;

    if (!child || child.exitCode !== null) return;

    const exited = new Promise<void>((resolve) =>
      child.once('exit', () => resolve())
    );

    child.kill('SIGTERM');

    const outcome = await Promise.race([
      exited.then(() => 'exited' as const),
      sleep(10_000).then(() => 'timeout' as const),
    ]);

    if (outcome === 'timeout') {
      child.kill('SIGKILL');
      await exited;
    }

    this.flushLog();
  }

  async deploy(
    spec: JobSpec
  ): Promise<{ ok: true; jobId: string } | { ok: false; error: string }> {
    const response = await fetch(`${this.apiBase}/jobs`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ spec }),
    });

    const text = await response.text();

    if (!response.ok) {
      let message = text;

      try {
        // SAFETY: the local Edge API documents this error envelope; missing
        // optional fields fall back to the raw response text.
        const parsed = JSON.parse(text) as {
          message?: string;
          details?: Record<string, string>;
        };

        message = parsed.message ?? text;
        const details = parsed.details ?? {};

        const extra = Object.keys(details)
          .filter((key) => /^error_\d+_message$/.test(key))
          .map((key) => details[key])
          .filter((value) => value && !message.includes(value));

        if (extra.length > 0) message += `\n${extra.join('\n')}`;
      } catch {
        // keep raw text
      }

      return { ok: false, error: `HTTP ${response.status}: ${message}` };
    }

    // SAFETY: successful Edge job creation returns this documented envelope;
    // the optional shape is checked before the id is used.
    const parsed = JSON.parse(text) as { job?: { id?: string } };

    if (!parsed.job?.id)
      return { ok: false, error: `deploy response had no job id: ${text}` };

    return { ok: true, jobId: parsed.job.id };
  }

  async executionStatus(jobId: string): Promise<ExecutionStatus | null> {
    const response = await fetch(`${this.apiBase}/executions`);

    if (!response.ok) return null;

    // SAFETY: the local Edge executions endpoint returns this documented
    // envelope; every nested field remains optional and is checked below.
    const parsed = (await response.json()) as {
      items?: Array<{
        job_id?: string;
        status?: { observed_state?: { state_type?: string; message?: string } };
      }>;
    };

    const execution = (parsed.items ?? []).find(
      (item) => item.job_id === jobId
    );

    if (!execution) return null;

    return {
      state: execution.status?.observed_state?.state_type ?? 'unknown',
      message: execution.status?.observed_state?.message ?? '',
    };
  }

  async deleteJob(jobId: string): Promise<void> {
    try {
      await fetch(`${this.apiBase}/jobs/${jobId}?force=true`, {
        method: 'DELETE',
      });
    } catch {
      // best effort cleanup
    }
  }

  pipelineLogPath(jobId: string): string {
    return join(this.dataDir, 'executions', jobId, 'logs', 'pipeline.log');
  }
}
