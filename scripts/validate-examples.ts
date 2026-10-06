#!/usr/bin/env tsx
/**
 * Validate and run every example pipeline with the pinned expanso-edge release,
 * then write a dated Markdown report.
 *
 * Usage:
 *   npm run validate-examples                       # validate + run, write reports
 *   npm run validate-examples -- --date 2026-10-05  # override the report date (UTC default)
 *   npm run validate-examples -- --edge-version latest --no-write
 *   npm run validate-examples -- --no-run --no-write --files <paths...>
 *
 * Exit code is 1 when any complete pipeline fails validation or execution, a
 * fragment fails validation, or a file in the inventory is not valid YAML.
 */

import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
  LocalEdgeAgent,
  PINNED_EDGE_VERSION,
  resolveEdgeBinary,
  validateFile,
  validateSource,
} from './validation/edge';
import {
  assessRunnability,
  planRun,
  wrapFragment,
  type LocalStandIns,
} from './validation/harness';
import {
  discoverPipelineFiles,
  inventoryDigest,
  pipelineConfigOf,
} from './validation/inventory';
import { renderIndex, renderReport, summarize } from './validation/report';
import { writeFailureReport } from './validation/failure-report';
import { verifyOutputs, type Expectation } from './validation/expectations';
import { rebaseNormalizationFixture } from './validation/recent-timestamps';
import type {
  PipelineFile,
  PipelineReport,
  RunResult,
  ValidateResult,
} from './validation/types';
import type { YamlObject } from './validation/yaml-value';

const repositoryRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));

const FIXTURE_ROOT = 'tests/fixtures/pipeline-inputs';

const RUN_TIMEOUT_MS = 45_000;

interface ManifestEntry {
  inputMetadata?: Record<string, string>;
  recentTimestamps?: boolean;
  expectation?: Expectation;
  fixture?: string;
  minRecords?: number;
  pathStandIns?: Record<string, string>;
  processorStandIns?: Record<string, YamlObject>;
  skip?: string;
  timeoutMs?: number;
  validationEnv?: Record<string, string>;
}

interface Manifest {
  categories?: Record<string, ManifestEntry>;
  environment?: Record<string, string>;
  families?: Record<string, ManifestEntry>;
  pipelines?: Record<string, ManifestEntry>;
}

interface Options {
  date: string;
  edgeVersion: string;
  files: string[];
  run: boolean;
  write: boolean;
}

function parseArgs(argv: readonly string[]): Options {
  const options: Options = {
    date: new Date().toISOString().slice(0, 10),
    edgeVersion: PINNED_EDGE_VERSION,
    files: [],
    run: true,
    write: true,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--date') options.date = argv[++index] ?? options.date;
    else if (arg === '--edge-version')
      options.edgeVersion = argv[++index] ?? options.edgeVersion;
    else if (arg === '--no-run') options.run = false;
    else if (arg === '--no-write') options.write = false;
    else if (arg === '--files') {
      options.files = argv
        .slice(index + 1)
        .map((path) =>
          relative(repositoryRoot, resolve(path)).replaceAll('\\', '/')
        );
      break;
    } else if (arg === '--help' || arg === '-h') {
      process.stdout.write(
        readFileSync(fileURLToPath(import.meta.url), 'utf8')
          .split('*/')[0]
          .replace(/^\/\*\*\n|^ \* ?/gm, '')
      );
      process.exit(0);
    } else throw new Error(`unknown argument: ${arg}`);
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(options.date))
    throw new Error(`--date must be YYYY-MM-DD, got ${options.date}`);
  if (
    !/^(?:latest|v\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?)$/.test(
      options.edgeVersion
    )
  )
    throw new Error(
      `--edge-version must be latest or a semantic version, got ${options.edgeVersion}`
    );

  return options;
}

function log(line: string): void {
  process.stderr.write(`${line}\n`);
}

