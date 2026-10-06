import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import { parse } from 'yaml';
import {
  LocalEdgeAgent,
  resolveEdgeBinary,
  validateSource,
} from '../../scripts/validation/edge';
import { planRun } from '../../scripts/validation/harness';
import {
  verifyEncryption,
  verifyOutputs,
  type Expectation,
  type EncryptionExpectation,
} from '../../scripts/validation/expectations';
import type { YamlObject } from '../../scripts/validation/yaml-value';
import { stringify } from 'yaml';
import { renderReport, summarize } from '../../scripts/validation/report';
import type { PipelineReport } from '../../scripts/validation/types';
import { discoverPipelineFiles } from '../../scripts/validation/inventory';
import { writeFailureReport } from '../../scripts/validation/failure-report';
import type { LocalStandIns } from '../../scripts/validation/harness';
import { rebaseNormalizationFixture } from '../../scripts/validation/recent-timestamps';

const root = process.cwd();
const manifest = JSON.parse(
  readFileSync('tests/fixtures/pipeline-inputs/manifest.json', 'utf8')
);
const edge = resolveEdgeBinary(root, { install: false, log: () => {} });
const work = mkdtempSync(join(root, '.bin', 'review-regressions-'));
const agent = new LocalEdgeAgent(edge, work, {
  ...manifest.environment,
  REVIEW_BAD_ENCRYPTION_KEY: 'invalid',
  REVIEW_EMPTY_ENCRYPTION_KEY: '',
});
let sequence = 0;
before(async () => {
  execFileSync(
    'openssl',
    [
      'req',
      '-x509',
      '-newkey',
      'rsa:2048',
      '-noenc',
      '-keyout',
      join(work, 'server.key'),
      '-out',
      join(work, 'server.crt'),
      '-days',
      '1',
      '-subj',
      '/CN=localhost',
    ],
    { stdio: 'ignore' }
  );
  await agent.start();
});
after(async () => {
  await agent.stop();
  rmSync(work, { recursive: true, force: true });
});

function config(path: string): YamlObject {
  const document = parse(readFileSync(path, 'utf8'));
  return document.config ?? document;
}

async function execute(
  pipeline: YamlObject,
  fixture?: string,
  standIns: LocalStandIns = {
    inputMetadata: manifest.families['encrypt-data'].inputMetadata,
  }
): Promise<unknown[]> {
  return (await capture(pipeline, fixture, standIns)).flatMap((text) =>
    text
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line))
  );
}

