#!/usr/bin/env tsx
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  unapprovedFenceLanguageChanges,
  type FenceLanguageChange,
} from './validation/fence-languages';

const args = process.argv.slice(2);
if (args.length !== 2 || args[0] !== '--base')
  throw new Error('Usage: validate-fence-languages --base MAIN_COMMIT');
const root = process.cwd();
const approved: FenceLanguageChange[] = JSON.parse(
  readFileSync(resolve(root, 'content/fence-language-changes.json'), 'utf8')
);
if (
  !Array.isArray(approved) ||
  approved.some(
    (entry) =>
      typeof entry.path !== 'string' ||
      !Number.isInteger(entry.line) ||
      typeof entry.snippet !== 'string' ||
      !/^[a-f0-9]{64}$/.test(entry.snippet) ||
      (entry.replacement !== undefined &&
        (typeof entry.replacement !== 'string' ||
          !/^[a-f0-9]{64}$/.test(entry.replacement))) ||
      typeof entry.from !== 'string' ||
      typeof entry.to !== 'string'
  )
)
  throw new Error('Invalid explicit fence-language change list');
const failures = unapprovedFenceLanguageChanges(root, args[1], approved);
for (const change of failures)
  process.stderr.write(
    `FAIL ${change.path}:${change.line}: fence language ${change.from || '(none)'} -> ${change.to || '(none)'} is not explicitly listed\n`
  );
process.stdout.write(
  `${failures.length} unapproved fence-language changes against ${args[1]}\n`
);
if (failures.length) process.exitCode = 1;