function loadManifest(): Manifest {
  const path = join(repositoryRoot, FIXTURE_ROOT, 'manifest.json');

  if (!existsSync(path)) return {};

  // SAFETY: this checked-in JSON file is owned by the harness and typechecked
  // through every property access below; malformed JSON fails immediately.
  const manifest = JSON.parse(readFileSync(path, 'utf8')) as Manifest;
  const contracts = JSON.parse(
    readFileSync(
      join(repositoryRoot, FIXTURE_ROOT, 'expectations.json'),
      'utf8'
    )
  ) as Record<string, Expectation>;
  for (const [path, expectation] of Object.entries(contracts))
    manifest.pipelines = {
      ...manifest.pipelines,
      [path]: { ...manifest.pipelines?.[path], expectation },
    };
  return manifest;
}

function resolveManifestEntry(
  manifest: Manifest,
  file: PipelineFile
): ManifestEntry {
  const byCategory = manifest.categories?.[file.category] ?? {};
  const byFamily = manifest.families?.[file.family] ?? {};
  const byPath = manifest.pipelines?.[file.path] ?? {};

  return { ...byCategory, ...byFamily, ...byPath };
}

function resolveFixture(
  entry: ManifestEntry,
  file: PipelineFile
): string | null {
  const candidates = [entry.fixture, `${FIXTURE_ROOT}/${file.family}.jsonl`];

  for (const candidate of candidates) {
    if (candidate && existsSync(join(repositoryRoot, candidate)))
      return candidate;
  }

  return null;
}

function resolveStandIns(entry: ManifestEntry): LocalStandIns {
  return {
    inputMetadata: entry.inputMetadata,
    outputFormats:
      entry.expectation?.kind === 'records'
        ? entry.expectation.outputs.map((output) => output.format ?? 'jsonl')
        : undefined,
    processors: entry.processorStandIns,
    paths: Object.fromEntries(
      Object.entries(entry.pathStandIns ?? {}).map(([source, path]) => [
        source,
        {
          absolute: pathToFileURL(join(repositoryRoot, path)).href,
          display: path,
        },
      ])
    ),
  };
}

function countRecords(paths: readonly string[]): number {
  let total = 0;

  for (const path of paths) {
    if (!existsSync(path)) continue;
    total += readFileSync(path, 'utf8')
      .split('\n')
      .filter((line) => line.trim().length > 0).length;
  }

  return total;
}

function errorLines(logPath: string): string[] {
  if (!existsSync(logPath)) return [];

  return readFileSync(logPath, 'utf8')
    .split('\n')
    .filter((line) =>
      /"level":"(error|fatal|panic)"|level=(error|fatal|panic)|\bERR\b|\bERROR\b/.test(
        line
      )
    );
}

