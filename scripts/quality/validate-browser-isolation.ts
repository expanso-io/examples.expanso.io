#!/usr/bin/env tsx

import { readFileSync } from 'node:fs';

import { globSync } from 'glob';

const patterns = [
  {
    label: 'installed browser channel',
    expression: /\bchannel\s*:/,
  },
  {
    label: 'headed browser launch',
    expression: /\bheadless\s*:\s*false\b/,
  },
  {
    label: 'browser executable override',
    expression: /\bexecutablePath\s*:/,
  },
  {
    label: 'system browser path environment override',
    expression: /PLAYWRIGHT_[A-Z_]*EXECUTABLE_PATH/,
  },
] as const;

const files = globSync(
  [
    'playwright*.{js,mjs,cjs,ts}',
    'scripts/**/*.{js,mjs,cjs,ts,tsx}',
    'src/**/*.{js,mjs,cjs,ts,tsx}',
    'tests/**/*.{js,mjs,cjs,ts,tsx}',
  ],
  {
    ignore: ['scripts/quality/validate-browser-isolation.ts'],
    nodir: true,
    posix: true,
  }
);

const failures: string[] = [];

for (const file of files) {
  const lines = readFileSync(file, 'utf8').split('\n');

  for (const [index, line] of lines.entries()) {
    for (const pattern of patterns) {
      if (pattern.expression.test(line))
        failures.push(`${file}:${index + 1}: ${pattern.label}`);
    }
  }
}

if (failures.length > 0) {
  process.stderr.write(`${failures.join('\n')}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(
    `Browser isolation PASS: ${files.length} source files use Playwright-managed headless browsers only.\n`
  );
}
