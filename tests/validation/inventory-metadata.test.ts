import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { discoverPipelineFiles } from '../../scripts/validation/inventory';

function validateFile(path: string) {
  return spawnSync(
    process.execPath,
    [
      'node_modules/tsx/dist/cli.mjs',
      'scripts/validate-examples.ts',
      '--no-run',
      '--no-write',
      '--files',
      path,
    ],
    { encoding: 'utf8' }
  );
}

test('Docusaurus tag metadata is excluded from pipeline validation', () => {
  assert.equal(
    discoverPipelineFiles(process.cwd()).find(
      (file) => file.path === 'docs/tags.yml'
    ),
    undefined
  );
  const result = validateFile('docs/tags.yml');
  assert.equal(result.status, 0, result.stderr + result.stdout);
});

test('unknown example YAML remains rejected, including tag-shaped content', () => {
  const directory = mkdtempSync('examples/review-metadata-');
  const path = join(directory, 'tags.yml');
  try {
    for (const source of [readFileSync('docs/tags.yml', 'utf8'), 'outpt: {}']) {
      writeFileSync(path, source);
      const result = validateFile(path);
      assert.equal(result.status, 1, result.stderr + result.stdout);
      assert.ok(result.stderr.includes(path), result.stderr);
      assert.ok(
        result.stderr.includes('Unclassified pipeline YAML document'),
        result.stderr
      );
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
