import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';

import {
  analyticsBlockedUrlPatterns,
  isAnalyticsHost,
} from '../../scripts/analytics-tags';
import {
  reportProblems,
  verifyAnalyticsBuild,
} from '../../scripts/verify-analytics-build';

const roots: string[] = [];
after(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

function fixture(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'analytics-build-'));
  roots.push(root);
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(join(root, path, '..'), { recursive: true });
    writeFileSync(join(root, path), content);
  }
  return root;
}

const productionPage = [
  '<!doctype html><html><head>',
  '</head><body>',
  '<div id="__docusaurus"></div>',
  '<img referrerpolicy="no-referrer-when-downgrade" src="https://static.scarf.sh/a.png?x-pxid=82d5c930-f525-4047-bb21-25a09e68ed2d" alt="" width="0" height="0">',
  '</body></html>',
].join('');

const productionScript =
  'posthog.init("phc_f467hBf7ZUEc5HDT3xFcbhZ4tL7wUYJH0COw9Y2bzSK",{api_host:"https://web.t.expanso.io"});' +
  'script.src="https://www.googletagmanager.com/gtag/js?id=G-6YXD85WVC6&l=expansoExamplesAnalyticsLayer";';

const unminifiedProductionPage = [
  '<!doctype html><html><head>',
  '</head><body>',
  '<div id="__docusaurus"></div>',
  "<img alt='' src = 'https://static.scarf.sh/a.png?x-pxid=82d5c930-f525-4047-bb21-25a09e68ed2d' width='0'>",
  '</body></html>',
].join('');

// The Google Tag Manager container and the old GA guard this site used to emit.
// GTM fired GA4, Google Ads and six other vendors before any consent choice.
const retiredGtmTags = [
  '<script>/^(docs|examples)\\.expanso\\.io$/.test(window.location.hostname)&&(window["ga-disable-G-X1RJ0QGN3Z"]=!0)</script>',
  '<script>!function(e,t,a,n){e[n]=e[n]||[],e[n].push({"gtm.start":(new Date).getTime(),event:"gtm.js"});var g=t.getElementsByTagName(a)[0],m=t.createElement(a);m.async=!0,m.src="https://www.googletagmanager.com/gtm.js?id=GTM-MPSKFDMF",g.parentNode.insertBefore(m,g)}(window,document,"script","dataLayer")</script>',
  '<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-MPSKFDMF" height="0" width="0"></iframe></noscript>',
].join('');

const plainPage =
  '<!doctype html><html><body><div id="__docusaurus"></div></body></html>';
const redirectStub =
  '<!doctype html><html><head><meta http-equiv="refresh" content="0; url=/x/"></head></html>';

