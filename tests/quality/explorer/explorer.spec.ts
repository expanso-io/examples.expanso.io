import { readFile } from 'node:fs/promises';
import { expect, test, type Locator } from '@playwright/test';

interface ExplorerAnalyticsEvent {
  event?: string;
  event_schema_version?: string;
  example_id?: string;
  execution_status?: string;
  operational_evidence?: string;
  stage_id?: string;
  navigation_method?: string;
  view?: string;
  scope?: string;
}

declare global {
  interface Window {
    __copiedExplorerValue?: string;
    dataLayer?: ExplorerAnalyticsEvent[];
  }
}

const route = '/data-security/remove-pii/explorer';

const architectureRoutes = [
  '/data-routing/content-routing/explorer',
  '/data-transformation/parse-logs/explorer',
  '/integrations/splunk-edge-processing/explorer',
] as const;

function stageSelector(explorer: Locator): Locator {
  return explorer.getByRole('combobox', { name: 'Stage', exact: true });
}

async function usesCompactStageSelector(explorer: Locator): Promise<boolean> {
  return stageSelector(explorer).isVisible();
}

async function selectStage(explorer: Locator, index: number): Promise<void> {
  if (await usesCompactStageSelector(explorer)) {
    await stageSelector(explorer).selectOption({ index });

    return;
  }

  await explorer
    .getByRole('button', { name: new RegExp(`Stage ${index + 1} of`) })
    .click();
}

async function expectCurrentStage(
  explorer: Locator,
  index: number
): Promise<void> {
  if (await usesCompactStageSelector(explorer)) {
    await expect
      .poll(() =>
        stageSelector(explorer).evaluate(
          (selector: HTMLSelectElement) => selector.selectedIndex
        )
      )
      .toBe(index);

    return;
  }

  await expect(explorer.locator('[aria-current="step"]')).toHaveAccessibleName(
    new RegExp(`Stage ${index + 1} of`)
  );
}

test.beforeEach(async ({ page }) => {
  await page.goto(route, { waitUntil: 'networkidle' });
  await expect(page.locator('[data-explorer-version="2"]')).toBeVisible();
});

test('stage controls expose names and a single current stage', async ({
  page,
}) => {
  const explorer = page.locator('[data-explorer-version="2"]');

  if (await usesCompactStageSelector(explorer)) {
    await expect(stageSelector(explorer)).toHaveAccessibleName('Stage');
  } else {
    const stages = explorer.locator('button[aria-label^="Stage "]');
    await expect(stages.first()).toHaveAccessibleName(/Stage 1 of \d+: .+/);
  }

  await expect(explorer.locator('[aria-current="step"]')).toHaveCount(1);
  await expectCurrentStage(explorer, 0);
  await expect(
    explorer.getByRole('button', { name: 'Previous stage' })
  ).toBeDisabled();
  await expect(
    explorer.getByRole('button', { name: 'Next stage' })
  ).toBeEnabled();
});

test('long stage labels stay inside their own controls', async ({ page }) => {
  const explorer = page.locator('[data-explorer-version="2"]');

  if (await usesCompactStageSelector(explorer)) return;
  const labels = explorer.locator('button[aria-label^="Stage "] strong');
  await expect(labels).toHaveCount(6);

  const bounds = await labels.evaluateAll((elements) =>
    elements.map((label) => {
      const button = label.closest('button')!.getBoundingClientRect();
      const text = document.createRange();
      text.selectNodeContents(label);

      return [...text.getClientRects()].map((rect) => ({
        left: rect.left - button.left,
        right: button.right - rect.right,
      }));
    })
  );

  for (const label of bounds) {
    for (const line of label) {
      expect(line.left).toBeGreaterThanOrEqual(0);
      expect(line.right).toBeGreaterThanOrEqual(0);
    }
  }
});

