import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const route = '/__explorer-runtime-proof';
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;

if (executablePath) {
  test.use({ launchOptions: { executablePath } });
}

test.beforeEach(async ({ page }) => {
  await page.goto(route, { waitUntil: 'networkidle' });
  await expect(
    page.locator('[data-explorer-version="2"][data-explorer-mode="runtime"]')
  ).toBeVisible();
});

test('steps through deterministic checkpoints and resets exactly', async ({
  page,
}) => {
  const explorer = page.locator('[data-explorer-mode="runtime"]');
  await expect(explorer).toContainText('Not an Expanso execution');

  for (let index = 0; index < 4; index += 1) {
    await explorer.getByRole('button', { name: 'Next event' }).click();
  }
  await expect(explorer.getByTestId('runtime-queue').locator('li')).toHaveText([
    /critical-001critical/,
    /normal-002normal/,
  ]);
  await expect(explorer.locator('[data-result="fail"]')).toHaveCount(0);
  await expect(explorer.locator('[data-result="pass"]')).toHaveCount(1);

  await explorer.getByRole('button', { name: 'Reset simulation' }).click();
  await expect(explorer).toContainText('Checkpoint0 / 6');
  await expect(explorer.getByText('Empty', { exact: true })).toHaveCount(2);
});

test('pause stops replay and resume advances it', async ({ page }) => {
  const explorer = page.locator('[data-explorer-mode="runtime"]');
  await explorer.getByRole('button', { name: 'Replay simulation' }).click();
  await explorer.getByRole('button', { name: 'Pause simulation' }).click();
  await page.waitForTimeout(800);
  await expect(explorer).toContainText('Checkpoint0 / 6');

  await explorer.getByRole('button', { name: 'Resume simulation' }).click();
  await expect(explorer).toContainText('Checkpoint1 / 6', { timeout: 2_000 });
});

test('models link failure, switches scenarios, and never advances past the final checkpoint', async ({
  page,
}) => {
  const explorer = page.locator('[data-explorer-mode="runtime"]');

  await explorer.getByRole('button', { name: 'Next event' }).click();
  await explorer.getByRole('button', { name: 'Next event' }).click();
  await expect(explorer.locator('[data-connection="offline"]')).toBeVisible();
  await expect(explorer.locator('[aria-current="step"]')).toContainText(
    'Modeled link becomes offline'
  );

  await explorer.getByLabel('Scenario').selectOption('steady-link');
  await expect(page).toHaveURL(/scenario=steady-link/);
  await expect(explorer).toContainText('Checkpoint0 / 3');
  await expect(explorer.locator('[data-connection="online"]')).toBeVisible();

  await explorer.getByRole('button', { name: 'Replay simulation' }).click();
  await expect(explorer).toContainText('Checkpoint3 / 3', { timeout: 4_000 });
  await page.waitForTimeout(800);
  await expect(explorer).toContainText('Checkpoint3 / 3');
  await expect(
    explorer.getByRole('button', { name: 'Next event' })
  ).toBeDisabled();
});

test('restores scenario history, normalizes invalid state, and copies the exact share URL', async ({
  page,
}) => {
  const explorer = page.locator('[data-explorer-mode="runtime"]');
  await explorer.getByLabel('Scenario').selectOption('steady-link');
  await expect(page).toHaveURL(/scenario=steady-link/);
  await page.goBack();
  await expect(explorer.getByLabel('Scenario')).toHaveValue('link-drop');
  await expect(page).not.toHaveURL(/scenario=/);

  await page.goto(`${route}?scenario=missing&source=test`, {
    waitUntil: 'networkidle',
  });
  await expect(page).toHaveURL(/scenario=link-drop/);
  await expect(page).toHaveURL(/source=test/);

  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: (value: string) => {
          (
            window as typeof window & { __copiedExplorerUrl?: string }
          ).__copiedExplorerUrl = value;
          return Promise.resolve();
        },
      },
    });
  });
  await explorer.getByRole('button', { name: 'Copy share link' }).click();
  const copied = await page.evaluate(
    () =>
      (window as typeof window & { __copiedExplorerUrl?: string })
        .__copiedExplorerUrl
  );
  expect(copied).toBe(page.url());
  await expect(explorer.getByRole('status')).toContainText(
    'Share link copied.'
  );
});

