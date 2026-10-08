#!/usr/bin/env tsx

import { readFileSync, writeFileSync } from 'node:fs';

import { PUBLIC_CATALOG } from '../../src/catalog/registry';
import { formatMarkdownTables } from './report';

const reports = [
  'validation-reports/conformance/README.md',
  'validation-reports/conformance/2026-10-06.md',
];

const records = new Map(
  PUBLIC_CATALOG.records
    .filter((record) => record.status === 'published')
    .map((record) => [record.title, record])
);

const status = (value: string): string => {
  if (value === 'Pass') return '✅ pass';

  if (value === 'Fixed') return '✅ fixed';

  if (value === 'Pending') return '⏭️ skipped: pending';

  return value;
};

for (const path of reports) {
  const source = readFileSync(path, 'utf8');

  const rendered = source
    .split('\n')
    .map((line) => {
      if (line.startsWith('| Example |'))
        return '| Example | 1: Runs | 2: Platform | 3: Structure | 4: Usability | 5: Preserved | Live page | Source |';

      if (/^\| -+ \| -+ \| -+ \| -+ \| -+ \| -+ \|$/.test(line))
        return '| --- | --- | --- | --- | --- | --- | --- | --- |';

      const cells = line
        .split('|')
        .slice(1, -1)
        .map((cell) => cell.trim());

      const record = records.get(cells[0]);

      if (!record || cells.length < 6) return line;

      return `| ${cells[0]} | ${cells.slice(1, 6).map(status).join(' | ')} | [Live page](https://examples.expanso.io${record.routes.overview}) | [Source](https://github.com/expanso-io/examples.expanso.io/blob/main/${record.completePipelinePath}) |`;
    })
    .join('\n');

  writeFileSync(path, formatMarkdownTables(rendered), 'utf8');
}
