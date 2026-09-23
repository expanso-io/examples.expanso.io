import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
const m = JSON.parse(readFileSync('.docusaurus/client-manifest.json', 'utf8'));
const files = new Set();
for (const e of m.entrypoints)
  for (const o of m.origins[e] ?? [e])
    for (const a of m.assets[String(o)].js ?? []) files.add(a.file);
let t = 0;
for (const f of files) {
  const n = gzipSync(readFileSync('build/' + f.replace(/^\//, '')), { level: 9 }).length;
  t += n;
  console.log(f, n);
}
console.log('TOTAL', t, 'budget', 184320);