async function capture(
  pipeline: YamlObject,
  fixture?: string,
  standIns: LocalStandIns = {
    inputMetadata: manifest.families['encrypt-data'].inputMetadata,
  },
  expectedState = 'completed'
): Promise<string[]> {
  sequence += 1;
  const plan = planRun(
    pipeline,
    fixture ? resolve(root, fixture) : null,
    join(work, String(sequence)),
    standIns
  );
  const validity = validateSource(
    edge,
    root,
    stringify(plan.config),
    manifest.environment
  );
  assert.equal(validity.status, 'PASS', JSON.stringify(validity));
  const deployed = await agent.deploy({
    name: `review-${sequence}`,
    type: 'pipeline',
    config: plan.config,
  });
  assert.equal(deployed.ok, true, JSON.stringify(deployed));
  if (!deployed.ok) throw new Error(deployed.error);
  try {
    const deadline = Date.now() + 20_000;
    let state = '';
    while (Date.now() < deadline) {
      state = (await agent.executionStatus(deployed.jobId))?.state ?? '';
      if (['completed', 'failed', 'stopped'].includes(state)) break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.equal(
      state,
      expectedState,
      existsSync(agent.pipelineLogPath(deployed.jobId))
        ? readFileSync(agent.pipelineLogPath(deployed.jobId), 'utf8')
        : JSON.stringify(await agent.executionStatus(deployed.jobId))
    );
    return plan.outputFiles.map((path) =>
      existsSync(path) ? readFileSync(path, 'utf8') : ''
    );
  } finally {
    await agent.deleteJob(deployed.jobId);
  }
}

for (const path of [
  'examples/data-security/encrypt-data.yaml',
  'examples/data-security/encrypt-data-complete.yaml',
  'examples/data-security/encryption-patterns-complete.yaml',
]) {
  test(`retains and decrypts protected fields with distinct nonces: ${path}`, async () => {
    const fixture = 'tests/fixtures/pipeline-inputs/encryption.jsonl';
    const outputs = await execute(config(path), fixture);
    const inputs = readFileSync(fixture, 'utf8')
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
    const expectation = (manifest.pipelines[path]?.expectation ??
      manifest.families[
        path.includes('patterns') ? 'encryption-patterns' : 'encrypt-data'
      ].expectation) as EncryptionExpectation;
    verifyEncryption(expectation, inputs, outputs, manifest.environment);
    assert.throws(
      () => verifyEncryption(expectation, inputs, inputs, manifest.environment),
      /plaintext/
    );
  });
}

for (const path of [
  'examples/data-transformation/normalize-timestamps.yaml',
  'examples/data-transformation/normalize-timestamps-complete.yaml',
]) {
  test(`normalizes valid naive and zoned timestamps: ${path}`, async () => {
    const pipeline = config(path);
    const instant = new Date(Date.now() - 3_600_000);
    const expected = instant.toISOString().replace(/\.\d{3}Z$/, 'Z');
    const wallClock = new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'America/Los_Angeles',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).format(instant);
    pipeline.input = {
      generate: {
        count: 1,
        mapping: `root = ${JSON.stringify({ event_id: 'zone', event_type: 'test', timestamp: wallClock, timezone: 'America/Los_Angeles' })}`,
      },
    };
    pipeline.output = { stdout: {} };
    const rows = (await execute(pipeline)) as Array<{ timestamp: string }>;
    assert.equal(rows.length, 1);
    assert.equal(rows[0].timestamp, expected);
    pipeline.input = {
      generate: {
        count: 1,
        mapping: `root = ${JSON.stringify({ event_id: 'naive', event_type: 'test', timestamp: expected.slice(0, -1) })}`,
      },
    };
    const naive = (await execute(pipeline)) as Array<{ timestamp: string }>;
    assert.equal(naive[0].timestamp, expected);
  });
}

test('preserves cent precision in generated retail transactions', async () => {
  const original = config('static/pipelines/motherduck-retail-pipeline.yaml');
  const rows = (await execute({
    input: original.input,
    output: { stdout: {} },
  })) as Array<{
    type: string;
    items: Array<{ qty: number; unit_price: number }>;
    subtotal: number;
    tax_amount: number;
    total_amount: number;
  }>;
  assert.equal(rows.length, 25);
  for (const row of rows) {
    const subtotal =
      Math.round(
        row.items.reduce((sum, item) => sum + item.qty * item.unit_price, 0) *
          100
      ) / 100;
    const sign = row.type === 'return' ? -1 : 1;
    assert.equal(row.subtotal, sign * subtotal);
    assert.equal(
      row.tax_amount,
      (sign * Math.round(subtotal * 0.0875 * 100)) / 100
    );
    assert.equal(
      row.total_amount,
      Math.round((row.subtotal + row.tax_amount) * 100) / 100
    );
  }
});

test('tries secondary enrichment only when primary fails', async () => {
  let primaryFails = true;
  let secondaryCalls = 0;
  const server = createServer((request, response) => {
    if (request.url?.startsWith('/primary') && primaryFails) {
      response.writeHead(500);
      response.end('failed');
      return;
    }
    if (request.url?.startsWith('/secondary')) secondaryCalls += 1;
    response.setHeader('content-type', 'application/json');
    response.end('{"value":"enriched"}');
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const address = server.address();
    assert.ok(address && typeof address === 'object');
    const original = config(
      'examples/data-routing/circuit-breakers-complete.yaml'
    );
    const serialized = stringify(original)
      .replace(
        '${PRIMARY_API:http://api:8080}',
        `http://127.0.0.1:${address.port}/primary`
      )
      .replace(
        '${SECONDARY_API:http://backup-api:8080}',
        `http://127.0.0.1:${address.port}/secondary`
      );
    const pipeline = parse(serialized) as YamlObject;
    pipeline.input = {
      generate: { count: 1, mapping: 'root = {"event_id":"fallback"}' },
    };
    pipeline.output = { stdout: {} };
    const failed = (await execute(pipeline)) as Array<{
      enrichment_source: string;
    }>;
    assert.equal(failed[0].enrichment_source, 'secondary_api');
    assert.equal(secondaryCalls, 1);
    primaryFails = false;
    const healthy = (await execute(pipeline)) as Array<{
      enrichment_source: string;
    }>;
    assert.equal(healthy[0].enrichment_source, 'primary_api');
    assert.equal(secondaryCalls, 1);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    );
  }
});

