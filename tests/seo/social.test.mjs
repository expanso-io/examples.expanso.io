import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { validateSocialHtml } from '../../scripts/social-validation.mjs';
import socialModule from '../../plugins/social-discovery.ts';
import breadcrumbsModule from '../../src/lib/socialBreadcrumbs.ts';
const { cardSvg, escapeXml, wrap } = socialModule;
const { socialBreadcrumbs } = breadcrumbsModule;

const head = `<meta property="og:image" content="https://examples.expanso.io/card.png"><meta name="twitter:image" content="https://examples.expanso.io/card.png"><meta name="twitter:card" content="summary_large_image"><meta property="og:image:alt" content="Title"><meta name="twitter:image:alt" content="Title"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">`;
test('missing images, incorrect dimensions, duplicate tags and mismatched destinations fail', () => {
  mkdirSync(resolve('.docusaurus'), { recursive: true });
  const root = mkdtempSync(resolve('.docusaurus/seo-test-'));
  try {
    assert.throws(() => validateSocialHtml(head, root), /missing/);
    const png = Buffer.alloc(24);
    Buffer.from('89504e470d0a1a0a', 'hex').copy(png);
    png.writeUInt32BE(1200, 16);
    png.writeUInt32BE(630, 20);
    writeFileSync(join(root, 'card.png'), png);
    assert.ok(validateSocialHtml(head, root));
    assert.throws(() =>
      validateSocialHtml(
        head + '<meta property="og:image" content="duplicate">',
        root
      )
    );
    assert.throws(() =>
      validateSocialHtml(
        head.replace(
          'name="twitter:image" content="https://examples.expanso.io/card.png"',
          'name="twitter:image" content="https://example.org/other.png"'
        ),
        root
      )
    );
    png.writeUInt32BE(600, 16);
    writeFileSync(join(root, 'card.png'), png);
    assert.throws(() => validateSocialHtml(head, root));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
test('card text is escaped and wraps on word boundaries', () => {
  assert.equal(escapeXml('<script>"&'), '&lt;script&gt;&quot;&amp;');
  assert.deepEqual(wrap('one two three', 7), ['one two', 'three']);
  assert.ok(cardSvg('A < B', 'Use X & Y', '').includes('A &lt; B'));
});

test('metadata follows catalog hierarchy and rejects incomplete document metadata', async () => {
  const makePlugin = socialModule.default;
  let data;
  const plugin = makePlugin({ siteDir: process.cwd() });
  const load = (docs) =>
    plugin.allContentLoaded({
      allContent: {
        'docusaurus-plugin-content-docs': {
          default: { loadedVersions: [{ docs }] },
        },
      },
      actions: {
        setGlobalData: (value) => {
          data = value;
        },
      },
    });
  await load([
    {
      permalink: '/data-transformation/deduplicate-events/troubleshooting',
      title: 'Troubleshooting',
      description: 'Diagnose duplicate events.',
      tags: [],
    },
  ]);
  const metadata =
    data['/data-transformation/deduplicate-events/troubleshooting/'];
  assert.equal(metadata.title, 'Deduplicate Events Troubleshooting');
  for (const page of Object.values(data)) {
    assert.equal(Object.hasOwn(page, 'summary'), false);
  }
  const crumbs = (pathname) => socialBreadcrumbs(pathname, data[pathname]);
  assert.deepEqual(crumbs('/tags/'), [
    { name: 'Examples', item: 'https://examples.expanso.io/' },
    { name: 'Topics', item: 'https://examples.expanso.io/tags/' },
  ]);
  assert.deepEqual(
    crumbs('/data-transformation/deduplicate-events/troubleshooting/'),
    [
      { name: 'Examples', item: 'https://examples.expanso.io/' },
      {
        name: 'Deduplicate Events',
        item: 'https://examples.expanso.io/data-transformation/deduplicate-events/',
      },
      {
        name: metadata.title,
        item: 'https://examples.expanso.io/data-transformation/deduplicate-events/troubleshooting/',
      },
    ]
  );
  await assert.rejects(
    load([{ permalink: '/broken/', title: 'Missing summary' }]),
    /requires title and description/
  );
});
