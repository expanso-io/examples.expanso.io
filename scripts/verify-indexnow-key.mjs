import {readdir, readFile} from 'node:fs/promises';
import path from 'node:path';

const args = process.argv.slice(2);
const valueFor = (flag) => {
  const index = args.indexOf(flag);
  return index === -1 ? undefined : args[index + 1];
};

const sourceDir = valueFor('--source-dir');
const buildDir = valueFor('--build-dir');
const productionBase = valueFor('--production');

if (!sourceDir) {
  throw new Error('--source-dir is required');
}

const candidates = [];
for (const entry of await readdir(sourceDir, {withFileTypes: true})) {
  if (!entry.isFile() || !entry.name.endsWith('.txt')) continue;
  const stem = entry.name.slice(0, -4);
  if (!/^[A-Za-z0-9-]{8,128}$/.test(stem)) continue;
  const bytes = await readFile(path.join(sourceDir, entry.name));
  if (bytes.equals(Buffer.from(stem, 'utf8'))) {
    candidates.push({fileName: entry.name, keyBytes: bytes});
  }
}

if (candidates.length !== 1) {
  throw new Error('Expected exactly one valid IndexNow protocol verification file');
}

const [{fileName, keyBytes}] = candidates;

if (buildDir) {
  const builtBytes = await readFile(path.join(buildDir, fileName));
  if (!builtBytes.equals(keyBytes)) {
    throw new Error('Built IndexNow protocol file does not match source bytes');
  }
  console.log('Built IndexNow protocol bytes verified.');
}

if (productionBase) {
  const target = new URL(fileName, productionBase.endsWith('/') ? productionBase : `${productionBase}/`);
  let lastError;
  for (let attempt = 1; attempt <= 20; attempt += 1) {
    try {
      const response = await fetch(target, {cache: 'no-store'});
      const liveBytes = Buffer.from(await response.arrayBuffer());
      if (response.status === 200 && liveBytes.equals(keyBytes)) {
        console.log('Production IndexNow protocol bytes verified.');
        lastError = undefined;
        break;
      }
      lastError = new Error('Production response did not match exact source bytes');
    } catch (error) {
      lastError = error;
    }
    if (attempt < 20) {
      await new Promise((resolve) => setTimeout(resolve, 10_000));
    }
  }
  if (lastError) throw lastError;
}

if (!buildDir && !productionBase) {
  console.log('Source IndexNow protocol bytes verified.');
}

