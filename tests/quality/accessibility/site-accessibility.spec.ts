import AxeBuilder from '@axe-core/playwright';
import {
  expect,
  test,
  type Browser,
  type Page,
  type TestInfo,
} from '@playwright/test';

import {
  ACCESSIBILITY_OBSERVATION_VERSION,
  loadAccessibilityContract,
  parseAccessibilityRoutes,
  type AccessibilityObservation,
} from '../../../scripts/quality/accessibility-lib';

const contract = loadAccessibilityContract();
const routes = parseAccessibilityRoutes(contract);
const observationAttachment = 'accessibility-observation-v1';
const wcagTags = ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'];
const explorerProofRoute = '/__explorer-runtime-proof/';

test.setTimeout(180_000);

interface ObservationScope {
  environmentIds: string[];
  themes: string[];
  interactionModes?: string[];
  stateIds?: string[];
}

async function recordObservation(
  testInfo: TestInfo,
  browser: Browser,
  oracleId: string,
  routePath: string,
  scope: ObservationScope,
  run: () => Promise<void>
): Promise<string | null> {
  const startedAt = Date.now();
  let status: AccessibilityObservation['status'] = 'PASS';
  const reasons: string[] = [];
  try {
    await run();
  } catch (error) {
    status = 'FAIL';
    reasons.push(error instanceof Error ? error.message : String(error));
  }
  const observation: AccessibilityObservation = {
    observationVersion: ACCESSIBILITY_OBSERVATION_VERSION,
    oracleId,
    routePath,
    status,
    environmentIds: scope.environmentIds,
    themes: scope.themes,
    interactionModes: scope.interactionModes ?? ['transformation'],
    stateIds: scope.stateIds ?? [],
    browserVersion: browser.version(),
    projectName: testInfo.project.name,
    durationMs: Date.now() - startedAt,
    reasons,
  };
  await testInfo.attach(observationAttachment, {
    body: Buffer.from(JSON.stringify(observation)),
    contentType: 'application/json',
  });
  return reasons[0] ?? null;
}

async function recordUnavailableObservation(
  testInfo: TestInfo,
  browser: Browser,
  oracleId: string,
  routePath: string,
  reason: string
): Promise<void> {
  const observation: AccessibilityObservation = {
    observationVersion: ACCESSIBILITY_OBSERVATION_VERSION,
    oracleId,
    routePath,
    status: 'UNKNOWN',
    environmentIds: ['desktop'],
    themes: ['dark'],
    interactionModes: ['transformation'],
    stateIds: [],
    browserVersion: browser.version(),
    projectName: testInfo.project.name,
    durationMs: 0,
    reasons: [reason],
  };
  await testInfo.attach(observationAttachment, {
    body: Buffer.from(JSON.stringify(observation)),
    contentType: 'application/json',
  });
}

