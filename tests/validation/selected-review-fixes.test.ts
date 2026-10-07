import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  rmSync,
  symlinkSync,
} from 'node:fs';
import { join } from 'node:path';
import { createServer } from 'node:net';
import { createServer as createHttpServer } from 'node:http';
import { execFileSync, spawnSync } from 'node:child_process';
import { parse, stringify } from 'yaml';
import { globSync } from 'glob';
import matter from 'gray-matter';
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
import { verifyOutputs } from '../../scripts/validation/expectations';
import { snippetDigest } from '../../scripts/validation/fence-languages';

const root = process.cwd();

const edge = resolveEdgeBinary(root, { log: () => {} });

mkdirSync(join(root, '.bin'), { recursive: true });
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
  expectedState = 'completed',
  captureRouting = false
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
  const targets: string[] = [];
  if (captureRouting) {
    assert.equal(config.output.switch.cases.length, 2);
    config.output.switch.cases.forEach(
      (entry: { output: unknown }, index: number) => {
        const path = target + '-' + index;
        targets.push(path);
        entry.output = { file: { path, codec: 'lines' } };
      }
    );
  } else
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

    return captureRouting
      ? Buffer.from(
          JSON.stringify(targets.map((path) => readFileSync(path, 'utf8')))
        )
      : readFileSync(target);
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

test('bare Bloblang mappings are inventoried and validated as fragments', () => {
  const source = 'let suffix = "ok"\nroot.status = $suffix';
  assert.equal(classifyPipelineCode(source), 'fragment');
  const wrapped = wrapFragment(source);
  assert.ok(wrapped);
  const result = validateSource(edge, root, wrapped.source, environment);
  assert.equal(result.status, 'PASS', JSON.stringify(result.errors));
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

test('nightly creates, deduplicates, and resolves tracking issues', async () => {
  const workflow = parse(
    readFileSync('.github/workflows/nightly-edge-drift.yml', 'utf8')
  );
  assert.equal(workflow.permissions.contents, 'read');
  assert.equal(workflow.permissions.issues, 'write');
  assert.equal(workflow.permissions['pull-requests'], undefined);

  const steps = workflow.jobs.validate.steps;
  const failure = steps.find(
    (step: { name: string }) =>
      step.name === 'Open or update the latest-release drift issue'
  );
  const resolved = steps.find(
    (step: { name: string }) => step.name === 'Close the resolved drift issue'
  );
  const calls: Array<{ method: string; args: Record<string, unknown> }> = [];
  const context = {
    repo: { owner: 'fixture', repo: 'examples' },
    serverUrl: 'https://github.com',
    runId: 123,
  };
  const environment = {
    DRIFT_LABEL: 'edge-latest-drift',
    EDGE_VERSION: 'v9.8.7',
    CLI_VERSION: 'v9.8.7',
    INSTALL_OUTCOME: 'success',
    VALIDATION_OUTCOME: 'failure',
  };

  async function run(script: string, numbers: number[], missingLabel = false) {
    calls.length = 0;
    const issues = Object.fromEntries(
      [
        'getLabel',
        'createLabel',
        'listForRepo',
        'create',
        'update',
        'createComment',
      ].map((method) => [
        method,
        async (args: Record<string, unknown>) => {
          calls.push({ method, args });
          if (method === 'getLabel' && missingLabel)
            throw Object.assign(new Error('missing label'), { status: 404 });
          if (method === 'listForRepo')
            return { data: numbers.map((number) => ({ number })) };
          return { data: {} };
        },
      ])
    );
    const executeScript = new Function(
      'github',
      'context',
      'require',
      'process',
      'return (async () => {' + script + '\n})();'
    );
    await executeScript(
      { rest: { issues } },
      context,
      () => ({ existsSync: () => false }),
      { env: environment }
    );
  }

  await run(failure.with.script, [], true);
  assert.ok(calls.some((call) => call.method === 'createLabel'));
  const created = calls.find((call) => call.method === 'create');
  assert.deepEqual(created?.args.labels, ['edge-latest-drift']);
  assert.match(String(created?.args.body), /full validation and execution/);
  assert.match(String(created?.args.body), /v9.8.7/);

  await run(failure.with.script, [11, 12, 13]);
  assert.equal(calls.filter((call) => call.method === 'create').length, 0);
  const updates = calls.filter((call) => call.method === 'update');
  assert.equal(updates.length, 3);
  assert.equal(updates[0].args.issue_number, 11);
  assert.match(String(updates[0].args.body), /full validation and execution/);
  assert.deepEqual(
    updates
      .slice(1)
      .map((call) => [
        call.args.issue_number,
        call.args.state,
        call.args.state_reason,
      ]),
    [
      [12, 'closed', 'not_planned'],
      [13, 'closed', 'not_planned'],
    ]
  );

  await run(resolved.with.script, [11, 12]);
  assert.deepEqual(
    calls
      .filter((call) => call.method === 'update')
      .map((call) => [
        call.args.issue_number,
        call.args.state,
        call.args.state_reason,
      ]),
    [
      [11, 'closed', 'completed'],
      [12, 'closed', 'completed'],
    ]
  );
  assert.equal(
    calls.filter((call) => call.method === 'createComment').length,
    2
  );
});

test('live availability has a separate nightly and main-only workflow', () => {
  const workflow = parse(
    readFileSync('.github/workflows/live-pipeline-links.yml', 'utf8')
  );

  assert.deepEqual(workflow.on.push.branches, ['main']);
  assert.equal(workflow.on.schedule.length, 1);
  assert.equal(workflow.on.pull_request, undefined);
});

function pageBlocks(path: string) {
  return extractYamlCodeBlocks(readFileSync(path, 'utf8'));
}

test('mismatched YAML fences fail extraction and inventory instead of disappearing', () => {
  const fixtureRoot = join(work, 'fence-inventory');
  mkdirSync(join(fixtureRoot, 'docs'), { recursive: true });
  const page = '        ```yaml\n        - mapping: root = this\n    ```\n';
  assert.throws(
    () => extractYamlCodeBlocks(page),
    /fence indentation mismatch/
  );
  writeFileSync(join(fixtureRoot, 'docs', 'broken.mdx'), page);
  assert.throws(
    () => discoverPipelineFiles(fixtureRoot),
    /fence indentation mismatch/
  );
});

test('published fingerprint mapping is inventoried, validates, and hashes business fields', async () => {
  const path =
    'docs/data-transformation/deduplicate-events/step-2-fingerprint-semantic-duplicates.mdx';
  const entries = discoverPipelineFiles(root).filter(
    (file) => file.sourcePath === path
  );
  assert.equal(entries.length, 1);
  const wrapped = wrapFragment(entries[0].document);
  assert.ok(wrapped);
  assert.equal(validateSource(edge, root, wrapped.source).status, 'PASS');
  const records = [
    { event_id: 'first', event_type: 'login', user_id: 'alice' },
    { event_id: 'second', event_type: 'login', user_id: 'alice' },
    { event_id: 'third', event_type: 'login', user_id: 'bob' },
  ];
  const outputs = (await execute(wrapped.source, records))
    .toString()
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));
  assert.equal(outputs.length, 3);
  const first = outputs.find((row) => row.event_id === 'first');
  const second = outputs.find((row) => row.event_id === 'second');
  const third = outputs.find((row) => row.event_id === 'third');
  assert.ok(first && second && third);
  assert.equal(first.dedup_hash, second.dedup_hash);
  assert.notEqual(first.dedup_hash, third.dedup_hash);
});

test('ID tutorial replacements retain the first occurrence and filter repeated IDs', async () => {
  const original = parse(
    pageBlocks(
      'docs/data-transformation/deduplicate-events/step-1-hash-based-exact-duplicates.mdx'
    )[0].source
  );
  const replacements = pageBlocks(
    'docs/data-transformation/deduplicate-events/step-3-id-based-unique-identifiers.mdx'
  );
  assert.equal(replacements.length, 3);
  for (let index = 0; index < replacements.length; index++)
    original.config.pipeline.processors[index] = parse(
      replacements[index].source
    )[0];
  const outputs = (
    await execute(stringify(original), [
      { event_id: 'abc-123', message: 'hello' },
      { event_id: 'abc-123', message: 'hello again' },
      { event_id: 'def-456', message: 'new event' },
    ])
  )
    .toString()
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));
  assert.deepEqual(
    outputs.map((row) => [row.event_id, row.message]),
    [
      ['abc-123', 'hello'],
      ['def-456', 'new event'],
    ]
  );
});

