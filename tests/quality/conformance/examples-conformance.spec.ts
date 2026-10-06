import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';

import { EXAMPLE_RECORDS } from '../../../src/catalog/registry';

const published = EXAMPLE_RECORDS.filter(
  (record) => record.status === 'published'
);

const themes = ['dark', 'light'] as const;

test.setTimeout(180_000);

test.describe.configure({ mode: 'parallel' });

async function visitOverview(page: Page, route: string): Promise<Locator> {
  await page.goto(route, { waitUntil: 'networkidle' });
  const explorer = page.locator('[data-explorer-version="2"]');
  await expect(explorer).toBeVisible();

  return explorer;
}

async function useTheme(
  page: Page,
  theme: (typeof themes)[number]
): Promise<void> {
  await page.emulateMedia({ colorScheme: theme });
  await page.evaluate(
    (nextTheme) => window.localStorage.setItem('theme', nextTheme),
    theme
  );
  await page.reload({ waitUntil: 'networkidle' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
}

async function expectNoContrastViolations(page: Page): Promise<void> {
  const result = await new AxeBuilder({ page })
    .include('main')
    .withRules(['color-contrast'])
    .analyze();

  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual(
    []
  );
}

async function expectOrdered(elements: Locator[]): Promise<void> {
  const ordered = await Promise.all(
    elements.map((element) =>
      element.evaluate((node) => {
        const walker = document.createTreeWalker(
          document,
          NodeFilter.SHOW_ELEMENT
        );

        let index = 0;

        while (walker.nextNode()) {
          if (walker.currentNode === node) return index;
          index += 1;
        }

        return -1;
      })
    )
  );

  expect(ordered).toEqual([...ordered].sort((left, right) => left - right));
  expect(ordered.every((index) => index >= 0)).toBe(true);
}

async function openActionMenu(explorer: Locator): Promise<Locator> {
  const menu = explorer.locator('details').filter({
    has: explorer.getByText('Copy & download', { exact: true }),
  });

  if (!(await menu.evaluate((node: HTMLDetailsElement) => node.open))) {
    await menu.locator('summary').click();
  }

  return menu;
}

async function expectDirectCopyFeedback(
  button: Locator,
  expectedKind: 'success' | 'error'
): Promise<void> {
  await expect(button).toHaveAttribute('data-copy-state', expectedKind);
  const anchor = button.locator('xpath=..');
  const role = expectedKind === 'success' ? 'status' : 'alert';
  await expect(anchor.getByRole(role)).toBeVisible();
}

test('the conformance inventory is the complete 26-example class', () => {
  expect(published).toHaveLength(26);
  expect(new Set(published.map(({ id }) => id))).toHaveProperty('size', 26);
});

for (const record of published) {
  test(`${record.id}: template, stages, keyboard, and action feedback`, async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText: () => Promise.resolve() },
      });
    });
    const explorer = await visitOverview(page, record.routes.overview);

    const explanation = page.locator(
      '[data-example-template-section="explanation"]'
    );

    const guide = page.locator('[data-explorer-guide]');

    const runDeploy = page.locator(
      '[data-example-template-section="run-deploy"]'
    );

    await expect(explanation).toBeVisible();
    await expect(explanation.getByRole('heading', { level: 1 })).toHaveText(
      record.title
    );
    await expect(
      explanation.getByRole('navigation', { name: 'Example actions' })
    ).toBeVisible();
    await expect(guide).toBeVisible();
    await expect(runDeploy).toBeVisible();
    await expect(runDeploy.getByRole('heading', { level: 2 })).toHaveText(
      'Run and deploy'
    );
    await expectOrdered([explanation, guide, explorer, runDeploy]);

    const stages = explorer.locator('button[aria-label^="Stage "]');
    expect(await stages.count()).toBeGreaterThan(1);
    await expect(explorer.locator('[aria-current="step"]')).toHaveCount(1);
    await expect(explorer.locator('[id$="-input-panel"]')).toContainText(/\S/);
    await expect(explorer.locator('[id$="-output-panel"]')).toContainText(/\S/);
    await expect(
      explorer.locator('[id$="-yaml-panel"] pre code')
    ).toContainText(/\S/);

    const targetScroll = await explorer.evaluate((element) =>
      Math.max(
        0,
        Math.round(element.getBoundingClientRect().top + scrollY - 24)
      )
    );

    expect(targetScroll).toBeGreaterThan(0);
    await page.evaluate((y) => scrollTo(0, y), targetScroll);
    await expect.poll(() => page.evaluate(() => scrollY)).toBe(targetScroll);

    const initialStage = await explorer
      .locator('[aria-current="step"]')
      .getAttribute('aria-label');

    await page.evaluate(() => {
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    });
    await page.keyboard.press('ArrowRight');
    await expect(explorer.locator('[aria-current="step"]')).not.toHaveAttribute(
      'aria-label',
      initialStage ?? ''
    );
    await page.waitForTimeout(250);
    expect(await page.evaluate(() => scrollY)).toBe(targetScroll);

    for (const label of [/Copy input/i, /Copy output/i, /^Copy YAML$/i]) {
      const button = explorer.getByRole('button', { name: label }).first();
      await button.click();
      await expectDirectCopyFeedback(button, 'success');
    }

    for (const label of [
      'Copy share link',
      'Copy stage YAML',
      'Copy full YAML',
    ]) {
      const menu = await openActionMenu(explorer);
      const button = menu.getByRole('button', { name: label });

      if ((await button.count()) === 0) continue;
      await button.click();
      const feedback = menu.locator('xpath=..').locator('[data-copy-toast]');
      await expect(feedback).toBeVisible();
      await expect(feedback).toContainText(/copied/i);
    }

    for (const label of ['Download stage YAML', 'Download full YAML']) {
      const menu = await openActionMenu(explorer);
      const button = menu.getByRole('button', { name: label });

      if ((await button.count()) === 0) continue;

      const [download] = await Promise.all([
        page.waitForEvent('download'),
        button.click(),
      ]);

      await download.cancel();

      const feedback = menu
        .locator('xpath=..')
        .locator('[data-download-feedback]');

      await expect(feedback).toBeVisible();
      await expect(feedback).toHaveAttribute('data-kind', 'success');
    }

    await page.evaluate(() => {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          writeText: () => Promise.reject(new Error('clipboard denied')),
        },
      });
    });
    const failedCopy = explorer.getByRole('button', { name: /Copy input/i });
    await failedCopy.click();
    await expectDirectCopyFeedback(failedCopy, 'error');

    await page.evaluate(() => {
      Object.defineProperty(URL, 'createObjectURL', {
        configurable: true,
        value: () => {
          throw new Error('download denied');
        },
      });
    });
    const menu = await openActionMenu(explorer);
    await menu.getByRole('button', { name: 'Download stage YAML' }).click();

    const failedDownload = menu
      .locator('xpath=..')
      .locator('[data-download-feedback]');

    await expect(failedDownload).toBeVisible();
    await expect(failedDownload).toHaveAttribute('data-kind', 'error');
  });

  test(`${record.id}: WCAG AA contrast and 320px reflow`, async ({ page }) => {
    test.setTimeout(180_000);
    await visitOverview(page, record.routes.overview);

    for (const theme of themes) {
      await useTheme(page, theme);
      await expect(page.locator('[data-explorer-version="2"]')).toBeVisible();
      await expectNoContrastViolations(page);
    }

    await page.setViewportSize({ width: 320, height: 800 });
    await page.reload({ waitUntil: 'networkidle' });

    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth
    );

    expect(overflow).toBeLessThanOrEqual(0);
    await expect(page.locator('[id$="-input-panel"]')).toBeVisible();
    await expect(page.locator('[id$="-output-panel"]')).toBeVisible();
  });
}