describe('analytics build variant verifier', () => {
  it('passes a build that carries no analytics host or identifier', () => {
    const root = fixture({
      'index.html': plainPage,
      'examples/x/index.html': redirectStub,
      'assets/js/main.js': 'console.log("no delivery code")',
      'img/logo.png': 'binary',
    });
    const report = verifyAnalyticsBuild(root, 'none');
    assert.deepEqual(report.findings, []);
    assert.deepEqual(reportProblems(report), []);
    assert.equal(report.scannedFiles, 3);
  });

  it('names every file and marker when a normal build leaks a tag', () => {
    const root = fixture({
      'index.html': productionPage.replace(
        '</head>',
        `${retiredGtmTags}</head>`
      ),
      'assets/js/main.js': productionScript,
      'about/index.html': plainPage.replace(
        '</body>',
        '<script src="https://www.clarity.ms/tag/abc"></script></body>'
      ),
    });
    const problems = reportProblems(verifyAnalyticsBuild(root, 'none'));
    assert.ok(
      problems.includes('index.html contains analytics marker static.scarf.sh')
    );
    assert.ok(
      problems.includes('index.html contains analytics marker GTM-MPSKFDMF')
    );
    assert.ok(
      problems.includes(
        'assets/js/main.js contains analytics marker web.t.expanso.io'
      )
    );
    assert.ok(
      problems.includes('about/index.html contains analytics marker clarity.ms')
    );
  });

  it('passes a production build whose pages and scripts carry every tag', () => {
    const root = fixture({
      'index.html': productionPage,
      'data-security/remove-pii/index.html': productionPage,
      'examples/x/index.html': redirectStub,
      'assets/js/main.js': productionScript,
    });
    const report = verifyAnalyticsBuild(root, 'production');
    assert.equal(report.pages, 2);
    assert.deepEqual(reportProblems(report), []);
  });

  it('accepts the unminified plugin shape of every production tag', () => {
    const root = fixture({
      'index.html': unminifiedProductionPage,
      'assets/js/main.js': productionScript,
    });
    const report = verifyAnalyticsBuild(root, 'production');
    assert.equal(report.pages, 1);
    assert.deepEqual(reportProblems(report), []);
  });

  it('fails a production build that brings back the retired GTM container', () => {
    const root = fixture({
      'index.html': productionPage.replace(
        '</head>',
        `${retiredGtmTags}</head>`
      ),
      'assets/js/main.js': productionScript,
    });
    const problems = reportProblems(verifyAnalyticsBuild(root, 'production'));
    assert.deepEqual(problems, [
      'index.html carries retired tag GTM-MPSKFDMF',
      'index.html carries retired tag googletagmanager.com/gtm.js',
      'index.html carries retired tag googletagmanager.com/ns.html',
      'index.html carries retired tag G-X1RJ0QGN3Z',
    ]);
  });

  it('fails a production build that lost a page tag or an adapter', () => {
    const root = fixture({
      'index.html': productionPage,
      'about/index.html': productionPage.replace(
        /<img [^>]*static\.scarf\.sh[^>]*>/,
        ''
      ),
      'assets/js/main.js': productionScript.replace(
        'web.t.expanso.io',
        'example.invalid'
      ),
    });
    const problems = reportProblems(verifyAnalyticsBuild(root, 'production'));
    assert.deepEqual(problems, [
      'about/index.html is missing production tag scarf-pixel',
      'assets/js is missing production tag web.t.expanso.io',
    ]);
  });

  it('fails a production build with no analytics at all', () => {
    const root = fixture({ 'index.html': plainPage, 'assets/js/main.js': '' });
    const problems = reportProblems(verifyAnalyticsBuild(root, 'production'));
    assert.ok(problems.length >= 5);
    assert.ok(
      problems.includes('production build carries no analytics marker at all')
    );
  });

  it('rejects a missing or empty build directory', () => {
    assert.throws(() => verifyAnalyticsBuild('/nonexistent/build', 'none'));
    assert.throws(() => verifyAnalyticsBuild(fixture({}), 'none'));
  });
});

describe('analytics host matching shared with the browser tests', () => {
  it('matches analytics hosts and their subdomains only', () => {
    assert.equal(isAnalyticsHost('static.scarf.sh'), true);
    assert.equal(isAnalyticsHost('www.googletagmanager.com'), true);
    assert.equal(isAnalyticsHost('us.i.posthog.com'), true);
    assert.equal(isAnalyticsHost('web.t.expanso.io'), true);
    assert.equal(isAnalyticsHost('px.ads.linkedin.com'), true);
    assert.equal(isAnalyticsHost('examples.expanso.io'), false);
    assert.equal(isAnalyticsHost('docs.scarf.sh'), false);
    assert.equal(isAnalyticsHost('127.0.0.1'), false);
  });

  it('emits one DevTools block pattern per host', () => {
    const patterns = analyticsBlockedUrlPatterns();
    assert.ok(patterns.includes('*static.scarf.sh/*'));
    assert.ok(patterns.includes('*googletagmanager.com/*'));
    assert.ok(patterns.every((pattern) => /^\*[a-z0-9.-]+\/\*$/.test(pattern)));
  });
});