test('serializes CSV and XML responses into their selected wire formats', async () => {
  for (const target of ['csv', 'xml']) {
    const pipeline = config(
      'examples/data-transformation/transform-formats-complete.yaml'
    );
    pipeline.input = {
      generate: {
        count: 1,
        mapping: `root = {"name":"A, B","value":42}\nmeta Accept = "application/${target}"`,
      },
    };
    pipeline.output =
      target === 'csv'
        ? {
            stdout: {},
            processors: [{ mapping: 'root = content().parse_csv()' }],
          }
        : { stdout: {}, processors: [{ xml: { operator: 'to_json' } }] };
    const rows = await execute(pipeline);
    assert.equal(rows.length, 1);
    if (target === 'csv')
      assert.deepEqual(rows[0], [{ name: 'A, B', value: '42' }]);
    else assert.ok(JSON.stringify(rows[0]).includes('A, B'));
  }
});

test('backup batches round-trip through real Parquet encoding', async () => {
  const source = parse(
    readFileSync(
      'examples/enterprise-migration/nightly-backup/nightly-backup.yaml',
      'utf8'
    )
  );
  const pipeline: YamlObject = {
    input: {
      generate: {
        count: 2,
        mapping:
          'root = {"order_id":123,"amount":1.99,"_backup_metadata":{"backup_date":"2026-10-05"}}',
      },
    },
    output: source.config.output.switch.cases[0].output,
  };
  const destination = pipeline.output as YamlObject;
  destination.processors = [{ parquet_decode: {} }];
  const rows = await execute(pipeline);
  const records = rows.flat() as Array<{ record: string }>;
  assert.equal(records.length, 2);
  for (const row of records)
    assert.deepEqual(JSON.parse(row.record), {
      order_id: 123,
      amount: 1.99,
      _backup_metadata: { backup_date: '2026-10-05' },
    });
});

test('the reusable encryption pattern preserves decryptable payment fields', async () => {
  const fixture = 'tests/fixtures/pipeline-inputs/encryption.jsonl';
  const output = await execute(
    {
      input: { file: { paths: [join(root, fixture)], codec: 'lines' } },
      pipeline: {
        processors: parse(
          readFileSync(
            'examples/data-security/encryption-patterns.yaml',
            'utf8'
          )
        ),
      },
      output: { stdout: {} },
    },
    fixture
  );
  const expectation = manifest.families['encrypt-data']
    .expectation as EncryptionExpectation;
  const paymentExpectation = {
    ...expectation,
    fields: expectation.fields.filter((field) =>
      field.source.startsWith('payment.')
    ),
    removed: expectation.removed.filter((path) => path.startsWith('payment.')),
  };
  verifyEncryption(
    paymentExpectation,
    readFileSync(fixture, 'utf8')
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line)),
    output,
    manifest.environment
  );
});

test('the emitted Markdown distinguishes skipped and stubbed execution', () => {
  const reports: PipelineReport[] = [
    {
      file: {
        path: 'example.yaml',
        kind: 'complete-bare',
        family: 'example',
        category: 'test',
      },
      validate: { status: 'PASS', mode: 'file', errors: [] },
      run: { status: 'SKIP', reason: 'external service unavailable' },
    },
  ];
  const options = {
    date: '2026-10-05',
    edgeVersion: edge.version,
    pinnedEdgeVersion: edge.version,
    inventoryDigest: 'fixture-digest',
  };
  assert.match(
    renderReport(reports, summarize(reports, options), 2),
    /Overall: \*\*INCOMPLETE\*\*/
  );
  reports[0].run = {
    status: 'PASS',
    mode: 'fixture-harness',
    reason: 'semantic output verified',
    substitutions: [
      {
        role: 'processor',
        at: 'pipeline.processors.0',
        from: 'http',
        to: 'mapping',
      },
    ],
  };
  const markdown = renderReport(reports, summarize(reports, options), 2);
  assert.match(markdown, /PASS \(stubbed fixture harness\)/);
  assert.match(
    markdown,
    /Replaced processors and resources were not exercised as committed/
  );
});