test('replay finishes at the same asserted checkpoint', async ({ page }) => {
  const explorer = page.locator('[data-explorer-mode="runtime"]');
  await explorer.getByRole('button', { name: 'Replay simulation' }).click();
  await expect(explorer).toContainText('Checkpoint6 / 6', { timeout: 6_000 });
  await expect(explorer.locator('[data-result="fail"]')).toHaveCount(0);
  await expect(
    explorer.getByTestId('runtime-delivered').locator('li')
  ).toHaveText([
    /normal-001direct/,
    /critical-001buffer-replay/,
    /normal-002buffer-replay/,
  ]);
});

test('has no automated WCAG A or AA violations in the initial state', async ({
  page,
}) => {
  const results = await new AxeBuilder({ page })
    .include('[data-explorer-mode="runtime"]')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();

  expect(results.violations).toEqual([]);
});

test('has no automated WCAG A or AA violations after interaction and with evidence expanded', async ({
  page,
}) => {
  const explorer = page.locator('[data-explorer-mode="runtime"]');
  await explorer.getByRole('button', { name: 'Next event' }).click();
  await explorer.getByRole('button', { name: 'Next event' }).click();
  await explorer.getByText('Simulation scope and immutable digests').click();

  const results = await new AxeBuilder({ page })
    .include('[data-explorer-mode="runtime"]')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();

  expect(results.violations).toEqual([]);
});

test('keeps controls usable without page overflow at 320 CSS pixels', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 });
  const explorer = page.locator('[data-explorer-mode="runtime"]');
  const controls = explorer.locator('button, select');
  const undersized = await controls.evaluateAll((elements) =>
    elements
      .map((element) => {
        const bounds = element.getBoundingClientRect();
        return { width: bounds.width, height: bounds.height };
      })
      .filter(({ width, height }) => width < 44 || height < 44)
  );
  expect(undersized).toEqual([]);

  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test('keeps runtime interface text at or above the 14px floor', async ({
  page,
}) => {
  const explorer = page.locator('[data-explorer-version="2"]');

  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 820, height: 1180 },
    { width: 390, height: 844 },
    { width: 320, height: 800 },
  ]) {
    await page.setViewportSize(viewport);
    const undersized = await explorer.evaluate((root) =>
      [...root.querySelectorAll<HTMLElement>('*')]
        .filter((element) =>
          [...element.childNodes].some(
            (node) =>
              node.nodeType === Node.TEXT_NODE &&
              Boolean(node.textContent?.trim())
          )
        )
        .map((element) => {
          const bounds = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          return {
            text: element.textContent?.trim().replace(/\s+/g, ' ').slice(0, 80),
            tag: element.tagName.toLowerCase(),
            className: element.className,
            fontSize: Number.parseFloat(style.fontSize),
            visible:
              bounds.width > 1 &&
              bounds.height > 1 &&
              style.display !== 'none' &&
              style.visibility !== 'hidden',
          };
        })
        .filter(({ fontSize, visible }) => visible && fontSize < 14)
    );

    expect(
      undersized,
      `${route} has interface text below 14px at ${viewport.width}px`
    ).toEqual([]);
  }
});

test('renders zero, malformed, and oversized transformation fixtures as recoverable errors', async ({
  page,
}) => {
  const cases = [
    ['zero', /No stages are available/],
    ['malformed', /stage fixture is invalid/],
    ['oversized', /exceeds the safe inline preview limit/],
  ] as const;

  for (const [fixtureCase, message] of cases) {
    await page.goto(`${route}?case=${fixtureCase}`, {
      waitUntil: 'networkidle',
    });
    const explorer = page.locator(
      '[data-explorer-version="2"][data-explorer-state="unavailable"]'
    );
    await expect(explorer.getByRole('alert')).toContainText(message);
    const results = await new AxeBuilder({ page })
      .include('[data-explorer-state="unavailable"]')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(results.violations).toEqual([]);
  }
});

test('keeps a dense one-stage fixture, long name, and missing full YAML usable', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto(`${route}?case=one`, { waitUntil: 'networkidle' });
  const explorer = page.locator(
    '[data-explorer-version="2"][data-provenance="curated-explanation"]'
  );

  await expect(explorer.locator('[aria-current="step"]')).toHaveCount(1);
  await expect(explorer.locator('[aria-current="step"]')).toContainText(
    'Normalize a deliberately long industrial telemetry stage name'
  );
  await expect(
    explorer.getByRole('button', { name: 'Previous' })
  ).toBeDisabled();
  await expect(explorer.getByRole('button', { name: 'Next' })).toBeDisabled();
  await expect(
    explorer.getByRole('combobox', { name: 'Stage', exact: true })
  ).toBeVisible();
  await explorer.getByText('Copy & download').click();
  await expect(explorer).toContainText(
    'Full pipeline file not included. Stage YAML remains available.'
  );

  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
