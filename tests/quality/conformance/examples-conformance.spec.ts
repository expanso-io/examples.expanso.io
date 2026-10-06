import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';

import routeLedger from '../../../content/routes/route-dispositions-v1.json';
import { GENERATED_EXPLORER_STAGE_CONFIGS } from '../../../src/catalog/explorerStageConfigs.generated';
import { getCatalogOverviewProjection } from '../../../src/catalog/overviewProjection';
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
    hasText: 'Copy & download',
  });

  if (!(await menu.evaluate((node: HTMLDetailsElement) => node.open))) {
    await menu.locator('summary').click();
  }

  return menu;
}

async function clickWithFreshFeedback(
  button: Locator,
  feedback: Locator
): Promise<void> {
  const previous = await feedback.allTextContents();
  await button.click();
  await expect(feedback).toBeVisible();
  await expect.poll(() => feedback.allTextContents()).not.toEqual(previous);
}

async function expectDirectCopyFeedback(
  button: Locator,
  expectedKind: 'success' | 'error',
  operation: RegExp
): Promise<void> {
  const anchor = button.locator('xpath=..');
  const role = expectedKind === 'success' ? 'status' : 'alert';
  await clickWithFreshFeedback(button, anchor.getByRole(role));
  await expect(button).toHaveAttribute('data-copy-state', expectedKind);
  await expect(anchor.getByRole(role)).toContainText(operation);
}

