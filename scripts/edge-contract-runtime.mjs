import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import readline from 'node:readline';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';

const root = fileURLToPath(new URL('..', import.meta.url));
const version = JSON.parse(
  fs.readFileSync(new URL('./edge-runtime-version.json', import.meta.url))
).version;
const edge = path.join(root, '.bin/expanso-edge');
const cli = path.join(root, '.bin/expanso-cli');
const file = path.resolve(process.argv[2]);
const scratch = fs.mkdtempSync(
  path.join(path.dirname(file), '.edge-contract-')
);
const output = path.join(scratch, 'output.jsonl');
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function port() {
  const server = net.createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const result = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return result;
}
let child,
  stopped,
  stopping = false,
  tail;
async function stop() {
  if (stopping) return;
  stopping = true;
  clearInterval(tail);
  if (child && child.exitCode === null) {
    child.kill('SIGTERM');
    const force = setTimeout(() => child.kill('SIGKILL'), 250);
    await stopped;
    clearTimeout(force);
  }
}
process.on('SIGTERM', () => {
  stop().then(() => process.exit(0));
});
process.on('SIGINT', () => {
  stop().then(() => process.exit(0));
});
try {
  for (const binary of [edge, cli]) {
    const found = spawnSync(binary, ['version'], { encoding: 'utf8' });
    if (
      found.status !== 0 ||
      found.stdout.trim().split(/\s+/).at(-1) !== version
    )
      throw new Error(
        `Install repository-pinned ${version} binaries with npm run setup-binaries`
      );
  }
  const config = YAML.parse(fs.readFileSync(file, 'utf8'));
  const stdin = !!config.input?.stdin;
  const ingress = stdin ? await port() : null;
  if (stdin)
    config.input = {
      http_server: {
        address: `127.0.0.1:${ingress}`,
        path: '/contract',
        timeout: '30s',
        allowed_verbs: ['POST'],
      },
    };
  function capture(value) {
    if (!value || typeof value !== 'object') return;
    if (value.stdout) {
      value.file = { path: output, codec: value.stdout.codec ?? 'lines' };
      delete value.stdout;
    }
    for (const child of Object.values(value)) capture(child);
  }
  capture(config.output);
  config.logger = { level: 'ERROR' };
  const api = `http://127.0.0.1:${await port()}`;
  child = spawn(
    edge,
    [
      'run',
      '--local',
      '--no-watch',
      '--data-dir',
      path.join(scratch, 'state'),
      '--api-listen',
      api.slice(7),
      '--log-level',
      'error',
    ],
    {
      env: { ...process.env, EXPANSO_DISABLEANALYTICS: 'true' },
      stdio: ['ignore', 'ignore', 'pipe'],
    }
  );
  let errors = '';
  child.stderr.on('data', (data) => (errors += data));
  stopped = new Promise((resolve) => child.on('close', resolve));
  for (let i = 0; ; i++) {
    if (i > 150 || child.exitCode !== null)
      throw new Error(`Edge API did not start: ${errors}`);
    try {
      if ((await fetch(api + '/api/v1/jobs')).ok) break;
    } catch {}
    await delay(20);
  }
  const job = path.join(scratch, 'job.yaml');
  fs.writeFileSync(
    job,
    YAML.stringify(
      { name: 'processor-contract', type: 'pipeline', config },
      { lineWidth: 0 }
    )
  );
  const deployment = spawnSync(cli, ['job', 'deploy', job, '--endpoint', api], {
    encoding: 'utf8',
    env: { ...process.env, EXPANSO_DISABLEANALYTICS: 'true' },
    timeout: 10000,
  });
  if (deployment.status !== 0)
    throw new Error(
      deployment.stderr || deployment.stdout || String(deployment.error)
    );
  let offset = 0;
  function flush() {
    if (!fs.existsSync(output)) return;
    const bytes = fs.readFileSync(output);
    if (bytes.length > offset) {
      process.stdout.write(bytes.subarray(offset));
      offset = bytes.length;
    }
  }
  tail = setInterval(flush, 20);
  const ready = async () => {
    for (let i = 0; i < 150; i++) {
      const jobs = await (await fetch(api + '/api/v1/jobs')).json();
      const state = jobs.items?.[0]?.status?.state?.state_type;
      if (state === 'running') return;
      if (['failed', 'stopped'].includes(state))
        throw new Error(JSON.stringify(jobs));
      await delay(20);
    }
    throw new Error('Edge job did not reach running state');
  };
  await ready();
  if (stdin) {
    const requests = [];
    for await (const line of readline.createInterface({
      input: process.stdin,
      crlfDelay: Infinity,
    })) {
      if (!line) continue;
      const request = fetch(`http://127.0.0.1:${ingress}/contract`, {
        method: 'POST',
        body: line,
        signal: AbortSignal.timeout(30000),
      }).then(async (response) => {
        if (!response.ok)
          throw new Error(
            `Input delivery failed: ${response.status} ${await response.text()}`
          );
      });
      request.catch(() => {});
      requests.push(request);
    }
    await Promise.all(requests);
    flush();
  } else {
    await stopped;
    if (!stopping) throw new Error(`Edge exited unexpectedly: ${errors}`);
  }
} catch (error) {
  process.stderr.write(String(error) + '\n');
  process.exitCode = 1;
} finally {
  await stop();
  fs.rmSync(scratch, { recursive: true, force: true });
}