test('arrow keys change the stage from anywhere on the page except text fields', async ({
  page,
}) => {
  const explorer = page.locator('[data-explorer-version="2"]');

  const target = await explorer.evaluate((element) => {
    const top = element.getBoundingClientRect().top + window.scrollY;

    return Math.max(0, Math.round(top - 24));
  });

  expect(target).toBeGreaterThan(0);
  await page.evaluate((y) => window.scrollTo(0, y), target);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(target);

  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  });
  expect(await page.evaluate(() => document.activeElement?.tagName)).toBe(
    'BODY'
  );
  await page.keyboard.press('ArrowRight');
  await expect(page).toHaveURL(/stage=delete-payment-data/);
  await expectCurrentStage(explorer, 1);
  await page.keyboard.press('ArrowRight');
  await expect(page).toHaveURL(/stage=hash-ip-address/);
  await expectCurrentStage(explorer, 2);
  await page.keyboard.press('ArrowLeft');
  await expect(page).toHaveURL(/stage=delete-payment-data/);
  await expectCurrentStage(explorer, 1);
  await page.waitForTimeout(250);
  expect(await page.evaluate(() => window.scrollY)).toBe(target);

  await page.evaluate(() => {
    const input = document.createElement('input');
    input.type = 'text';
    input.id = 'arrow-key-probe';
    document.body.append(input);
    input.focus({ preventScroll: true });
  });
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(250);
  await expect(page).toHaveURL(/stage=delete-payment-data/);
  await expectCurrentStage(explorer, 1);
  await page.evaluate(() =>
    document.getElementById('arrow-key-probe')?.remove()
  );
});

test('arrow keys scroll a focused YAML panel instead of changing the stage', async ({
  page,
}) => {
  const explorer = page.locator('[data-explorer-version="2"]');
  const pre = explorer.locator('[id$="-yaml-panel"] pre[data-scroll-panel]');
  await pre.evaluate((element: HTMLElement) => {
    element.style.width = '160px';
    element.style.overflowX = 'auto';
    element.style.whiteSpace = 'pre';
    element.focus({ preventScroll: true });
  });
  expect(
    await pre.evaluate((element) => element.scrollWidth > element.clientWidth)
  ).toBe(true);
  expect(await pre.evaluate((element) => element.scrollLeft)).toBe(0);
  expect(await pre.evaluate((el) => document.activeElement === el)).toBe(true);

  await page.keyboard.press('ArrowRight');
  await expect
    .poll(() => pre.evaluate((element) => element.scrollLeft))
    .toBeGreaterThan(0);
  await page.waitForTimeout(250);
  await expect(page).not.toHaveURL(/stage=/);
  await expectCurrentStage(explorer, 0);
});

test('stage history and the change view are shareable and restorable', async ({
  page,
}) => {
  const explorer = page.locator('[data-explorer-version="2"]');
  await selectStage(explorer, 1);
  await explorer.getByLabel('Changes only').check();
  await expect(page).toHaveURL(/stage=delete-payment-data/);
  await expect(page).toHaveURL(/view=changes/);

  await selectStage(explorer, 2);
  await expect(page).toHaveURL(/stage=hash-ip-address/);
  await page.goBack();
  await expectCurrentStage(explorer, 1);
  await expect(explorer.getByLabel('Changes only')).toBeChecked();
});

test('an invalid stage is normalized once without dropping unrelated state', async ({
  page,
}) => {
  await page.goto(`${route}?stage=missing-stage&view=changes&source=test`, {
    waitUntil: 'networkidle',
  });
  await expect(page).toHaveURL(/stage=original-input/);
  await expect(page).toHaveURL(/view=changes/);
  await expect(page).toHaveURL(/source=test/);
  await expectCurrentStage(page.locator('[data-explorer-version="2"]'), 0);
});

test('pipeline and payload actions have explicit scope', async ({ page }) => {
  const explorer = page.locator('[data-explorer-version="2"]');
  await expect(explorer).toHaveAttribute('data-comparison-mode', 'diff');

  const inputCopy = explorer.getByRole('button', {
    name: /Copy input JSON for Original Input/,
  });

  const outputCopy = explorer.getByRole('button', {
    name: /Copy output JSON for Original Input/,
  });

  await expect(outputCopy).toBeVisible();
  await expect(inputCopy).toBeVisible();
  await expect(outputCopy).toBeVisible();

  await explorer.getByText('Copy & download').click();
  await expect(
    explorer.getByRole('button', { name: 'Copy share link' })
  ).toBeVisible();
  await expect(
    explorer.getByRole('button', { name: 'Copy full YAML' })
  ).toBeVisible();
  await expect(
    explorer.getByRole('button', { name: 'Download full YAML' })
  ).toBeVisible();
});

