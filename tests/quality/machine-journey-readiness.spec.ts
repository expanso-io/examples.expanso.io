import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

const overview = '/data-security/remove-pii/';

test.describe('machine journey browser readiness', () => {
  test('finds the pilot from the public catalog without a route hint', async ({
    page,
  }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.getByRole('searchbox', { name: 'Search examples' }).fill('PII');
    await expect(page.getByText('1 example', { exact: true })).toBeVisible();
    await page
      .getByRole('link', { name: /Remove PII/ })
      .first()
      .click();
    await expect(page).toHaveURL(new RegExp(`${overview}$`));
    await expect(
      page
        .locator('main')
        .getByRole('heading', { level: 1, name: 'Remove PII', exact: true })
    ).toBeVisible();
  });

  test('keeps the problem, solution, and Explorer inline on the overview', async ({
    page,
  }) => {
    await page.goto(overview, { waitUntil: 'networkidle' });
    const main = page.locator('main');
    await expect(
      main.getByRole('heading', {
        level: 2,
        name: 'The problem',
        exact: true,
      })
    ).toBeVisible();
    await expect(
      main.getByRole('heading', {
        level: 2,
        name: 'How Expanso solves it',
        exact: true,
      })
    ).toBeVisible();
    await expect(main.locator('[data-explorer-version="2"]')).toHaveAttribute(
      'data-example-id',
      'remove-pii'
    );
    await expect(
      main.getByText('System boundary', { exact: true })
    ).toHaveCount(0);
  });

  test('opens the shared Hash email stage and exposes its material change', async ({
    page,
  }) => {
    await page.goto(`${overview}?stage=hash-email`, {
      waitUntil: 'networkidle',
    });
    const surface = page.locator('[data-explorer-version="2"]');
    await expect(surface).toHaveAttribute('data-example-id', 'remove-pii');
    await expect(surface.locator('[aria-current="step"]')).toHaveAccessibleName(
      /Hash Email/
    );
    await expect(surface).toContainText(
      'Replace the email with a keyed hash and retain its domain'
    );
    await expect(page).toHaveURL(/stage=hash-email$/);
  });

  test('renders the canonical complete pipeline with exact bytes', async ({
    page,
  }) => {
    await page.goto('/data-security/remove-pii/complete-pipeline', {
      waitUntil: 'networkidle',
    });
    const expected = await readFile(
      'examples/data-security/remove-pii-complete.yaml',
      'utf8'
    );
    const rendered = await page.locator('pre code').innerText();
    expect(rendered).toBe(expected);
  });

  test('publishes the exact offline command and fixture path', async ({
    page,
  }) => {
    await page.goto('/data-security/remove-pii/setup', {
      waitUntil: 'networkidle',
    });
    await expect(page.locator('main')).toContainText(
      'examples/data-security/remove-pii/sample-data.json'
    );
    await expect(page.locator('main')).toContainText('npm run test-pipelines');
  });
});
