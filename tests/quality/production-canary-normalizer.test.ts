import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { describe, it } from 'node:test';

import {
  normalizeCloudflareHtml,
  verifyCanaryEntry,
} from '../../scripts/verify-production-canary.mjs';

const challenge = `<script>(function(){function c(){var b=a.contentDocument||a.contentWindow.document;if(b){var d=b.createElement('script');d.innerHTML="window.__CF$cv$params={r:'a20414a3ae9cccb8',t:'MTc4NDkwODIyNw=='};var a=document.createElement('script');a.src='/cdn-cgi/challenge-platform/scripts/jsd/main.js';document.getElementsByTagName('head')[0].appendChild(a);";b.getElementsByTagName('head')[0].appendChild(d)}}if(document.body){var a=document.createElement('iframe');a.height=1;a.width=1;a.style.position='absolute';a.style.top=0;a.style.left=0;a.style.border='none';a.style.visibility='hidden';document.body.appendChild(a);if('loading'!==document.readyState)c();else if(window.addEventListener)document.addEventListener('DOMContentLoaded',c);else{var e=document.onreadystatechange||function(){};document.onreadystatechange=function(b){e(b);'loading'!==document.readyState&&(document.onreadystatechange=e,c())}}}})();</script>`;
const expectedHtml = Buffer.from(
  '<html><body>support@example.com</body></html>'
);
const expected = {
  route: '/',
  artifactPath: 'index.html',
  bytes: expectedHtml.byteLength,
  sha256: createHash('sha256').update(expectedHtml).digest('hex'),
};

describe('production canary Cloudflare normalization', () => {
  it('accepts admitted bytes without normalization', () => {
    const result = verifyCanaryEntry({
      expected,
      expectedBytes: expectedHtml,
      observedBytes: expectedHtml,
    });
    assert.equal(result.raw.sha256, expected.sha256);
    assert.equal(result.transformations.cloudflareChallengeScripts, 0);
  });

  it('strictly removes the Cloudflare JS-detection tail', () => {
    const result = verifyCanaryEntry({
      expected,
      expectedBytes: expectedHtml,
      observedBytes: Buffer.from(
        `<html><body>support@example.com${challenge}</body></html>`
      ),
    });
    assert.equal(result.normalized.sha256, expected.sha256);
    assert.equal(result.transformations.cloudflareChallengeScripts, 1);
  });

  it('reverses Cloudflare email protection before exact comparison', () => {
    const observed = Buffer.from(
      '<html><body><a href="/cdn-cgi/l/email-protection" class="__cf_email__" data-cfemail="4f3c3a3f3f203d3b0f2a372e223f232a612c2022">[email&#160;protected]</a>' +
        '<script data-cfasync="false" src="/cdn-cgi/scripts/5c5dd728/cloudflare-static/email-decode.min.js"></script>' +
        `${challenge}</body></html>`
    );
    const normalized = normalizeCloudflareHtml(observed);
    assert.deepEqual(normalized.bytes, expectedHtml);
    assert.deepEqual(normalized.transformations, {
      cloudflareChallengeScripts: 1,
      cloudflareEmailAddresses: 1,
      cloudflareEmailDecoderScripts: 1,
    });
  });

  it('rejects unrecognized production drift', () => {
    const observed = Buffer.from(
      `<html><body>tampered<script src="/other.js"></script>${challenge}</body></html>`
    );
    assert.throws(
      () =>
        verifyCanaryEntry({
          expected,
          expectedBytes: expectedHtml,
          observedBytes: observed,
        }),
      /production bytes do not match admitted artifact/
    );
  });

  it('rejects a lookalike Cloudflare challenge', () => {
    const observed = Buffer.from(
      `<html><body>support@example.com${challenge.replace('/jsd/main.js', '/jsd/other.js')}</body></html>`
    );
    assert.throws(
      () => normalizeCloudflareHtml(observed),
      /unrecognized Cloudflare challenge transformation/
    );
  });

  it('rejects incomplete email protection', () => {
    const observed = Buffer.from(
      '<html><body><a href="/cdn-cgi/l/email-protection" class="__cf_email__" data-cfemail="4f3c3a3f3f203d3b0f2a372e223f232a612c2022">[email&#160;protected]</a></body></html>'
    );
    assert.throws(
      () => normalizeCloudflareHtml(observed),
      /incomplete Cloudflare email-protection transformation/
    );
  });
});
