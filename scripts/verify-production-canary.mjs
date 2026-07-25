import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const EMAIL_PROTECTION =
  /<a href="\/cdn-cgi\/l\/email-protection" class="__cf_email__" data-cfemail="([0-9a-f]+)">\[email&#160;protected\]<\/a>/g;
const EMAIL_DECODER =
  /<script data-cfasync="false" src="\/cdn-cgi\/scripts\/([0-9a-f]{8})\/cloudflare-static\/email-decode\.min\.js"><\/script>/g;
const CHALLENGE_START = '<script>(function(){function c(){';
const CHALLENGE_DOCUMENT_EXPRESSIONS = [
  'a.contentDocument||a.contentWindow.document',
  'a.contentDocument||(a.contentWindow&&a.contentWindow.document)',
];

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function decodeCloudflareEmail(encoded) {
  if (encoded.length < 4 || encoded.length % 2 !== 0) {
    throw new Error('invalid Cloudflare email-protection payload');
  }
  const key = Number.parseInt(encoded.slice(0, 2), 16);
  const decoded = Buffer.alloc((encoded.length - 2) / 2);
  for (let offset = 2; offset < encoded.length; offset += 2) {
    decoded[(offset - 2) / 2] =
      Number.parseInt(encoded.slice(offset, offset + 2), 16) ^ key;
  }
  const email = decoded.toString('utf8');
  if (!/^[^\s@"<>]+@[^\s@"<>]+\.[^\s@"<>]+$/.test(email)) {
    throw new Error(
      'decoded Cloudflare email-protection payload is not an email'
    );
  }
  return email;
}

function expectedChallengeScript(ray, timestamp, documentExpression) {
  return `<script>(function(){function c(){var b=${documentExpression};if(b){var d=b.createElement('script');d.innerHTML="window.__CF$cv$params={r:'${ray}',t:'${timestamp}'};var a=document.createElement('script');a.src='/cdn-cgi/challenge-platform/scripts/jsd/main.js';document.getElementsByTagName('head')[0].appendChild(a);";b.getElementsByTagName('head')[0].appendChild(d)}}if(document.body){var a=document.createElement('iframe');a.height=1;a.width=1;a.style.position='absolute';a.style.top=0;a.style.left=0;a.style.border='none';a.style.visibility='hidden';document.body.appendChild(a);if('loading'!==document.readyState)c();else if(window.addEventListener)document.addEventListener('DOMContentLoaded',c);else{var e=document.onreadystatechange||function(){};document.onreadystatechange=function(b){e(b);'loading'!==document.readyState&&(document.onreadystatechange=e,c())}}}})();</script>`;
}

function removeCloudflareChallenge(html) {
  const bodyIndex = html.lastIndexOf('</body>');
  const challengeIndex = html.lastIndexOf(CHALLENGE_START, bodyIndex);
  if (challengeIndex === -1) return { html, count: 0 };

  const candidate = html.slice(challengeIndex, bodyIndex);
  const identity = candidate.match(
    /window\.__CF\$cv\$params=\{r:'([0-9a-f]{16})',t:'([A-Za-z0-9+/]+={0,2})'\};/
  );
  const expectedCandidates = identity
    ? CHALLENGE_DOCUMENT_EXPRESSIONS.map((documentExpression) =>
        expectedChallengeScript(identity[1], identity[2], documentExpression)
      )
    : [];
  if (!identity || !expectedCandidates.includes(candidate)) {
    throw new Error('unrecognized Cloudflare challenge transformation');
  }
  if (html.indexOf(CHALLENGE_START) !== challengeIndex) {
    throw new Error('multiple Cloudflare challenge transformations');
  }
  return {
    html: `${html.slice(0, challengeIndex)}${html.slice(bodyIndex)}`,
    count: 1,
  };
}

export function normalizeCloudflareHtml(observedBytes) {
  let html = Buffer.from(observedBytes).toString('utf8');
  let emailCount = 0;
  html = html.replace(EMAIL_PROTECTION, (_, encoded) => {
    emailCount += 1;
    return decodeCloudflareEmail(encoded);
  });

  let decoderCount = 0;
  html = html.replace(EMAIL_DECODER, () => {
    decoderCount += 1;
    return '';
  });
  if (emailCount > 0 !== (decoderCount === 1)) {
    throw new Error('incomplete Cloudflare email-protection transformation');
  }

  const challenge = removeCloudflareChallenge(html);
  return {
    bytes: Buffer.from(challenge.html),
    transformations: {
      cloudflareChallengeScripts: challenge.count,
      cloudflareEmailAddresses: emailCount,
      cloudflareEmailDecoderScripts: decoderCount,
    },
  };
}

export function verifyCanaryEntry({ expected, expectedBytes, observedBytes }) {
  const raw = {
    bytes: observedBytes.byteLength,
    sha256: sha256(observedBytes),
  };
  let normalizedBytes = observedBytes;
  let transformations = {
    cloudflareChallengeScripts: 0,
    cloudflareEmailAddresses: 0,
    cloudflareEmailDecoderScripts: 0,
  };
  if (
    expected.artifactPath.endsWith('.html') &&
    !observedBytes.equals(expectedBytes)
  ) {
    const normalized = normalizeCloudflareHtml(observedBytes);
    normalizedBytes = normalized.bytes;
    transformations = normalized.transformations;
  }

  const normalized = {
    bytes: normalizedBytes.byteLength,
    sha256: sha256(normalizedBytes),
  };
  if (
    expected.bytes !== expectedBytes.byteLength ||
    expected.sha256 !== sha256(expectedBytes)
  ) {
    throw new Error(
      `admitted artifact does not match manifest: ${expected.route}`
    );
  }
  if (!normalizedBytes.equals(expectedBytes)) {
    throw new Error(
      `production bytes do not match admitted artifact: ${expected.route}`
    );
  }
  return {
    route: expected.route,
    artifactPath: expected.artifactPath,
    raw,
    normalized,
    expectedBytes: expected.bytes,
    expectedSha256: expected.sha256,
    transformations,
  };
}

const OBSERVED_PATHS = new Map([
  ['/', 'home.html'],
  ['/data-security/remove-pii/', 'remove-pii.html'],
  ['/data-security/remove-pii/explorer/', 'remove-pii-explorer.html'],
  ['/data-routing/content-routing/explorer/', 'content-routing-explorer.html'],
  ['/sitemap.xml', 'sitemap.xml'],
  ['/version.json', 'version.json'],
]);

function argument(name) {
  const index = process.argv.indexOf(name);
  if (index === -1 || !process.argv[index + 1])
    throw new Error(`missing ${name}`);
  return process.argv[index + 1];
}

function main() {
  const manifestPath = argument('--manifest');
  const manifestBytes = readFileSync(manifestPath);
  const manifest = JSON.parse(manifestBytes.toString('utf8'));
  const expectedRoot = argument('--expected-root');
  const observedRoot = argument('--observed-root');
  const subject = JSON.parse(
    readFileSync(join(expectedRoot, 'release-subject.json'), 'utf8')
  );
  if (sha256(manifestBytes) !== subject.canaryManifestSha256) {
    throw new Error(
      'deployed canary manifest is not bound to admitted subject'
    );
  }
  if (
    manifest.manifestVersion !== 'release-canary-manifest-v1' ||
    manifest.repository !== process.env.GITHUB_REPOSITORY ||
    manifest.subjectSha !== process.env.SUBJECT_SHA ||
    !Array.isArray(manifest.routes)
  ) {
    throw new Error('deployed canary manifest identity mismatch');
  }

  const remaining = new Map(OBSERVED_PATHS);
  const files = manifest.routes.map((expected) => {
    const observedPath = remaining.get(expected.route);
    if (!observedPath)
      throw new Error(`unexpected canary route: ${expected.route}`);
    remaining.delete(expected.route);
    return verifyCanaryEntry({
      expected,
      expectedBytes: readFileSync(join(expectedRoot, expected.artifactPath)),
      observedBytes: readFileSync(join(observedRoot, observedPath)),
    });
  });
  if (remaining.size !== 0)
    throw new Error('production canary routes are incomplete');

  const result = {
    resultVersion: 'production-canary-v1',
    status: 'PASS',
    releaseScope: 'viewer-facing-site-refresh',
    repository: process.env.GITHUB_REPOSITORY,
    subjectSha: process.env.SUBJECT_SHA,
    foundationRunId: process.env.FOUNDATION_RUN_ID,
    foundationRunAttempt: Number(process.env.FOUNDATION_RUN_ATTEMPT),
    releaseRunId: process.env.GITHUB_RUN_ID,
    releaseRunAttempt: Number(process.env.GITHUB_RUN_ATTEMPT),
    baseUrl: process.env.BASE_URL,
    files,
  };
  writeFileSync(argument('--output'), `${JSON.stringify(result, null, 2)}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
