import {mkdir, readdir, readFile, rm, writeFile} from 'node:fs/promises';
import path from 'node:path';

const key = process.env.INDEXNOW_KEY;
const targetRoot = process.argv[2];

if (!targetRoot) {
  throw new Error('Usage: node scripts/materialize-indexnow-key.mjs <public-root>');
}
if (!key || !/^[A-Za-z0-9-]{8,128}$/.test(key)) {
  throw new Error('INDEXNOW_KEY must be 8-128 URL-safe characters');
}

await mkdir(targetRoot, {recursive: true});

for (const entry of await readdir(targetRoot, {withFileTypes: true})) {
  if (!entry.isFile() || !entry.name.endsWith('.txt')) continue;
  const stem = entry.name.slice(0, -4);
  if (!/^[A-Za-z0-9-]{8,128}$/.test(stem)) continue;
  const candidatePath = path.join(targetRoot, entry.name);
  if ((await readFile(candidatePath, 'utf8')) === stem) {
    await rm(candidatePath);
  }
}

await writeFile(path.join(targetRoot, `${key}.txt`), key, {
  encoding: 'utf8',
  mode: 0o644,
});
console.log('IndexNow protocol verification file materialized.');