test('semantic colors and the final complete pipeline stay explicit', async ({
  page,
}) => {
  const explorer = page.locator('[data-explorer-version="2"]');

  const fullYaml = await readFile(
    'examples/data-security/remove-pii-complete.yaml',
    'utf8'
  );

  await selectStage(explorer, 1);
  await expect(explorer.getByText('Updated', { exact: true })).toHaveCSS(
    'color',
    'rgb(74, 222, 128)'
  );
  await expect(explorer.getByText('Removed', { exact: true })).toHaveCSS(
    'color',
    'rgb(248, 113, 113)'
  );

  await page.evaluate(() => window.localStorage.setItem('theme', 'light'));
  await page.reload({ waitUntil: 'networkidle' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  const lightExplorer = page.locator('[data-explorer-version="2"]');
  await selectStage(lightExplorer, 1);
  await expect(lightExplorer.getByText('Updated', { exact: true })).toHaveCSS(
    'color',
    'rgb(4, 120, 87)'
  );
  await expect(lightExplorer.getByText('Removed', { exact: true })).toHaveCSS(
    'color',
    'rgb(185, 28, 28)'
  );

  const stageCount = await lightExplorer
    .locator('button[aria-label^="Stage "]')
    .count();

  expect(stageCount).toBeGreaterThan(1);
  await selectStage(lightExplorer, stageCount - 1);

  const yamlPanel = lightExplorer.locator('[id$="-yaml-panel"]');
  await expect(
    yamlPanel.getByText('Complete pipeline', { exact: true })
  ).toBeVisible();
  await expect(yamlPanel.getByText('remove-pii-complete.yaml')).toBeVisible();
  expect(await yamlPanel.locator('pre code').textContent()).toBe(fullYaml);
});

test('copy, share, and download actions preserve exact bytes and announce success', async ({
  page,
}) => {
  const explorer = page.locator('[data-explorer-version="2"]');
  await selectStage(explorer, 1);
  await explorer.getByLabel('Changes only').check();
  const yamlPanel = explorer.locator('[id$="-yaml-panel"]');
  const stageYaml = (await yamlPanel.locator('pre code').textContent()) ?? '';

  const fullYaml = await readFile(
    'examples/data-security/remove-pii-complete.yaml',
    'utf8'
  );

  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: (value: string) => {
          window.__copiedExplorerValue = value;

          return Promise.resolve();
        },
      },
    });
  });

  const menu = explorer.locator('details');
  await explorer.getByText('Copy & download').click();
  await explorer.getByRole('button', { name: 'Copy stage YAML' }).click();
  await expect(explorer.locator('[data-copy-toast]')).toHaveText(
    'Stage YAML copied.'
  );
  await expect
    .poll(() => menu.evaluate((d: HTMLDetailsElement) => d.open))
    .toBe(false);
  expect(await page.evaluate(() => window.__copiedExplorerValue)).toBe(
    stageYaml
  );

  await explorer.getByText('Copy & download').click();
  await explorer.getByRole('button', { name: 'Copy share link' }).click();
  expect(await page.evaluate(() => window.__copiedExplorerValue)).toBe(
    page.url()
  );

  await explorer.getByText('Copy & download').click();

  const [stageDownload] = await Promise.all([
    page.waitForEvent('download'),
    explorer.getByRole('button', { name: 'Download stage YAML' }).click(),
  ]);

  expect(await readFile((await stageDownload.path())!, 'utf8')).toBe(stageYaml);
  await expect
    .poll(() => menu.evaluate((d: HTMLDetailsElement) => d.open))
    .toBe(false);
  const downloadFeedback = explorer.locator('[data-download-feedback]');
  await expect(downloadFeedback).toBeVisible();
  await expect(downloadFeedback).toHaveAttribute('role', 'status');
  await expect(downloadFeedback).toContainText('download started.');

  await explorer.getByText('Copy & download').click();

  const [fullDownload] = await Promise.all([
    page.waitForEvent('download'),
    explorer.getByRole('button', { name: 'Download full YAML' }).click(),
  ]);

  expect(await readFile((await fullDownload.path())!, 'utf8')).toBe(fullYaml);
  await expect(downloadFeedback).toBeVisible();
  await expect(downloadFeedback).toHaveAttribute('role', 'status');
  await expect(downloadFeedback).toHaveText(
    'remove-pii-complete.yaml download started.'
  );
  await expect(explorer.locator('[data-explorer-status]')).toContainText(
    'remove-pii-complete.yaml download started.'
  );
});

