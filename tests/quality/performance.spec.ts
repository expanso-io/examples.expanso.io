import {
  chromium as playwrightChromium,
  test,
  type Locator,
} from '@playwright/test';
import { launch } from 'chrome-launcher';
import lighthouse from 'lighthouse';
import { mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  artifactForFile,
  collectProductionAssetEvidence,
  writeJsonEvidenceArtifact,
  writePerformanceEvidenceManifest,
  type ArtifactRecord,
  type BrowserMetrics,
  type LighthouseCell,
  type PageLoadCell,
  type PerformanceEvidenceManifest,
} from '../../scripts/quality/performance-evidence';
import {
  loadContract,
  readJson,
  sha256Bytes,
  type QualityContract,
} from '../../scripts/quality/contract-lib';
import { validateJsonSchema } from '../../scripts/quality/json-schema';

interface PerformanceContract extends QualityContract {
  profiles: Record<
    string,
    {
      width: number;
      height: number;
      deviceScaleFactor: number;
      cpuSlowdown: number;
      latencyMs: number;
      downloadKbps: number;
      uploadKbps: number;
    }
  >;
  themes: Array<'dark' | 'light'>;
  runs: {
    pageLoadsPerCell: number;
    explorerWarmups: number;
    explorerMeasuredTransitions: number;
  };
  evidenceSchema: string;
}

