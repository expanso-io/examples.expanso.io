import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const IGNORED_DIRECTORIES = new Set([
  '.git',
  '.docusaurus',
  'build',
  'node_modules',
]);

const PACKAGE_FILE = /(^|\/)package\.json$/;

const JUST_FILE = /(^|\/)(?:justfile|Justfile)$/;

const SERVER_CONFIG_FILE = /(^|\/)(?:astro|vite)\.config\.(?:c|m)?(?:js|ts)$/;

function inspectCommand(command) {
  const problems = [];

  if (
    /\bdocusaurus\s+(?:start|serve)\b/.test(command) &&
    !/\bdocusaurus\s+(?:start|serve)\b[^;&|\n]*\s--no-open(?:\s|$)/.test(
      command
    )
  ) {
    problems.push('Docusaurus start/serve command is missing --no-open');
  }

  if (
    /\blive-server\b/.test(command) &&
    !/\s--no-browser(?:\s|$)/.test(command)
  ) {
    problems.push('live-server command is missing --no-browser');
  }

  if (/(?:^|\s)--open(?:[=\s]|$)/.test(command)) {
    problems.push('command uses the browser-opening --open flag');
  }

  for (const match of command.matchAll(/(?:^|\s)BROWSER\s*=\s*([^\s;&|]+)/g)) {
    const value = match[1].replace(/^['"]|['"]$/g, '').toLowerCase();

    if (value !== 'none') {
      problems.push(`BROWSER must be none, not ${match[1]}`);
    }
  }

  return problems;
}

export function inspectFile(relativePath, contents) {
  const violations = [];

  if (PACKAGE_FILE.test(relativePath)) {
    let packageJson;

    try {
      packageJson = JSON.parse(contents);
    } catch (error) {
      return [`${relativePath}: invalid JSON: ${error.message}`];
    }

    for (const [name, command] of Object.entries(packageJson.scripts ?? {})) {
      for (const problem of inspectCommand(command)) {
        violations.push(`${relativePath} script ${name}: ${problem}`);
      }
    }
  } else if (JUST_FILE.test(relativePath)) {
    for (const [index, line] of contents.split('\n').entries()) {
      for (const problem of inspectCommand(line)) {
        violations.push(`${relativePath}:${index + 1}: ${problem}`);
      }
    }
  } else if (
    SERVER_CONFIG_FILE.test(relativePath) &&
    /\bopen\s*:\s*true\b/.test(contents)
  ) {
    violations.push(`${relativePath}: server open must be false, not true`);
  }

  return violations;
}

async function* walk(directory, root = directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && IGNORED_DIRECTORIES.has(entry.name)) continue;

    const absolutePath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      yield* walk(absolutePath, root);
    } else if (entry.isFile()) {
      yield path.relative(root, absolutePath);
    }
  }
}

export async function checkRoot(root) {
  const violations = [];

  for await (const relativePath of walk(root)) {
    if (
      !PACKAGE_FILE.test(relativePath) &&
      !JUST_FILE.test(relativePath) &&
      !SERVER_CONFIG_FILE.test(relativePath)
    ) {
      continue;
    }

    const contents = await readFile(path.join(root, relativePath), 'utf8');
    violations.push(...inspectFile(relativePath, contents));
  }

  return violations;
}

const invokedPath = process.argv[1] && path.resolve(process.argv[1]);

if (invokedPath === fileURLToPath(import.meta.url)) {
  const root = path.resolve(process.argv[2] ?? process.cwd());
  const violations = await checkRoot(root);

  if (violations.length > 0) {
    console.error('Browser auto-open guard failed:');

    for (const violation of violations) console.error(`- ${violation}`);
    process.exitCode = 1;
  } else {
    console.log('Browser auto-open guard passed');
  }
}