test('changing stages keeps the page scroll position', async ({ page }) => {
  const explorer = page.locator('[data-explorer-version="2"]');
  const compact = await usesCompactStageSelector(explorer);

  const target = await explorer.evaluate((element) => {
    const top = element.getBoundingClientRect().top + window.scrollY;

    return Math.max(0, Math.round(top - 24));
  });

  expect(target).toBeGreaterThan(0);
  await page.evaluate((y) => window.scrollTo(0, y), target);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(target);

  if (compact) {
    await stageSelector(explorer).selectOption({ index: 1 });
  } else {
    await explorer.locator('[aria-current="step"]').focus();
    await page.keyboard.press('ArrowRight');
  }

  await expect(page).toHaveURL(/stage=delete-payment-data/);
  await expectCurrentStage(explorer, 1);
  await page.waitForTimeout(250);
  expect(await page.evaluate(() => window.scrollY)).toBe(target);

  await explorer.getByRole('button', { name: 'Next stage' }).click();
  await expect(page).toHaveURL(/stage=hash-ip-address/);
  await expectCurrentStage(explorer, 2);
  await page.waitForTimeout(250);
  expect(await page.evaluate(() => window.scrollY)).toBe(target);

  await explorer.getByRole('button', { name: 'Previous stage' }).click();
  await expect(page).toHaveURL(/stage=delete-payment-data/);
  await page.waitForTimeout(250);
  expect(await page.evaluate(() => window.scrollY)).toBe(target);
});

test('copy actions confirm where the reader clicked and close the menu', async ({
  page,
}) => {
  const explorer = page.locator('[data-explorer-version="2"]');
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: () => Promise.resolve() },
    });
  });
  const menu = explorer.locator('details');
  const summary = explorer.getByText('Copy & download');
  const toast = explorer.locator('[data-copy-toast]');

  await summary.click();
  await explorer.getByRole('button', { name: 'Copy full YAML' }).click();
  await expect
    .poll(() => menu.evaluate((d: HTMLDetailsElement) => d.open))
    .toBe(false);
  await expect
    .poll(() => summary.evaluate((el) => document.activeElement === el))
    .toBe(true);
  await expect(toast).toHaveText('Full YAML copied.');
  const toastBox = await toast.boundingBox();
  const summaryBox = await summary.boundingBox();
  expect(toastBox).not.toBeNull();
  expect(summaryBox).not.toBeNull();
  expect(toastBox!.y).toBeGreaterThanOrEqual(summaryBox!.y);
  expect(toastBox!.y - (summaryBox!.y + summaryBox!.height)).toBeLessThan(48);

  await summary.click();
  await expect(explorer.getByRole('button', { name: 'Copied' })).toBeVisible();
  await expect(
    explorer.getByRole('button', { name: 'Copy full YAML' })
  ).toBeVisible({ timeout: 4_000 });
  await expect(toast).toHaveCount(0);
  await summary.click();

  const inputCopy = explorer.getByRole('button', {
    name: /Copy input JSON for Original Input/,
  });

  const inputFeedback = inputCopy
    .locator('xpath=..')
    .locator('[data-copy-toast]');

  await inputCopy.click();
  await expect(inputCopy).toHaveText('Copied');
  await expect(inputFeedback).toBeVisible();
  await expect(inputFeedback).toHaveAttribute('role', 'status');
  await expect(inputFeedback).toHaveText('Input JSON copied.');
  await expect(
    explorer.getByRole('button', {
      name: /Copy output JSON for Original Input/,
    })
  ).toHaveText('Copy JSON');
});

test('reopening the copy menu hides its trigger toast and permits copying', async ({
  page,
}) => {
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: () => Promise.resolve() },
    });
  });
  const explorer = page.locator('[data-explorer-version="2"]');
  const summary = explorer.getByText('Copy & download');
  const toast = explorer.locator('[data-copy-toast]');

  await summary.click();
  await explorer.getByRole('button', { name: 'Copy full YAML' }).click();
  await expect(toast).toBeVisible();
  await expect(toast).toHaveText('Full YAML copied.');

  await summary.click();
  await expect(toast).toBeHidden();
  await expect(toast).toHaveText('Full YAML copied.');
  await explorer.getByRole('button', { name: 'Copy share link' }).click();
  await expect(toast).toBeVisible();
  await expect(toast).toHaveText('Share link copied.');
  await expect(summary).toBeFocused();
});

