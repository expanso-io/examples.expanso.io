import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  rmSync,
} from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { parse, stringify } from 'yaml';
import {
  classifyPipelineCode,
  extractYamlCodeBlocks,
} from '../../src/lib/pipelineCode';
import { discoverPipelineFiles } from '../../scripts/validation/inventory';
import {
  LocalEdgeAgent,
  resolveEdgeBinary,
  validateSource,
} from '../../scripts/validation/edge';
import { wrapFragment } from '../../scripts/validation/harness';

const root = process.cwd();
const edge = resolveEdgeBinary(root, { install: true, log: () => {} });
const work = mkdtempSync(join(root, '.bin', 'selected-review-'));
const environment = JSON.parse(
  readFileSync('tests/fixtures/pipeline-inputs/manifest.json', 'utf8')
).environment;
const agent = new LocalEdgeAgent(edge, work, environment);
let sequence = 0;
before(async () => agent.start());
after(async () => {
  await agent.stop();
  rmSync(work, { recursive: true, force: true });
});

async function execute(
  source: string,
  records: unknown[],
  raw = false,
  inputBytes?: Buffer,
  expectedState = 'completed'
): Promise<Buffer> {
  const document = parse(source);
  const config = document.config ?? document;
  const target = join(work, `result-${++sequence}`);
  const input = join(work, `input-${sequence}`);
  writeFileSync(
    input,
    inputBytes ??
      records.map((record) => JSON.stringify(record)).join('\n') + '\n'
  );
  config.input = {
    file: { paths: [input], codec: inputBytes ? 'all-bytes' : 'lines' },
  };
  config.output = {
    file: { path: target, codec: raw ? 'all-bytes' : 'lines' },
  };
  const validation = validateSource(edge, root, stringify(config), environment);
  assert.equal(validation.status, 'PASS', JSON.stringify(validation.errors));
  const deployed = await agent.deploy({
    name: `selected-review-${sequence}`,
    type: 'pipeline',
    config,
  });
  assert.ok(deployed.ok, JSON.stringify(deployed));
  if (!deployed.ok) throw new Error(deployed.error);
  try {
    const deadline = Date.now() + 15_000;
    let state = '';
    while (Date.now() < deadline) {
      state = (await agent.executionStatus(deployed.jobId))?.state ?? '';
      if (['completed', 'failed', 'stopped'].includes(state)) break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.equal(
      state,
      expectedState,
      readFileSync(agent.pipelineLogPath(deployed.jobId), 'utf8')
    );
    return readFileSync(target);
  } finally {
    await agent.deleteJob(deployed.jobId);
  }
}

const fixture = {
  sensor_id: 'sensor-1',
  timestamp: '2026-10-06T12:00:00Z',
  readings: { temperature_celsius: 22, humidity_percent: 45 },
};
for (const path of [
  'examples/explorer-stages/enforce-schema/03-validate-route.yaml',
  'examples/explorer-stages/enforce-schema/04-monitor-quality.yaml',
  'examples/data-security/step-2-validate-route-dlq.yaml',
  'examples/data-security/step-3-monitor-quality-metrics.yaml',
]) {
  test(`sensor schema preserves records and marks failures: ${path}`, async () => {
    const bad = {
      ...fixture,
      timestamp: 'not-a-time',
      readings: { temperature_celsius: 'hot', humidity_percent: 150 },
    };
    const outputs = (
      await execute(
        readFileSync(path, 'utf8'),
        [fixture, bad],
        false,
        undefined,
        'failed'
      )
    )
      .toString()
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
    assert.equal(outputs.length, 2);
    const valid = outputs.find((row) => row.status === 'valid');
    const invalid = outputs.find((row) => row.status === 'invalid');
    assert.deepEqual(valid, { ...fixture, status: 'valid' });
    assert.equal(invalid.sensor_id, bad.sensor_id);
    assert.deepEqual(invalid.readings, bad.readings);
  });
}

for (const path of [
  'examples/data-security/step-2-encrypt-pii.yaml',
  'examples/explorer-stages/encrypt-data/03-encrypt-pii-customer-data.yaml',
]) {
  test(`country prefix is removed before extracting area code: ${path}`, async () => {
    const source = wrapFragment(parse(readFileSync(path, 'utf8')))?.source;
    assert.ok(source);
    const records = ['+1-415-555-0123', '415-555-0123'].map((phone) => ({
      customer: {
        phone,
        ssn: '123-45-6789',
        email: 'ada@example.com',
        date_of_birth: '1985-03-14',
      },
    }));
    const outputs = (await execute(source, records))
      .toString()
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
    assert.equal(outputs.length, 2);
    for (const output of outputs)
      assert.equal(output.customer.phone_area_code, '415');
  });
}

for (const path of [
  'examples/explorer-stages/transform-formats/02-json-avro.yaml',
  'examples/data-transformation/step-1-json-to-avro.yaml',
]) {
  test(`real Avro binary encoding: ${path}`, async () => {
    const source = readFileSync(path, 'utf8');
    const document = parse(source);
    const schema = JSON.parse(document.pipeline.processors[1].avro.schema);
    const sensor = {
      sensor_id: 'sensor-1',
      temperature_celsius: 22,
      humidity_percent: 45,
      timestamp: fixture.timestamp,
    };
    const bytes = await execute(source, [sensor], true);
    const avsc = createRequire(import.meta.url)('avsc');
    const codec = avsc.Type.forSchema(schema);
    assert.deepEqual({ ...codec.fromBuffer(bytes) }, sensor);
    assert.notDeepEqual(bytes, Buffer.from(JSON.stringify(sensor)));
  });
}

test('all fragment forms are labeled; indented complete fences are inventoried', () => {
  for (const source of [
    'window:\n  tumbling:\n    size: 1m',
    'dedup:\n  cache: seen',
    '- metric:\n    type: counter\n    name: count',
    'processor_resources:\n  - label: normalize\n    mapping: root = this',
  ])
    assert.equal(classifyPipelineCode(source), 'fragment');
  const page =
    '    ```yaml title="inline"\n    input:\n      generate: {count: 1, mapping: "root = {}"}\n    output:\n      drop: {}\n    ```\n';
  const blocks = extractYamlCodeBlocks(page);
  assert.equal(blocks.length, 1);
  assert.equal(classifyPipelineCode(blocks[0].source), 'complete');
  const inventory = discoverPipelineFiles(root);
  const complete = inventory.find(
    (file) =>
      file.sourcePath ===
      'docs/data-transformation/transform-formats/step-4-auto-detect-formats.mdx'
  );
  assert.equal(complete?.kind, 'complete-job');
  assert.equal(complete?.surface, 'page');
  assert.ok(
    inventory.some(
      (file) =>
        file.sourcePath ===
        'docs/data-transformation/aggregate-time-windows/troubleshooting.mdx'
    )
  );
});

test('invalid inline configuration fails the real Edge boundary', () => {
  const blocks = extractYamlCodeBlocks(
    '```yaml\ninput: {unknown_input: {}}\noutput: {drop: {}}\n```\n'
  );
  assert.equal(validateSource(edge, root, blocks[0].source).status, 'FAIL');
});

test('latest cache is accepted only for the currently resolved release', () => {
  const sandbox = join(work, 'latest');
  const bin = join(sandbox, '.bin', 'edge-latest');
  const commands = join(sandbox, 'commands');
  mkdirSync(bin, { recursive: true });
  mkdirSync(commands);
  writeFileSync(join(bin, 'expanso-edge'), '#!/bin/sh\necho v2.1.22\n', {
    mode: 0o755,
  });
  const curl = join(commands, 'curl');
  const previous = process.env.PATH;
  process.env.PATH = `${commands}:${previous}`;
  try {
    writeFileSync(curl, '#!/bin/sh\necho \'{"version":"v2.1.23"}\'\n', {
      mode: 0o755,
    });
    assert.throws(
      () =>
        resolveEdgeBinary(sandbox, {
          version: 'latest',
          install: false,
          log: () => {},
        }),
      /v2.1.23.*installation is disabled/
    );
    writeFileSync(curl, '#!/bin/sh\necho \'{"version":"v2.1.22"}\'\n', {
      mode: 0o755,
    });
    assert.equal(
      resolveEdgeBinary(sandbox, {
        version: 'latest',
        install: false,
        log: () => {},
      }).version,
      'v2.1.22'
    );
  } finally {
    process.env.PATH = previous;
  }
});

test('no-write failure preserves committed reports', () => {
  const report = join(root, 'validation-reports/latest/report.json');
  const before = readFileSync(report);
  const commands = join(work, 'failure-commands');
  mkdirSync(commands);
  writeFileSync(join(commands, 'curl'), '#!/bin/sh\nexit 1\n', { mode: 0o755 });
  const result = spawnSync(
    process.execPath,
    [
      'node_modules/tsx/dist/cli.mjs',
      'scripts/validate-examples.ts',
      '--edge-version',
      'v0.0.0',
      '--no-write',
      '--no-run',
    ],
    {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, PATH: `${commands}:${process.env.PATH}` },
    }
  );
  assert.equal(result.status, 1);
  assert.match(result.stderr, /could not download/);
  assert.deepEqual(readFileSync(report), before);
});