async function visit(
  page: Page,
  routePath: string,
  options: {
    width?: number;
    height?: number;
    theme?: 'dark' | 'light';
    reducedMotion?: 'reduce' | 'no-preference';
    forcedColors?: 'active' | 'none';
  } = {}
): Promise<void> {
  const theme = options.theme ?? 'dark';
  await page.setViewportSize({
    width: options.width ?? 1440,
    height: options.height ?? 900,
  });
  await page.emulateMedia({
    colorScheme: theme,
    reducedMotion: options.reducedMotion ?? 'no-preference',
    forcedColors: options.forcedColors ?? 'none',
  });
  if (page.url() === 'about:blank' && theme !== 'dark') {
    throw new Error(
      'The first accessibility visit must establish the dark origin'
    );
  }
  if (page.url() !== 'about:blank') {
    await page.evaluate(
      (nextTheme) => window.localStorage.setItem('theme', nextTheme),
      theme
    );
  }
  await page.goto(routePath, { waitUntil: 'networkidle' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
  await expect(page.locator('main')).toBeVisible();
}

async function expectNoPageOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

async function expectAxeClean(page: Page): Promise<void> {
  const result = await new AxeBuilder({ page }).withTags(wcagTags).analyze();
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual(
    []
  );
}

test.describe('accessibility-v1 inventory matrix', () => {
  for (const route of routes) {
    test(`all declared local oracles emit evidence for ${route.path}`, async ({
      page,
      browser,
    }, testInfo) => {
      const failures: string[] = [];
      await page.addInitScript(() => {
        Object.defineProperty(navigator, 'clipboard', {
          configurable: true,
          value: {
            writeText: () =>
              Promise.reject(new Error('Denied by accessibility harness')),
          },
        });
        Object.defineProperty(URL, 'createObjectURL', {
          configurable: true,
          value: () => {
            throw new Error('Denied by accessibility harness');
          },
        });
      });

      const observe = async (
        oracleId: string,
        scope: ObservationScope,
        run: () => Promise<void>
      ) => {
        const resolvedScope = {
          ...scope,
          interactionModes:
            scope.interactionModes ??
            (route.path === explorerProofRoute
              ? ['runtime']
              : ['transformation']),
        };
        const failure = await recordObservation(
          testInfo,
          browser,
          oracleId,
          route.path,
          resolvedScope,
          run
        );
        if (failure) failures.push(`${oracleId}: ${failure}`);
      };

      await observe(
        'chromium-structural-scan',
        { environmentIds: ['desktop'], themes: ['dark', 'light'] },
        async () => {
          for (const theme of ['dark', 'light'] as const) {
            await visit(page, route.path, { theme });
            await expectAxeClean(page);
          }
        }
      );

      await observe(
        'accessibility-tree',
        { environmentIds: ['desktop'], themes: ['dark'] },
        async () => {
          await visit(page, route.path);
          await expect(page.getByRole('main')).toHaveCount(1);
          await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
          const tree = await page.getByRole('main').ariaSnapshot();
          expect(tree).toContain('heading');
        }
      );

      await observe(
        'keyboard-trace',
        { environmentIds: ['desktop'], themes: ['dark'] },
        async () => {
          await visit(page, route.path);
          await page.keyboard.press('Tab');
          const focused = page.locator(':focus');
          await expect(focused).toHaveCount(1);
          await expect(focused).toBeVisible();

          const explorer = page.locator(
            '[data-explorer-version="2"]:not([data-explorer-mode="runtime"])'
          );
          if ((await explorer.count()) > 0) {
            const currentStage = explorer.locator('[aria-current="step"]');
            const initialStage = await currentStage.getAttribute('aria-label');
            const outsideControl = page.locator('nav a, header a').first();
            await outsideControl.focus();
            await page.keyboard.press('ArrowRight');
            await expect(currentStage).toHaveAttribute(
              'aria-label',
              initialStage ?? ''
            );
            await explorer
              .locator('button[aria-label^="Stage "]')
              .first()
              .focus();
            await page.keyboard.press('ArrowRight');
            const stageCount = await explorer
              .locator('button[aria-label^="Stage "]')
              .count();
            if (stageCount > 1) {
              await expect(
                explorer.locator('[aria-current="step"]')
              ).toHaveAccessibleName(/Stage 2 of/);
            } else {
              await expect(currentStage).toHaveAttribute(
                'aria-label',
                initialStage ?? ''
              );
            }
          }
        }
      );

      await observe(
        'forced-colors',
        { environmentIds: ['desktop'], themes: ['dark', 'light'] },
        async () => {
          for (const theme of ['dark', 'light'] as const) {
            await visit(page, route.path, { theme, forcedColors: 'active' });
            const controls = page.locator(
              'button:visible, a:visible, input:visible, select:visible'
            );
            const count = await controls.count();
            for (let index = 0; index < Math.min(count, 25); index += 1) {
              await expect(controls.nth(index)).toBeVisible();
            }
            if (count > 0) {
              await controls.first().focus();
              await expect(controls.first()).toBeFocused();
            }
          }
        }
      );

      await observe(
        'text-spacing',
        { environmentIds: ['desktop'], themes: ['dark', 'light'] },
        async () => {
          for (const theme of ['dark', 'light'] as const) {
            await visit(page, route.path, { theme });
            await page.addStyleTag({
              content: `
                body, body * {
                  line-height: 1.5 !important;
                  letter-spacing: 0.12em !important;
                  word-spacing: 0.16em !important;
                }
                p { margin-bottom: 2em !important; }
              `,
            });
            await expect(page.locator('main')).toBeVisible();
            await expectNoPageOverflow(page);
          }
        }
      );

      await observe(
        'orientation',
        { environmentIds: ['mobile'], themes: ['dark'] },
        async () => {
          for (const viewport of [
            { width: 390, height: 844 },
            { width: 844, height: 390 },
          ]) {
            await visit(page, route.path, viewport);
            await expectNoPageOverflow(page);
            await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
          }
        }
      );

      await observe(
        'reflow-320',
        { environmentIds: ['reflow-320'], themes: ['dark', 'light'] },
        async () => {
          for (const theme of ['dark', 'light'] as const) {
            await visit(page, route.path, { width: 320, height: 800, theme });
            await expectNoPageOverflow(page);
          }
        }
      );

      await observe(
        'zoom-200',
        { environmentIds: ['desktop'], themes: ['dark'] },
        async () => {
          await visit(page, route.path, { width: 720, height: 900 });
          await expectNoPageOverflow(page);
          await expect(page.locator('main')).toBeVisible();
        }
      );

      await observe(
        'zoom-400',
        { environmentIds: ['desktop'], themes: ['dark'] },
        async () => {
          await visit(page, route.path, { width: 360, height: 900 });
          await expectNoPageOverflow(page);
          await expect(page.locator('main')).toBeVisible();
        }
      );

      await observe(
        'reduced-motion',
        { environmentIds: ['desktop'], themes: ['dark'] },
        async () => {
          await visit(page, route.path, { reducedMotion: 'reduce' });
          await expect(page.locator('main')).toBeVisible();
          const explorer = page.locator(
            '[data-explorer-version="2"]:not([data-explorer-mode="runtime"])'
          );
          if ((await explorer.count()) > 0) {
            await expect(explorer.locator('[aria-current="step"]')).toHaveCount(
              1
            );
            await expect(
              explorer.locator(':text-is("Input"):visible').first()
            ).toBeVisible();
            await expect(
              explorer.locator(':text-is("Output"):visible').first()
            ).toBeVisible();
          }
        }
      );

      await visit(page, route.path);
      const explorerV2 = page.locator(
        '[data-explorer-version="2"]:not([data-explorer-mode="runtime"])'
      );
      if (route.path === explorerProofRoute) {
        await expect(
          page.locator('[data-explorer-mode="runtime"]')
        ).toBeVisible();
      } else if ((await explorerV2.count()) === 0) {
        await recordUnavailableObservation(
          testInfo,
          browser,
          'clipboard-denial',
          route.path,
          'Explorer V2 is not present on this inventory route'
        );
        await recordUnavailableObservation(
          testInfo,
          browser,
          'download-failure',
          route.path,
          'Explorer V2 is not present on this inventory route'
        );
      } else {
        const comparisonMode = await explorerV2.getAttribute(
          'data-comparison-mode'
        );
        const filteredViewLabel =
          comparisonMode === 'highlights' ? 'Highlights only' : 'Changes only';
        const filteredViewState =
          comparisonMode === 'highlights' ? 'highlights-only' : 'changes-only';
        await observe(
          'accessibility-tree',
          {
            environmentIds: ['desktop'],
            themes: ['dark'],
            stateIds: ['default', 'full-data'],
          },
          async () => {
            await expect(
              explorerV2.locator('[aria-current="step"]')
            ).toHaveCount(1);
            await expect(
              explorerV2.locator(':text-is("Input"):visible').first()
            ).toBeVisible();
            await expect(
              explorerV2.locator(':text-is("Output"):visible').first()
            ).toBeVisible();
          }
        );
        await observe(
          'keyboard-trace',
          {
            environmentIds: ['desktop'],
            themes: ['dark'],
            stateIds: ['stage-selected', filteredViewState],
          },
          async () => {
            const stages = explorerV2.locator('button[aria-label^="Stage "]');
            if ((await stages.count()) > 1) {
              await stages.nth(1).click();
              await expect(
                explorerV2.locator('[aria-current="step"]')
              ).toHaveAccessibleName(/Stage 2 of/);
            }
            const filteredViewOnly = explorerV2.getByRole('checkbox', {
              name: filteredViewLabel,
            });
            await filteredViewOnly.check();
            await expect(filteredViewOnly).toBeChecked();
          }
        );
        const actionMenu = explorerV2.locator('details').filter({
          hasText: 'Copy & download',
        });
        const openActionMenu = async () => {
          const isOpen = await actionMenu.evaluate(
            (element) => (element as HTMLDetailsElement).open
          );
          if (!isOpen) await actionMenu.locator('summary').click();
        };
        await observe(
          'clipboard-denial',
          {
            environmentIds: ['desktop'],
            themes: ['dark'],
            stateIds: ['clipboard-error'],
          },
          async () => {
            await openActionMenu();
            await explorerV2
              .getByRole('button', { name: 'Copy stage YAML' })
              .click();
            await expect(explorerV2.getByRole('alert')).toContainText(
              /Could not copy stage YAML.*Select the text and copy it manually/i
            );
          }
        );

        await openActionMenu();
        const fullDownload = explorerV2.getByRole('button', {
          name: 'Download full YAML',
        });
        const stageDownload = explorerV2.getByRole('button', {
          name: 'Download stage YAML',
        });
        const download =
          (await fullDownload.count()) > 0 ? fullDownload : stageDownload;
        await observe(
          'download-failure',
          {
            environmentIds: ['desktop'],
            themes: ['dark'],
            stateIds: ['download-error'],
          },
          async () => {
            await openActionMenu();
            await download.click();
            await expect(explorerV2.getByRole('alert')).toContainText(
              /Could not download (?:the full YAML|the stage YAML).*Copy it instead/i
            );
          }
        );
      }

      await observe(
        'target-size',
        { environmentIds: ['desktop', 'mobile'], themes: ['dark'] },
        async () => {
          for (const viewport of [
            { width: 1440, height: 900 },
            { width: 390, height: 844 },
          ]) {
            await visit(page, route.path, viewport);
            const undersized = await page
              .locator(
                'button:visible, input:visible:not([type="hidden"]), select:visible, textarea:visible, [role="button"]:visible'
              )
              .evaluateAll((controls) =>
                controls
                  .map((control) => {
                    let target = control;
                    if (control instanceof HTMLInputElement) {
                      const usesCompositeTarget = [
                        'checkbox',
                        'radio',
                        'search',
                      ].includes(control.type);
                      if (usesCompositeTarget) {
                        const explicitLabel = control.id
                          ? document.querySelector(
                              `label[for="${CSS.escape(control.id)}"]`
                            )
                          : null;
                        const label = control.closest('label') ?? explicitLabel;
                        const searchWrapper =
                          control.type === 'search'
                            ? control.closest(
                                '[class*="searchControl"], [class*="navbar__search"], [role="search"]'
                              )
                            : null;
                        target = searchWrapper ?? label ?? control;
                      }
                    }
                    const bounds = target.getBoundingClientRect();
                    return {
                      name:
                        control.getAttribute('aria-label') ||
                        control.textContent?.trim().slice(0, 80) ||
                        control.tagName.toLowerCase(),
                      width: bounds.width,
                      height: bounds.height,
                    };
                  })
                  .filter(({ width, height }) => width < 44 || height < 44)
              );
            expect(undersized, JSON.stringify(undersized, null, 2)).toEqual([]);
          }
        }
      );

      await observe(
        'dark-light-viewports',
        {
          environmentIds: contract.environments.map(({ id }) => id),
          themes: ['dark', 'light'],
        },
        async () => {
          for (const environment of contract.environments) {
            for (const theme of ['dark', 'light'] as const) {
              await visit(page, route.path, {
                width: environment.width,
                height: environment.height,
                theme,
              });
              await expectNoPageOverflow(page);
              await expectAxeClean(page);
            }
          }
        }
      );

      expect(failures, failures.join('\n')).toEqual([]);
    });
  }
});

test('Explorer proof route emits recoverable edge-state evidence', async ({
  page,
  browser,
}, testInfo) => {
  expect(
    routes.some((route) => route.path === explorerProofRoute),
    `${explorerProofRoute} must be present in the bound route inventory`
  ).toBe(true);

  const failures: string[] = [];
  const observeFixture = async (
    fixtureCase: string,
    stateIds: string[],
    run: () => Promise<void>,
    environmentIds = ['desktop']
  ) => {
    const failure = await recordObservation(
      testInfo,
      browser,
      'chromium-structural-scan',
      explorerProofRoute,
      {
        environmentIds,
        themes: ['dark'],
        interactionModes: ['transformation'],
        stateIds,
      },
      async () => {
        await visit(page, `${explorerProofRoute}?case=${fixtureCase}`, {
          width: environmentIds.includes('reflow-320') ? 320 : 1440,
          height: 800,
        });
        await run();
        await expectAxeClean(page);
      }
    );
    if (failure) failures.push(`${fixtureCase}: ${failure}`);
  };

  await observeFixture('zero', ['zero-stage'], async () => {
    await expect(page.getByRole('alert')).toContainText(
      'No stages are available'
    );
  });
  await observeFixture('malformed', ['malformed-fixture'], async () => {
    await expect(page.getByRole('alert')).toContainText(
      'stage fixture is invalid'
    );
  });
  await observeFixture('oversized', ['oversized-fixture'], async () => {
    await expect(page.getByRole('alert')).toContainText(
      'exceeds the safe inline preview limit'
    );
  });
  await observeFixture(
    'one',
    ['one-stage', 'long-stage-name', 'high-density', 'missing-full-yaml'],
    async () => {
      const explorer = page.locator('[data-explorer-version="2"]');
      await expect(explorer.locator('[aria-current="step"]')).toHaveCount(1);
      await expect(
        explorer.getByRole('combobox', { name: 'Stage', exact: true })
      ).toBeVisible();
      await explorer.getByText('Copy & download').click();
      await expect(explorer).toContainText(
        'Full pipeline file not included. Stage YAML remains available.'
      );
      await expectNoPageOverflow(page);
    },
    ['reflow-320']
  );

  expect(failures, failures.join('\n')).toEqual([]);
});