for (const path of [
  'docs/data-transformation/parse-logs/step-2-parse-csv-data.mdx',
  'docs/data-transformation/parse-logs/step-4-multi-format-detection.mdx',
]) {
  test(`published CSV parser preserves quoted delimiters: ${path}`, async () => {
    const output = JSON.parse(
      (
        await execute(pageBlocks(path)[0].source, [
          {
            raw_log:
              '2025-10-20T14:23:45Z,"temperature,ambient",temp-sensor-01,35.5,celsius',
          },
        ])
      ).toString()
    );
    assert.equal(output.metric_name, 'temperature,ambient');
    assert.equal(output.sensor_id, 'temp-sensor-01');
    assert.equal(output.value, '35.5');
    assert.equal(output.unit, 'celsius');
  });
}

test('published ORAN timestamps use seconds and preserve fractional precision', async () => {
  const blocks = pageBlocks(
    'docs/integrations/oran-telco-pipeline/step-2-transform-and-enrich.mdx'
  );
  const normalized = wrapFragment(parse(blocks[0].source));
  const validation = wrapFragment(parse(blocks[blocks.length - 1].source));
  assert.ok(normalized);
  assert.ok(validation);
  const rows = (
    await execute(normalized.source, [{ timestamp: 1 }, { timestamp: 1.125 }])
  )
    .toString()
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));
  const integer = rows.find((row) => row.timestamp === 1);
  const fractional = rows.find((row) => row.timestamp === 1.125);
  assert.ok(integer && fractional);
  assert.equal(integer.timestamp_iso, '1970-01-01T00:00:01.000000000Z');
  assert.equal(fractional.timestamp_iso, '1970-01-01T00:00:01.125000000Z');
  const output = JSON.parse(
    (
      await execute(validation.source, [
        {
          ...fractional,
          du_id: 'du-1',
          ptp_review: 'healthy',
          prb_efficiency: 1,
        },
      ])
    ).toString()
  );
  assert.equal(output.validation.timestamp, fractional.timestamp_iso);
});

async function withPostgres(check: (dsn: string) => Promise<void>) {
  const location = spawnSync('pg_config', ['--bindir'], { encoding: 'utf8' });
  assert.equal(location.status, 0, location.error?.message ?? location.stderr);
  const binaries = location.stdout.trim();
  const database = mkdtempSync(join(work, 'postgres-'));
  const run = (command: string, args: string[]) => {
    const result = spawnSync(join(binaries, command), args, {
      encoding: 'utf8',
      timeout: 45_000,
    });
    assert.equal(
      result.status,
      0,
      [result.error?.message, result.stderr, result.stdout]
        .filter(Boolean)
        .join('\n')
    );
  };
  run('initdb', [
    '-D',
    database,
    '-A',
    'trust',
    '-U',
    'fixture',
    '--no-locale',
    '--no-sync',
  ]);
  const reservation = createServer();
  await new Promise<void>((resolve, reject) => {
    reservation.once('error', reject);
    reservation.listen(0, '127.0.0.1', resolve);
  });
  const address = reservation.address();
  assert.ok(address && typeof address !== 'string');
  const port = address.port;
  await new Promise<void>((resolve, reject) =>
    reservation.close((error) => (error ? reject(error) : resolve()))
  );
  const dsn = `postgres://fixture@127.0.0.1:${port}/postgres?sslmode=disable`;

  try {
    run('pg_ctl', [
      'start',
      '-D',
      database,
      '-l',
      join(work, 'postgres.log'),
      '-o',
      `-h 127.0.0.1 -k '' -p ${port}`,
      '-w',
      '-t',
      '10',
    ]);
    run('psql', [
      '-X',
      '-d',
      dsn,
      '-v',
      'ON_ERROR_STOP=1',
      '-c',
      'CREATE TABLE users (user_id text PRIMARY KEY, user_name text, user_tier text); ' +
        "INSERT INTO users VALUES ('user_001', 'Ada', 'premium');",
    ]);
    await check(dsn);
  } finally {
    run('pg_ctl', ['stop', '-D', database, '-m', 'fast', '-w', '-t', '10']);
  }
}

test('published database circuit breaker enriches a healthy PostgreSQL result', async () => {
  await withPostgres(async (dsn) => {
    const wrapped = wrapFragment(
      parse(
        pageBlocks(
          'docs/data-routing/circuit-breakers/step-2-database-circuit-breakers.mdx'
        )[0].source
      )
    );
    assert.ok(wrapped);
    const config = parse(wrapped.source);
    config.pipeline.processors[0].try[0].branch.processors[0].sql_select.dsn =
      dsn;
    const output = JSON.parse(
      (await execute(stringify(config), [{ user_id: 'user_001' }])).toString()
    );
    assert.equal(output.user_id, 'user_001');
    assert.equal(output.db_enriched, true);
    assert.equal(output.db_status, 'success');
    assert.deepEqual(output.user_profile, { name: 'Ada', tier: 'premium' });
    assert.equal(output.fallback_reason, undefined);
  });
});

test('published multi-array splitter emits tagged items and discounts with order context', async () => {
  const wrapped = wrapFragment(
    parse(
      pageBlocks(
        'docs/data-routing/content-splitting/step-4-advanced-patterns.mdx'
      )[0].source
    )
  );
  assert.ok(wrapped);
  const records = [
    {
      order_id: 'order-a',
      items: [
        { sku: 'a', quantity: 2 },
        { sku: 'b', quantity: 1 },
      ],
      applied_discounts: [
        { code: 'sale', amount: 3 },
        { code: 'loyalty', amount: 1 },
      ],
    },
    {
      order_id: 'order-b',
      items: [],
      applied_discounts: [{ code: 'welcome', amount: 2 }],
    },
    {
      order_id: 'order-c',
      items: [{ sku: 'c', quantity: 4 }],
      applied_discounts: [],
    },
    { order_id: 'order-d', items: [], applied_discounts: [] },
  ];
  const outputs = (await execute(wrapped.source, records))
    .toString()
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));
  const expected = [
    { sku: 'a', quantity: 2, order_id: 'order-a', type: 'line_item' },
    { sku: 'b', quantity: 1, order_id: 'order-a', type: 'line_item' },
    {
      code: 'sale',
      amount: 3,
      order_id: 'order-a',
      type: 'discount_application',
    },
    {
      code: 'loyalty',
      amount: 1,
      order_id: 'order-a',
      type: 'discount_application',
    },
    {
      code: 'welcome',
      amount: 2,
      order_id: 'order-b',
      type: 'discount_application',
    },
    { sku: 'c', quantity: 4, order_id: 'order-c', type: 'line_item' },
  ];
  const key = (row: { order_id: string; sku?: string; code?: string }) =>
    row.order_id + (row.sku ?? row.code);
  assert.deepEqual(
    outputs.sort((a, b) => key(a).localeCompare(key(b))),
    expected.sort((a, b) => key(a).localeCompare(key(b)))
  );
});

for (const [path, dedicated] of [
  [
    'docs/data-transformation/parse-logs/step-3-parse-syslog-messages.mdx',
    true,
  ],
  [
    'docs/data-transformation/parse-logs/step-4-multi-format-detection.mdx',
    false,
  ],
] as const) {
  test(`published syslog parser accepts optional PIDs and padded dates: ${path}`, async () => {
    const fixtures = [
      {
        raw_log: '<134>Oct 20 14:23:45 edge-node-01 app[12345]: connected',
        timestamp: 'Oct 20 14:23:45',
        pid: '12345',
        message: 'connected',
      },
      {
        raw_log: '<134>Oct 7 14:23:45 edge-node-01 app: ready',
        timestamp: 'Oct 7 14:23:45',
        pid: '',
        message: 'ready',
      },
      {
        raw_log: '<134>Oct  7 14:23:45 edge-node-01 app: padded',
        timestamp: 'Oct  7 14:23:45',
        pid: '',
        message: 'padded',
      },
      {
        raw_log: '<134>Oct  7 14:23:45 edge-node-01 app[42]: padded-pid',
        timestamp: 'Oct  7 14:23:45',
        pid: '42',
        message: 'padded-pid',
      },
    ];
    const outputs = (
      await execute(
        pageBlocks(path)[0].source,
        fixtures.map(({ raw_log }) => ({ raw_log }))
      )
    )
      .toString()
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
    assert.equal(outputs.length, fixtures.length);
    for (const fixture of fixtures) {
      const output = outputs.find((row) => row.message === fixture.message);
      assert.ok(output);
      assert.equal(output.timestamp, fixture.timestamp);
      assert.equal(output.pid, fixture.pid);
      assert.equal(output.tag, 'app');
      assert.equal(output.hostname, 'edge-node-01');
      assert.equal(output.priority, '134');
      if (dedicated) {
        assert.equal(output.facility, 16);
        assert.equal(output.severity, 6);
      } else assert.equal(output.parsed_by, 'syslog_parser');
    }
  });
}