for (const path of [
  'examples/explorer-stages/transform-formats/04-auto-detection.yaml',
  'examples/data-transformation/step-3-auto-detect.yaml',
]) {
  test(`Avro header detection uses bytes: ${path}`, async () => {
    const document = parse(readFileSync(path, 'utf8'));
    document.pipeline.processors.push({
      mapping: 'root = {"format": meta("source_format")}',
    });
    const result = await execute(
      stringify(document),
      [{}],
      false,
      Buffer.from('4f626a01', 'hex')
    );
    assert.equal(JSON.parse(result.toString()).format, 'avro');
  });
}

test('selected MDX files reach Edge validation through the public CLI', () => {
  const page = 'docs/review-inline-regression.mdx';
  writeFileSync(
    page,
    '---\ntitle: Regression fixture\n---\n    ```yaml\n    input: {unknown_input: {}}\n    output: {drop: {}}\n    ```\n'
  );
  try {
    const result = spawnSync(
      process.execPath,
      [
        'node_modules/tsx/dist/cli.mjs',
        'scripts/validate-examples.ts',
        '--no-run',
        '--no-write',
        '--files',
        page,
      ],
      { cwd: root, encoding: 'utf8' }
    );
    assert.equal(result.status, 1);
    assert.match(
      result.stderr,
      /complete pipelines: 1; validate 0 pass \/ 1 fail/
    );
    assert.match(result.stderr, /review-inline-regression.mdx#L/);
  } finally {
    rmSync(page, { force: true });
  }
});

test('pin bumps dispatch all required workflows on the bump branch', () => {
  const workflow = parse(
    readFileSync('.github/workflows/nightly-edge-drift.yml', 'utf8')
  );
  assert.equal(workflow.permissions.actions, 'write');
  const dispatch = workflow.jobs.validate.steps.find(
    (step: { name: string }) =>
      step.name === 'Dispatch required checks for the pin-bump branch'
  );
  assert.ok(dispatch);
  const commands = join(work, 'dispatch-commands');
  mkdirSync(commands);
  const calls = join(work, 'dispatch-calls');
  writeFileSync(
    join(commands, 'gh'),
    '#!/bin/sh\nprintf \'%s\\n\' "$*" >> "$CALLS"\n',
    { mode: 0o755 }
  );
  const result = spawnSync('bash', ['-e', '-c', dispatch.run], {
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${commands}:${process.env.PATH}`,
      CALLS: calls,
      LATEST_VERSION: 'v2.1.23',
    },
  });
  assert.equal(result.status, 0, result.stderr);
  const invoked = readFileSync(calls, 'utf8')
    .trim()
    .split('\n')
    .map((call) => call.split(' '));
  assert.deepEqual(invoked.map((args) => args[2]).sort(), [
    'ai-check.yml',
    'ci.yml',
    'entity-policy.yml',
    'phase1-foundation.yml',
    'validate-examples.yml',
  ]);
  for (const args of invoked) {
    assert.deepEqual(args.slice(3), [
      '--ref',
      'automation/expanso-edge-v2.1.23',
    ]);
    const dispatched = parse(
      readFileSync(`.github/workflows/${args[2]}`, 'utf8')
    );
    assert.ok(Object.hasOwn(dispatched.on, 'workflow_dispatch'));
  }
});

test('live availability has a separate nightly and main-only workflow', () => {
  const workflow = parse(
    readFileSync('.github/workflows/live-pipeline-links.yml', 'utf8')
  );
  assert.deepEqual(workflow.on.push.branches, ['main']);
  assert.equal(workflow.on.schedule.length, 1);
  assert.equal(workflow.on.pull_request, undefined);
});
