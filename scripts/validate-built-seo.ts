import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const buildRoot = resolve('build');
const sitemapPath = resolve(buildRoot, 'sitemap.xml');
const siteOrigin = 'https://examples.expanso.io';

function htmlPath(pathname: string): string {
  const normalized = pathname === '/' ? '' : pathname.replace(/^\/|\/$/g, '');
  return resolve(buildRoot, normalized, 'index.html');
}

function countMatches(source: string, pattern: RegExp): number {
  return [...source.matchAll(pattern)].length;
}

if (!existsSync(sitemapPath)) {
  throw new Error('Built SEO validation requires build/sitemap.xml');
}

const sitemap = readFileSync(sitemapPath, 'utf8');
const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(
  ([, value]) => new URL(value)
);
const failures: string[] = [];
let tagRoutes = 0;

for (const url of urls) {
  if (url.origin !== siteOrigin) {
    failures.push(`${url.href}: sitemap URL has an unexpected origin`);
    continue;
  }
  const path = htmlPath(url.pathname);
  if (!existsSync(path)) {
    failures.push(`${url.pathname}: built HTML is missing`);
    continue;
  }
  const html = readFileSync(path, 'utf8');
  const h1Count = countMatches(html, /<h1\b/gi);
  if (h1Count !== 1) {
    failures.push(`${url.pathname}: expected exactly one H1, got ${h1Count}`);
  }
  if (url.pathname === '/tags/' || url.pathname.startsWith('/tags/')) {
    tagRoutes += 1;
    const descriptions = [
      ...html.matchAll(
        /<meta\b(?=[^>]*\bname="description")(?=[^>]*\bcontent="([^"]+)")[^>]*>/gi
      ),
    ];
    if (descriptions.length !== 1) {
      failures.push(
        `${url.pathname}: expected one nonempty meta description, got ${descriptions.length}`
      );
    }
  }
}

if (tagRoutes === 0) {
  failures.push('Sitemap contains no tag routes');
}
if (failures.length > 0) {
  throw new Error(`Built SEO validation failed:\n${failures.join('\n')}`);
}

process.stdout.write(
  `Built SEO validation PASS: ${urls.length} sitemap routes, ${tagRoutes} tag routes, one H1 per route.\n`
);
