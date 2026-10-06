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
import { createServer } from 'node:net';
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

test('published database circuit breaker enriches a healthy PostgreSQL result', async () => {
  const location = spawnSync('pg_config', ['--bindir'], { encoding: 'utf8' });
  assert.equal(location.status, 0, location.error?.message ?? location.stderr);
  const binaries = location.stdout.trim();
  const database = join(work, 'postgres');
  const run = (command: string, args: string[]) => {
    const result = spawnSync(join(binaries, command), args, {
      encoding: 'utf8',
      timeout: 20_000,
    });
    assert.equal(
      result.status,
      0,
      result.error?.message ?? result.stderr + result.stdout
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
  } finally {
    run('pg_ctl', ['stop', '-D', database, '-m', 'fast', '-w', '-t', '10']);
  }
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
