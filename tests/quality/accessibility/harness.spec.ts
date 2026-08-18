import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test.describe('accessibility harness oracles', () => {
  test('axe oracle detects a known accessible-name failure', async ({
    page,
  }) => {
    await page.setContent(
      '<main><button><svg aria-hidden="true"></svg></button></main>'
    );
    const result = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();

    expect(result.violations.map((violation) => violation.id)).toContain(
      'button-name'
    );
  });

  test('axe oracle accepts the equivalent named control', async ({ page }) => {
    await page.setContent(
      '<!doctype html><html lang="en"><head><title>Accessible fixture</title></head><body><main><h1>Fixture</h1><button aria-label="Next stage"><svg aria-hidden="true"></svg></button></main></body></html>'
    );
    const result = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();

    expect(result.violations).toEqual([]);
  });

  test('44 CSS pixel target oracle rejects a known 36px control', async ({
    page,
  }) => {
    await page.setContent(
      '<main><h1>Fixture</h1><button style="width:36px;height:36px" aria-label="Undersized">X</button><button style="width:44px;height:44px" aria-label="Valid">Y</button></main>'
    );
    const undersized = await page.locator('button').evaluateAll((controls) =>
      controls
        .map((control) => {
          const bounds = control.getBoundingClientRect();
          return {
            name: control.getAttribute('aria-label'),
            width: bounds.width,
            height: bounds.height,
          };
        })
        .filter(({ width, height }) => width < 44 || height < 44)
    );

    expect(undersized).toEqual([{ name: 'Undersized', width: 36, height: 36 }]);
  });
});