const SHA_PATTERN = /^[a-f0-9]{40}$/;
const contract = loadContract(
  'tests/contracts/performance-v1.json'
) as PerformanceContract;

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Performance collection requires ${name}`);
  return value;
}

function slug(value: string): string {
  return value.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '');
}

function assertExactVersion(
  actual: string,
  expected: string,
  tool: string
): void {
  if (actual !== expected) {
    throw new Error(
      `${tool} version mismatch: expected ${expected}, got ${actual}`
    );
  }
}

async function selectExplorerStage(
  explorer: Locator,
  index: number
): Promise<void> {
  const compactSelector = explorer.getByRole('combobox', {
    name: 'Stage',
    exact: true,
  });
  if (await compactSelector.isVisible()) {
    await compactSelector.selectOption({ index });
    return;
  }
  await explorer
    .getByRole('button', { name: new RegExp(`Stage ${index + 1} of`) })
    .click();
}

async function measureExplorerStageTransition(
  explorer: Locator,
  index: number
): Promise<number> {
  return explorer.evaluate((root, stageIndex) => {
    const select = root.querySelector<HTMLSelectElement>(
      'select[aria-label="Stage"]'
    );
    const target = select
      ? select.options[stageIndex]
      : root.querySelector<HTMLButtonElement>(
          `button[aria-label^="Stage ${stageIndex + 1} of"]`
        );
    if (!target) {
      throw new Error(`Explorer stage ${stageIndex + 1} is not available`);
    }

    const started = performance.now();
    if (select) {
      select.value = target.value;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
      target.click();
    }
    return new Promise<number>((resolveFrame) =>
      requestAnimationFrame(() =>
        requestAnimationFrame(() => resolveFrame(performance.now() - started))
      )
    );
  }, index);
}

test('collects exact-SHA performance evidence from the production artifact', async ({
  baseURL,
  browser,
}) => {
  test.setTimeout(30 * 60 * 1000);
  if (!baseURL) throw new Error('Performance collection requires a base URL');

  const role = requiredEnvironment('PERFORMANCE_ROLE');
  if (role !== 'baseline' && role !== 'candidate') {
    throw new Error('PERFORMANCE_ROLE must be baseline or candidate');
  }
  const subjectSha = requiredEnvironment('PERFORMANCE_SUBJECT_SHA');
  if (!SHA_PATTERN.test(subjectSha) || subjectSha === '0'.repeat(40)) {
    throw new Error(
      'PERFORMANCE_SUBJECT_SHA must be a nonzero lowercase Git SHA'
    );
  }
  const environmentId = requiredEnvironment('PERFORMANCE_ENVIRONMENT_ID');
  const evidenceRoot = resolve(requiredEnvironment('PERFORMANCE_EVIDENCE_DIR'));
  const buildRoot = resolve(requiredEnvironment('PERFORMANCE_BUILD_ROOT'));
  const docusaurusRoot = resolve(
    requiredEnvironment('PERFORMANCE_DOCUSARUS_ROOT')
  );
  mkdirSync(evidenceRoot, { recursive: true });
  const startedAt = new Date().toISOString();

  const nodeVersion = process.version.replace(/^v/, '');
  const playwrightVersion = JSON.parse(
    readFileSync('node_modules/@playwright/test/package.json', 'utf8')
  ).version as string;
  const lighthouseVersion = JSON.parse(
    readFileSync('node_modules/lighthouse/package.json', 'utf8')
  ).version as string;
  const chromiumVersion = browser.version();
  const toolVersions = {
    node: nodeVersion,
    playwright: playwrightVersion,
    chromium: chromiumVersion,
    lighthouse: lighthouseVersion,
  };
  for (const [tool, expected] of Object.entries(contract.tools)) {
    assertExactVersion(
      toolVersions[tool as keyof typeof toolVersions],
      expected,
      tool
    );
  }

  for (const fixture of contract.fixtures) {
    const actual = sha256Bytes(readFileSync(resolve(fixture.path)));
    if (actual !== fixture.sha256) {
      throw new Error(
        `Fixture digest mismatch for ${fixture.id}: expected ${fixture.sha256}, got ${actual}`
      );
    }
  }

  const removePiiRoute = contract.routes.required.find(
    (route) => route.id === 'remove-pii-pilot'
  );
  if (!removePiiRoute) throw new Error('Contract is missing remove-pii-pilot');
  const assetEvidence = collectProductionAssetEvidence({
    buildRoot,
    docusaurusRoot,
    evidenceRoot,
    explorerRoute: removePiiRoute.path,
  });
  const artifacts: ArtifactRecord[] = [...assetEvidence.artifacts];

  const requiredRoutes = contract.routes.required.filter(
    (route) => route.availableWhen === undefined
  );
  const lighthouseCells: LighthouseCell[] = [];
  const chrome = await launch({
    chromePath: playwrightChromium.executablePath(),
    chromeFlags: ['--headless=new', '--no-sandbox', '--disable-gpu'],
    logLevel: 'error',
  });
  try {
    const mobile = contract.profiles.mobile;
    if (!mobile) throw new Error('Contract is missing the mobile profile');
    for (const route of requiredRoutes) {
      const result = await lighthouse(new URL(route.path, baseURL).toString(), {
        port: chrome.port,
        output: 'json',
        logLevel: 'error',
        onlyCategories: ['performance'],
        formFactor: 'mobile',
        screenEmulation: {
          width: mobile.width,
          height: mobile.height,
          deviceScaleFactor: mobile.deviceScaleFactor,
          mobile: true,
          disabled: false,
        },
        throttlingMethod: 'simulate',
        throttling: {
          rttMs: mobile.latencyMs,
          throughputKbps: mobile.downloadKbps,
          requestLatencyMs: mobile.latencyMs,
          downloadThroughputKbps: mobile.downloadKbps,
          uploadThroughputKbps: mobile.uploadKbps,
          cpuSlowdownMultiplier: mobile.cpuSlowdown,
        },
      });
      if (!result)
        throw new Error(`Lighthouse returned no result for ${route.id}`);
      assertExactVersion(
        result.lhr.lighthouseVersion,
        contract.tools.lighthouse,
        'Lighthouse report'
      );
      const lcp = result.lhr.audits['largest-contentful-paint']?.numericValue;
      const cls = result.lhr.audits['cumulative-layout-shift']?.numericValue;
      if (lcp === undefined || cls === undefined) {
        throw new Error(`Lighthouse metrics are incomplete for ${route.id}`);
      }
      const reportArtifact = writeJsonEvidenceArtifact(
        evidenceRoot,
        `raw/lighthouse/${slug(route.id)}.json`,
        result.lhr,
        {
          id: `lighthouse:${route.id}`,
          kind: 'lighthouse-report',
        }
      );
      artifacts.push(reportArtifact);
      lighthouseCells.push({
        routeId: route.id,
        lcpMs: lcp,
        cls,
        reportArtifactId: reportArtifact.id,
      });
    }
  } finally {
    chrome.kill();
  }

  const applyThrottling = async (
    context: Awaited<ReturnType<typeof browser.newContext>>,
    page: Awaited<ReturnType<typeof context.newPage>>,
    profile: PerformanceContract['profiles'][string]
  ) => {
    const session = await context.newCDPSession(page);
    await session.send('Network.enable');
    await session.send('Network.setCacheDisabled', { cacheDisabled: true });
    await session.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: profile.latencyMs,
      downloadThroughput: (profile.downloadKbps * 1024) / 8,
      uploadThroughput: (profile.uploadKbps * 1024) / 8,
    });
    await session.send('Emulation.setCPUThrottlingRate', {
      rate: profile.cpuSlowdown,
    });
  };

  const pageLoadCells: PageLoadCell[] = [];
  for (const [profileId, profile] of Object.entries(contract.profiles)) {
    for (const theme of contract.themes) {
      for (const route of requiredRoutes) {
        const cellId = `${route.id}-${profileId}-${theme}`;
        const tracePath = resolve(
          evidenceRoot,
          `raw/traces/page-load-${slug(cellId)}.zip`
        );
        mkdirSync(resolve(tracePath, '..'), { recursive: true });
        const runs: PageLoadCell['runs'] = [];
        for (let run = 0; run < contract.runs.pageLoadsPerCell; run += 1) {
          const context = await browser.newContext({
            viewport: { width: profile.width, height: profile.height },
            deviceScaleFactor: profile.deviceScaleFactor,
            colorScheme: theme,
          });
          if (run === 0) {
            await context.tracing.start({ screenshots: true, snapshots: true });
          }
          const page = await context.newPage();
          await applyThrottling(context, page, profile);
          await page.addInitScript(() => {
            const metrics = { lcp: 0, cls: 0 };
            (
              window as typeof window & { __qualityVitals?: typeof metrics }
            ).__qualityVitals = metrics;
            new PerformanceObserver((list) => {
              const last = list.getEntries().at(-1);
              if (last) metrics.lcp = last.startTime;
            }).observe({ type: 'largest-contentful-paint', buffered: true });
            new PerformanceObserver((list) => {
              for (const entry of list.getEntries() as Array<
                PerformanceEntry & { value: number; hadRecentInput: boolean }
              >) {
                if (!entry.hadRecentInput) metrics.cls += entry.value;
              }
            }).observe({ type: 'layout-shift', buffered: true });
          });
          await page.goto(new URL(route.path, baseURL).toString(), {
            waitUntil: 'networkidle',
          });
          await page.waitForTimeout(100);
          const metrics = await page.evaluate(() => {
            const vitals = (
              window as typeof window & {
                __qualityVitals?: { lcp: number; cls: number };
              }
            ).__qualityVitals;
            return {
              lcpMs: vitals?.lcp ?? 0,
              cls: vitals?.cls ?? Number.NaN,
              overflowCssPixels: Math.max(
                0,
                document.documentElement.scrollWidth -
                  document.documentElement.clientWidth
              ),
            };
          });
          if (
            metrics.lcpMs <= 0 ||
            !Number.isFinite(metrics.cls) ||
            !Number.isFinite(metrics.overflowCssPixels)
          ) {
            throw new Error(
              `Invalid page-load metrics for ${cellId} run ${run + 1}`
            );
          }
          runs.push(metrics);
          if (run === 0) await context.tracing.stop({ path: tracePath });
          await context.close();
        }
        const traceArtifact = artifactForFile(evidenceRoot, tracePath, {
          id: `trace:page-load:${cellId}`,
          kind: 'playwright-trace',
          mediaType: 'application/zip',
        });
        artifacts.push(traceArtifact);
        pageLoadCells.push({
          routeId: route.id,
          profileId,
          theme,
          cacheMode: 'cold-page-load',
          traceArtifactId: traceArtifact.id,
          runs,
        });
      }
    }
  }

  const mobile = contract.profiles.mobile;
  const explorerContext = await browser.newContext({
    viewport: { width: mobile.width, height: mobile.height },
    deviceScaleFactor: mobile.deviceScaleFactor,
    colorScheme: 'dark',
  });
  const explorerTracePath = resolve(
    evidenceRoot,
    'raw/traces/explorer-interaction.zip'
  );
  mkdirSync(resolve(explorerTracePath, '..'), { recursive: true });
  await explorerContext.tracing.start({ screenshots: true, snapshots: true });
  const explorerPage = await explorerContext.newPage();
  await applyThrottling(explorerContext, explorerPage, mobile);
  await explorerPage.addInitScript(() => {
    const durations: number[] = [];
    (
      window as typeof window & { __qualityEventDurations?: number[] }
    ).__qualityEventDurations = durations;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) durations.push(entry.duration);
    }).observe({ type: 'event', buffered: true, durationThreshold: 0 });
  });
  await explorerPage.goto(new URL(removePiiRoute.path, baseURL).toString(), {
    waitUntil: 'networkidle',
  });
  const explorer = explorerPage.locator('.data-pipeline-explorer');
  const stages = explorer.locator('button[aria-label^="Stage "]');
  const stageCount = await stages.count();
  if (stageCount < 2)
    throw new Error('Explorer must expose at least two stages');
  const stageIds: string[] = [];
  for (let index = 0; index < stageCount; index += 1) {
    const label = await stages.nth(index).getAttribute('aria-label');
    if (!label)
      throw new Error(`Explorer stage ${index + 1} has no aria-label`);
    stageIds.push(label);
  }
  for (let index = 0; index < contract.runs.explorerWarmups; index += 1) {
    await selectExplorerStage(explorer, (index + 1) % stageCount);
  }
  const scriptingMs: number[] = [];
  for (
    let index = 0;
    index < contract.runs.explorerMeasuredTransitions;
    index += 1
  ) {
    scriptingMs.push(
      await measureExplorerStageTransition(explorer, (index + 1) % stageCount)
    );
  }
  await explorerPage.waitForTimeout(100);
  const eventDurationsMs = await explorerPage.evaluate(
    () =>
      (window as typeof window & { __qualityEventDurations?: number[] })
        .__qualityEventDurations ?? []
  );
  await explorerContext.tracing.stop({ path: explorerTracePath });
  await explorerContext.close();
  const explorerTrace = artifactForFile(evidenceRoot, explorerTracePath, {
    id: 'trace:explorer-interaction',
    kind: 'playwright-trace',
    mediaType: 'application/zip',
  });
  artifacts.push(explorerTrace);

  const browserMetrics: BrowserMetrics = {
    metricsVersion: '1.0.0',
    subjectSha,
    contractSha256: contract.contractSha256,
    pageLoadCells,
    lighthouseCells,
    explorer: {
      routeId: removePiiRoute.id,
      stageIds,
      warmups: contract.runs.explorerWarmups,
      measuredTransitions: contract.runs.explorerMeasuredTransitions,
      scriptingMs,
      eventDurationsMs,
      traceArtifactId: explorerTrace.id,
    },
  };
  artifacts.push(
    writeJsonEvidenceArtifact(
      evidenceRoot,
      'raw/browser-metrics.json',
      browserMetrics,
      { id: 'browser-metrics', kind: 'browser-metrics' }
    )
  );

  const manifest: PerformanceEvidenceManifest = {
    evidenceVersion: '1.0.0',
    role,
    contractId: 'performance-v1',
    contractSha256: contract.contractSha256,
    subjectSha,
    environmentId,
    startedAt,
    finishedAt: new Date().toISOString(),
    capability: { status: 'AVAILABLE' },
    fixtureIds: contract.fixtures.map((fixture) => fixture.id),
    stageIds,
    toolVersions,
    artifacts: artifacts.sort((left, right) =>
      left.id < right.id ? -1 : left.id > right.id ? 1 : 0
    ),
  };
  const evidenceSchema = readJson(resolve(contract.evidenceSchema));
  const schemaErrors = validateJsonSchema(manifest, evidenceSchema, 'evidence');
  if (schemaErrors.length > 0) {
    throw new Error(
      `Evidence manifest schema validation failed:\n${schemaErrors.join('\n')}`
    );
  }
  writePerformanceEvidenceManifest(evidenceRoot, manifest);
});
