import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
const serialize = createRequire(require.resolve('terser-webpack-plugin'))(
  'serialize-javascript'
);
test('webpack serialization preserves normal values and rejects injected RegExp flags', () => {
  const code = serialize({
    value: '</script>',
    expression: /abc/gi,
    date: new Date('2026-09-08T00:00:00Z'),
    fn: function () {
      return 42;
    },
  });
  const value = vm.runInNewContext('(' + code + ')');
  assert.equal(value.value, '</script>');
  assert.equal(value.expression.source, 'abc');
  assert.equal(value.date.toISOString(), '2026-09-08T00:00:00.000Z');
  assert.equal(value.fn(), 42);
  const expression = /x/;
  Object.defineProperty(expression, 'flags', {
    value: 'g);globalThis.unexpected=true;//',
  });
  const context = {};
  try {
    vm.runInNewContext('(' + serialize(expression) + ')', context);
  } catch (error) {
    assert.equal(error.name, 'SyntaxError');
  }
  assert.equal(context.unexpected, undefined);
});

test('SockJS resolves a compatible patched UUID CommonJS API', () => {
  const uuid = createRequire(require.resolve('sockjs'))('uuid');
  assert.equal(uuid.version(uuid.v4()), 4);
  assert.throws(
    () => uuid.v5('test', uuid.v5.DNS, Buffer.alloc(1)),
    RangeError
  );
  assert.ok(require('sockjs').createServer());
});

test(
  'patched Lighthouse collects the LCP and CLS fields consumed by the performance harness',
  { timeout: 90000 },
  async () => {
    const { createServer } = await import('node:http');
    const { once } = await import('node:events');
    const { launch } = await import('chrome-launcher');
    const { default: lighthouse } = await import('lighthouse');
    const server = createServer((_request, response) => {
      response.setHeader('Content-Type', 'text/html');
      response.end(
        '<!doctype html><html lang="en"><title>Local performance fixture</title><body><h1>Local performance fixture</h1></body></html>'
      );
    });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    let chrome;
    try {
      chrome = await launch({
        chromeFlags: [
          '--headless',
          '--no-sandbox',
          '--disable-background-networking',
        ],
      });
      const result = await lighthouse(
        `http://127.0.0.1:${server.address().port}/`,
        {
          port: chrome.port,
          output: 'json',
          logLevel: 'error',
          onlyCategories: ['performance'],
          enableErrorReporting: false,
        }
      );
      assert.equal(result.lhr.lighthouseVersion, '13.4.1');
      assert.equal(result.lhr.runtimeError, undefined);
      for (const id of [
        'largest-contentful-paint',
        'cumulative-layout-shift',
      ]) {
        assert.ok(Number.isFinite(result.lhr.audits[id].numericValue), id);
      }
    } finally {
      if (chrome) await chrome.kill();
      await new Promise((resolve) => server.close(resolve));
    }
  }
);