test('action feedback requires a fresh response to each click', async ({
  page,
}) => {
  await page.setContent(`
    <button onclick="document.querySelector('[role=alert]').textContent = 'Could not copy stage YAML.'">Copy stage YAML</button>
    <button>Copy full YAML</button>
    <p role="alert">Could not copy share link.</p>
  `);
  const feedback = page.getByRole('alert');
  await clickWithFreshFeedback(
    page.getByRole('button', { name: 'Copy stage YAML' }),
    feedback
  );
  await expect(feedback).toHaveText('Could not copy stage YAML.');
  await expect(
    clickWithFreshFeedback(
      page.getByRole('button', { name: 'Copy full YAML' }),
      feedback
    )
  ).rejects.toThrow();
});

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
    const projection = getCatalogOverviewProjection(record.id).header;
    await expect(explanation).toContainText(projection.problem);
    await expect(explanation).toContainText(projection.outcome);
    await expect(guide).toBeVisible();
    await expect(guide).toContainText(/\S/);
    await expect(runDeploy).toBeVisible();
    await expect(runDeploy.getByRole('heading', { level: 2 })).toHaveText(
      'Run and deploy'
    );
    await expectOrdered([explanation, guide, explorer, runDeploy]);

    const family = GENERATED_EXPLORER_STAGE_CONFIGS[record.id];
    expect(family).toBeDefined();
    const stages = explorer.locator('button[aria-label^="Stage "]');
    await expect(stages).toHaveCount(family.stages.length);
    expect(family.stages.length).toBeGreaterThan(1);
    await expect(
      explorer.getByRole('button', { name: 'Previous stage', exact: true })
    ).toBeDisabled();

    const targetScroll = await explorer.evaluate((element) =>
      Math.max(
        0,
        Math.round(element.getBoundingClientRect().top + scrollY - 24)
      )
    );
    expect(targetScroll).toBeGreaterThan(0);
    await page.evaluate((y) => scrollTo(0, y), targetScroll);
    await expect.poll(() => page.evaluate(() => scrollY)).toBe(targetScroll);

    for (const [index, stage] of family.stages.entries()) {
      const current = explorer.locator('[aria-current="step"]');
      await expect(current).toHaveCount(1);
      await expect(stages.nth(index)).toHaveAttribute('aria-current', 'step');
      await expect(explorer.locator('[id$="-stage-panel"] h3')).toHaveText(
        stage.title.replace(/^step\s+\d+\s*:\s*/i, '')
      );
      for (const [panel, lines] of [
        ['input', stage.inputLines],
        ['output', stage.outputLines],
      ] as const) {
        expect(lines.length).toBeGreaterThan(0);
        const renderedLines = explorer.locator(
          '[id$="-' + panel + '-panel"] pre code > span > span:last-child'
        );
        await expect
          .poll(() => renderedLines.allTextContents())
          .toEqual(lines.map(({ content }) => content));
      }
      await expect
        .poll(() =>
          explorer.locator('[id$="-yaml-panel"] pre code').textContent()
        )
        .toBe(
          index === family.stages.length - 1 ? family.fullYaml : stage.yamlCode
        );
      if (index < family.stages.length - 1) {
        await current.evaluate((node: HTMLElement) =>
          node.focus({ preventScroll: true })
        );
        await page.keyboard.press('ArrowRight');
        await expect(stages.nth(index + 1)).toHaveAttribute(
          'aria-current',
          'step'
        );
        await page.waitForTimeout(250);
        expect(await page.evaluate(() => scrollY)).toBe(targetScroll);
      }
    }
    await expect(
      explorer.getByRole('button', { name: 'Next stage', exact: true })
    ).toBeDisabled();
    await explorer
      .getByRole('button', { name: 'Previous stage', exact: true })
      .click();
    await expect(stages.nth(family.stages.length - 2)).toHaveAttribute(
      'aria-current',
      'step'
    );
    await explorer
      .getByRole('button', { name: 'Next stage', exact: true })
      .click();
    await expect(stages.last()).toHaveAttribute('aria-current', 'step');
    await stages.first().click();
    await expect(stages.first()).toHaveAttribute('aria-current', 'step');
    await stages
      .first()
      .evaluate((node: HTMLElement) => node.focus({ preventScroll: true }));
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowLeft');
    await expect(stages.first()).toHaveAttribute('aria-current', 'step');

    for (const [label, operation] of [
      [/Copy input/i, /input /i],
      [/Copy output/i, /output /i],
      [/^Copy YAML$/i, /stage yaml/i],
    ]) {
      const button = explorer.getByRole('button', { name: label }).first();
      await expectDirectCopyFeedback(button, 'success', operation);
    }

    for (const label of [
      'Copy share link',
      'Copy stage YAML',
      'Copy full YAML',
    ]) {
      const menu = await openActionMenu(explorer);
      const button = menu.getByRole('button', { name: label });

      await expect(button).toBeVisible();
      const feedback = menu.locator('xpath=..').locator('[data-copy-toast]');
      await clickWithFreshFeedback(button, feedback);
      await expect(feedback).toHaveAttribute('data-kind', 'success');
      await expect(feedback).toHaveText(
        label
          .replace(/^Copy /, '')
          .replace(/^./, (initial) => initial.toUpperCase()) + ' copied.'
      );
    }

    for (const label of ['Download stage YAML', 'Download full YAML']) {
      const menu = await openActionMenu(explorer);
      const button = menu.getByRole('button', { name: label });

      await expect(button).toBeVisible();

      const feedback = menu
        .locator('xpath=..')
        .locator('[data-download-feedback]');
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        clickWithFreshFeedback(button, feedback),
      ]);

      expect(download.suggestedFilename()).toBe(
        label === 'Download full YAML'
          ? family.fullYamlFilename
          : family.stages[0].yamlFilename
      );
      await download.cancel();

      await expect(feedback).toBeVisible();
      await expect(feedback).toHaveText(
        (label === 'Download full YAML'
          ? family.fullYamlFilename
          : family.stages[0].yamlFilename) + ' download started.'
      );
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
    for (const [label, operation] of [
      [/Copy input/i, /input /i],
      [/Copy output/i, /output /i],
      [/^Copy YAML$/i, /stage yaml/i],
    ]) {
      const button = explorer.getByRole('button', { name: label }).first();
      await expectDirectCopyFeedback(button, 'error', operation);
    }
    for (const label of [
      'Copy share link',
      'Copy stage YAML',
      'Copy full YAML',
    ]) {
      const menu = await openActionMenu(explorer);
      const feedback = menu.locator('xpath=..').locator('[data-copy-toast]');
      await clickWithFreshFeedback(
        menu.getByRole('button', { name: label, exact: true }),
        feedback
      );
      await expect(feedback).toHaveAttribute('data-kind', 'error');
      await expect(feedback).toContainText(
        'Could not copy ' + label.replace(/^Copy /, '').toLowerCase()
      );
    }
    await page.evaluate(() => {
      Object.defineProperty(URL, 'createObjectURL', {
        configurable: true,
        value: () => {
          throw new Error('download denied');
        },
      });
    });
    for (const label of ['Download stage YAML', 'Download full YAML']) {
      const menu = await openActionMenu(explorer);
      const feedback = menu
        .locator('xpath=..')
        .locator('[data-download-feedback]');
      await clickWithFreshFeedback(
        menu.getByRole('button', { name: label, exact: true }),
        feedback
      );
      await expect(feedback).toContainText(
        label === 'Download full YAML'
          ? 'Could not download the full YAML'
          : 'Could not download the stage YAML'
      );
      await expect(feedback).toHaveAttribute('data-kind', 'error');
    }
  });

  test(`${record.id}: preserved actions, sidebar routes, and related examples`, async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await page.goto(record.routes.overview, { waitUntil: 'networkidle' });
    const overviewURL = page.url();
    const actionLinks = page.locator(
      '[aria-label="Example actions"] a, [data-example-template-section="run-deploy"] a'
    );
    expect(await actionLinks.count()).toBeGreaterThanOrEqual(3);
    const destinations = await actionLinks.evaluateAll((links) =>
      links.map((link) => (link as HTMLAnchorElement).href)
    );
    for (const [index, destination] of destinations.entries()) {
      await page.goto(overviewURL, { waitUntil: 'networkidle' });
      await actionLinks.nth(index).click();
      await expect(page).toHaveURL(destination);
      await expect(page.locator('main')).toBeVisible();
      const hash = new URL(destination).hash;
      if (hash)
        await expect(
          page.locator(
            '[id=' + JSON.stringify(decodeURIComponent(hash.slice(1))) + ']'
          )
        ).toBeVisible();
      await expect(page.locator('main')).not.toContainText('Page Not Found');
    }

    const routes = routeLedger.routes.filter(
      (route) =>
        route.familyId === record.id &&
        route.publicationState === 'published' &&
        route.sourceState === 'present'
    );
    expect(routes.length).toBeGreaterThan(1);
    const setupRoute = record.routes.overview.replace(/\/$/, '') + '/setup';
    expect(
      routes.some(({ route }) => route.replace(/\/$/, '') === setupRoute)
    ).toBe(true);
    for (const route of routes) {
      await page.goto(overviewURL, { waitUntil: 'networkidle' });
      const sidebar = page.locator('.theme-doc-sidebar-menu');
      const family = sidebar
        .locator('li.theme-doc-sidebar-item-category')
        .filter({
          has: page.getByRole('link', { name: record.title, exact: true }),
        })
        .last();
      await expect(family).toBeVisible();
      const toggle = family.locator(':scope > div').getByRole('button');
      if ((await toggle.getAttribute('aria-expanded')) !== 'true')
        await toggle.click();
      const destination = new URL(route.route, overviewURL);
      const child = family.locator('a').filter({ hasText: /./ });
      const hrefs = await child.evaluateAll((links) =>
        links.map((link) =>
          (link as HTMLAnchorElement).pathname.replace(/\/$/, '')
        )
      );
      const index = hrefs.indexOf(destination.pathname.replace(/\/$/, ''));
      expect(
        index,
        route.route + ' is reachable in its unfolded family'
      ).toBeGreaterThanOrEqual(0);
      await child.nth(index).click();
      await expect
        .poll(() => new URL(page.url()).pathname.replace(/\/$/, ''))
        .toBe(destination.pathname.replace(/\/$/, ''));
      await expect(page.locator('main')).toBeVisible();
      await expect(page.locator('main')).not.toContainText('Page Not Found');
    }

    await page.goto(overviewURL, { waitUntil: 'networkidle' });
    const related = page.getByRole('heading', {
      name: /^Related examples(?: Direct link to Related examples)?$/,
    });
    await expect(related).toBeVisible();
    const relatedLinks = related
      .locator('xpath=following-sibling::*[1]')
      .getByRole('link');
    expect(await relatedLinks.count()).toBeGreaterThan(0);
    const relatedURL = await relatedLinks
      .first()
      .evaluate((link: HTMLAnchorElement) => link.href);
    expect(
      published.some(
        (example) =>
          new URL(example.routes.overview, overviewURL).pathname.replace(
            /\/$/,
            ''
          ) === new URL(relatedURL).pathname.replace(/\/$/, '')
      )
    ).toBe(true);
    await relatedLinks.first().click();
    await expect(page).toHaveURL(relatedURL);
    await expect(
      page.locator('[data-example-template-section="explanation"]')
    ).toBeVisible();
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