async function runPipeline(
  agent: LocalEdgeAgent,
  file: PipelineFile,
  manifest: Manifest,
  index: number
): Promise<RunResult> {
  const config = pipelineConfigOf(file.document);

  if (!config) return { status: 'SKIP', reason: 'no pipeline config' };
  const entry = resolveManifestEntry(manifest, file);

  if (entry.skip) return { status: 'SKIP', reason: entry.skip };
  const standIns = resolveStandIns(entry);
  const verdict = assessRunnability(config, standIns);

  if (!verdict.runnable)
    return { status: 'SKIP', reason: verdict.reason ?? 'not runnable locally' };

  const fixtureRelative = resolveFixture(entry, file);

  let fixture = fixtureRelative ? join(repositoryRoot, fixtureRelative) : null;

  const outputDir = join(
    agent.dataDir,
    '..',
    'outputs',
    String(index).padStart(3, '0')
  );

  mkdirSync(outputDir, { recursive: true });
  if (entry.recentTimestamps && fixture && entry.expectation) {
    const recent = rebaseNormalizationFixture(
      readFileSync(fixture, 'utf8'),
      entry.expectation
    );
    fixture = join(outputDir, 'recent-timestamps.jsonl');
    writeFileSync(fixture, recent.source);
    entry.expectation = recent.expectation;
  }
  let plan;

  try {
    plan = planRun(config, fixture, outputDir, standIns);
    if (entry.recentTimestamps)
      plan.substitutions.push({
        role: 'input',
        at: 'input.file',
        from: 'historical normalization fixture timestamps',
        to: 'previous-day timestamps and matching semantic expectations',
      });
  } catch (error) {
    return {
      status: 'SKIP',
      reason: error instanceof Error ? error.message : String(error),
    };
  }

  const started = Date.now();

  const jobName =
    `ev-${String(index).padStart(3, '0')}-${file.family.replace(/[^a-z0-9-]/gi, '-').toLowerCase()}`.slice(
      0,
      60
    );

  const deployed = await agent.deploy({
    name: jobName,
    type: 'pipeline',
    config: plan.config,
  });

  if (deployed.ok === false) {
    return {
      status: 'FAIL',
      mode: plan.mode,
      fixture: fixtureRelative ?? undefined,
      substitutions: plan.substitutions,
      reason: 'agent rejected the pipeline',
      detail: deployed.error,
      durationMs: Date.now() - started,
    };
  }

  const timeoutMs = entry.timeoutMs ?? RUN_TIMEOUT_MS;
  const deadline = started + timeoutMs;
  let finalState = 'unknown';
  let finalMessage = '';

  try {
    while (Date.now() < deadline) {
      const status = await agent.executionStatus(deployed.jobId);

      if (status) {
        finalState = status.state;
        finalMessage = status.message;

        if (
          status.state === 'completed' ||
          status.state === 'failed' ||
          status.state === 'stopped'
        )
          break;
      }

      await new Promise((resolveSleep) => setTimeout(resolveSleep, 250));
    }

    // Give file outputs a moment to flush after the stream reports completion.
    await new Promise((resolveSleep) => setTimeout(resolveSleep, 300));
    const records = countRecords(plan.outputFiles);
    const errors = errorLines(agent.pipelineLogPath(deployed.jobId));
    const minRecords = entry.minRecords ?? 1;

    const base = {
      mode: plan.mode,
      fixture: fixtureRelative ?? undefined,
      substitutions: plan.substitutions,
      records,
      durationMs: Date.now() - started,
    };

    if (finalState === 'failed') {
      return {
        status: 'FAIL',
        ...base,
        reason: `execution failed: ${finalMessage}`,
        detail: errors.join('\n') || finalMessage,
      };
    }

    if (finalState !== 'completed') {
      return {
        status: 'FAIL',
        ...base,
        reason: `did not complete within ${timeoutMs}ms (state ${finalState})`,
        detail: [finalMessage, ...errors].filter(Boolean).join('\n'),
      };
    }

    if (errors.length > 0) {
      return {
        status: 'FAIL',
        ...base,
        reason: 'pipeline logged errors while running',
        detail: errors.slice(0, 20).join('\n'),
      };
    }

    if (records < minRecords) {
      return {
        status: 'FAIL',
        ...base,
        reason: `produced ${records} records, expected at least ${minRecords}`,
      };
    }

    if (!entry.expectation) {
      return {
        status: 'FAIL',
        ...base,
        reason: 'semantic output expectation is not registered',
      };
    }
    try {
      const parseLines = (path: string): unknown[] =>
        readFileSync(path, 'utf8')
          .split('\n')
          .filter((line) => line.trim())
          .map((line) => JSON.parse(line));
      verifyOutputs(
        entry.expectation,
        entry.expectation.kind === 'encryption' && fixture
          ? parseLines(fixture)
          : [],
        plan.outputFiles.map((path) =>
          existsSync(path) ? readFileSync(path, 'utf8') : ''
        ),
        manifest.environment ?? {}
      );
    } catch (error) {
      return {
        status: 'FAIL',
        ...base,
        reason: 'semantic output verification failed',
        detail: error instanceof Error ? error.message : String(error),
      };
    }

    return {
      status: 'PASS',
      ...base,
      reason: `${records} records written and semantic output verified`,
    };
  } finally {
    await agent.deleteJob(deployed.jobId);
  }
}

