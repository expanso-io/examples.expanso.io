import assert from 'node:assert/strict';
import test from 'node:test';

import { inspectFile } from '../../scripts/check-no-browser-open.mjs';

test('rejects a Docusaurus script that can open a browser', () => {
  const violations = inspectFile(
    'package.json',
    JSON.stringify({ scripts: { start: 'docusaurus start' } })
  );

  assert.deepEqual(violations, [
    'package.json script start: Docusaurus start/serve command is missing --no-open',
  ]);
});

test('accepts Docusaurus start and serve scripts with no-open', () => {
  const violations = inspectFile(
    'package.json',
    JSON.stringify({
      scripts: {
        start: 'docusaurus start --no-open',
        serve: 'docusaurus serve --no-open',
      },
    })
  );

  assert.deepEqual(violations, []);
});

test('rejects the other supported browser auto-open settings', () => {
  const cases = [
    ['package.json', { scripts: { preview: 'vite preview --open' } }],
    ['package.json', { scripts: { dev: 'live-server public' } }],
    ['package.json', { scripts: { dev: 'BROWSER=chrome vite' } }],
    ['justfile', 'dev:\n\tlive-server public'],
    ['vite.config.ts', 'export default {server: {open: true}}'],
    ['astro.config.mjs', 'export default {server: {open: true}}'],
  ];

  for (const [file, value] of cases) {
    const contents = file === 'package.json' ? JSON.stringify(value) : value;

    assert.notDeepEqual(inspectFile(file, contents), [], file);
  }
});
