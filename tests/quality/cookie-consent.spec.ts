import AxeBuilder from '@axe-core/playwright';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';

// The config seeds a decline for every other spec, so they never see the
// card. These tests start with no cookies at all.
test.use({ storageState: { cookies: [], origins: [] } });

const CARD = 'section[aria-label="Analytics privacy choices"]';
const wcagTags = ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'];

async function seed(
  context: BrowserContext,
  baseURL: string | undefined,
  cookies: Record<string, string>
): Promise<void> {
  await context.addCookies(
    Object.entries(cookies).map(([name, value]) => ({
      name,
      value,
      url: baseURL!,
    }))
  );
}

async function cookie(page: Page, name: string): Promise<string | undefined> {
  return (await page.context().cookies()).find(
    (candidate) => candidate.name === name
  )?.value;
}

async function open(page: Page): Promise<void> {
  await page.goto('/', { waitUntil: 'networkidle' });
  await expect(page.locator('main')).toBeVisible();
}

// The card renders nothing until the page hydrates, so a missing card proves
// little by itself. Reopening it from the footer proves hydration and shows
// the stored choice. After Escape, only the first-visit card could stay.
async function expectStoredChoice(page: Page, label: string): Promise<void> {
  await page
    .locator('footer')
    .getByRole('button', { name: 'Cookie settings' })
    .click();
  const card = page.locator(CARD);
  await expect(card).toContainText(`Your current choice: ${label}`);
  await page.keyboard.press('Escape');
  await expect(card).toHaveCount(0);
}

test('an undecided visitor in the EU sees the cookieless notice and the privacy link', async ({
  page,
}) => {
  await open(page);
  const card = page.locator(CARD);
  await expect(card).toBeVisible();
  await expect(card).toContainText(
    'Until you accept, we measure anonymously and keep no analytics cookies or data on your device.'
  );
  await expect(card).toContainText('these examples');
  // The privacy policy describes the Scarf pixel; the card does not.
  await expect(card).not.toContainText('Scarf');
  await expect(card.getByRole('link')).toHaveCount(1);
  await expect(
    card.getByRole('link', { name: 'Read our privacy policy' })
  ).toHaveAttribute('href', 'https://expanso.io/privacy');
  await expect(card.getByText('Your current choice')).toHaveCount(0);
  // The first-visit card never takes focus, so Escape leaves it open.
  await page.keyboard.press('Escape');
  await expect(card).toBeVisible();
});

test('an undecided visitor outside the EU is told analytics runs now', async ({
  page,
  context,
  baseURL,
}) => {
  await seed(context, baseURL, { 'expanso-geo': 'row' });
  await open(page);
  await expect(page.locator(CARD)).toContainText(
    'It is running now; decline below to turn it off.'
  );
});

for (const [button, value, label] of [
  ['Accept analytics', 'true', 'Accepted'],
  ['Decline analytics', 'false', 'Declined'],
] as const) {
  test(`${button} records the choice and closes the card`, async ({ page }) => {
    await open(page);
    await page.locator(CARD).getByRole('button', { name: button }).click();
    await expect(page.locator(CARD)).toHaveCount(0);
    expect(await cookie(page, 'expanso-cookie-consent')).toBe(value);
    await page.reload({ waitUntil: 'networkidle' });
    await expect(page.locator('main')).toBeVisible();
    await expect(page.locator(CARD)).toHaveCount(0);
    await expectStoredChoice(page, label);
  });
}

test('closing the card records no choice and keeps it closed on reload', async ({
  page,
}) => {
  await open(page);
  await page.locator(CARD).getByRole('button', { name: 'Close' }).click();
  await expect(page.locator(CARD)).toHaveCount(0);
  expect(await cookie(page, 'expanso-cookie-banner-dismissed')).toBe('1');
  expect(await cookie(page, 'expanso-cookie-consent')).toBeUndefined();
  await page.reload({ waitUntil: 'networkidle' });
  await expect(page.locator('main')).toBeVisible();
  await expect(page.locator(CARD)).toHaveCount(0);
  await expectStoredChoice(page, 'Undecided');
});

test('Cookie settings reopens the card with the current choice, and Escape closes it', async ({
  page,
  context,
  baseURL,
}) => {
  await seed(context, baseURL, { 'expanso-cookie-consent': 'false' });
  await open(page);
  await expect(page.locator(CARD)).toHaveCount(0);
  const settings = page
    .locator('footer')
    .getByRole('button', { name: 'Cookie settings' });
  await settings.click();
  const card = page.locator(CARD);
  await expect(card).toBeVisible();
  await expect(card).toContainText('Your current choice: Declined');
  await page.keyboard.press('Escape');
  await expect(card).toHaveCount(0);
  await expect(settings).toBeFocused();
  expect(await cookie(page, 'expanso-cookie-consent')).toBe('false');
  // A new choice from the reopened card replaces the old one.
  await settings.click();
  await card.getByRole('button', { name: 'Accept analytics' }).click();
  await expect(card).toHaveCount(0);
  expect(await cookie(page, 'expanso-cookie-consent')).toBe('true');
});

test('a visitor who accepted on another Expanso site never sees the card', async ({
  page,
  context,
  baseURL,
}) => {
  await seed(context, baseURL, { 'expanso-cookie-consent': 'true' });
  await open(page);
  await expect(page.locator(CARD)).toHaveCount(0);
  await expectStoredChoice(page, 'Accepted');
});

test('the open card and the footer control have no accessibility violations', async ({
  page,
}) => {
  await open(page);
  await expect(page.locator(CARD)).toBeVisible();
  const result = await new AxeBuilder({ page })
    .include(CARD)
    .include('footer')
    .withTags(wcagTags)
    .analyze();
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual(
    []
  );
});

test.describe('on a 320 px wide phone', () => {
  test.use({ viewport: { width: 320, height: 568 } });

  test('the open card keeps its buttons inside it and adds no side scroll', async ({
    page,
  }) => {
    await open(page);
    const card = page.locator(CARD);
    await expect(card).toBeVisible();
    const box = (await card.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(320);
    for (const name of ['Decline analytics', 'Accept analytics', 'Close']) {
      const button = (await card.getByRole('button', { name }).boundingBox())!;
      expect(button.x, name).toBeGreaterThanOrEqual(box.x);
      expect(button.y, name).toBeGreaterThanOrEqual(box.y);
      expect(button.x + button.width, name).toBeLessThanOrEqual(
        box.x + box.width
      );
      expect(button.y + button.height, name).toBeLessThanOrEqual(
        box.y + box.height
      );
    }
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth)
    ).toBeLessThanOrEqual(320);
  });
});
