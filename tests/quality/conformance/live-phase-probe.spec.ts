import { test, expect } from '@playwright/test';
import { EXAMPLE_RECORDS } from '../../../src/catalog/registry';
import { GENERATED_EXPLORER_STAGE_CONFIGS } from '../../../src/catalog/explorerStageConfigs.generated';
const published = EXAMPLE_RECORDS.filter((r) => r.status === 'published');
test.setTimeout(180000);
for (const record of published) {
  test(`${record.id}: restored explanation and every distinct action`, async ({
    page,
  }) => {
    test.setTimeout(180000);
    await page.goto(record.routes.overview, { waitUntil: 'networkidle' });
    const overview = page.url();
    const header = page.locator(
      '[data-example-template-section="explanation"]'
    );
    await expect(header.getByRole('heading', { level: 1 })).toHaveText(
      record.title
    );
    await expect(
      header.getByRole('navigation', { name: 'Example actions' })
    ).toBeVisible();
    await expect(header.getByRole('definition')).toHaveCount(4);
    const links = page.locator(
      '[aria-label="Example actions"] a, [data-example-template-section="run-deploy"] a'
    );
    const destinations = await links.evaluateAll((nodes) =>
      nodes.map((n) => (n as HTMLAnchorElement).href)
    );
    expect(destinations.length).toBeGreaterThanOrEqual(3);
    for (const [index, url] of destinations.entries()) {
      await page.goto(overview, { waitUntil: 'networkidle' });
      await links.nth(index).click();
      await expect(page).toHaveURL(url);
      await expect(page.locator('main')).toBeVisible();
      await expect(page.locator('main')).not.toContainText('Page Not Found');
    }
    await page.goto(overview, { waitUntil: 'networkidle' });
    const related = page.getByRole('heading', {
      name: /^Related examples(?: Direct link to Related examples)?$/,
    });
    await expect(related).toBeVisible();
    const relatedLink = related
      .locator('xpath=following-sibling::*[1]')
      .getByRole('link')
      .first();
    await relatedLink.click();
    await expect(
      page.locator('[data-example-template-section="explanation"]')
    ).toBeVisible();
  });
  test(`${record.id}: inspect every rendered stage independently of guide`, async ({
    page,
  }) => {
    test.setTimeout(180000);
    await page.goto(record.routes.overview, { waitUntil: 'networkidle' });
    const explorer = page.locator('[data-explorer-version="2"]');
    await expect(explorer).toBeVisible();
    const family = GENERATED_EXPLORER_STAGE_CONFIGS[record.id];
    const stages = explorer.locator('button[aria-label^="Stage "]');
    await expect(stages).toHaveCount(family.stages.length);
    for (const [index, stage] of family.stages.entries()) {
      await stages.nth(index).click();
      await expect(stages.nth(index)).toHaveAttribute('aria-current', 'step');
      for (const [panel, lines] of [
        ['input', stage.inputLines],
        ['output', stage.outputLines],
      ] as const) {
        await expect
          .poll(() =>
            explorer
              .locator(
                `[id$="-${panel}-panel"] pre code > span > span:last-child`
              )
              .allTextContents()
          )
          .toEqual(lines.map((l) => l.content));
      }
      await expect
        .poll(() =>
          explorer.locator('[id$="-yaml-panel"] pre code').textContent()
        )
        .toBe(
          index === family.stages.length - 1 ? family.fullYaml : stage.yamlCode
        );
    }
  });
}
