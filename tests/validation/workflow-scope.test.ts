import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { parse } from 'yaml';

const root = process.cwd();
mkdirSync(join(root, '.bin'), { recursive: true });
const work = mkdtempSync(join(root, '.bin', 'workflow-scope-'));
after(() => rmSync(work, { recursive: true, force: true }));

const workflow = parse(
  readFileSync('.github/workflows/validate-examples.yml', 'utf8')
);
const scope = workflow.jobs.validate.steps.find(
  (step: { id?: string }) => step.id === 'scope'
);
assert.equal(typeof scope.run, 'string');

writeFileSync(
  join(work, 'git'),
  `#!/bin/bash
case "$1" in
  fetch) exit 0 ;;
  merge-base) printf '%s\\n' fixture-base ;;
  diff)
    if [ "$SCOPE_DIFF_FAILURE" = 1 ]; then exit 2; fi
    printf '%s\\n' "$SCOPE_CHANGED_FILES"
    ;;
  *) exit 2 ;;
esac
`,
  { mode: 0o755 }
);

let sequence = 0;
function runScope(
  files: string[],
  event = 'pull_request',
  diffFailure = false
) {
  const output = join(work, `output-${++sequence}`);
  writeFileSync(output, '');
  const result = spawnSync(
    '/bin/bash',
    ['-e', '-o', 'pipefail', '-c', scope.run],
    {
      cwd: root,
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${work}:${process.env.PATH}`,
        BASE_REF: 'main',
        BEFORE_SHA: '',
        EVENT_NAME: event,
        GITHUB_OUTPUT: output,
        SCOPE_CHANGED_FILES: files.join('\n'),
        SCOPE_DIFF_FAILURE: diffFailure ? '1' : '0',
      },
    }
  );
  const entries = readFileSync(output, 'utf8')
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const separator = line.indexOf('=');
      return [line.slice(0, separator), line.slice(separator + 1)];
    });
  return { ...result, output: Object.fromEntries(entries) };
}

for (const path of [
  'scripts/setup-binaries.ts',
  'scripts/validate-cli-commands.ts',
  'scripts/new-check.ts',
  'package.json',
  'package-lock.json',
  '.github/workflows/another-check.yml',
  'examples/new-example.txt',
  'docs/getting-started/process-data-locally.mdx',
  'src/lib/pipelineCode.ts',
  'src/lib/pipelineCode.test.ts',
  'src/theme/CodeBlock/index.tsx',
  'unknown/new-config.toml',
]) {
  test(`validation runs for a PR changing only ${path}`, () => {
    const result = runScope([path]);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.output.run, 'true');
    assert.equal(result.output.base, 'fixture-base');
  });
}

test('validation skips only an entirely explicit no-op change set', () => {
  const result = runScope([
    'LICENSE',
    'static/img/example.png',
    'static/img/logo.svg',
  ]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.output.run, 'false');
  assert.equal(result.output.base, 'fixture-base');
  const mixed = runScope([
    'static/img/example.png',
    'scripts/setup-binaries.ts',
  ]);
  assert.equal(mixed.status, 0, mixed.stderr);
  assert.equal(mixed.output.run, 'true');
  assert.equal(mixed.output.base, 'fixture-base');
});

test('manual validation always runs and diff failure cannot produce a passing no-op', () => {
  const manual = runScope([], 'workflow_dispatch');
  assert.equal(manual.status, 0, manual.stderr);
  assert.equal(manual.output.run, 'true');
  assert.equal(manual.output.base, undefined);
  const failed = runScope([], 'pull_request', true);
  assert.notEqual(failed.status, 0);
  assert.equal(failed.output.run, undefined);
  assert.equal(failed.output.base, 'fixture-base');
});
