import { join } from 'node:path';
import { expect, test, type Locator, type Page } from '@playwright/test';

const snapshotStyle = join(
  process.cwd(),
  'tests/quality/visual-regression/visual-regression.css'
);
const transformationRoute = '/data-security/remove-pii/explorer';
const architectureRoute = '/data-routing/content-routing/explorer';
const themes = ['light', 'dark'] as const;

const screenshotOptions = {
  animations: 'disabled' as const,
  caret: 'hide' as const,
  maxDiffPixels: 0,
  scale: 'css' as const,
  stylePath: snapshotStyle,
  threshold: 0.1,
};

async function visitStable(
  page: Page,
  route: string,
  theme: (typeof themes)[number]
): Promise<void> {
  await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
  await page.addInitScript(
    (nextTheme) => window.localStorage.setItem('theme', nextTheme),
    theme
  );
  await page.goto(route, { waitUntil: 'networkidle' });
  await page.addStyleTag({ path: snapshotStyle });
  await page.evaluate(async () => {
    await document.fonts.ready;
    window.scrollTo({ left: 0, top: 0, behavior: 'instant' });
  });

  await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
  await expect
    .poll(() => page.evaluate(() => document.fonts.status))
    .toBe('loaded');
  await expect(page.locator('main')).toBeVisible();
}

async function expectExplorerCentered(explorer: Locator): Promise<void> {
  const alignment = await explorer.evaluate((element) => {
    const parent = element.parentElement;
    if (parent === null) throw new Error('Explorer has no layout parent');
    const explorerBounds = element.getBoundingClientRect();
    const parentBounds = parent.getBoundingClientRect();
    return {
      delta: Math.abs(
        explorerBounds.left -
          parentBounds.left -
          (parentBounds.right - explorerBounds.right)
      ),
      explorerCenter: explorerBounds.left + explorerBounds.width / 2,
      parentCenter: parentBounds.left + parentBounds.width / 2,
    };
  });

  expect(
    alignment.delta,
    `Explorer center ${alignment.explorerCenter}px must match its content-column center ${alignment.parentCenter}px`
  ).toBeLessThanOrEqual(1);
}

function explorer(page: Page): Locator {
  return page.locator('[data-explorer-version="2"]');
}

async function selectSecondStage(root: Locator): Promise<void> {
  const compactSelector = root.getByLabel('Stage', { exact: true });
  if (await compactSelector.isVisible()) {
    await compactSelector.selectOption({ index: 1 });
    return;
  }
  await root.getByRole('button', { name: /Stage 2 of/ }).click();
}

for (const theme of themes) {
  test(`catalog filtered results - ${theme}`, async ({ page }) => {
    await visitStable(page, '/?type=scenario&source=db2', theme);
    const catalog = page.locator('section').filter({
      has: page.getByRole('heading', {
        level: 2,
        name: 'Choose by constraint',
      }),
    });

    await expect(catalog).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Scenario architectures' })
    ).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByText('1 example', { exact: true })).toBeVisible();
    await expect(catalog).toHaveScreenshot(
      `catalog-filtered-${theme}.png`,
      screenshotOptions
    );
  });

  test(`transformation Explorer full comparison - ${theme}`, async ({
    page,
  }) => {
    await visitStable(page, transformationRoute, theme);
    const root = explorer(page);

    await expect(root).toHaveAttribute('data-comparison-mode', 'diff');
    await expect(root.getByLabel('Changes only')).not.toBeChecked();
    await expectExplorerCentered(root);
    await expect(root).toHaveScreenshot(
      `explorer-transformation-full-${theme}.png`,
      screenshotOptions
    );
  });

  test(`transformation Explorer changes-only state - ${theme}`, async ({
    page,
  }) => {
    await visitStable(page, transformationRoute, theme);
    const root = explorer(page);

    await selectSecondStage(root);
    await root.getByLabel('Changes only').check();
    await expect(page).toHaveURL(/stage=delete-payment-data/);
    await expect(page).toHaveURL(/view=changes/);
    await expectExplorerCentered(root);
    await expect(root).toHaveScreenshot(
      `explorer-transformation-changes-${theme}.png`,
      screenshotOptions
    );
  });

  test(`architecture Explorer full comparison - ${theme}`, async ({ page }) => {
    await visitStable(page, architectureRoute, theme);
    const root = explorer(page);

    await expect(root).toHaveAttribute('data-comparison-mode', 'highlights');
    await expect(root.getByLabel('Highlights only')).not.toBeChecked();
    await expect(root).not.toContainText('Architecture only');
    await expectExplorerCentered(root);
    await expect(root).toHaveScreenshot(
      `explorer-architecture-full-${theme}.png`,
      screenshotOptions
    );
  });

  test(`architecture Explorer highlights-only state - ${theme}`, async ({
    page,
  }) => {
    await visitStable(page, architectureRoute, theme);
    const root = explorer(page);

    await selectSecondStage(root);
    await root.getByLabel('Highlights only').check();
    await expect(page).toHaveURL(/view=highlights/);
    await expect(root).toContainText(
      'Authored emphasis only—not a computed diff.'
    );
    await expectExplorerCentered(root);
    await expect(root).toHaveScreenshot(
      `explorer-architecture-highlights-${theme}.png`,
      screenshotOptions
    );
  });
}