test('foundation installer steps resolve freshly installed binaries in the same shell', () => {
  const workflow = parse(
    readFileSync('.github/workflows/phase1-foundation.yml', 'utf8')
  );
  const jobs: Record<
    string,
    { steps?: Array<{ name: string; run?: string }> }
  > = workflow.jobs;
  const steps = Object.values(jobs)
    .flatMap((job) => job.steps ?? [])
    .filter(
      (step) => step.name === 'Install latest Expanso validation binaries'
    );
  assert.equal(steps.length, 2);
  const commands = spawnSync(
    '/bin/sh',
    ['-c', 'command -v mkdir; command -v bash; command -v chmod'],
    { encoding: 'utf8' }
  );
  assert.equal(commands.status, 0);
  const [mkdir, bash, chmod] = commands.stdout.trim().split('\n');

  for (const step of steps) {
    assert.ok(step.run);
    const runner = mkdtempSync(join(work, 'foundation-runner-'));
    const tools = join(runner, 'tools');
    mkdirSync(tools);
    for (const [name, target] of [
      ['mkdir', mkdir],
      ['bash', bash],
      ['chmod', chmod],
    ])
      symlinkSync(target, join(tools, name));
    const installer = [
      '#!/bin/bash',
      `printf '%s\\n' '#!/bin/sh' 'echo v9.8.7' > "$EXPANSO_INSTALL_DIR/expanso-COMPONENT"`,
      'chmod 755 "$EXPANSO_INSTALL_DIR/expanso-COMPONENT"',
    ].join('\n');
    writeFileSync(
      join(tools, 'curl'),
      `#!${process.execPath}
const fs = require('node:fs');
const args = process.argv.slice(2);
const url = args.find((arg) => arg.startsWith('https://'));
const component = url.split('/')[3];
if (!['edge', 'cli'].includes(component)) throw new Error('Unexpected installer URL');
const destination = args[args.indexOf('--output') + 1];
fs.writeFileSync(destination, ${JSON.stringify(installer)}.replaceAll('COMPONENT', component));
`,
      { mode: 0o755 }
    );
    writeFileSync(
      join(tools, 'npm'),
      `#!${process.execPath}
const {spawnSync} = require('node:child_process');
if (process.argv.slice(2).join(' ') !== 'run setup-binaries') throw new Error('Unexpected npm invocation');
const result = spawnSync(process.execPath, ${JSON.stringify([
        join(root, 'node_modules/tsx/dist/cli.mjs'),
        join(root, 'scripts/setup-binaries.ts'),
      ])}, { encoding: 'utf8', env: process.env });
process.stdout.write(result.stdout ?? '');
process.stderr.write(result.stderr ?? '');
process.exit(result.status ?? 1);
`,
      { mode: 0o755 }
    );
    const result = spawnSync(bash, ['-c', step.run], {
      cwd: root,
      encoding: 'utf8',
      timeout: 20_000,
      env: {
        ...process.env,
        PATH: tools,
        RUNNER_TEMP: runner,
        EXPANSO_INSTALL_DIR: join(runner, 'installed'),
        GITHUB_PATH: join(runner, 'github-path'),
      },
    });
    assert.equal(result.status, 0, result.error?.message ?? result.stderr);
    assert.match(result.stdout, /using expanso-edge v9.8.7/);
    assert.match(result.stdout, /using expanso-cli v9.8.7/);
  }
});

test('registered multi-format fixture satisfies its published execution contract', async () => {
  const path =
    'docs/data-transformation/parse-logs/step-4-multi-format-detection.mdx';
  const entry = discoverPipelineFiles(root).find(
    (file) => file.sourcePath === path && file.kind === 'complete-job'
  );
  assert.ok(entry);
  const manifest = JSON.parse(
    readFileSync('tests/fixtures/pipeline-inputs/manifest.json', 'utf8')
  );
  const expectations = JSON.parse(
    readFileSync('tests/fixtures/pipeline-inputs/expectations.json', 'utf8')
  );
  const fixture = manifest.pipelines[entry.path].fixture;
  const records = readFileSync(fixture, 'utf8')
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));
  assert.ok(entry.source);
  const output = (await execute(entry.source, records)).toString();
  verifyOutputs(expectations[entry.path], records, [output], environment);
});

test('published cached database circuit breaker preserves events on misses and hits', async () => {
  await withPostgres(async (dsn) => {
    const wrapped = wrapFragment(
      parse(
        pageBlocks(
          'docs/data-routing/circuit-breakers/step-4-advanced-patterns.mdx'
        )[0].source
      )
    );
    assert.ok(wrapped);
    const config = parse(wrapped.source);
    config.pipeline.threads = 1;
    config.pipeline.processors[1].switch[1].processors[0].try[0].branch.processors[0].sql_select.dsn =
      dsn;
    const outputs = (
      await execute(stringify(config), [
        { event_id: 'first', user_id: 'user_001' },
        { event_id: 'second', user_id: 'user_001' },
      ])
    )
      .toString()
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
    assert.equal(outputs.length, 2);
    for (const [event_id, source] of [
      ['first', 'database'],
      ['second', 'cache'],
    ]) {
      const output = outputs.find((row) => row.event_id === event_id);
      assert.ok(output);
      assert.equal(output.user_id, 'user_001');
      assert.equal(output.data_source, source);
      assert.deepEqual(output.user_profile, { name: 'Ada', tier: 'premium' });
      assert.equal(output.db_error, undefined);
    }
  });
});

test('published JSON parser guards malformed data and classifies parsed objects', async () => {
  const fixtures = [
    {
      raw_log: '  {"level":"info","message":"whitespace JSON"}',
      expected: { level: 'info', message: 'whitespace JSON', was_json: true },
    },
    ...[
      '{not JSON',
      'web server started',
      '[1,2]',
      '42',
      'true',
      'null',
      '"a string"',
    ].map((raw_log) => ({
      raw_log,
      expected: { message: raw_log, level: 'unknown', was_json: false },
    })),
  ];
  const output = (
    await execute(
      pageBlocks(
        'docs/log-processing/filter-severity/step-1-parse-json-add-metadata.mdx'
      )[0].source,
      [fixtures.map(({ raw_log }) => ({ raw_log }))]
    )
  ).toString();
  const rows = output
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));
  assert.equal(rows.length, fixtures.length);
  for (const fixture of fixtures)
    assert.deepEqual(
      rows.find((row) => row.message === fixture.expected.message),
      fixture.expected
    );
});

test('published branch and grok fragments are inventoried, labeled, and validate', () => {
  const inventory = discoverPipelineFiles(root);
  const canonical = parse(
    pageBlocks(
      'docs/data-transformation/deduplicate-events/step-1-hash-based-exact-duplicates.mdx'
    )[0].source
  ).config;
  for (const [path, component] of [
    [
      'docs/data-transformation/deduplicate-events/step-3-id-based-unique-identifiers.mdx',
      'branch',
    ],
    ['docs/data-transformation/parse-logs/troubleshooting.mdx', 'grok'],
  ]) {
    const block = pageBlocks(path).find(
      (block) => parse(block.source)?.[0]?.[component]
    );
    assert.ok(block);
    assert.equal(classifyPipelineCode(block.source), 'fragment');
    const entry = inventory.find(
      (entry) => entry.sourcePath === path && entry.source === block.source
    );
    assert.equal(entry?.kind, 'fragment');
    assert.ok(entry?.document);
    const wrapped = wrapFragment(
      entry.document,
      component === 'branch' ? canonical : undefined
    );
    assert.ok(wrapped);
    assert.equal(
      validateSource(edge, root, wrapped.source, environment).status,
      'PASS'
    );
  }
});