const contracts = JSON.parse(
  readFileSync('tests/fixtures/pipeline-inputs/expectations.json', 'utf8')
) as Record<string, Expectation>;

test('every complete inventory entry has a semantic output contract', () => {
  const complete = discoverPipelineFiles(root).filter((file) =>
    file.kind.startsWith('complete')
  );
  assert.equal(complete.length, 106);
  for (const file of complete) {
    const entry = {
      ...manifest.categories?.[file.category],
      ...manifest.families?.[file.family],
      ...manifest.pipelines?.[file.path],
    };
    const expectation = contracts[file.path] ?? entry.expectation;
    assert.ok(expectation, file.path);
    if (expectation.kind === 'records') {
      assert.ok(expectation.outputs.length > 0, file.path);
      for (const output of expectation.outputs) {
        assert.ok(
          output.count === 0 ||
            output.records?.length ||
            output.invariant ||
            Object.keys(output.every?.equals ?? {}).length,
          file.path
        );
      }
    }
  }
});

for (const path of [
  'examples/data-transformation/aggregate-time-windows.yaml',
  'examples/data-transformation/aggregate-time-windows-complete.yaml',
  'examples/data-transformation/step-4-production.yaml',
  'examples/explorer-stages/aggregate-time-windows/05-multi-level-configuration.yaml',
  'examples/data-transformation/transform-formats.yaml',
]) {
  test(`executes and verifies semantic records: ${path}`, async () => {
    const file = discoverPipelineFiles(root).find(
      (file) => file.path === path
    )!;
    const entry = {
      ...manifest.categories?.[file.category],
      ...manifest.families?.[file.family],
      ...manifest.pipelines?.[path],
    };
    const expectation = contracts[path];
    assert.equal(expectation.kind, 'records');
    if (expectation.kind !== 'records') return;
    const texts = await capture(config(path), entry.fixture, {
      outputFormats: expectation.outputs.map(
        (output) => output.format ?? 'jsonl'
      ),
      processors: entry.processorStandIns,
    });
    verifyOutputs(expectation, [], texts, manifest.environment);
    assert.throws(() =>
      verifyOutputs(
        expectation,
        [],
        texts.map(() => ''),
        manifest.environment
      )
    );
    if (!path.includes('transform-formats')) {
      const rows = texts.flatMap((text) =>
        text
          .split('\n')
          .filter(Boolean)
          .map((line) => JSON.parse(line))
      );
      assert.ok(rows.some((row) => (row.aggregation ?? row).event_count === 2));
    }
  });
}

test('CSV negotiation handles JSON arrays and quoted CSV input', async () => {
  for (const input of [
    '[{"name":"A, B","value":42},{"name":"C","value":7}]',
    'name,value\n"A, B",42\nC,7\n',
  ]) {
    const pipeline = config(
      'examples/data-transformation/transform-formats-complete.yaml'
    );
    pipeline.input = {
      generate: {
        count: 1,
        mapping: `root = ${JSON.stringify(input)}\nmeta Accept = "text/csv"`,
      },
    };
    pipeline.output = {
      stdout: {},
      processors: [{ mapping: 'root = content().parse_csv()' }],
    };
    assert.deepEqual(await execute(pipeline), [
      [
        { name: 'A, B', value: '42' },
        { name: 'C', value: '7' },
      ],
    ]);
  }
});

test('CSV log parsing preserves commas inside quoted fields', async () => {
  const pipeline = config(
    'examples/data-transformation/parse-logs-complete.yaml'
  );
  pipeline.input = {
    generate: {
      count: 1,
      mapping: `root = ${JSON.stringify('2026-10-05T12:00:00Z,WARN,"billing,worker","request failed"')}`,
    },
  };
  pipeline.output = { stdout: {} };
  const rows = (await execute(pipeline)) as Array<Record<string, unknown>>;
  assert.equal(rows.length, 1);
  assert.equal(rows[0].service, 'billing,worker');
  assert.equal(rows[0].message, 'request failed');
  assert.equal(rows[0].level, 'WARN');
});

