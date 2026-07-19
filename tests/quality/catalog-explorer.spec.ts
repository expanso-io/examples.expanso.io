import { expect, test, type Page } from '@playwright/test';

import { PUBLIC_CATALOG } from '../../src/catalog/registry';
import { GOAL_FACETS } from '../../src/catalog/schema';

function relativeLuminance(color: string): number {
  const channels = color.startsWith('#')
    ? color
        .slice(1)
        .match(/.{2}/g)
        ?.map((channel) => Number.parseInt(channel, 16))
    : color
        .match(/[\d.]+/g)
        ?.slice(0, 3)
        .map(Number);
  if (channels === undefined || channels.length !== 3) {
    throw new Error(`Expected an rgb color, received ${color}`);
  }

  const [red, green, blue] = channels.map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.04045
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrastRatio(foreground: string, background: string): number {
  const luminances = [
    relativeLuminance(foreground),
    relativeLuminance(background),
  ].sort((left, right) => right - left);
  return (luminances[0] + 0.05) / (luminances[1] + 0.05);
}

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
  test('uses specific example names throughout the sidebar', async ({
    page,
  }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const mobileNavigation = page.getByRole('button', {
      name: 'Toggle navigation bar',
    });
    if (await mobileNavigation.isVisible()) {
      await mobileNavigation.click();
    }

    const menu = page.locator('.theme-doc-sidebar-menu');
    for (const goal of GOAL_FACETS) {
      const category = menu.getByRole('button', {
        name: goal.label,
        exact: true,
      });
      if ((await category.getAttribute('aria-expanded')) !== 'true') {
        await category.click();
      }
    }

    await expect(
      menu.getByRole('link', { name: 'Overview', exact: true })
    ).toHaveCount(0);

    for (const record of PUBLIC_CATALOG.records.filter(
      ({ status }) => status === 'published'
    )) {
      await expect(
        menu.getByRole('link', { name: record.title, exact: true })
      ).toHaveCount(1);
    }
  });

  test('keeps featured entry points readable without link underlines in dark mode', async ({
    page,
  }) => {
    await page.addInitScript(() =>
      window.localStorage.setItem('theme', 'dark')
    );
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const featuredLinks = page
      .getByRole('region', { name: 'Three useful entry points' })
      .getByRole('link');
    await expect(featuredLinks).toHaveCount(3);

    const presentation = await featuredLinks.evaluateAll((links) =>
      links.map((link) => {
        const goal = link.querySelector('span');
        const title = link.querySelector('strong');
        const outcome = title?.nextElementSibling;
        if (goal === null || title === null || outcome === null) {
          throw new Error('Featured entry point is missing display text');
        }
        return {
          background: getComputedStyle(document.documentElement)
            .getPropertyValue('--ifm-background-color')
            .trim(),
          decoration: getComputedStyle(link).textDecorationLine,
          goal: getComputedStyle(goal).color,
          title: getComputedStyle(title).color,
          outcome: getComputedStyle(outcome).color,
        };
      })
    );

    for (const entry of presentation) {
      expect(entry.decoration).toBe('none');
      expect(
        contrastRatio(entry.goal, entry.background)
      ).toBeGreaterThanOrEqual(7);
      expect(
        contrastRatio(entry.title, entry.background)
      ).toBeGreaterThanOrEqual(7);
      expect(
        contrastRatio(entry.outcome, entry.background)
      ).toBeGreaterThanOrEqual(7);
    }
  });

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