test('published access parser preserves unknown byte counts and parses numeric ones', async () => {
  const rows = (
    await execute(
      pageBlocks(
        'docs/data-transformation/parse-logs/step-4-multi-format-detection.mdx'
      )[0].source,
      [
        {
          raw_log:
            '127.0.0.1 - - [01/Jan/2025:12:00:00 +0000] "GET / HTTP/1.1" 304 -',
        },
        {
          raw_log:
            '127.0.0.1 - - [01/Jan/2025:12:00:00 +0000] "GET / HTTP/1.1" 200 123',
        },
      ]
    )
  )
    .toString()
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));
  assert.equal(rows.length, 2);
  assert.equal(rows.find((row) => row.status === 304)?.bytes, null);
  assert.equal(rows.find((row) => row.status === 200)?.bytes, 123);
  for (const row of rows) {
    assert.equal(row.parsed_by, 'access_log_parser');
    assert.equal(row.ip, '127.0.0.1');
    assert.equal(row.request, 'GET / HTTP/1.1');
  }
});

for (const path of [
  'examples/enterprise-migration/db2-to-bigquery/db2-to-bigquery.yaml',
  'static/files/enterprise-migration/db2-to-bigquery/db2-to-bigquery.yaml',
  'docs/enterprise-migration/db2-to-bigquery/step-6-validate-required-fields.mdx',
]) {
  test(`published DB2 routing isolates invalid records from the BigQuery path: ${path}`, async () => {
    const completePath =
      'examples/enterprise-migration/db2-to-bigquery/db2-to-bigquery.yaml';
    const manifest = JSON.parse(
      readFileSync('tests/fixtures/pipeline-inputs/manifest.json', 'utf8')
    );
    const expectations = JSON.parse(
      readFileSync('tests/fixtures/pipeline-inputs/expectations.json', 'utf8')
    );
    const records = readFileSync(
      manifest.pipelines[completePath].fixture,
      'utf8'
    )
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
    let config;
    if (path.endsWith('.mdx')) {
      const complete = parse(readFileSync(completePath, 'utf8')).config;
      const fragment = parse(pageBlocks(path)[0].source);
      config = {
        ...complete,
        ...fragment,
        pipeline: {
          processors: [
            ...complete.pipeline.processors.slice(0, -1),
            ...fragment.pipeline.processors,
          ],
        },
      };
    } else config = parse(readFileSync(path, 'utf8')).config;
    assert.ok(config.output.switch.cases[1].output.gcp_bigquery);
    const outputs: string[] = JSON.parse(
      (
        await execute(
          stringify(config),
          records,
          false,
          undefined,
          'completed',
          true
        )
      ).toString()
    );
    verifyOutputs(expectations[completePath], records, outputs, environment);
    const rejected = outputs[0]
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
    const accepted = outputs[1]
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
    assert.equal(rejected.length, 1);
    assert.equal(rejected[0].transaction_id == null, true);
    assert.equal(rejected[0].customer_id, 'CUST-INVALID');
    assert.deepEqual(accepted.map((row) => row.transaction_id).sort(), [
      'TXN-2026-001',
      'TXN-2026-002',
    ]);
  });
}

test('HTTP input sub-fragments are labeled, inventoried, and validated in context', () => {
  const path =
    'docs/log-processing/production-pipeline/step-1-configure-http-input.mdx';
  const inventory = discoverPipelineFiles(root);
  for (const block of pageBlocks(path)) {
    assert.equal(classifyPipelineCode(block.source), 'fragment');
    const entry = inventory.find(
      (entry) => entry.path === `${path}#L${block.line}`
    );
    assert.equal(entry?.kind, 'fragment');
    const wrapped = wrapFragment(entry?.document);
    assert.ok(wrapped);
    const result = validateSource(edge, root, wrapped.source, environment);
    assert.equal(result.status, 'PASS', JSON.stringify(result.errors));
  }
  for (const source of [
    'auth: {type: header, header: X-API-Key, required_value: fixture}',
    'cors: {enabled: true, unsupported_option: true}',
    'auth: {}\ncors: {enabled: true}',
  ]) {
    assert.equal(classifyPipelineCode(source), 'fragment');
    const wrapped = wrapFragment(parse(source));
    assert.ok(wrapped);
    assert.equal(
      validateSource(edge, root, wrapped.source, environment).status,
      'FAIL'
    );
  }
});

test('every published YAML fence reaches classification or an explicit CI failure', () => {
  const inventory = discoverPipelineFiles(root);
  const failures: string[] = [];
  let blocks = 0;
  for (const path of globSync('docs/**/*.mdx').sort()) {
    const page = readFileSync(path, 'utf8');
    if (matter(page).data.draft === true) continue;
    for (const block of extractYamlCodeBlocks(page)) {
      blocks += 1;
      const kind = classifyPipelineCode(block.source);
      const unclassified = hasUnclassifiedExpansoCode(block.source);
      const entry = inventory.find(
        (entry) => entry.path === `${path}#L${block.line}`
      );
      if (kind === 'fragment') assert.equal(entry?.kind, 'fragment');
      else if (kind === 'complete')
        assert.ok(entry?.kind.startsWith('complete-'));
      else if (unclassified) {
        assert.equal(entry?.kind, 'invalid-yaml');
        assert.ok(entry.parseError);
        failures.push(`${path}#L${block.line}`);
      } else assert.equal(entry, undefined);
    }
  }
  assert.ok(blocks > 0);
  const result = spawnSync(
    process.execPath,
    [
      'node_modules/tsx/dist/cli.mjs',
      'scripts/validate-pipeline-code-blocks.ts',
    ],
    { cwd: root, encoding: 'utf8' }
  );
  assert.equal(result.status, failures.length ? 1 : 0, result.stderr);
  for (const location of failures)
    assert.ok(result.stderr.includes(location), location);
});

test('opaque YAML cannot silently bypass the public validation CLI', () => {
  const page = 'docs/review-unknown-fragment.mdx';
  writeFileSync(
    page,
    '---\ntitle: Regression fixture\n---\n```yaml\nopaque_section: {}\n```\n'
  );
  try {
    assert.equal(classifyPipelineCode('opaque_section: {}'), null);
    assert.equal(hasUnclassifiedExpansoCode('opaque_section: {}'), true);
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
    assert.ok(result.stderr.includes(`${page}#L5`), result.stderr);
  } finally {
    rmSync(page, { force: true });
  }
});

test('documented five-field CSV request executes the published parser', async () => {
  const path =
    'docs/data-transformation/parse-logs/step-4-multi-format-detection.mdx';
  const page = readFileSync(path, 'utf8');
  const payloads = [...page.matchAll(/-d '([^']+)'/g)].map((match) =>
    JSON.parse(match[1])
  );
  const record = payloads.find((payload) =>
    payload.raw_log.includes(',temperature,')
  );
  assert.ok(record);
  const output = JSON.parse(
    (await execute(pageBlocks(path)[0].source, [record])).toString()
  );
  assert.equal(output.parsed_by, 'csv_parser');
  assert.equal(output.metric_name, 'temperature');
  assert.equal(output.sensor_id, 'temp-sensor-01');
  assert.equal(output.value, '35.5');
  assert.equal(output.unit, 'celsius');
});