test('retail enrichment rounds average item prices to cents', async () => {
  const original = config('static/pipelines/motherduck-retail-pipeline.yaml');
  const pipeline = original.pipeline as { processors: unknown[] };
  const rows = (await execute({
    input: {
      generate: {
        count: 1,
        mapping:
          'root = {"store_id":1,"timestamp":"2026-10-05T12:00:00Z","subtotal":13.96,"items":[{},{},{}]}',
      },
    },
    pipeline: { processors: [pipeline.processors[0]] } as YamlObject,
    output: { stdout: {} },
  })) as Array<{ avg_item_price: number }>;
  assert.equal(rows[0].avg_item_price, 4.65);
});

test('setup failures emit browsable failure evidence and replace stale latest', () => {
  const destination = join(work, 'failure-report');
  writeFailureReport(destination, '2026-10-05', new Error('download failed'));
  writeFailureReport(
    destination,
    '2026-10-06',
    new Error('agent startup failed')
  );
  const latest = JSON.parse(
    readFileSync(
      join(destination, 'validation-reports/latest/report.json'),
      'utf8'
    )
  );
  assert.equal(latest.summary.failure, 'agent startup failed');
  assert.equal(latest.summary.date, '2026-10-06');
  assert.match(
    readFileSync(
      join(destination, 'validation-reports/latest/README.md'),
      'utf8'
    ),
    /Overall: \*\*FAIL\*\*/
  );
  assert.match(
    readFileSync(join(destination, 'validation-reports/README.md'), 'utf8'),
    /2026-10-06/
  );
});

test('record contracts reject changed values and incorrect routing', () => {
  const expectation: Expectation = {
    kind: 'records',
    outputs: [
      {
        count: 1,
        records: [
          {
            equals: { event_id: 'one', temperature: 21.8 },
            absent: ['card_number'],
          },
        ],
      },
      { count: 0 },
    ],
  };
  verifyOutputs(
    expectation,
    [],
    ['{"event_id":"one","temperature":21.8}\n', ''],
    {}
  );
  assert.throws(() =>
    verifyOutputs(
      expectation,
      [],
      ['{"event_id":"one","temperature":10}\n', ''],
      {}
    )
  );
  assert.throws(() =>
    verifyOutputs(
      expectation,
      [],
      ['', '{"event_id":"one","temperature":21.8}\n'],
      {}
    )
  );
});

for (const [path, keys] of [
  [
    'examples/data-security/encrypt-data.yaml',
    ['CARD_ENCRYPTION_KEY', 'PII_ENCRYPTION_KEY', 'ADDRESS_ENCRYPTION_KEY'],
  ],
  [
    'examples/data-security/encrypt-data-complete.yaml',
    ['CARD_KEY', 'PII_KEY', 'ADDR_KEY'],
  ],
  [
    'examples/data-security/encryption-patterns-complete.yaml',
    [
      'PAYMENT_ENCRYPTION_KEY',
      'PII_ENCRYPTION_KEY',
      'ADDRESS_ENCRYPTION_KEY',
      'TEMPORAL_ENCRYPTION_KEY',
    ],
  ],
  ['static/files/data-security/encrypt-data.yaml', ['CARD_ENCRYPTION_KEY']],
] as const) {
  test(`drops messages when encryption keys are invalid or missing: ${path}`, async () => {
    for (const key of keys) {
      for (const environment of [
        'REVIEW_BAD_ENCRYPTION_KEY',
        'REVIEW_EMPTY_ENCRYPTION_KEY',
      ]) {
        const pipeline = parse(
          stringify(config(path)).replaceAll(
            `env("${key}")`,
            `env("${environment}")`
          )
        ) as YamlObject;
        const texts = await capture(
          pipeline,
          'tests/fixtures/pipeline-inputs/encryption.jsonl',
          { inputMetadata: manifest.families['encrypt-data'].inputMetadata },
          'failed'
        );
        assert.ok(texts.length > 0);
        assert.ok(
          texts.every((text) => text === ''),
          'encryption failure emitted data'
        );
      }
    }
  });
}

