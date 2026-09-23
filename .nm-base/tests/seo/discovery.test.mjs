import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  validateManifest,
  validateRpcResponse,
} from '../../scripts/mcp-discovery.mjs';

const manifest = JSON.parse(
  readFileSync(new URL('../../static/.well-known/mcp.json', import.meta.url))
);
test('published manifest uses the verified protocol endpoint', () =>
  validateManifest(manifest));
test('chat homepage and generic HTTPS transport fail discovery validation', () => {
  assert.throws(() =>
    validateManifest({
      ...manifest,
      server: { ...manifest.server, url: 'https://mcp.expanso.io' },
    })
  );
  assert.throws(() =>
    validateManifest({
      ...manifest,
      server: { ...manifest.server, transport: 'https' },
    })
  );
});
test('HTTP success alone cannot pass the protocol check', () => {
  for (const body of [
    '<!DOCTYPE html>',
    { jsonrpc: '2.0', id: 1, error: { code: -32601 } },
    { jsonrpc: '2.0', id: 2, result: {} },
  ]) {
    assert.throws(() => validateRpcResponse(body, 1));
  }
  assert.deepEqual(
    validateRpcResponse({ jsonrpc: '2.0', id: 1, result: { tools: [] } }, 1),
    { tools: [] }
  );
});