function validate(
  file: PipelineFile,
  edge: ReturnType<typeof resolveEdgeBinary>,
  filesByPath: ReadonlyMap<string, PipelineFile>,
  validationEnv: Readonly<Record<string, string>> = {}
): ValidateResult {
  if (file.kind === 'invalid-yaml') {
    return {
      status: 'FAIL',
      mode: 'file',
      errors: [{ message: file.parseError ?? 'not valid YAML' }],
    };
  }

  if (file.kind === 'fragment') {
    let canonicalConfig: YamlObject | undefined;

    if (file.canonicalPath) {
      const canonical = filesByPath.get(file.canonicalPath);
      canonicalConfig = pipelineConfigOf(canonical?.document) ?? undefined;
    }
    const wrapped = wrapFragment(file.document, canonicalConfig);

    if (!wrapped) {
      return {
        status: 'FAIL',
        mode: 'wrapped',
        errors: [{ message: 'fragment is not a recognisable pipeline piece' }],
      };
    }

    return validateSource(edge, repositoryRoot, wrapped.source, validationEnv);
  }

  if (file.surface === 'page' && file.source)
    return validateSource(
      edge,
      repositoryRoot,
      file.source,
      validationEnv,
      'file'
    );

  return validateFile(edge, repositoryRoot, file.path, validationEnv);
}

