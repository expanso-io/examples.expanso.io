import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Examine the production HTML that a crawler receives, never source imports or
// hydrated client links. Every sitemap destination must be reachable from home.
const origin = 'https://examples.expanso.io';
const sitemap = readFileSync('build/sitemap.xml', 'utf8');
const routes = new Set(
  [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(
    (match) => new URL(match[1]).pathname
  )
);
assert.ok(routes.size > 0, 'production sitemap is empty');
const graph = new Map<string, Set<string>>();
for (const route of routes) {
  const html = readFileSync(join('build', route, 'index.html'), 'utf8');
  const links = new Set<string>();
  for (const match of html.matchAll(/<a\s[^>]*href="([^"]*)"/g)) {
    const target = new URL(match[1].replaceAll('&amp;', '&'), origin + route);
    const path = target.pathname.endsWith('/')
      ? target.pathname
      : `${target.pathname}/`;
    if (target.origin === origin && routes.has(path)) links.add(path);
  }
  graph.set(route, links);
}
const reachable = new Set(['/']);
const pending = ['/'];
while (pending.length) {
  for (const target of graph.get(pending.pop()!) ?? []) {
    if (!reachable.has(target)) {
      reachable.add(target);
      pending.push(target);
    }
  }
}
const missing = [...routes].filter((route) => !reachable.has(route));
assert.deepEqual(
  missing,
  [],
  `Sitemap pages unreachable via static anchors: ${missing.join(', ')}`
);
console.log(
  `Static navigation: ${reachable.size}/${routes.size} sitemap routes reachable from home.`
);
