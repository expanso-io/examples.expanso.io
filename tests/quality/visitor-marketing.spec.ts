import { expect, test } from '@playwright/test';
import { isAnalyticsHost } from '../../scripts/analytics-tags';

test.use({ storageState: { cookies: [], origins: [] } });

const cookieName = 'expanso-examples-marketing-v1';

const suppliedUrl =
  'https://a.usbrowserspeed.com/cs?pid=ddae2e0bce828a30a7b24f94f87290780f71120eaf9f11353f234c3bd86512d3&puid=%7B%22userId%22%3A%226ad11bf15c45461722106c51%22%2C%22env%22%3A%22prod%22%7D';

const production = process.env.EXPANSO_PRODUCTION_ANALYTICS === '1';

test('separate affirmative consent, one exact request, and withdrawal across reloads', async ({
  page,
  context,
  baseURL,
}) => {
  const requests: string[] = [];
  // Exercise the documented 204 response without contacting marketing vendors.
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());

    if (url.hostname === 'a.usbrowserspeed.com') {
      requests.push(route.request().url());
      await route.fulfill({ status: 204 });
    } else if (isAnalyticsHost(url.hostname)) {
      await route.abort();
    } else {
      await route.continue();
    }
  });
  // Prior analytics acceptance must not grant marketing permission.
  await context.addCookies([
    { name: 'expanso-cookie-consent', value: 'true', url: baseURL! },
  ]);
  await page.goto('/marketing-privacy/');
  await expect(page.getByRole('status')).toHaveText('Marketing off.');
  await page.waitForTimeout(1200);
  expect(requests).toEqual([]);
  await page
    .getByRole('button', { name: 'Allow marketing', exact: true })
    .click();
  await expect(page.getByRole('status')).toHaveText('Marketing allowed.');

  if (production) await expect.poll(() => requests.length).toBe(1);
  await page
    .getByRole('button', { name: 'Allow marketing', exact: true })
    .click();
  await page.evaluate(() => {
    window.dispatchEvent(new Event('focus'));
    window.dispatchEvent(new Event('pageshow'));
  });
  await page.waitForTimeout(1200);
  expect(requests).toEqual(production ? [suppliedUrl] : []);
  await page
    .getByRole('button', { name: 'Decline marketing', exact: true })
    .click();
  await expect(page.getByRole('status')).toHaveText('Marketing off.');
  await page.reload();
  await expect(page.getByRole('status')).toHaveText('Marketing off.');
  await page.waitForTimeout(1200);
  expect(requests).toEqual(production ? [suppliedUrl] : []);
  expect(
    (await context.cookies()).find((cookie) => cookie.name === cookieName)
      ?.value
  ).toBe('no');
});

test('GPC blocks a saved opt-in and disables acceptance', async ({
  page,
  context,
  baseURL,
}) => {
  const requests: string[] = [];
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'globalPrivacyControl', { value: true });
  });
  await context.addCookies([{ name: cookieName, value: 'yes', url: baseURL! }]);
  await page.route('**/*', async (route) => {
    const host = new URL(route.request().url()).hostname;

    if (host === 'a.usbrowserspeed.com') requests.push(route.request().url());

    if (isAnalyticsHost(host)) await route.abort();
    else await route.continue();
  });
  await page.goto('/marketing-privacy/');
  await expect(page.getByRole('status')).toHaveText(
    'Marketing blocked by your browser privacy signal.'
  );
  await expect(
    page.getByRole('button', { name: 'Allow marketing', exact: true })
  ).toBeDisabled();
  await page.waitForTimeout(1200);
  expect(requests).toEqual([]);
});

test('consent changes in another tab update the display without focus', async ({
  page,
  context,
  baseURL,
}) => {
  const requests: string[] = [];
  await context.route('**/*', async (route) => {
    const host = new URL(route.request().url()).hostname;

    if (host === 'a.usbrowserspeed.com') {
      requests.push(route.request().url());
      await route.fulfill({ status: 204 });
    } else if (isAnalyticsHost(host)) await route.abort();
    else await route.continue();
  });
  await context.addCookies([
    { name: 'expanso-cookie-consent', value: 'false', url: baseURL! },
  ]);
  await page.goto('/marketing-privacy/');
  await expect(page.getByRole('status')).toHaveText('Marketing off.');
  const otherTab = await context.newPage();
  await otherTab.goto('/marketing-privacy/');
  await expect(otherTab.getByRole('status')).toHaveText('Marketing off.');
  const refreshEvents: string[] = [];
  await page.exposeFunction('recordMarketingRefresh', (type: string) => {
    refreshEvents.push(type);
  });
  await page.evaluate(() => {
    const record = (event: Event) => {
      (
        window as Window & {
          recordMarketingRefresh: (type: string) => Promise<void>;
        }
      ).recordMarketingRefresh(event.type);
    };

    window.addEventListener('focus', record);
    window.addEventListener('pageshow', record);
    document.addEventListener('visibilitychange', record);
  });
  await otherTab
    .getByRole('button', { name: 'Allow marketing', exact: true })
    .click();
  await expect(otherTab.getByRole('status')).toHaveText('Marketing allowed.');
  await expect(page.getByRole('status')).toHaveText('Marketing allowed.');
  expect(refreshEvents).toEqual([]);

  if (production) {
    await expect.poll(() => requests.length).toBe(2);
    expect(requests).toEqual([suppliedUrl, suppliedUrl]);
  } else {
    expect(requests).toEqual([]);
  }

  await otherTab
    .getByRole('button', { name: 'Decline marketing', exact: true })
    .click();
  await expect(otherTab.getByRole('status')).toHaveText('Marketing off.');
  await expect(page.getByRole('status')).toHaveText('Marketing off.');
});

test('withdrawal in another tab tears down the loaded document', async ({
  page,
  context,
  baseURL,
}) => {
  test.skip(!production, 'Requires the production delivery build');
  let requests = 0;
  await context.route('**/*', async (route) => {
    const host = new URL(route.request().url()).hostname;

    if (host === 'a.usbrowserspeed.com') {
      requests += 1;
      await route.fulfill({ status: 204 });
    } else if (isAnalyticsHost(host)) await route.abort();
    else await route.continue();
  });
  await context.addCookies([
    { name: cookieName, value: 'yes', url: baseURL! },
    { name: 'expanso-cookie-consent', value: 'false', url: baseURL! },
  ]);
  await page.goto('/marketing-privacy/');
  await expect.poll(() => requests).toBe(1);
  // A change in another tab changes the same host-only cookie, without a same-tab event.
  const otherTab = await context.newPage();
  await otherTab.goto('/marketing-privacy/');
  await expect.poll(() => requests).toBe(2);
  await otherTab
    .getByRole('button', { name: 'Decline marketing', exact: true })
    .click();
  await expect(page.getByRole('status')).toHaveText('Marketing off.');
  await expect(page.locator('#examples-visitor-marketing')).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('status')).toHaveText('Marketing off.');
  expect(requests).toBe(2);
});