test('a failed copy is reported at its control or menu trigger', async ({
  page,
}) => {
  const explorer = page.locator('[data-explorer-version="2"]');
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: () => Promise.reject(new Error('denied')) },
    });
  });
  const yamlPanel = explorer.locator('[id$="-yaml-panel"]');
  const yamlCopy = yamlPanel.locator('button[data-copy-state]');
  await yamlCopy.click();
  await expect(yamlCopy).toHaveText('Copy failed');
  await expect(yamlCopy).toHaveAttribute('data-copy-state', 'error');
  const yamlError = yamlPanel.getByRole('alert');
  await expect(yamlError).toBeVisible();
  await expect(yamlError).toContainText('Could not copy stage yaml');

  const menu = explorer.locator('details');
  const summary = explorer.getByText('Copy & download');
  await summary.click();
  await explorer.getByRole('button', { name: 'Copy stage YAML' }).click();
  await expect
    .poll(() => menu.evaluate((d: HTMLDetailsElement) => d.open))
    .toBe(false);
  await expect(summary).toBeFocused();
  const menuError = explorer.getByRole('alert');
  await expect(menuError).toBeVisible();
  await expect(menuError).toContainText('Could not copy stage yaml');
});

test('Explorer analytics uses only the versioned privacy-safe schema', async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.dataLayer = [];
  });
  await page.reload({ waitUntil: 'networkidle' });
  const explorer = page.locator('[data-explorer-version="2"]');
  await expect(explorer).toBeVisible();
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: () => Promise.resolve() },
    });
  });

  const navigationMethod = (await usesCompactStageSelector(explorer))
    ? 'select'
    : 'click';

  await selectStage(explorer, 1);
  await explorer.getByLabel('Changes only').check();
  await explorer.getByText('Copy & download').click();
  await explorer.getByRole('button', { name: 'Copy stage YAML' }).click();
  await explorer.getByText('Copy & download').click();
  await explorer.getByRole('button', { name: 'Copy share link' }).click();
  await explorer.getByText('Copy & download').click();

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    explorer.getByRole('button', { name: 'Download full YAML' }).click(),
  ]);

  await download.cancel();

  const events = await page.evaluate(() => window.dataLayer ?? []);

  const publicEvents = events.filter((event) =>
    [
      'example_view',
      'explorer_stage_view',
      'explorer_view_toggle',
      'pipeline_copy',
      'pipeline_download',
      'explorer_share',
    ].includes(String(event.event))
  );

  const expectedEvents = [
    {
      event: 'example_view',
      event_schema_version: '1.0.0',
      example_id: 'remove-pii',
      execution_status: 'offline-runnable',
      operational_evidence: 'not-assessed',
    },
    {
      event: 'explorer_stage_view',
      event_schema_version: '1.0.0',
      example_id: 'remove-pii',
      stage_id: 'delete-payment-data',
      navigation_method: navigationMethod,
    },
    {
      event: 'explorer_view_toggle',
      event_schema_version: '1.0.0',
      example_id: 'remove-pii',
      view: 'changes',
    },
    {
      event: 'pipeline_copy',
      event_schema_version: '1.0.0',
      example_id: 'remove-pii',
      stage_id: 'delete-payment-data',
      scope: 'stage',
    },
    {
      event: 'explorer_share',
      event_schema_version: '1.0.0',
      example_id: 'remove-pii',
      stage_id: 'delete-payment-data',
    },
    {
      event: 'pipeline_download',
      event_schema_version: '1.0.0',
      example_id: 'remove-pii',
      stage_id: 'delete-payment-data',
      scope: 'full',
    },
  ];

  for (const expectedEvent of expectedEvents) {
    const matching = publicEvents.filter(
      (event) => event.event === expectedEvent.event
    );

    expect(matching.length).toBeGreaterThan(0);
    expect(matching.at(-1)).toEqual(expectedEvent);
  }

  const serialized = JSON.stringify(publicEvents);
  expect(serialized).not.toContain('filename');
  expect(serialized).not.toContain('root =');
  expect(serialized).not.toContain('http_server');
});

test('mobile keeps both payloads and YAML visible without internal vertical scrolling', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 });
  const explorer = page.locator('[data-explorer-version="2"]');
  await expect(stageSelector(explorer)).toBeVisible();
  await expect(
    explorer.getByRole('button', { name: 'Previous stage' })
  ).toBeVisible();
  await expect(
    explorer.getByRole('button', { name: 'Next stage' })
  ).toBeVisible();
  await expect(explorer.locator('[id$="-input-panel"]')).toBeVisible();
  await expect(explorer.locator('[id$="-output-panel"]')).toBeVisible();
  await expect(explorer.locator('[id$="-yaml-panel"] pre code')).toBeVisible();

  const verticallyScrollablePanels = await explorer
    .locator('[class*="dataScroll"], [id$="-yaml-panel"] pre')
    .evaluateAll(
      (panels) =>
        panels.filter((panel) => panel.scrollHeight > panel.clientHeight + 1)
          .length
    );

  expect(verticallyScrollablePanels).toBe(0);

  const pageOverflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth
  );

  expect(pageOverflow).toBeLessThanOrEqual(0);
});

