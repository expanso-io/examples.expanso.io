import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, sep } from 'node:path';

export function validateSocialHtml(html, buildRoot) {
  function meta(attribute, name) {
    const values = [
      ...html.matchAll(
        new RegExp(
          `<meta\\b(?=[^>]*\\b${attribute}="${name}")(?=[^>]*\\bcontent="([^"]*)")[^>]*>`,
          'g'
        )
      ),
    ].map((match) => match[1]);
    assert.equal(values.length, 1, `Expected one ${name}`);
    assert.ok(values[0], `Empty ${name}`);
    return values[0];
  }
  const image = new URL(meta('property', 'og:image'));
  assert.equal(image.origin, 'https://examples.expanso.io');
  assert.equal(meta('name', 'twitter:image'), image.href);
  assert.equal(meta('name', 'twitter:card'), 'summary_large_image');
  meta('property', 'og:image:alt');
  meta('name', 'twitter:image:alt');
  assert.equal(meta('property', 'og:image:width'), '1200');
  assert.equal(meta('property', 'og:image:height'), '630');
  const file = resolve(buildRoot, `.${decodeURIComponent(image.pathname)}`);
  assert.ok(
    file.startsWith(resolve(buildRoot) + sep),
    'Image escapes build root'
  );
  assert.ok(existsSync(file), 'Social image is missing');
  const png = readFileSync(file);
  assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.equal(png.readUInt32BE(16), 1200);
  assert.equal(png.readUInt32BE(20), 630);
  return image.href;
}
