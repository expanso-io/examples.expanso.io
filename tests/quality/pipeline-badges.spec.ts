import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const route =
  '/data-routing/content-routing/explorer/?stage=severity-based-routing';

test('labels fragments, links the complete pipeline, and preserves copy feedback', async ({
  context,
  page,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto(route, { waitUntil: 'networkidle' });
  const explorer = page.locator('[data-explorer-version="2"]');
  const fragmentBadge = explorer.locator('[data-pipeline-kind="fragment"]');

  await expect(fragmentBadge).toHaveText('Fragment');
  await expect(fragmentBadge).toHaveAttribute(
    'href',
    '/data-routing/content-routing/complete-content-routing/'
  );

  await explorer.getByRole('button', { name: 'Copy YAML' }).click();
  await expect(explorer.getByRole('status')).toContainText('copied', {
    ignoreCase: true,
  });

  const stages = explorer.locator('[aria-label^="Stage "]');
  await stages.last().click();
  await expect(explorer.locator('[data-pipeline-kind="complete"]')).toHaveText(
    'Complete pipeline'
  );
});

test('badge remains AA-readable without horizontal overflow at 320px', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto(route, { waitUntil: 'networkidle' });

  for (const colorScheme of ['dark', 'light'] as const) {
    await page.emulateMedia({ colorScheme });

    const results = await new AxeBuilder({ page })
      .include('[data-pipeline-kind="fragment"]')
      .withTags(['wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();

    expect(results.violations).toEqual([]);
  }

  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth
  );

  expect(overflow).toBeLessThanOrEqual(1);
});

test('captures the local after state', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(route, { waitUntil: 'networkidle' });
  const badge = page.locator('[data-pipeline-kind="fragment"]').first();
  await badge.scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, -180));
  await page.screenshot({
    path: '.github/screenshots/examples-ci-guard/after.png',
  });
});
