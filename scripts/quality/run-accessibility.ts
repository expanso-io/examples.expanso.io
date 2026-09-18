import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

import { produceAccessibilityResult } from './produce-accessibility-result';
import {
  accessibilityGatePasses,
  reduceAccessibility,
} from './reduce-accessibility';
import { readJson } from './contract-lib';
import { writeAccessibilityShardManifest } from './merge-accessibility-shards';

const subjectSha = process.env.QUALITY_SUBJECT_SHA;
if (!subjectSha) {
  throw new Error(
    'QUALITY_SUBJECT_SHA is required; bind accessibility evidence to the exact 40-character commit SHA'
  );
}

const environmentId =
  process.env.QUALITY_ENVIRONMENT_ID ?? `${process.platform}-${process.arch}`;
const shardIndexText = (
  process.env.QUALITY_ACCESSIBILITY_SHARD_INDEX ?? ''
).trim();
const shardTotalText = (
  process.env.QUALITY_ACCESSIBILITY_SHARD_TOTAL ?? ''
).trim();
if ((shardIndexText === '') !== (shardTotalText === '')) {
  throw new Error(
    'QUALITY_ACCESSIBILITY_SHARD_INDEX and QUALITY_ACCESSIBILITY_SHARD_TOTAL must be set together'
  );
}
const shardIndex = shardIndexText === '' ? null : Number(shardIndexText);
const shardTotal = shardTotalText === '' ? null : Number(shardTotalText);
if (
  shardIndex !== null &&
  shardTotal !== null &&
  (!Number.isInteger(shardTotal) ||
    shardTotal < 1 ||
    shardTotal > 16 ||
    !Number.isInteger(shardIndex) ||
    shardIndex < 1 ||
    shardIndex > shardTotal)
) {
  throw new Error(
    'Accessibility shard coordinates must be integers with 1 <= index <= total <= 16'
  );
}
const evidenceRoot = resolve(
  process.env.QUALITY_ACCESSIBILITY_OUTPUT_ROOT ??
    'test-results/quality/accessibility'
);
const observationPath = resolve(evidenceRoot, 'playwright-observations.json');
const resultPath = resolve(evidenceRoot, 'accessibility-result.json');
mkdirSync(evidenceRoot, { recursive: true });
rmSync(observationPath, { force: true });
rmSync(resultPath, { force: true });

const accessibilityWorkers = (
  process.env.QUALITY_ACCESSIBILITY_WORKERS ?? ''
).trim();
if (
  accessibilityWorkers !== '' &&
  (!/^[1-9]\d*$/.test(accessibilityWorkers) ||
    Number(accessibilityWorkers) > 16)
) {
  throw new Error(
    'QUALITY_ACCESSIBILITY_WORKERS must be an integer between 1 and 16'
  );
}

function run(command: string, args: string[], env = process.env): number {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    env,
  });
  if (result.error) throw result.error;
  return result.status ?? 1;
}

const buildExit =
  process.env.QUALITY_SKIP_BUILD === '1'
    ? 0
    : run('npm', ['run', 'build'], {
        ...process.env,
        EXPLORER_RUNTIME_HARNESS: '1',
      });
if (buildExit !== 0 || !existsSync('build/sitemap.xml')) {
  throw new Error(
    'Accessibility inventory build failed or did not emit build/sitemap.xml'
  );
}

const playwrightExit = run(
  resolve('node_modules/.bin/playwright'),
  [
    'test',
    'tests/quality/accessibility/harness.spec.ts',
    'tests/quality/accessibility/site-accessibility.spec.ts',
    '--project=chromium-desktop',
    '--reporter=line,./scripts/quality/accessibility-reporter.ts',
    ...(accessibilityWorkers === ''
      ? []
      : [`--workers=${accessibilityWorkers}`]),
    ...(shardIndex === null || shardTotal === null
      ? []
      : [`--shard=${shardIndex}/${shardTotal}`]),
  ],
  {
    ...process.env,
    A11Y_OBSERVATIONS_PATH: observationPath,
    QUALITY_STATIC_SERVER: '1',
  }
);

if (!existsSync(observationPath)) {
  throw new Error(
    `Playwright exited ${playwrightExit} without emitting the required observation manifest`
  );
}
if (playwrightExit !== 0) {
  throw new Error(
    `Playwright accessibility producer exited ${playwrightExit}; retained observations cannot authorize PASS`
  );
}

if (shardIndex !== null && shardTotal !== null) {
  writeAccessibilityShardManifest({
    subjectSha,
    environmentId,
    shardIndex,
    shardTotal,
    observationPath,
    outputPath: resolve(evidenceRoot, 'accessibility-shard-manifest.json'),
  });
  process.stdout.write(
    `${JSON.stringify({
      status: 'PASS',
      shardIndex,
      shardTotal,
      observationPath,
    })}\n`
  );
  process.exit(0);
}

produceAccessibilityResult({
  subjectSha,
  environmentId,
  observationPath,
  evidenceRoot,
  outputPath: resultPath,
});
const reduction = reduceAccessibility(readJson(resultPath), {
  expectedSubjectSha: subjectSha,
  expectedEnvironmentId: environmentId,
  evidenceRoot,
});
process.stdout.write(`${JSON.stringify(reduction, null, 2)}\n`);

if (!accessibilityGatePasses(reduction)) {
  process.exitCode = 1;
}
