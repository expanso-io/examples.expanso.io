import { createHash } from 'node:crypto';
import { readdir, readFile, stat } from 'node:fs/promises';
import { resolve, relative } from 'node:path';

export function sha256(value: string | Buffer): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

export async function sha256File(path: string): Promise<string> {
  return sha256(await readFile(path));
}

export async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, 'utf8')) as T;
}

export async function findContentFiles(root: string): Promise<string[]> {
  return findFiles(root, (name) => /\.mdx?$/.test(name));
}

export async function findFiles(
  root: string,
  matches: (name: string, absolutePath: string) => boolean
): Promise<string[]> {
  const absoluteRoot = resolve(root);
  const rootStat = await stat(absoluteRoot);
  if (rootStat.isFile()) {
    if (
      !matches(absoluteRoot.split('/').at(-1) ?? absoluteRoot, absoluteRoot)
    ) {
      throw new Error(
        `Input file does not match the requested contract: ${root}`
      );
    }
    return [absoluteRoot];
  }

  const files: string[] = [];
  async function walk(directory: string): Promise<void> {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) {
        await walk(path);
      } else if (entry.isFile() && matches(entry.name, path)) {
        files.push(path);
      }
    }
  }
  await walk(absoluteRoot);
  return files;
}

export function repositoryPath(repositoryRoot: string, path: string): string {
  return relative(resolve(repositoryRoot), resolve(path)).replaceAll('\\', '/');
}

export function parseArguments(argv: string[]): Map<string, string> {
  const values = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!argument.startsWith('--')) {
      throw new Error(`Unexpected positional argument: ${argument}`);
    }
    const name = argument.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) {
      throw new Error(`Missing value for --${name}`);
    }
    values.set(name, value);
    index += 1;
  }
  return values;
}

export function requireArgument(
  values: Map<string, string>,
  name: string,
  fallback?: string
): string {
  const value = values.get(name) ?? fallback;
  if (!value) {
    throw new Error(`Missing required --${name}`);
  }
  return value;
}
