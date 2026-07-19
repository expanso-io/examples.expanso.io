import { defineConfig } from '@playwright/test';

const port = Number(process.env.QUALITY_PORT ?? 4173);
const baseURL = process.env.QUALITY_BASE_URL ?? `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: './tests/quality',
  outputDir: 'test-results/quality',
  fullyParallel: true,
  forbidOnly: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [
        ['line'],
        [
          'json',
          { outputFile: 'test-results/quality/playwright-results.json' },
        ],
      ]
    : [['line']],
  use: {
    baseURL,
    browserName: 'chromium',
    colorScheme: 'dark',
    reducedMotion: 'no-preference',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium-desktop',
      use: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
    },
    {
      name: 'chromium-tablet',
      use: { viewport: { width: 820, height: 1180 }, deviceScaleFactor: 1 },
    },
    {
      name: 'chromium-mobile',
      use: {
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: process.env.QUALITY_BASE_URL
    ? undefined
    : {
        command: `EXPLORER_RUNTIME_HARNESS=1 npm run start -- --host 127.0.0.1 --port ${port}`,
        url: baseURL,
        reuseExistingServer: false,
        timeout: 120_000,
      },
});
