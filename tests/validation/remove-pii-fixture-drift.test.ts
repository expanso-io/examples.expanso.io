import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { delimiter, dirname, join, resolve } from 'node:path';
import { test } from 'node:test';

interface FixtureEnvironment {
  pipelineSha256: string;
  inputSha256: string;
  expectedOutputSha256: string;
  environment: { IP_SALT: string };
  timeoutsMs: { execution: number };
  schemaVersion: string;
  executor: string;
  extra?: boolean;
}

test('remove-PII generator ignores only execution-version drift', () => {
  mkdirSync('.bin', { recursive: true });
  const work = mkdtempSync(resolve('.bin/remove-pii-drift-'));
  const paths = [
    'examples/data-security/remove-pii-complete.yaml',
    'examples/data-security/remove-pii/sample-data.json',
    'examples/data-security/remove-pii/fixture-environment.json',
    'examples/data-security/remove-pii/expected-output.jsonl',
  ];
  const environmentPath = paths[2];
  const originals = new Map(
    paths.map((path) => [path, readFileSync(path, 'utf8')])
  );
  try {
    for (const path of paths) {
      mkdirSync(dirname(join(work, path)), { recursive: true });
      copyFileSync(path, join(work, path));
    }
    const binaryDirectory = join(work, 'bin');
    mkdirSync(binaryDirectory);
    writeFileSync(
      join(binaryDirectory, 'expanso-edge'),
      '#!/bin/sh\nprintf "v99.100.101\\n"\n',
      { mode: 0o755 }
    );
    const run = (...args: string[]) =>
      spawnSync(
        process.execPath,
        [
          resolve('node_modules/tsx/dist/cli.mjs'),
          resolve('scripts/fixtures/generate-remove-pii-fixture.ts'),
          ...args,
        ],
        {
          cwd: work,
          encoding: 'utf8',
          env: {
            ...process.env,
            PATH: binaryDirectory + delimiter + process.env.PATH,
          },
        }
      );
    const unchanged = run();
    assert.equal(unchanged.status, 0, unchanged.stderr);
    assert.equal(
      readFileSync(join(work, environmentPath), 'utf8'),
      originals.get(environmentPath)
    );

    const mutations: ((value: FixtureEnvironment) => void)[] = [
      (value) => {
        value.pipelineSha256 = 'sha256:changed';
      },
      (value) => {
        value.inputSha256 = 'sha256:changed';
      },
      (value) => {
        value.expectedOutputSha256 = 'sha256:changed';
      },
      (value) => {
        value.environment.IP_SALT = 'changed';
      },
      (value) => {
        value.timeoutsMs.execution += 1;
      },
      (value) => {
        value.schemaVersion = '2.0.0';
      },
      (value) => {
        value.executor = 'other';
      },
      (value) => {
        value.extra = true;
      },
    ];
    for (const mutate of mutations) {
      const value = JSON.parse(originals.get(environmentPath)!);
      mutate(value);
      writeFileSync(
        join(work, environmentPath),
        JSON.stringify(value, null, 2) + '\n'
      );
      const result = run();
      assert.equal(result.status, 1, result.stdout);
      assert.match(result.stderr, /Remove PII fixture drift/);
    }
    writeFileSync(join(work, environmentPath), originals.get(environmentPath)!);
    for (const path of [paths[1], paths[3]]) {
      writeFileSync(
        join(work, path),
        originals.get(path)!.replace('USD', 'EUR')
      );
      const result = run();
      assert.equal(result.status, 1, result.stdout);
      assert.match(result.stderr, /Remove PII fixture drift/);
      writeFileSync(join(work, path), originals.get(path)!);
    }
    const written = run('--write');
    assert.equal(written.status, 0, written.stderr);
    assert.equal(
      JSON.parse(readFileSync(join(work, environmentPath), 'utf8')).version,
      'v99.100.101'
    );
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
});