test('published HTTP API-key check rejects unauthorized requests before output', async () => {
  const path =
    'docs/log-processing/production-pipeline/step-1-configure-http-input.mdx';
  const block = pageBlocks(path).find(
    (block) => parse(block.source)?.input?.processors
  );
  assert.ok(block);
  const wrapped = wrapFragment(parse(block.source));
  assert.ok(wrapped);
  const config = parse(wrapped.source);
  const reservation = createServer();
  await new Promise<void>((resolve, reject) => {
    reservation.once('error', reject);
    reservation.listen(0, '127.0.0.1', resolve);
  });
  const address = reservation.address();
  assert.ok(address && typeof address !== 'string');
  const port = address.port;
  await new Promise<void>((resolve, reject) =>
    reservation.close((error) => (error ? reject(error) : resolve()))
  );
  config.input.http_server.address = `127.0.0.1:${port}`;
  const target = join(work, `http-auth-${++sequence}.jsonl`);
  config.output = { file: { path: target, codec: 'lines' } };
  const validation = validateSource(edge, root, stringify(config), environment);
  assert.equal(validation.status, 'PASS', JSON.stringify(validation.errors));
  const deployed = await agent.deploy({
    name: `http-auth-${sequence}`,
    type: 'pipeline',
    config,
  });
  assert.ok(deployed.ok, JSON.stringify(deployed));
  if (!deployed.ok) throw new Error(deployed.error);
  try {
    const url = `http://127.0.0.1:${port}/logs/ingest`;
    const request = (key?: string) =>
      fetch(url, {
        method: 'POST',
        body: JSON.stringify({ message: key ? 'accepted' : 'rejected' }),
        headers: {
          Origin: 'https://fixture.invalid',
          ...(key ? { 'X-API-Key': key } : {}),
        },
        signal: AbortSignal.timeout(2000),
      });
    let response: Response | undefined;
    const deadline = Date.now() + 10000;
    while (!response && Date.now() < deadline) {
      try {
        response = await request();
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
    assert.ok(response);
    assert.equal(response.status, 401);
    assert.equal((await request('wrong-key')).status, 401);
    const accepted = await request(environment.LOG_API_KEY);
    assert.equal(accepted.status, 200);
    assert.equal(accepted.headers.get('access-control-allow-origin'), '*');
    assert.deepEqual(
      readFileSync(target, 'utf8')
        .trim()
        .split('\n')
        .map((row) => JSON.parse(row)),
      [{ message: 'accepted' }]
    );
  } finally {
    await agent.deleteJob(deployed.jobId);
  }
});

test('published Splunk audit retains only CEF or ERROR while HEC receives every event', async () => {
  const page =
    'docs/integrations/splunk-edge-processing/step-4-route-to-splunk-hec.mdx';
  const block = pageBlocks(page).find((block) => {
    const output = parse(block.source)?.output;
    return output?.broker?.pattern === 'fan_out';
  });
  assert.ok(block);
  const wrapped = wrapFragment(parse(block.source));
  assert.ok(wrapped);
  const config = parse(wrapped.source);
  const received: Array<{ event: { id: string } }> = [];
  const receiver = createHttpServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on('data', (chunk: Buffer) => chunks.push(chunk));
    request.on('end', () => {
      try {
        received.push(JSON.parse(Buffer.concat(chunks).toString()));
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ text: 'Success', code: 0 }));
      } catch {
        response.writeHead(400);
        response.end();
      }
    });
  });
  await new Promise<void>((resolve, reject) => {
    receiver.once('error', reject);
    receiver.listen(0, '127.0.0.1', resolve);
  });
  const address = receiver.address();
  assert.ok(address instanceof Object);
  const target = join(work, `splunk-audit-${++sequence}.jsonl`);
  config.input = {
    file: {
      paths: [
        join(root, 'tests/fixtures/pipeline-inputs/splunk-audit-routing.jsonl'),
      ],
      codec: 'lines',
    },
  };
  config.output.broker.outputs[0].http_client.url = `http://127.0.0.1:${address.port}/services/collector/event`;
  config.output.broker.outputs[1].switch.cases[0].output.file.path = target;
  try {
    const validation = validateSource(
      edge,
      root,
      stringify(config),
      environment
    );
    assert.equal(validation.status, 'PASS', JSON.stringify(validation.errors));
    const deployed = await agent.deploy({
      name: `splunk-audit-${sequence}`,
      type: 'pipeline',
      config,
    });
    assert.ok(deployed.ok, JSON.stringify(deployed));
    if (!deployed.ok) throw new Error(deployed.error);
    try {
      let state = '';
      const deadline = Date.now() + 15000;
      while (Date.now() < deadline) {
        state = (await agent.executionStatus(deployed.jobId))?.state ?? '';
        if (['completed', 'failed', 'stopped'].includes(state)) break;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      assert.equal(state, 'completed');
      assert.deepEqual(received.map((record) => record.event.id).sort(), [
        'cef-info',
        'json-error',
        'json-info',
      ]);
      const audit = readFileSync(target, 'utf8')
        .trim()
        .split('\n')
        .map((row) => JSON.parse(row));
      assert.deepEqual(audit.map((record) => record.event.id).sort(), [
        'cef-info',
        'json-error',
      ]);
    } finally {
      await agent.deleteJob(deployed.jobId);
    }
  } finally {
    receiver.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
      receiver.close((error) => (error ? reject(error) : resolve()))
    );
  }
});

for (const healthy of [true, false]) {
  test(`published adaptive health check preserves sensor_id when healthy=${healthy}`, async () => {
    const path =
      'docs/data-routing/circuit-breakers/step-4-advanced-patterns.mdx';
    const block = pageBlocks(path)[2];
    const wrapped = wrapFragment(parse(block.source));
    assert.ok(wrapped);
    const config = parse(wrapped.source);
    const requests: string[] = [];
    const receiver = createHttpServer((request, response) => {
      requests.push(request.url ?? '');
      response.setHeader('Content-Type', 'application/json');
      if (request.url === '/health') {
        response.statusCode = healthy ? 200 : 503;
        response.end(JSON.stringify({ healthy }));
      } else {
        response.end(
          JSON.stringify({
            sensor_id: request.url?.split('/').at(-1),
            policy: request.headers['x-fixture-policy'],
          })
        );
      }
    });
    await new Promise<void>((resolve, reject) => {
      receiver.once('error', reject);
      receiver.listen(0, '127.0.0.1', resolve);
    });
    const address = receiver.address();
    assert.ok(address && typeof address !== 'string');
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const health =
      config.pipeline.processors[0].try[0].branch.processors[0].http;
    health.url = baseUrl + '/health';
    health.retries = 0;
    for (const [
      index,
      route,
    ] of config.pipeline.processors[2].switch.entries()) {
      route.processors[0].http.url = baseUrl + '/metadata/${!this.sensor_id}';
      route.processors[0].http.headers = {
        'X-Fixture-Policy': index === 0 ? 'normal' : 'fast',
      };
    }
    const records = readFileSync(
      'tests/fixtures/pipeline-inputs/adaptive-health-routing.jsonl',
      'utf8'
    )
      .trim()
      .split('\n')
      .map((row) => JSON.parse(row));
    try {
      const output = JSON.parse(
        (await execute(stringify(config), records)).toString()
      );
      assert.equal(output.sensor_id, records[0].sensor_id);
      assert.equal(output.policy, healthy ? 'normal' : 'fast');
      assert.deepEqual(requests, ['/health', '/metadata/temp_001']);
    } finally {
      receiver.closeAllConnections();
      await new Promise<void>((resolve, reject) =>
        receiver.close((error) => (error ? reject(error) : resolve()))
      );
    }
  });
}

test('published cache retrieval failure uses the database miss path', async () => {
  await withPostgres(async (dsn) => {
    const path =
      'docs/data-routing/circuit-breakers/step-4-advanced-patterns.mdx';
    const wrapped = wrapFragment(parse(pageBlocks(path)[0].source));
    assert.ok(wrapped);
    const config = parse(wrapped.source);
    config.pipeline.threads = 1;
    config.pipeline.processors[1].switch[1].processors[0].try[0].branch.processors[0].sql_select.dsn =
      dsn;
    let guardedReads = 0;
    const expireBeforeRead = (node: unknown): void => {
      if (Array.isArray(node)) {
        for (let index = 0; index < node.length; index += 1) {
          if (node[index]?.cache?.operator === 'get') {
            node.splice(index, 0, {
              cache: { ...node[index].cache, operator: 'delete' },
            });
            guardedReads += 1;
            index += 1;
          }
          expireBeforeRead(node[index]);
        }
      } else if (node !== null && typeof node === 'object') {
        for (const value of Object.values(node)) expireBeforeRead(value);
      }
    };
    expireBeforeRead(config.pipeline.processors);
    assert.equal(guardedReads, 1);
    config.pipeline.processors.unshift({
      cache: {
        resource: 'user_profile_cache',
        operator: 'set',
        key: 'user_${!this.user_id}',
        value: '{"name":"Stale","tier":"expired"}',
      },
    });
    const records = readFileSync(
      'tests/fixtures/pipeline-inputs/expired-profile-cache.jsonl',
      'utf8'
    )
      .trim()
      .split('\n')
      .map((row) => JSON.parse(row));
    const output = JSON.parse(
      (
        await execute(stringify(config), records, false, undefined, 'failed')
      ).toString()
    );
    assert.equal(output.event_id, records[0].event_id);
    assert.equal(output.user_id, records[0].user_id);
    assert.equal(output.profile_cached, false);
    assert.equal(output.data_source, 'database');
    assert.deepEqual(output.user_profile, { name: 'Ada', tier: 'premium' });
    assert.equal(output.db_error, undefined);
  });
});

