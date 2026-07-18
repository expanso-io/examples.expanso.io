#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = path.join(root, 'static', 'llms.txt');
const buildDir = path.join(root, 'build');
const builtPath = path.join(buildDir, 'llms.txt');

assert.ok(fs.existsSync(sourcePath), 'static/llms.txt is missing');
assert.ok(
  fs.existsSync(buildDir),
  'build/ is missing; run `npm run build` first'
);
assert.ok(fs.existsSync(builtPath), 'build/llms.txt is missing');

const source = fs.readFileSync(sourcePath, 'utf8');
const built = fs.readFileSync(builtPath, 'utf8');

assert.equal(built, source, 'build/llms.txt does not match static/llms.txt');
assert.match(
  source,
  /^# Expanso Examples$/m,
  'llms.txt must have the canonical H1'
);
assert.match(
  source,
  /expanso-cli job validate\s+\S+\s+--offline/,
  'llms.txt must show offline job validation'
);
assert.match(
  source,
  /expanso-cli job deploy\s+\S+/,
  'llms.txt must show the current job deploy command'
);

const forbidden = [
  {
    pattern: /curl\s+-sSL\s+https:\/\/get\.expanso\.io\s*\|\s*(?:ba)?sh/,
    reason: 'bare one-shot installer endpoint',
  },
  {
    pattern: /\bexpanso\s+pipeline\s+deploy\b/,
    reason: 'obsolete CLI deploy command',
  },
  {
    pattern: /each example includes/i,
    reason: 'blanket example-coverage claim',
  },
  {
    pattern: /all 200\+ components/i,
    reason: 'unverified component-count claim',
  },
];

for (const { pattern, reason } of forbidden) {
  assert.doesNotMatch(source, pattern, `llms.txt contains ${reason}`);
}

const markdownUrlPattern =
  /\[[^\]]+\]\((https:\/\/examples\.expanso\.io(?:\/[^)\s]*)?)\)/g;
const siteUrls = [...source.matchAll(markdownUrlPattern)].map(
  (match) => match[1]
);

assert.ok(
  siteUrls.length > 0,
  'llms.txt must include at least one examples.expanso.io URL'
);

for (const urlString of siteUrls) {
  const url = new URL(urlString);
  const decodedPath = decodeURIComponent(url.pathname);
  const relativePath =
    decodedPath === '/'
      ? 'index.html'
      : decodedPath.endsWith('/')
        ? path.join(decodedPath.slice(1), 'index.html')
        : decodedPath.slice(1);
  const artifactPath = path.join(buildDir, relativePath);

  assert.ok(
    fs.existsSync(artifactPath),
    `${urlString} has no matching build artifact at ${path.relative(root, artifactPath)}`
  );
}

console.log(
  `Validated static/llms.txt and ${siteUrls.length} same-origin build routes.`
);
