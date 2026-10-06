#!/usr/bin/env tsx

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { globSync } from 'glob';

import {
  classifyPipelineCode,
  extractYamlCodeBlocks,
  hasUnclassifiedExpansoCode,
} from '../src/lib/pipelineCode';
import { discoverPipelineFiles } from './validation/inventory';

const repositoryRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));

const failures: string[] = [];

let yamlBlocks = 0;

let renderedPipelineBlocks = 0;

for (const path of globSync('docs/**/*.mdx', {
  cwd: repositoryRoot,
  nodir: true,
  posix: true,
}).sort()) {
  const page = readFileSync(`${repositoryRoot}/${path}`, 'utf8');

  for (const block of extractYamlCodeBlocks(page)) {
    yamlBlocks += 1;

    if (classifyPipelineCode(block.source)) renderedPipelineBlocks += 1;
    else if (hasUnclassifiedExpansoCode(block.source))
      failures.push(
        `${path}#L${block.line}: YAML is not a recognised complete pipeline, fragment, or infrastructure document`
      );
  }
}

const pipelineFiles = discoverPipelineFiles(repositoryRoot).filter(
  (file) => file.kind !== 'manifest' && file.kind !== 'invalid-yaml'
);

for (const file of pipelineFiles) {
  const renderedKind = classifyPipelineCode(file.source ?? '');
  const expectedKind = file.kind === 'fragment' ? 'fragment' : 'complete';

  if (renderedKind !== expectedKind)
    failures.push(
      `${file.path}: expected ${expectedKind}, classified ${renderedKind ?? 'not-pipeline'}`
    );
}

process.stdout.write(
  `classified ${renderedPipelineBlocks} rendered pipeline blocks among ${yamlBlocks} YAML fences\n`
);

process.stdout.write(
  `classified ${pipelineFiles.length} canonical pipeline files for badge rendering\n`
);

if (failures.length > 0) {
  for (const failure of failures) process.stderr.write(`FAIL ${failure}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(
    'every canonical pipeline is classified as fragment or complete\n'
  );
}