test('published O-RAN file parsers extract values from raw telemetry lines', async () => {
  const path =
    'docs/integrations/oran-telco-pipeline/step-1-collect-oran-metrics.mdx';

  const block = pageBlocks(path)[0];
  const inputs = parse(block.source).config.input.broker.inputs;

  const fixtures = JSON.parse(
    readFileSync(
      'tests/fixtures/pipeline-inputs/oran-file-parsers.json',
      'utf8'
    )
  );

  for (const fixture of fixtures) {
    const source = stringify({
      pipeline: { processors: inputs[fixture.input].processors },
    });

    const output = JSON.parse(
      (
        await execute(source, [], false, Buffer.from(fixture.line, 'utf8'))
      ).toString()
    );

    assert.equal(output.metric_type, fixture.expected.metric_type);
    assert.equal(output.raw_line, fixture.line);

    for (const [field, value] of Object.entries(fixture.expected.values))
      assert.equal(output[field], value);
  }
});

test('published HTTP circuit breaker preserves sensor events on both routes', async () => {
  const path =
    'docs/data-routing/circuit-breakers/step-1-http-circuit-breakers.mdx';

  const block = pageBlocks(path)[0];
  const wrapped = wrapFragment(parse(block.source));
  assert.ok(wrapped);

  const config = parse(wrapped.source);

  const receiver = createHttpServer((request, response) => {
    if (request.url === '/metadata/fail') {
      request.socket.destroy();

      return;
    }

    response.setHeader('Content-Type', 'application/json');
    response.end(
      JSON.stringify({ metadata: { site: 'edge-a', firmware: '1.2.3' } })
    );
  });

  await new Promise<void>((resolve, reject) => {
    receiver.once('error', reject);
    receiver.listen(0, '127.0.0.1', resolve);
  });

  const address = receiver.address();
  assert.ok(address instanceof Object);

  const http = config.pipeline.processors[0].try[0].branch.processors[0].http;
  http.url = `http://127.0.0.1:${address.port}/metadata/\${!this.sensor_id}`;
  http.retries = 0;
  http.timeout = '500ms';

  const records = readFileSync(
    'tests/fixtures/pipeline-inputs/circuit-breaker-enrichment.jsonl',
    'utf8'
  )
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));

  try {
    const outputs = (await execute(stringify(config), records))
      .toString()
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));

    const success = outputs.find((row) => row.sensor_id === 'temp_001');
    const failure = outputs.find((row) => row.sensor_id === 'fail');
    assert.deepEqual(success, {
      ...records[0],
      metadata: { site: 'edge-a', firmware: '1.2.3' },
      enriched: true,
      api_status: 'success',
    });
    assert.deepEqual(failure, {
      ...records[1],
      enriched: false,
      api_status: 'failed',
      fallback_reason: 'api_circuit_breaker_open',
    });
  } finally {
    receiver.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
      receiver.close((error) => (error ? reject(error) : resolve()))
    );
  }
});

for (const [kind, paths, group, fields, keyName] of [
  [
    'payment',
    [
      'examples/data-security/step-1-payment-encryption.yaml',
      'examples/explorer-stages/encryption-patterns/02-payment-field-encryption.yaml',
    ],
    'payment',
    ['card_number', 'cvv', 'cardholder_name'],
    'PAYMENT_ENCRYPTION_KEY',
  ],
  [
    'identity',
    [
      'examples/data-security/step-2-pii-encryption.yaml',
      'examples/explorer-stages/encryption-patterns/03-identity-field-encryption.yaml',
    ],
    'customer',
    ['email', 'phone', 'ssn', 'first_name', 'last_name'],
    'PII_ENCRYPTION_KEY',
  ],
  [
    'address',
    [
      'examples/data-security/step-3-address-encryption.yaml',
      'examples/explorer-stages/encryption-patterns/04-address-data-encryption-location-privacy.yaml',
    ],
    'billing_address',
    ['street', 'zip'],
    'ADDRESS_ENCRYPTION_KEY',
  ],
] as const) {
  for (const path of paths) {
    test(`selected encryption retains recoverable ${kind} fields: ${path}`, async () => {
      const { createDecipheriv } = await import('node:crypto');
      const record = JSON.parse(
        readFileSync(
          'tests/fixtures/pipeline-inputs/encryption.jsonl',
          'utf8'
        ).split('\n')[0]
      );
      record.customer.first_name = 'Ada';
      record.customer.last_name = 'Lovelace';
      record.shipping_address = {
        ...record.billing_address,
        street: '20 Main Street',
      };
      const output = JSON.parse(
        (await execute(readFileSync(path, 'utf8'), [record])).toString()
      );
      for (const object of kind === 'address'
        ? ['billing_address', 'shipping_address']
        : [group]) {
        for (const field of fields) {
          assert.equal(Object.hasOwn(output[object], field), false);
          const encrypted = Buffer.from(
            output[object][field + '_encrypted'],
            'base64'
          );
          const nonce = Buffer.from(output[object][field + '_nonce'], 'base64');
          assert.equal(nonce.length, 12);
          const decipher = createDecipheriv(
            'aes-256-gcm',
            Buffer.from(environment[keyName]),
            nonce
          );
          decipher.setAuthTag(encrypted.subarray(-16));
          assert.equal(
            Buffer.concat([
              decipher.update(encrypted.subarray(0, -16)),
              decipher.final(),
            ]).toString(),
            record[object][field]
          );
        }
      }
      if (kind === 'payment')
        assert.equal(output.payment.card_last_four, '1111');
      if (kind === 'identity')
        assert.equal(output.customer.email_domain, 'example.com');
      if (kind === 'address')
        assert.equal(output.billing_address.zip_prefix, '941');
    });
  }
}

test('selected timestamp metadata retains numeric calendar components', async () => {
  const source = pageBlocks(
    'docs/data-transformation/normalize-timestamps/step-3-enrich-metadata.mdx'
  )[0].source;
  const rows = (
    await execute(source, [
      { timestamp_utc: '2025-10-20T18:23:45Z' },
      { timestamp_utc: '2025-10-26T00:00:00Z' },
    ])
  )
    .toString()
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));
  assert.deepEqual(
    rows.map((row) => row.time_metadata),
    [
      { year: 2025, month: 10, day: 20, hour: 18, day_of_week: 1 },
      { year: 2025, month: 10, day: 26, hour: 0, day_of_week: 0 },
    ]
  );
});

for (const path of [
  'examples/data-transformation/step-1-hash-based.yaml',
  'examples/data-transformation/step-2-fingerprint-based.yaml',
  'examples/data-transformation/step-3-id-based.yaml',
  'examples/explorer-stages/deduplicate-events/02-hash-based-deduplication.yaml',
  'examples/explorer-stages/deduplicate-events/03-fingerprint-based-deduplication.yaml',
  'examples/explorer-stages/deduplicate-events/04-id-based-deduplication.yaml',
]) {
  test(`selected deduplication serializes repeated records: ${path}`, async () => {
    const config = parse(readFileSync(path, 'utf8'));
    assert.equal(config.pipeline.threads, 1);
    config.cache_resources ??= [
      { label: 'dedup_cache', memory: { default_ttl: '1h' } },
    ];
    const record = {
      event_id: 'same',
      payload: { message: 'Retain the complete event', attributes: [1, 2] },
      event_type: 'signup',
      user: { email: 'ada@example.com' },
      signup_details: { source: 'web', plan: 'basic' },
    };
    const rows = (
      await execute(
        stringify(config),
        Array.from({ length: 200 }, () => record)
      )
    )
      .toString()
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
    assert.equal(rows.length, 1);
    assert.equal(rows[0].is_duplicate, false);
    for (const [field, value] of Object.entries(record))
      assert.deepEqual(rows[0][field], value);
  });
}

