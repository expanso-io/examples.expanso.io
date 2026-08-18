import { expect, test } from '@playwright/test';

import retiredRouteRegistry from '../../content/routes/retired-draft-sources-v1.json';

const explorerRoute = '/data-security/remove-pii/explorer/';
const legacyFixtureRoute = '/files/data-security/remove-pii/sample-data.json';

function withTrailingSlash(path: string): string {
  return path.endsWith('/') ? path : `${path}/`;
}

function requiredSubjectSha(): string {
  const value = process.env.EXPECTED_SUBJECT_SHA;
  if (!value || !/^[a-f0-9]{40}$/.test(value) || /^0+$/.test(value)) {
    throw new Error(
      'Production canary requires a nonzero EXPECTED_SUBJECT_SHA'
    );
  }
  return value;
}

test('production serves the exact release, redirect, canonical, and local assets', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const subjectSha = requiredSubjectSha();
  const browserErrors: string[] = [];
  const failedRequests: string[] = [];

  page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(message.text());
  });
  page.on('pageerror', (error) => browserErrors.push(error.message));
  page.on('requestfailed', (request) => {
    failedRequests.push(
      `${request.method()} ${request.url()}: ${request.failure()?.errorText ?? 'unknown error'}`
    );
  });

  const manifestResponse = await page.request.get(
    `/release-subject.json?subject=${subjectSha}`,
    { failOnStatusCode: true }
  );
  const manifest = (await manifestResponse.json()) as {
    subjectSha?: string;
    artifactContentSha256?: string;
    artifactFileCount?: number;
  };
  expect(manifest.subjectSha).toBe(subjectSha);
  expect(manifest.artifactContentSha256).toMatch(/^[a-f0-9]{64}$/);
  expect(manifest.artifactFileCount).toBeGreaterThan(0);

  const runtimeProofResponse = await page.request.get(
    '/__explorer-runtime-proof/',
    { failOnStatusCode: false, maxRedirects: 0 }
  );
  expect(
    runtimeProofResponse.status(),
    'the test-only runtime proof must not be publicly routable'
  ).toBe(404);

  const redirectResponse = await page.request.get(legacyFixtureRoute, {
    failOnStatusCode: false,
    maxRedirects: 0,
  });
  expect(
    [301, 308],
    'legacy route must use a permanent host redirect'
  ).toContain(redirectResponse.status());
  const redirectLocation = redirectResponse.headers().location;
  expect(
    redirectLocation,
    'legacy redirect must include Location'
  ).toBeTruthy();
  expect(new URL(redirectLocation!, redirectResponse.url()).pathname).toBe(
    explorerRoute
  );

  for (const [index, redirect] of retiredRouteRegistry.entries.entries()) {
    for (const sourcePath of [
      redirect.route,
      withTrailingSlash(redirect.route),
    ]) {
      const probe = `retired-${index + 1}`;
      const sourceUrl = `${sourcePath}?redirect_probe=${probe}`;
      const response = await page.request.get(sourceUrl, {
        failOnStatusCode: false,
        maxRedirects: 0,
      });
      expect(
        [301, 308],
        `${sourceUrl} must use a permanent host redirect`
      ).toContain(response.status());

      const location = response.headers().location;
      expect(location, `${sourceUrl} must include Location`).toBeTruthy();
      const resolvedLocation = new URL(location!, response.url());
      expect(resolvedLocation.pathname, `${sourceUrl} canonical target`).toBe(
        withTrailingSlash(redirect.redirectTarget)
      );
      expect(resolvedLocation.searchParams.get('redirect_probe')).toBe(probe);

      const finalResponse = await page.request.get(
        resolvedLocation.toString(),
        {
          failOnStatusCode: false,
          maxRedirects: 0,
        }
      );
      expect(
        finalResponse.status(),
        `${sourceUrl} must not create a redirect chain`
      ).toBe(200);
    }
  }

  await page.goto(explorerRoute, { waitUntil: 'networkidle' });

  const canonicalHref = await page
    .locator('link[rel="canonical"]')
    .getAttribute('href');
  expect(canonicalHref).toBeTruthy();
  expect(new URL(canonicalHref!).pathname).toBe(explorerRoute);

  const explorer = page.locator('[data-explorer-version="2"]');
  await expect(explorer).toBeVisible();
  await explorer.getByRole('button', { name: /Stage 2 of/ }).click();
  await expect(page).toHaveURL(/stage=delete-payment-data/);
  await explorer.getByLabel('Changes only').check();
  await expect(page).toHaveURL(/view=changes/);
  await expect(
    explorer.getByText('No marked changes in this view.')
  ).toHaveCount(0);

  const html = await page.content();
  for (const privatePattern of [
    new RegExp('/Us' + 'ers/', 'i'),
    new RegExp('second' + '-brain', 'i'),
    /customer(?:Name|Path|Handle|Identity|Volume)/i,
  ]) {
    expect(html).not.toMatch(privatePattern);
  }

  const localAssets = await page
    .locator('script[src], link[rel="stylesheet"][href]')
    .evaluateAll((elements) =>
      elements
        .map((element) =>
          element instanceof HTMLScriptElement
            ? element.src
            : (element as HTMLLinkElement).href
        )
        .filter((value) => new URL(value).origin === window.location.origin)
    );
  expect(localAssets.length).toBeGreaterThan(0);
  for (const asset of [...new Set(localAssets)]) {
    const response = await page.request.get(asset, { failOnStatusCode: true });
    expect((await response.body()).byteLength, asset).toBeGreaterThan(0);
  }

  expect(browserErrors, browserErrors.join('\n')).toEqual([]);
  expect(failedRequests, failedRequests.join('\n')).toEqual([]);
});