test('payloads and YAML remain visible across the responsive breakpoint', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1024, height: 900 });
  const explorer = page.locator('[data-explorer-version="2"]');

  await expect(explorer.getByRole('tablist')).toHaveCount(0);
  await expect(explorer.locator('[role="tabpanel"]')).toHaveCount(0);
  await expect(explorer.locator('[id$="-input-panel"]')).toBeVisible();
  await expect(explorer.locator('[id$="-output-panel"]')).toBeVisible();

  await page.setViewportSize({ width: 1023, height: 900 });
  await expect(explorer.getByRole('tablist')).toHaveCount(0);
  await expect(explorer.locator('[role="tabpanel"]')).toHaveCount(0);
  await expect(explorer.locator('[id$="-input-panel"]')).toBeVisible();
  await expect(explorer.locator('[id$="-output-panel"]')).toBeVisible();
  await expect(explorer.locator('[id$="-yaml-panel"] pre code')).toBeVisible();
});

test('Explorer interface text stays at or above the 14px floor', async ({
  page,
}) => {
  const explorer = page.locator('[data-explorer-version="2"]');
  await expect(explorer).toBeVisible();

  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 820, height: 1180 },
    { width: 390, height: 844 },
    { width: 320, height: 800 },
  ]) {
    await page.setViewportSize(viewport);

    const undersized = await explorer.evaluate((root) => {
      const results = [];

      for (const element of root.querySelectorAll<HTMLElement>('*')) {
        const hasText = [...element.childNodes].some(
          (node) =>
            node.nodeType === Node.TEXT_NODE &&
            Boolean(node.textContent?.trim())
        );

        if (!hasText) continue;

        const bounds = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        const fontSize = Number.parseFloat(style.fontSize);

        const visible =
          bounds.width > 1 &&
          bounds.height > 1 &&
          style.display !== 'none' &&
          style.visibility !== 'hidden';

        if (!visible || fontSize >= 14) continue;

        results.push({
          text: element.textContent?.trim().replace(/\s+/g, ' ').slice(0, 80),
          tag: element.tagName.toLowerCase(),
          className: element.className,
          fontSize,
          visible,
        });
      }

      return results;
    });

    expect(
      undersized,
      `${route} has interface text below 14px at ${viewport.width}px`
    ).toEqual([]);
  }
});

test.describe('architecture Explorer rollout', () => {
  for (const architectureRoute of architectureRoutes) {
    test(`keeps ${architectureRoute} interactive without claiming runtime evidence`, async ({
      page,
    }) => {
      await page.goto(architectureRoute, { waitUntil: 'networkidle' });

      const explorer = page.locator(
        '[data-explorer-version="2"][data-provenance="curated-explanation"]'
      );

      await expect(explorer).toBeVisible();
      await expect(explorer).not.toContainText('Architecture only');
      await expect(explorer).not.toContainText('Not assessed');
      await expect(explorer).toContainText(
        'Authored emphasis only—not a computed diff.'
      );
      await expect(explorer).toHaveAttribute(
        'data-comparison-mode',
        'highlights'
      );
      await expect(explorer).not.toHaveAttribute('data-verification-id', /.+/);

      const stages = explorer.locator('button[aria-label^="Stage "]');
      const stageCount = await stages.count();
      expect(stageCount).toBeGreaterThan(1);
      await selectStage(explorer, 1);
      await expect(page).toHaveURL(/[?&]stage=[a-z0-9-]+/);

      await explorer.getByLabel('Highlights only').check();
      await expect(page).toHaveURL(/[?&]view=highlights/);

      if (architectureRoute.includes('content-routing')) {
        await expect(
          explorer.getByRole('button', {
            name: /Copy output route map/i,
          })
        ).toBeVisible();
      }

      await explorer.getByText('Copy & download').click();
      await expect(
        explorer.getByRole('button', { name: 'Copy share link' })
      ).toBeVisible();
      await expect(
        explorer.getByRole('button', { name: 'Copy stage YAML' })
      ).toBeVisible();
      await expect(
        explorer.getByRole('button', { name: 'Download stage YAML' })
      ).toBeVisible();
    });
  }
});