test('raw arrays split into individual objects with shared batch metadata', async () => {
  const pipeline = config(
    'examples/data-routing/content-splitting-complete.yaml'
  );
  pipeline.input = {
    generate: { count: 1, mapping: 'root = [{"sku":"A"},{"sku":"B"}]' },
  };
  const texts = await capture(pipeline);
  assert.notEqual(texts[0], '', JSON.stringify(texts));
  const rows = texts[0]
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));
  assert.deepEqual(
    rows.map((row) => row.sku),
    ['A', 'B']
  );
  assert.equal(texts[1], '');
  assert.equal(rows[0].batch_context.batch_id, rows[1].batch_context.batch_id);
  for (const row of rows) {
    assert.equal(row.batch_context.total_items, 2);
    assert.ok(Number.isFinite(Date.parse(row.batch_context.received_at)));
  }
});

for (const path of [
  'examples/data-transformation/normalize-timestamps.yaml',
  'examples/data-transformation/normalize-timestamps-complete.yaml',
]) {
  test(`normalization fixtures remain recent without bypassing age validation: ${path}`, async () => {
    const old = readFileSync(
      'tests/fixtures/pipeline-inputs/data-transformation.jsonl',
      'utf8'
    ).replaceAll('2026-10-05', '2000-01-01');
    const recent = rebaseNormalizationFixture(old, contracts[path]);
    const fixture = join(work, 'recent-normalization.jsonl');
    writeFileSync(fixture, recent.source);
    const texts = await capture(config(path), fixture);
    verifyOutputs(recent.expectation, [], texts, manifest.environment);
    const input = JSON.parse(recent.source.split('\n')[0]);
    assert.ok(Date.now() - Date.parse(input.timestamp) < 2 * 86400000);
    assert.ok(Date.parse(input.timestamp) < Date.now());
    const later = rebaseNormalizationFixture(
      old,
      contracts[path],
      new Date('2035-02-04T20:00:00Z')
    );
    assert.equal(
      JSON.parse(later.source.split('\n')[0]).timestamp,
      '2035-02-03T12:00:00.000Z'
    );
    const expectation = later.expectation;
    assert.equal(expectation.kind, 'records');
    if (expectation.kind === 'records')
      assert.equal(
        expectation.outputs[0].records![0].equals!.timestamp,
        '2035-02-03T12:00:00Z'
      );
  });
}

test('normalization continues to reject genuinely stale production events', async () => {
  const pipeline = config(
    'examples/data-transformation/normalize-timestamps.yaml'
  );
  pipeline.input = {
    generate: {
      count: 1,
      mapping: 'root = {"event_id":"old","timestamp":"2000-01-01T12:00:00Z"}',
    },
  };
  await assert.rejects(
    () => execute(pipeline),
    /Timestamp too old|timestamp.*old/i
  );
});

test('Splunk HEC envelopes mask PII in parsed and fallback log lines', async () => {
  for (const prefix of ['2026-10-05 12:00:00 [ERROR] [worker] ', '']) {
    const pipeline = config('static/pipelines/splunk-production-pipeline.yaml');
    delete (pipeline.input as YamlObject).file;
    pipeline.input = {
      generate: {
        count: 1,
        mapping: `root = ${JSON.stringify(prefix + 'customer person@example.com SSN 123-45-6789 card 4532-1234-5678-9010 phone 4155551234')}`,
      },
    };
    const rows = (await execute(pipeline)) as Array<{
      event: { message: string; raw: string };
    }>;
    assert.equal(rows.length, 1);
    const masked =
      'customer ***@***.*** SSN ***-**-**** card ****-****-****-**** phone ***-***-****';
    assert.equal(rows[0].event.message, masked);
    assert.equal(rows[0].event.raw, prefix + masked);
  }
});