test('selected O-RAN polling inputs resolve their original cadences', () => {
  const blocks = pageBlocks(
    'docs/integrations/oran-telco-pipeline/step-1-collect-oran-metrics.mdx'
  );
  const configs = [
    parse(blocks[1].source).config,
    parse(blocks[2].source).config,
    parse(readFileSync('examples/integrations/oran-input.yaml', 'utf8')),
  ];
  const expected = [['1s', '1s', '10s'], ['1s'], ['30s']];
  for (const [index, config] of configs.entries()) {
    const inputs = config.input.broker?.inputs ?? [config.input];
    const intervals = inputs
      .filter((input: any) => input.http_client)
      .map((input: any) => {
        const resource = config.rate_limit_resources.find(
          (resource: any) => resource.label === input.http_client.rate_limit
        );
        assert.equal(resource.local.count, 1);
        return resource.local.interval;
      });
    assert.deepEqual(intervals, expected[index]);
    config.output = { drop: {} };
    const result = validateSource(edge, root, stringify(config), {
      DU_ENDPOINT: 'http://localhost:9999',
      DU_API_KEY: 'fixture',
    });
    assert.equal(result.status, 'PASS', JSON.stringify(result.errors));
  }
});

test('selected SCADA register parser emits scaled measurements', async () => {
  const source = readFileSync(
    'examples/integrations/scada-step-1-parse.yaml',
    'utf8'
  );
  const registers = [40001, 40003, 40005, 40007, 40009];
  const rows = [];
  for (const reg of registers) {
    const bytes = Buffer.from(
      `REG=${reg};VAL=14823;TS=1708290845;DEVICE=RTU-07A;STATUS=0`
    );
    rows.push(JSON.parse((await execute(source, [], false, bytes)).toString()));
  }
  assert.equal(rows.length, registers.length);
  for (const [index, row] of rows.entries()) {
    assert.equal(row.register, registers[index]);
    assert.equal(row.raw_value, 14823);
    assert.equal(row.device_id, 'RTU-07A');
    assert.equal(row.status, 0);
    assert.equal(row['@timestamp'], 1708290845);
    const measurement = [
      'voltage_kv',
      'current_a',
      'frequency_hz',
      'temp_c',
      'power_mw',
    ][index];
    assert.equal(
      row[measurement],
      index === 0 || index === 2 ? 148.23 : 1482.3
    );
    assert.equal(
      ['voltage_kv', 'current_a', 'frequency_hz', 'temp_c', 'power_mw'].filter(
        (field) => Object.hasOwn(row, field)
      ).length,
      1
    );
  }
});

for (const stage of [1, 2, 3]) {
  test(`selected timestamp tutorial stage ${stage} accepts published HTTP requests`, async () => {
    const config = parse(
      pageBlocks(
        'docs/data-transformation/normalize-timestamps/step-1-parse-formats.mdx'
      )[0].source
    ).config;
    for (const path of [
      'docs/data-transformation/normalize-timestamps/step-2-convert-timezones.mdx',
      'docs/data-transformation/normalize-timestamps/step-3-enrich-metadata.mdx',
    ].slice(0, stage - 1)) {
      config.pipeline.processors.push(
        ...parse(pageBlocks(path)[0].source).pipeline.processors
      );
    }
    const validation = validateSource(edge, root, stringify(config));
    assert.equal(validation.status, 'PASS', JSON.stringify(validation.errors));
    const scratch = join(work, `timestamp-http-${stage}`);
    mkdirSync(scratch);
    const httpAgent = new LocalEdgeAgent(edge, scratch);
    const records = readFileSync(
      'tests/fixtures/pipeline-inputs/timestamp-tutorial.jsonl',
      'utf8'
    )
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
    let output = '';
    try {
      await httpAgent.start();
      const deployed = await httpAgent.deploy({
        name: `timestamp-http-${stage}`,
        type: 'pipeline',
        config,
      });
      assert.ok(deployed.ok, JSON.stringify(deployed));
      if (!deployed.ok) throw new Error(deployed.error);
      for (const record of records) {
        const deadline = Date.now() + 10000;
        let response: Response | undefined;
        while (!response && Date.now() < deadline) {
          try {
            response = await fetch('http://localhost:8080/ingest', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(record),
              signal: AbortSignal.timeout(2000),
            });
          } catch {
            await new Promise((resolve) => setTimeout(resolve, 100));
          }
        }
        assert.ok(response, 'published HTTP input did not start');
        assert.equal(response.status, 200, await response.text());
      }
      const deadline = Date.now() + 10000;
      let state = '';
      while (Date.now() < deadline) {
        state = (await httpAgent.executionStatus(deployed.jobId))?.state ?? '';
        if (state === 'running' || state === 'failed') break;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      assert.equal(state, 'running');
    } finally {
      await httpAgent.stop();
      output = readFileSync(httpAgent.logPath, 'utf8');
    }
    const rows = output.split('\n').flatMap((line) => {
      try {
        const row = JSON.parse(line);
        return row.event_id ? [row] : [];
      } catch {
        return [];
      }
    });
    assert.equal(rows.length, records.length, output);
    for (const record of records) {
      const row = rows.find((row) => row.event_id === record.event_id);
      assert.ok(row);
      assert.equal(row.original_timestamp, record.timestamp);
      const expectedUtc: Record<string, string> = {
        A: '2025-10-20T18:23:45.123Z',
        B: '2024-10-20T18:53:45Z',
        C: '2025-10-20T18:23:45.123456789Z',
        D: '2025-10-20T18:23:45Z',
        E: '2024-10-20T18:53:45.125Z',
      };
      const utc = expectedUtc[record.event_id];
      assert.equal(row.normalized_timestamp, utc);
      if (stage >= 2) {
        assert.equal(row.timestamp_utc, utc);
        assert.equal(
          row.original_timezone,
          record.event_id === 'C' ? '-04:00' : '+00:00'
        );
      }
      if (stage === 3) {
        const instant = new Date(utc);
        assert.deepEqual(row.time_metadata, {
          year: instant.getUTCFullYear(),
          month: instant.getUTCMonth() + 1,
          day: instant.getUTCDate(),
          hour: instant.getUTCHours(),
          day_of_week: instant.getUTCDay(),
        });
      }
    }
  });
}

for (const language of ['bloblang', 'coffee']) {
  test(`selected ${language} fences reach inventory, fragment classification, and Edge lint`, async () => {
    const fixtureRoot = join(work, `fence-${language}`);
    mkdirSync(join(fixtureRoot, 'docs', 'test'), { recursive: true });
    writeFileSync(
      join(fixtureRoot, 'docs', 'test', 'step.mdx'),
      `---\ntitle: Mapping\n---\n\n\x60\x60\x60${language}\nroot = this\nroot.checked = true\n\x60\x60\x60\n\n\x60\x60\x60${language}\nroot = (\n\x60\x60\x60\n`
    );
    const entries = discoverPipelineFiles(fixtureRoot).filter(
      (file) => file.sourcePath === 'docs/test/step.mdx'
    );
    assert.equal(entries.length, 2);
    for (const entry of entries) {
      assert.equal(entry.kind, 'fragment');
      assert.equal(
        classifyPipelineCode(entry.source ?? '', language),
        'fragment'
      );
      const wrapped = wrapFragment(entry.document);
      assert.ok(wrapped);
      const status = validateSource(edge, root, wrapped.source).status;
      assert.equal(status, entry === entries[0] ? 'PASS' : 'FAIL');
    }
    const valid = wrapFragment(entries[0].document);
    assert.ok(valid);
    const output = JSON.parse(
      (await execute(valid.source, [{ id: 'event' }])).toString()
    );
    assert.deepEqual(output, { id: 'event', checked: true });
  });
}