async function verifyLivePages(
  reports: readonly PipelineReport[]
): Promise<void> {
  const missing = reports
    .filter((report) => !report.file.liveRoute)
    .map((report) => report.file.path);

  if (missing.length > 0) {
    throw new Error(
      `live page mapping missing for ${missing.length} pipeline files:\n${missing.join('\n')}`
    );
  }

  const baseUrl =
    process.env.VALIDATION_LIVE_BASE_URL ?? 'https://examples.expanso.io';
  const routes = [
    ...new Set(reports.map((report) => report.file.liveRoute as string)),
  ].sort();
  const failures: string[] = [];

  await Promise.all(
    routes.map(async (route) => {
      const url = new URL(route, baseUrl);

      try {
        const response = await fetch(url, {
          redirect: 'follow',
          signal: AbortSignal.timeout(15_000),
        });

        if (response.status !== 200)
          failures.push(`${url.toString()} returned HTTP ${response.status}`);
        await response.body?.cancel();
      } catch (error) {
        failures.push(
          `${url.toString()} failed: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    })
  );

  if (failures.length > 0)
    throw new Error(
      `live page verification failed:\n${failures.sort().join('\n')}`
    );

  log(`verified ${routes.length} live pipeline pages return HTTP 200`);
}

async function writeReports(
  reports: PipelineReport[],
  options: Options,
  edgeVersion: string,
  digest: string
): Promise<void> {
  await verifyLivePages(reports);
  const summary = summarize(reports, {
    date: options.date,
    edgeVersion,
    pinnedEdgeVersion: PINNED_EDGE_VERSION,
    inventoryDigest: digest,
  });

  const reportRoot = join(repositoryRoot, 'validation-reports');
  const dated = join(reportRoot, options.date);
  const latest = join(reportRoot, 'latest');

  for (const dir of [dated, latest]) {
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, 'README.md'),
      renderReport(reports, summary, 2),
      'utf8'
    );
    writeFileSync(
      join(dir, 'report.json'),
      `${JSON.stringify({ summary, pipelines: reports.map(stripDocument) }, null, 2)}\n`,
      'utf8'
    );
  }

  const dates = readdirSync(reportRoot, { withFileTypes: true })
    .filter(
      (entry) => entry.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(entry.name)
    )
    .map((entry) => entry.name);

  writeFileSync(
    join(reportRoot, 'README.md'),
    renderIndex(dates, summary),
    'utf8'
  );
  log(
    `report written to validation-reports/${options.date}/README.md and validation-reports/latest/README.md`
  );
}

function stripDocument(report: PipelineReport): Omit<PipelineReport, 'file'> & {
  file: Omit<PipelineFile, 'document' | 'source'>;
} {
  const { document: _document, source: _source, ...file } = report.file;

  const run = report.run
    ? {
        ...report.run,
        durationMs: undefined,
        records: undefined,
        reason:
          report.run.status === 'PASS'
            ? 'semantic output verified'
            : report.run.reason,
      }
    : undefined;

  void _document;
  void _source;

  return { ...report, file, run };
}

let reportDate = new Date().toISOString().slice(0, 10);

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  reportDate = options.date;

  const edge = resolveEdgeBinary(repositoryRoot, {
    install: true,
    log,
    version: options.edgeVersion,
  });

  log(`expanso-edge ${edge.version} (${edge.path})`);

  const inventory = discoverPipelineFiles(repositoryRoot);
  const allFiles = inventory.filter((file) => file.kind !== 'manifest');
  const selectedPaths = new Set(options.files);
  const files =
    selectedPaths.size === 0
      ? allFiles
      : allFiles.filter((file) => selectedPaths.has(file.path));

  if (selectedPaths.size > 0) {
    const found = new Set(inventory.map((file) => file.path));
    const missing = [...selectedPaths].filter((path) => !found.has(path));

    if (missing.length > 0)
      throw new Error(
        `staged pipeline files were not found in the validation inventory:\n${missing.join('\n')}`
      );
  }

  const digest = inventoryDigest(repositoryRoot, files);

  log(
    `inventory: ${files.length} files (${files.filter((file) => file.kind.startsWith('complete')).length} complete pipelines)`
  );

  const manifest = loadManifest();
  const validationEnvironment = manifest.environment ?? {};
  const reports: PipelineReport[] = [];
  const filesByPath = new Map(allFiles.map((file) => [file.path, file]));

  for (const file of files) {
    const entry = resolveManifestEntry(manifest, file);
    reports.push({
      file,
      validate: validate(file, edge, filesByPath, {
        ...validationEnvironment,
        ...entry.validationEnv,
      }),
    });
  }

  if (options.run) {
    const workRoot = join(repositoryRoot, '.bin');
    mkdirSync(workRoot, { recursive: true });
    const workDir = mkdtempSync(join(workRoot, 'examples-validation-'));
    const agent = new LocalEdgeAgent(edge, workDir, validationEnvironment);

    try {
      await agent.start();
      log(
        `local expanso-edge agent started (pid ${agent.pid}, ${agent.apiBase})`
      );
      let index = 0;

      for (const report of reports) {
        if (!report.file.kind.startsWith('complete')) continue;
        index += 1;

        if (report.validate.status !== 'PASS') {
          report.run = { status: 'SKIP', reason: 'validation failed' };
          continue;
        }

        report.run = await runPipeline(agent, report.file, manifest, index);
        log(
          `run ${report.run.status.padEnd(4)} ${report.file.path}: ${report.run.reason}`
        );

        if (report.run.status === 'FAIL' && report.run.detail)
          log(report.run.detail);
      }
    } finally {
      await agent.stop();

      rmSync(workDir, { recursive: true, force: true });
    }
  }

  for (const report of reports) {
    const run = report.run ? ` run=${report.run.status}` : '';
    log(
      `${report.validate.status.padEnd(4)} ${report.file.kind.padEnd(13)} ${report.file.path}${run}`
    );
  }

  if (options.write) await writeReports(reports, options, edge.version, digest);

  const summary = summarize(reports, {
    date: options.date,
    edgeVersion: edge.version,
    pinnedEdgeVersion: PINNED_EDGE_VERSION,
    inventoryDigest: digest,
  });

  log(
    `complete pipelines: ${summary.complete.total}; validate ${summary.complete.validatePass} pass / ${summary.complete.validateFail} fail; run ${summary.complete.runPass} pass / ${summary.complete.runFail} fail / ${summary.complete.runSkip} skip; fragments ${summary.fragments.validatePass} pass / ${summary.fragments.validateFail} fail; invalid yaml ${summary.invalidYaml}`
  );

  if (
    summary.complete.validateFail > 0 ||
    summary.complete.runFail > 0 ||
    summary.complete.runSkip > 0 ||
    (options.run && summary.complete.runNotAttempted > 0) ||
    summary.fragments.validateFail > 0 ||
    summary.invalidYaml > 0
  ) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  writeFailureReport(repositoryRoot, reportDate, error);
  log(error instanceof Error ? (error.stack ?? error.message) : String(error));
  process.exitCode = 1;
});