test('payment HTTPS ingestion rejects unauthenticated requests before forwarding', async () => {
  const token = manifest.environment.PAYMENTS_INGEST_TOKEN;
  for (const configured of [true, false]) {
    const listener = createServer();
    await new Promise<void>((resolve) =>
      listener.listen(0, '127.0.0.1', resolve)
    );
    const address = listener.address();
    assert.ok(address && typeof address === 'object');
    const port = address.port;
    await new Promise<void>((resolve, reject) =>
      listener.close((error) => (error ? reject(error) : resolve()))
    );
    let pipeline = config('examples/data-security/encrypt-data.yaml');
    if (!configured)
      pipeline = parse(
        stringify(pipeline).replaceAll(
          'env("PAYMENTS_INGEST_TOKEN")',
          'env("REVIEW_EMPTY_ENCRYPTION_KEY")'
        )
      ) as YamlObject;
    const input = pipeline.input as YamlObject;
    const server = input.http_server as YamlObject;
    server.address = `127.0.0.1:${port}`;
    server.cert_file = join(work, 'server.crt');
    server.key_file = join(work, 'server.key');
    const output = join(work, `authenticated-${configured}.jsonl`);
    pipeline.output = { file: { path: output, codec: 'lines' } };
    const validity = validateSource(
      edge,
      root,
      stringify(pipeline),
      manifest.environment
    );
    assert.equal(validity.status, 'PASS', JSON.stringify(validity));
    const deployed = await agent.deploy({
      name: `review-auth-${configured}`,
      type: 'pipeline',
      config: pipeline,
    });
    assert.ok(deployed.ok, JSON.stringify(deployed));
    if (!deployed.ok) return;
    const body = readFileSync(
      'tests/fixtures/pipeline-inputs/encryption.jsonl',
      'utf8'
    ).split('\n')[0];
    const send = (authorization?: string): Promise<number> =>
      new Promise((resolve, reject) => {
        const request = httpsRequest(
          {
            hostname: '127.0.0.1',
            port,
            path: '/payments/transactions',
            method: 'POST',
            rejectUnauthorized: false,
            headers: {
              'Content-Type': 'application/json',
              ...(authorization ? { Authorization: authorization } : {}),
            },
          },
          (response) => {
            response.resume();
            response.on('end', () => resolve(response.statusCode ?? 0));
          }
        );
        request.on('error', reject);
        request.setTimeout(3000, () =>
          request.destroy(new Error('HTTPS request timed out'))
        );
        request.end(body);
      });
    try {
      const deadline = Date.now() + 5000;
      let status = 0;
      while (Date.now() < deadline) {
        try {
          status = await send();
          break;
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ECONNREFUSED')
            throw error;
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }
      assert.equal(status, 401);
      assert.equal(await send('Bearer wrong-token'), 401);
      assert.equal(existsSync(output) ? readFileSync(output, 'utf8') : '', '');
      assert.equal(await send(`Bearer ${token}`), configured ? 200 : 401);
      const rows = existsSync(output)
        ? readFileSync(output, 'utf8')
            .split('\n')
            .filter(Boolean)
            .map((line) => JSON.parse(line))
        : [];
      assert.equal(rows.length, configured ? 1 : 0);
      if (configured) {
        const expectation = manifest.families['encrypt-data']
          .expectation as EncryptionExpectation;
        verifyEncryption(
          expectation,
          [JSON.parse(body)],
          rows,
          manifest.environment
        );
      }
    } finally {
      await agent.deleteJob(deployed.jobId);
    }
  }
});

test('retail batching emits Parquet objects grouped by region', async () => {
  const pipeline = config('static/pipelines/motherduck-retail-pipeline.yaml');
  const texts = await capture(pipeline, undefined, { outputFormats: ['avro'] });
  const objects = texts[0]
    .trim()
    .split('\n')
    .map((line) => Buffer.from(line, 'base64'));
  assert.ok(objects.length > 0 && objects.length <= 5);
  const decoded: unknown[] = [];
  for (const object of objects) {
    assert.equal(object.subarray(0, 4).toString(), 'PAR1');
    assert.equal(object.subarray(-4).toString(), 'PAR1');
    const rows = await execute({
      input: {
        generate: {
          count: 1,
          mapping: `root = ${JSON.stringify(object.toString('base64'))}.decode("base64")`,
        },
      },
      pipeline: { processors: [{ parquet_decode: {} }] },
      output: { stdout: {} },
    });
    assert.equal(
      new Set(rows.map((row) => (row as { store_region: string }).store_region))
        .size,
      1
    );
    decoded.push(...rows);
  }
  assert.equal(decoded.length, 25);
  assert.equal(
    new Set(decoded.map((row) => (row as { txn_id: string }).txn_id)).size,
    25
  );
});
