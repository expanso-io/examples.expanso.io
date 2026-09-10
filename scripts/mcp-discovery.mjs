import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

export function validateManifest(manifest) {
  assert.equal(manifest.server?.url, 'https://mcp.expanso.io/mcp');
  assert.equal(manifest.server?.transport, 'streamable-http');
  assert.ok(manifest.tools?.length > 0);
  assert.equal(
    new Set(manifest.tools.map((tool) => tool.name)).size,
    manifest.tools.length
  );
}

export function validateRpcResponse(body, id) {
  assert.equal(
    body.jsonrpc,
    '2.0',
    'Endpoint must return JSON-RPC, not a chat page'
  );
  assert.equal(body.id, id);
  assert.equal(body.error, undefined, 'Protocol response contains an error');
  assert.ok(body.result && typeof body.result === 'object');
  return body.result;
}

export async function probeManifest(manifest) {
  validateManifest(manifest);
  let session;
  let protocol = '2025-03-26';
  async function rpc(method, params, id) {
    const response = await fetch(manifest.server.url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        'MCP-Protocol-Version': protocol,
        ...(session ? { 'Mcp-Session-Id': session } : {}),
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method,
        params,
        ...(id ? { id } : {}),
      }),
      signal: AbortSignal.timeout(20000),
    });
    assert.ok(response.ok, `${method}: HTTP ${response.status}`);
    session = response.headers.get('mcp-session-id') || session;
    if (!id) return;
    const contentType = response.headers.get('content-type') || '';
    const text = await response.text();
    const messages = contentType.includes('text/event-stream')
      ? text
          .split('\n')
          .filter((line) => line.startsWith('data:'))
          .map((line) => JSON.parse(line.slice(5)))
      : [JSON.parse(text)];
    return validateRpcResponse(
      messages.find((message) => message.id === id) || {},
      id
    );
  }
  const initialized = await rpc(
    'initialize',
    {
      protocolVersion: protocol,
      capabilities: {},
      clientInfo: { name: 'examples-discovery-check', version: '1.0.0' },
    },
    1
  );
  protocol = initialized.protocolVersion;
  await rpc('notifications/initialized', {}, undefined);
  const tools = await rpc('tools/list', {}, 2);
  for (const tool of manifest.tools) {
    assert.ok(
      tools.tools.some((actual) => actual.name === tool.name),
      `Missing advertised tool: ${tool.name}`
    );
  }
  const resources = await rpc('resources/list', {}, 3);
  assert.ok(Array.isArray(resources.resources));
  return {
    protocolVersion: protocol,
    advertisedTools: manifest.tools.length,
    availableTools: tools.tools.length,
    resources: resources.resources.length,
  };
}

if (process.argv.includes('--live')) {
  const manifest = JSON.parse(
    await readFile(
      new URL('../static/.well-known/mcp.json', import.meta.url),
      'utf8'
    )
  );
  console.log(JSON.stringify(await probeManifest(manifest), null, 2));
}
