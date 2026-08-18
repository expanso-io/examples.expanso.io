import { expect, test, type Page } from '@playwright/test';

async function openCatalogDisclosure(
  page: Page,
  label: 'Filters' | 'More filters'
): Promise<void> {
  const summary = page
    .locator('details > summary')
    .filter({ hasText: new RegExp(`^${label}`) })
    .first();
  const disclosure = summary.locator('..');

  if (!(await disclosure.evaluate((element) => element.hasAttribute('open')))) {
    await summary.click();
  }
}

test.describe('catalog explorer', () => {
  test('restores normalized facets without putting search text in the URL', async ({
    page,
  }) => {
    await page.goto('/?goal=secure-data,unknown');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await openCatalogDisclosure(page, 'Filters');
    await expect(
      page
        .locator('[aria-label="Catalog filters"]')
        .getByRole('button', { name: 'Protect data', exact: true })
    ).toHaveAttribute('aria-pressed', 'true');
    await expect(
      page
        .getByRole('status')
        .filter({ hasText: 'Ignored unknown catalog filter' })
    ).toContainText('Ignored unknown catalog filter: goal=unknown.');

    await page
      .getByRole('searchbox', { name: 'Search examples' })
      .fill('schema');
    await expect(page.getByText('1 example', { exact: true })).toBeVisible();
    await expect(page).toHaveURL(/goal=secure-data$/);
    await expect(page).not.toHaveURL(/schema/);

    await page.evaluate(() => {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          writeText: (value: string) => {
            (
              window as typeof window & { __copiedCatalogUrl?: string }
            ).__copiedCatalogUrl = value;
            return Promise.resolve();
          },
        },
      });
    });
    await page.getByRole('button', { name: 'Share results' }).click();
    await expect(
      page.getByRole('status').filter({ hasText: 'Search text was omitted.' })
    ).toContainText('Search text was omitted.');
    const copied = await page.evaluate(
      () =>
        (window as typeof window & { __copiedCatalogUrl?: string })
          .__copiedCatalogUrl
    );
    expect(copied).toMatch(/\?goal=secure-data$/);
    expect(copied).not.toContain('schema');

    await page.getByRole('button', { name: 'Clear filters' }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByText('26 examples', { exact: true })).toBeVisible();
  });

  test('filters by execution status and preserves mobile containment', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await openCatalogDisclosure(page, 'Filters');
    await page.getByRole('button', { name: 'Runs offline' }).click();
    await expect(page).toHaveURL(/status=offline-runnable/);
    await expect(page.getByText('1 example', { exact: true })).toBeVisible();
    await expect(
      page.getByRole('link', { name: /Remove PII/ }).first()
    ).toBeVisible();

    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test('supports portfolio, topology and evidence facets with privacy-safe events', async ({
    page,
  }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => {
      (window as typeof window & { dataLayer?: unknown[] }).dataLayer = [];
    });

    await page.getByRole('button', { name: 'Scenario architectures' }).click();
    await expect(page).toHaveURL(/type=scenario/);

    await openCatalogDisclosure(page, 'Filters');
    await openCatalogDisclosure(page, 'More filters');
    await page.getByRole('button', { name: 'IBM Db2' }).click();
    await expect(page).toHaveURL(/source=db2/);
    await expect(
      page.getByRole('link', { name: 'DB2 to BigQuery', exact: true }).first()
    ).toBeVisible();
    await expect(
      page.getByText('Advanced', { exact: true }).first()
    ).toBeVisible();

    await page
      .getByRole('searchbox', { name: 'Search examples' })
      .fill('BigQuery private phrase');
    await page.waitForTimeout(450);

    const events = await page.evaluate(
      () =>
        (window as typeof window & { dataLayer?: unknown[] }).dataLayer ?? []
    );
    const serializedEvents = JSON.stringify(events);
    expect(serializedEvents).toContain('example_filter_change');
    expect(serializedEvents).toContain('example_search');
    expect(serializedEvents).toContain('query_length');
    expect(serializedEvents).not.toContain('BigQuery private phrase');
  });

  test('records run-local and related-example clicks at authored interaction sites', async ({
    page,
  }) => {
    await page.goto('/data-security/remove-pii/');
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => {
      (window as typeof window & { dataLayer?: unknown[] }).dataLayer = [];
    });
    await page.getByRole('link', { name: 'Review the inputs' }).click();
    await expect(page).toHaveURL(/remove-pii\/setup/);
    let events = await page.evaluate(
      () =>
        (window as typeof window & { dataLayer?: unknown[] }).dataLayer ?? []
    );
    expect(JSON.stringify(events)).toContain('run_local_click');

    await page.goto('/enterprise-migration/db2-to-bigquery/');
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => {
      (window as typeof window & { dataLayer?: unknown[] }).dataLayer = [];
    });
    await page
      .locator('#related-examples + p, #related-examples + ul')
      .getByRole('link')
      .first()
      .click();
    events = await page.evaluate(
      () =>
        (window as typeof window & { dataLayer?: unknown[] }).dataLayer ?? []
    );
    expect(JSON.stringify(events)).toContain('related_example_click');
  });
});