test('selected restored PII pattern snippet reaches Edge and reports violations', async () => {
  const path =
    'docs/data-security/cross-border-gdpr/step-6-validate-anonymization.mdx';
  const block = pageBlocks(path).find((block) =>
    block.source.includes('let email_pattern')
  );
  assert.ok(block);
  const entry = discoverPipelineFiles(root).find(
    (file) => file.sourcePath === path && file.sourceLine === block.line
  );
  assert.ok(entry);
  assert.equal(entry.kind, 'fragment');
  const wrapped = wrapFragment(entry.document);
  assert.ok(wrapped);
  const good = { region: 'EU', note: 'redacted' };
  assert.deepEqual(
    JSON.parse((await execute(wrapped.source, [good])).toString()),
    good
  );
  const bad = { region: 'EU', note: 'ada@example.com' };
  await execute(wrapped.source, [bad], false, undefined, 'failed');
});

test('selected MCC enrichment preserves transaction fields through standardization', async () => {
  const path =
    'docs/enterprise-migration/db2-to-bigquery/step-4-categorize-transactions.mdx';
  const mappings = pageBlocks(path)
    .map((block) => parse(block.source))
    .filter((document) => Array.isArray(document));
  assert.equal(mappings.length, 3);
  const record = {
    TRANSACTION_ID: 'TX1',
    CUSTOMER_ID: 'C1',
    AMOUNT: 100,
    MERCHANT_CATEGORY_CODE: '5411',
    TRANSACTION_DATE: '2025-10-20',
  };
  const expected = [
    { transaction_category: 'GROCERY_SUPERMARKET' },
    { category_level1: 'RETAIL', category_level2: 'GROCERY' },
    { high_risk: false },
  ];
  const standardize = parse(
    pageBlocks(
      'docs/enterprise-migration/db2-to-bigquery/step-5-standardize-schema.mdx'
    )[0].source
  ).pipeline.processors;
  for (const [index, processors] of mappings.entries()) {
    const source = stringify({ pipeline: { processors } });
    assert.deepEqual(JSON.parse((await execute(source, [record])).toString()), {
      ...record,
      ...expected[index],
    });
    const output = JSON.parse(
      (
        await execute(
          stringify({
            pipeline: { processors: [...processors, ...standardize] },
          }),
          [record]
        )
      ).toString()
    );
    assert.equal(output.transaction_id, 'TX1');
    assert.equal(output.customer_id, 'C1');
    assert.equal(output.merchant_category_code, '5411');
  }
});

test('selected fence-language CI command rejects changes unless explicitly listed', () => {
  const fixtureRoot = join(work, 'fence-language-git');
  mkdirSync(join(fixtureRoot, 'docs', 'test'), { recursive: true });
  mkdirSync(join(fixtureRoot, 'content'));
  const path = 'docs/test/step.mdx';
  const page = (language: string) =>
    `# Example\n\n\x60\x60\x60${language}\nroot = this\n\x60\x60\x60\n`;
  writeFileSync(join(fixtureRoot, path), page('yaml'));
  writeFileSync(
    join(fixtureRoot, 'content', 'fence-language-changes.json'),
    '[]\n'
  );
  const git = (args: string[]) =>
    execFileSync('git', args, { cwd: fixtureRoot, encoding: 'utf8' });
  git(['init', '--quiet']);
  git(['add', '.']);
  git([
    '-c',
    'user.name=Fixture',
    '-c',
    'user.email=fixture@example.invalid',
    'commit',
    '--quiet',
    '-m',
    'Fixture baseline',
  ]);
  const base = git(['rev-parse', 'HEAD']).trim();
  const run = () =>
    spawnSync(
      process.execPath,
      [
        join(root, 'node_modules/tsx/dist/cli.mjs'),
        join(root, 'scripts/validate-fence-languages.ts'),
        '--base',
        base,
      ],
      { cwd: fixtureRoot, encoding: 'utf8' }
    );
  assert.equal(run().status, 0);
  for (const language of ['text', 'bloblang', 'coffee', '']) {
    writeFileSync(join(fixtureRoot, path), page(language));
    const result = run();
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stderr, /docs\/test\/step.mdx:3/);
  }
  writeFileSync(
    join(fixtureRoot, path),
    '# Example\n\nNew introductory prose.\n' +
      '\n'.repeat(20) +
      '# Moved snippet\n\n' +
      page('text')
  );
  assert.equal(run().status, 1);
  writeFileSync(
    join(fixtureRoot, path),
    page('yaml').replace('root = this', 'root = this\nroot.checked = true')
  );
  assert.equal(run().status, 0);
  writeFileSync(join(fixtureRoot, path), '# Example\n');
  assert.equal(run().status, 1);
  writeFileSync(
    join(fixtureRoot, 'content', 'fence-language-changes.json'),
    JSON.stringify([
      {
        path,
        line: 3,
        snippet: snippetDigest('root = this'),
        from: 'yaml',
        to: 'deleted',
      },
    ])
  );
  assert.equal(run().status, 0);
  writeFileSync(join(fixtureRoot, path), page('text'));
  assert.equal(run().status, 1);
  writeFileSync(join(fixtureRoot, path), page('coffee'));
  writeFileSync(
    join(fixtureRoot, 'content', 'fence-language-changes.json'),
    JSON.stringify([
      {
        path,
        line: 3,
        snippet: snippetDigest('root = this'),
        from: 'yaml',
        to: 'coffee',
      },
    ])
  );
  assert.equal(run().status, 0);
  writeFileSync(join(fixtureRoot, path), page('bloblang'));
  assert.equal(run().status, 1);
  git(['mv', path, 'docs/test/renamed.mdx']);
  assert.equal(run().status, 1);
});

test('selected range validation preserves transactions and their output routing', async () => {
  const blocks = pageBlocks(
    'docs/enterprise-migration/db2-to-bigquery/step-6-validate-required-fields.mdx'
  );
  const range = parse(blocks[3].source);
  const valid = {
    transaction_id: 'TX1',
    customer_id: 'C1',
    amount_usd: 100,
    transaction_date: '2025-10-20',
  };
  const suspicious = {
    ...valid,
    transaction_id: 'TX2',
    amount_usd: 150001,
    transaction_date: '2999-01-01',
  };
  const source = stringify({ pipeline: { processors: range } });
  const rows = (await execute(source, [valid, suspicious]))
    .toString()
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));
  assert.deepEqual(rows, [
    { ...valid, _warnings: [] },
    {
      ...suspicious,
      _warnings: [
        'Large transaction: review required',
        'Future transaction date',
      ],
    },
  ]);
  const config = parse(blocks[0].source);
  config.pipeline.processors.unshift(...range);
  const missing = {
    customer_id: 'C1',
    amount_usd: 100,
    transaction_date: '2025-10-20',
  };
  const [dlq, bigquery] = JSON.parse(
    (
      await execute(
        stringify(config),
        [valid, suspicious, missing],
        false,
        undefined,
        'completed',
        true
      )
    ).toString()
  ).map((text: string) =>
    text
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line))
  );
  assert.deepEqual(bigquery, rows);
  assert.equal(dlq.length, 1);
  assert.equal(dlq[0]._error, 'Missing required field for BigQuery load');
  assert.equal(dlq[0].customer_id, 'C1');
  assert.equal(dlq[0].amount_usd, 100);
});

test('selected priority normalization and defaults preserve event data', async () => {
  const blocks = pageBlocks(
    'docs/data-routing/priority-queues/troubleshooting.mdx'
  );
  const normalize = stringify({
    pipeline: { processors: parse(blocks[0].source) },
  });
  const record = {
    event_id: 'event',
    message: 'Keep this payload',
    severity: 'critical',
    priority_score: 250,
  };
  assert.deepEqual(
    JSON.parse((await execute(normalize, [record])).toString()),
    { ...record, severity: 'CRITICAL' }
  );
  const defaults = stringify({
    pipeline: { processors: parse(blocks[3].source) },
  });
  const missing = {
    event_id: 'missing',
    message: 'Keep this payload',
    priority_score: 50,
  };
  const existing = { ...record, user_tier: 'paid' };
  const rows = (await execute(defaults, [missing, existing]))
    .toString()
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));
  assert.deepEqual(rows, [
    { ...missing, severity: 'INFO', user_tier: 'free' },
    existing,
  ]);
});
