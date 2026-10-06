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
import { parse, stringify } from 'yaml';
import {
  classifyPipelineCode,
  extractYamlCodeBlocks,
  hasUnclassifiedExpansoCode,
} from '../../src/lib/pipelineCode';
import { discoverPipelineFiles } from '../../scripts/validation/inventory';
import {
  LocalEdgeAgent,
  resolveEdgeBinary,
  validateSource,
} from '../../scripts/validation/edge';
import { wrapFragment } from '../../scripts/validation/harness';

const root = process.cwd();

const edge = resolveEdgeBinary(root, { log: () => {} });

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
  test(`partial Avro stage performs only validated JSON preparation: ${path}`, async () => {
    const source = readFileSync(path, 'utf8');

    const sensor = {
      sensor_id: 'sensor-1',
      temperature_celsius: 22,
      humidity_percent: 45,
      timestamp: fixture.timestamp,
    };

    const output = JSON.parse((await execute(source, [sensor])).toString());
    assert.deepEqual(output, sensor);
  });
}

test('installed Edge rejects the documented native Avro processor', () => {
  const source = `
input:
  generate:
    count: 1
    mapping: 'root = {}'
pipeline:
  processors:
    - avro:
        operator: from_json
        encoding: binary
        schema: '{"type":"record","name":"Empty","fields":[]}'
output:
  drop: {}
`;

  const result = validateSource(edge, root, source);
  assert.equal(result.status, 'FAIL');
  assert.equal(result.errors[0]?.path, 'pipeline.processors.0');
  assert.equal(result.errors[0]?.message, "Unknown component or field 'avro'");
});

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

  const partial = inventory.find(
    (file) =>
      file.sourcePath ===
      'docs/data-transformation/transform-formats/step-4-auto-detect-formats.mdx'
  );

  assert.equal(partial?.kind, 'fragment');
  assert.equal(partial?.surface, 'page');
  assert.ok(
    inventory.some(
      (file) =>
        file.sourcePath ===
        'docs/data-transformation/aggregate-time-windows/troubleshooting.mdx'
    )
  );
});

test('pipeline classifier excludes infrastructure YAML and fails unknown Expanso shapes', () => {
  for (const source of [
    'apiVersion: v1\nkind: ConfigMap\nmetadata:\n  name: sample',
    'services:\n  edge:\n    image: expanso/edge:latest',
    'global:\n  scrape_interval: 15s\nscrape_configs: []',
  ]) {
    assert.equal(classifyPipelineCode(source), null);
    assert.equal(hasUnclassifiedExpansoCode(source), false);
  }

  for (const source of [
    'processors:\n  - mapping: root = this',
    'cache_resources:\n  - label: seen\n    memory: {}',
    'window:\n  tumbling:\n    size: 1m',
    'dedup:\n  cache: seen\n  key: ${! content() }',
  ]) {
    assert.equal(classifyPipelineCode(source), 'fragment');
    assert.equal(hasUnclassifiedExpansoCode(source), false);
  }

  const unknown = 'mapping: root = this\nunknown_expanso_section: {}';
  assert.equal(classifyPipelineCode(unknown), null);
  assert.equal(hasUnclassifiedExpansoCode(unknown), true);
});

test('invalid inline configuration fails the real Edge boundary', () => {
  const blocks = extractYamlCodeBlocks(
    '```yaml\ninput: {unknown_input: {}}\noutput: {drop: {}}\n```\n'
  );

  assert.equal(validateSource(edge, root, blocks[0].source).status, 'FAIL');
});

test('Edge resolution uses PATH and never resolves or downloads a version', () => {
  const commands = join(work, 'path-binaries');
  mkdirSync(commands);
  const previous = process.env.PATH;

  try {
    process.env.PATH = commands;
    assert.throws(
      () => resolveEdgeBinary(root, { log: () => {} }),
      /expanso-edge is not installed on PATH.*install the latest release/
    );
    writeFileSync(join(commands, 'expanso-edge'), '#!/bin/sh\necho v9.8.7\n', {
      mode: 0o755,
    });
    const resolved = resolveEdgeBinary(root, { log: () => {} });
    assert.equal(resolved.path, join(commands, 'expanso-edge'));
    assert.equal(resolved.version, 'v9.8.7');
  } finally {
    process.env.PATH = previous;
  }
});

test('no-write failure preserves committed reports', () => {
  const report = join(root, 'validation-reports/latest/report.json');
  const before = readFileSync(report);

  const result = spawnSync(
    process.execPath,
    [
      'node_modules/tsx/dist/cli.mjs',
      'scripts/validate-examples.ts',
      '--no-write',
      '--unknown-option',
    ],
    {
      cwd: root,
      encoding: 'utf8',
    }
  );

  assert.equal(result.status, 1);
  assert.match(result.stderr, /unknown argument: --unknown-option/);
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

test('nightly validates latest only and deduplicates one tracking issue', () => {
  const workflow = parse(
    readFileSync('.github/workflows/nightly-edge-drift.yml', 'utf8')
  );

  assert.equal(workflow.permissions.contents, 'read');
  assert.equal(workflow.permissions.issues, 'write');
  assert.equal(workflow.permissions['pull-requests'], undefined);

  const source = readFileSync(
    '.github/workflows/nightly-edge-drift.yml',
    'utf8'
  );

  assert.doesNotMatch(
    source,
    /PINNED|pin-bump|--edge-version|pulls\.create|gh pr create/
  );

  // SAFETY: the workflow fixture is parsed immediately above and this test
  // asserts the named step fields before consuming their optional values.
  const steps = workflow.jobs.validate.steps as Array<{
    name: string;
    uses?: string;
    with?: { script?: string };
  }>;

  const failure = steps.find(
    (step) => step.name === 'Open or update the latest-release drift issue'
  );

  const resolved = steps.find(
    (step) => step.name === 'Close the resolved drift issue'
  );

  assert.equal(failure?.uses, 'actions/github-script@v7');
  assert.equal(resolved?.uses, 'actions/github-script@v7');
  assert.match(failure?.with?.script ?? '', /issues\.slice\(1\)/);
  assert.match(failure?.with?.script ?? '', /state_reason: 'not_planned'/);
  assert.match(resolved?.with?.script ?? '', /state_reason: 'completed'/);
});

test('live availability has a separate nightly and main-only workflow', () => {
  const workflow = parse(
    readFileSync('.github/workflows/live-pipeline-links.yml', 'utf8')
  );

  assert.deepEqual(workflow.on.push.branches, ['main']);
  assert.equal(workflow.on.schedule.length, 1);
  assert.equal(workflow.on.pull_request, undefined);
});
