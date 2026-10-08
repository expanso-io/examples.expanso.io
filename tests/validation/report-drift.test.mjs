import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { test } from 'node:test';

test('report drift accepts release metadata changes but rejects result changes', () => {
  mkdirSync('.bin', { recursive: true });
  const root = mkdtempSync(resolve('.bin/report-drift-'));
  const script = resolve('scripts/validation/check-report-drift.mjs');
  const git = (...args) => execFileSync('git', args, { cwd: root });
  const report = (version, date, status = 'PASS') => ({
    summary: {
      date,
      edgeVersion: version,
      cliVersion: version,
      validatePass: status === 'PASS' ? 1 : 0,
    },
    pipelines: [{ validate: { status }, run: { status } }],
  });
  const write = (version, date, status = 'PASS') => {
    for (const directory of ['latest', '2026-10-06']) {
      const folder = join(root, 'validation-reports', directory);
      mkdirSync(folder, { recursive: true });
      writeFileSync(
        join(folder, 'report.json'),
        JSON.stringify(report(version, date, status))
      );
      writeFileSync(
        join(folder, 'README.md'),
        `# Example pipeline validation: ${date}\n\n- expanso-edge: \`${version}\` (latest installed)\n- expanso-cli: \`${version}\` (latest installed)\n\n| Pipeline | Run | expanso-edge |\n| --- | --- | ${'-'.repeat(version.length)} |\n| fixture | ${status} | ${version} |\n`
      );
    }
    writeFileSync(
      join(root, 'validation-reports/README.md'),
      `Latest: [${date}](latest/README.md). Complete pipelines 1/1 validate. expanso-edge \`${version}\`; expanso-cli \`${version}\`.\n`
    );
  };
  const run = () =>
    spawnSync(process.execPath, [script], { cwd: root, encoding: 'utf8' });
  try {
    git('init', '--quiet');
    write('v2.1.22', '2026-10-06');
    git('add', '.');
    git(
      '-c',
      'user.name=Test',
      '-c',
      'user.email=test@example.invalid',
      '-c',
      'core.hooksPath=/dev/null',
      'commit',
      '--quiet',
      '-m',
      'fixture'
    );
    write('v22.100.300', '2026-10-07');
    assert.equal(run().status, 0);
    write('v22.100.300', '2026-10-07', 'FAIL');
    const changed = run();
    assert.equal(changed.status, 1);
    assert.match(changed.stderr, /Validation report drift/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
