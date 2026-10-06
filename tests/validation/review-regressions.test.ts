import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { execFileSync, spawn } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import { parse } from 'yaml';
import {
  LocalEdgeAgent,
  resolveEdgeBinary,
  validateFile,
  validateSource,
} from '../../scripts/validation/edge';
import { planRun } from '../../scripts/validation/harness';
import {
  verifyEncryption,
  verifyOutputs,
  type Expectation,
  type EncryptionExpectation,
} from '../../scripts/validation/expectations';
import {
  isYamlObject,
  type YamlObject,
} from '../../scripts/validation/yaml-value';
import { stringify } from 'yaml';
import { renderReport, summarize } from '../../scripts/validation/report';
import type { PipelineReport } from '../../scripts/validation/types';
import { discoverPipelineFiles } from '../../scripts/validation/inventory';
import { writeFailureReport } from '../../scripts/validation/failure-report';
import type { LocalStandIns } from '../../scripts/validation/harness';
import { rebaseNormalizationFixture } from '../../scripts/validation/recent-timestamps';
import type { Server } from 'node:http';

const root = process.cwd();

const manifest = JSON.parse(
  readFileSync('tests/fixtures/pipeline-inputs/manifest.json', 'utf8')
);

const edge = resolveEdgeBinary(root, { log: () => {} });

const work = mkdtempSync(join(root, '.bin', 'review-regressions-'));

const agent = new LocalEdgeAgent(edge, work, {
  ...manifest.environment,
  REVIEW_BAD_ENCRYPTION_KEY: 'invalid',
  REVIEW_EMPTY_ENCRYPTION_KEY: '',
});

let sequence = 0;

interface ParsedLogRow {
  level?: string;
  message?: string;
  service?: string;
}

interface RequestHeaders {
  'Content-Type': string;
  Authorization?: string;
}

function tcpPort(server: Server): number {
  const address = server.address();

  if (address instanceof Object) return address.port;

  throw new Error('expected a TCP listener address');
}

const failedContracts = [
  'examples/data-routing/smart-buffering-step-1.yaml',
  'examples/data-routing/smart-buffering-step-3.yaml',
  'examples/data-routing/priority-queues-complete.yaml',
  'examples/integrations/scada-energy-edge/scada-edge-complete.yaml',
  'examples/integrations/scada-energy-edge/step-3-classify-faults.yaml',
  'examples/integrations/scada-energy-edge/step-4-route-destinations.yaml',
  'examples/log-processing/enrichment-foundation.yaml',
  'examples/data-routing/circuit-breakers-foundation.yaml',
  'examples/enterprise-migration/db2-to-bigquery/db2-to-bigquery.yaml',
  'static/files/enterprise-migration/db2-to-bigquery/db2-to-bigquery.yaml',
];

const failedExpectations = JSON.parse(
  readFileSync('tests/fixtures/pipeline-inputs/expectations.json', 'utf8')
);

for (const path of failedContracts) {
  test(`reported semantic failure: ${path}`, async () => {
    const file = discoverPipelineFiles(root).find((file) => file.path === path);
    assert.ok(file, path);

    const entry = {
      ...manifest.categories?.[file.category],
      ...manifest.families?.[file.family],
      ...manifest.pipelines?.[path],
    };

    const expectation = failedExpectations[path];
    assert.ok(expectation, path);
    const candidate = `tests/fixtures/pipeline-inputs/${file.family}.jsonl`;

    const fixture =
      entry.fixture ?? (existsSync(candidate) ? candidate : undefined);

    const outputs = await capture(config(path), fixture, {
      inputMetadata: entry.inputMetadata,
      processors: entry.processorStandIns,
      outputFormats: expectation.outputs.map(
        (output) => output.format ?? 'jsonl'
      ),
    });

    verifyOutputs(expectation, [], outputs, manifest.environment);
  });
}

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

    // SAFETY: every path in this table is backed by an encryption fixture
    // contract, which verifyEncryption checks property by property.
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
    // SAFETY: the pipeline mapping emits a timestamp string for every record.
    const rows = (await execute(pipeline)) as Array<{ timestamp: string }>;
    assert.equal(rows.length, 1);
    assert.equal(rows[0].timestamp, expected);
    pipeline.input = {
      generate: {
        count: 1,
        mapping: `root = ${JSON.stringify({ event_id: 'naive', event_type: 'test', timestamp: expected.slice(0, -1) })}`,
      },
    };
    // SAFETY: the same mapping contract applies to the naive timestamp case.
    const naive = (await execute(pipeline)) as Array<{ timestamp: string }>;
    assert.equal(naive[0].timestamp, expected);
  });
}

test('preserves cent precision in generated retail transactions', async () => {
  const original = config('static/pipelines/motherduck-retail-pipeline.yaml');

  // SAFETY: the retail generator emits the numeric transaction fields checked
  // immediately below for all 25 generated records.
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
    const port = tcpPort(server);

    const original = config(
      'examples/data-routing/circuit-breakers-complete.yaml'
    );

    const serialized = stringify(original)
      .replace(
        '${PRIMARY_API:http://api:8080}',
        `http://127.0.0.1:${port}/primary`
      )
      .replace(
        '${SECONDARY_API:http://backup-api:8080}',
        `http://127.0.0.1:${port}/secondary`
      );

    // SAFETY: serialized was produced from a known YamlObject pipeline and
    // only two URL scalar values were replaced.
    const pipeline = parse(serialized) as YamlObject;
    pipeline.input = {
      generate: { count: 1, mapping: 'root = {"event_id":"fallback"}' },
    };
    pipeline.output = { stdout: {} };

    // SAFETY: the enrichment mapping always emits enrichment_source.
    const failed = (await execute(pipeline)) as Array<{
      enrichment_source: string;
    }>;

    assert.equal(failed[0].enrichment_source, 'secondary_api');
    assert.equal(secondaryCalls, 1);
    primaryFails = false;

    // SAFETY: the healthy path uses the same enrichment output contract.
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

  // SAFETY: the selected switch case is an output mapping in the canonical
  // nightly-backup pipeline.
  const destination = pipeline.output as YamlObject;
  destination.processors = [{ parquet_decode: {} }];
  const rows = await execute(pipeline);
  // SAFETY: parquet_decode emits objects carrying each decoded record string.
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

  // SAFETY: the encrypt-data family fixture owns an EncryptionExpectation,
  // which verifyEncryption validates against the emitted records.
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
    cliVersion: 'v2.1.22',
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
  assert.match(markdown, /✅ pass \(stubbed fixture harness\)/);
  assert.match(
    markdown,
    /Replaced processors and resources were not exercised as committed/
  );
});

// SAFETY: the checked-in expectations fixture is consumed through the
// Expectation contract and verified for every complete inventory entry below.
const contracts = JSON.parse(
  readFileSync('tests/fixtures/pipeline-inputs/expectations.json', 'utf8')
) as Record<string, Expectation>;

test('every complete inventory entry has a semantic output contract', () => {
  const complete = discoverPipelineFiles(root).filter((file) =>
    file.kind.startsWith('complete')
  );

  assert.equal(complete.length, 122);

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

for (const path of [
  'examples/data-transformation/aggregate-time-windows.yaml',
  'static/files/data-transformation/aggregate-time-windows.yaml',
]) {
  test(`filters invalid sensor records before windowing: ${path}`, async () => {
    const original = config(path);

    const planned = planRun(
      original,
      resolve(
        root,
        'tests/fixtures/pipeline-inputs/aggregate-time-windows-mixed.jsonl'
      ),
      join(
        work,
        `aggregate-plan-${path.startsWith('static/') ? 'static' : 'example'}`
      )
    );

    assert.ok(isYamlObject(planned.config.input));
    assert.ok(isYamlObject(original.input));
    assert.deepEqual(
      planned.config.input.processors,
      original.input.processors
    );

    const mixed = await execute(
      original,
      'tests/fixtures/pipeline-inputs/aggregate-time-windows-mixed.jsonl'
    );

    assert.equal(mixed.length, 1);
    assert.ok(isYamlObject(mixed[0]));
    assert.deepEqual(Object.keys(mixed[0]).sort(), [
      'event_count',
      'group_key',
      'sensor_id',
      'temperature_avg',
      'temperature_max',
      'temperature_min',
      'time_bucket',
      'window_end',
      'window_start',
    ]);

    const aggregate = mixed[0];
    assert.equal(aggregate.sensor_id, 'sensor-1');
    assert.equal(aggregate.event_count, 2);
    assert.equal(aggregate.temperature_avg, 21.8);
    assert.equal(aggregate.temperature_min, 21.5);
    assert.equal(aggregate.temperature_max, 22.1);
    assert.equal(aggregate.time_bucket, aggregate.window_start);
    assert.equal(
      aggregate.group_key,
      `sensor-1|${String(aggregate.window_start)}`
    );

    const allInvalid = await capture(
      config(path),
      'tests/fixtures/pipeline-inputs/aggregate-time-windows-all-invalid.jsonl'
    );

    assert.deepEqual(allInvalid, ['']);
  });
}

test('complete content splitting retains batch context and valid routing', async () => {
  const path = 'examples/data-routing/content-splitting-complete.yaml';
  const expectation = contracts[path];
  assert.equal(expectation.kind, 'records');

  if (expectation.kind !== 'records') return;

  const texts = await capture(
    config(path),
    'tests/fixtures/pipeline-inputs/data-routing.jsonl'
  );

  verifyOutputs(expectation, [], texts, manifest.environment);

  const rows = texts[0]
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));

  assert.ok(rows.every((row) => row.batch_context.total_items === 1));
});

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
  // SAFETY: the log parsing pipeline emits the three optional scalar fields
  // asserted immediately below.
  const rows = (await execute(pipeline)) as ParsedLogRow[];
  assert.equal(rows.length, 1);
  assert.equal(rows[0].service, 'billing,worker');
  assert.equal(rows[0].message, 'request failed');
  assert.equal(rows[0].level, 'WARN');
});

test('retail enrichment rounds average item prices to cents', async () => {
  const original = config('static/pipelines/motherduck-retail-pipeline.yaml');

  if (!original.pipeline || !(original.pipeline instanceof Object))
    throw new Error('retail pipeline processors are missing');

  const processors = original.pipeline.processors;

  if (!Array.isArray(processors))
    throw new Error('retail pipeline processors are missing');

  // SAFETY: the first retail processor emits avg_item_price as a number.
  const rows = (await execute({
    input: {
      generate: {
        count: 1,
        mapping:
          'root = {"store_id":1,"timestamp":"2026-10-05T12:00:00Z","subtotal":13.96,"items":[{},{},{}]}',
      },
    },
    pipeline: { processors: [processors[0]] },
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
        // SAFETY: config(path) is a known pipeline mapping and replaceAll only
        // changes the referenced environment variable name.
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

test('normalization rebases foundation expectations keyed by equals', () => {
  const recent = rebaseNormalizationFixture(
    readFileSync(
      'tests/fixtures/pipeline-inputs/data-transformation.jsonl',
      'utf8'
    ),
    contracts['examples/data-transformation/normalization-foundation.yaml'],
    new Date('2035-02-04T20:00:00Z')
  );

  const expectation = recent.expectation;

  assert.equal(expectation.kind, 'records');

  if (expectation.kind !== 'records') return;

  const first = expectation.outputs[0].records![0].equals!;

  assert.equal(first.timestamp, '2035-02-03T12:00:00.000Z');
  assert.equal(first.time, '2035-02-03 12:00:00');
});

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

for (const path of [
  'examples/data-transformation/normalize-timestamps.yaml',
  'examples/data-transformation/normalize-timestamps-complete.yaml',
  'static/files/data-transformation/normalize-timestamps.yaml',
]) {
  test(`normalization preserves fractional timestamps and millisecond metadata: ${path}`, async () => {
    const instant = Math.floor((Date.now() - 86400000) / 1000) * 1000 + 123;
    const iso = new Date(instant).toISOString();

    const offset = new Date(instant + 2 * 3600000)
      .toISOString()
      .replace('Z', '+02:00');

    const nano = iso.replace('.123Z', '.123456789Z');

    const timestamps = [
      iso,
      instant,
      offset,
      nano,
      iso.replace('T', ' ').replace('Z', ''),
      iso.replace('.123Z', 'Z'),
      ...[1, 10, 999].map((milliseconds) => instant - 123 + milliseconds),
    ];

    const fixture = join(work, 'fractional-timestamps.jsonl');
    writeFileSync(
      fixture,
      timestamps
        .map((timestamp, index) =>
          JSON.stringify({
            event_id: `fraction-${index}`,
            event_type: 'activity',
            timestamp,
          })
        )
        .join('\n') + '\n'
    );
    const outputs = await capture(config(path), fixture);

    const expected = [
      iso,
      iso,
      iso,
      nano,
      iso,
      iso.replace('.123Z', 'Z'),
      ...[1, 10, 999].map((milliseconds) =>
        new Date(instant - 123 + milliseconds)
          .toISOString()
          .replace('.010Z', '.01Z')
      ),
    ];

    const destinations = path.includes('-complete')
      ? outputs
      : outputs.slice(0, 2);

    for (const destination of destinations) {
      const rows = destination
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line));

      assert.equal(rows.length, timestamps.length);

      for (const row of rows) {
        const index = Number(row.event_id.replace('fraction-', ''));
        assert.equal(row.timestamp, expected[index]);
        assert.equal(row.timestamp_original, timestamps[index]);

        if (!path.includes('-complete'))
          assert.equal(
            row.time_metadata.unix_milli,
            Date.parse(expected[index])
          );
      }
    }

    if (!path.includes('-complete')) assert.equal(outputs[2], '');
  });
}

test('Splunk HEC envelopes mask PII in parsed and fallback log lines', async () => {
  for (const prefix of ['2026-10-05 12:00:00 [ERROR] [worker] ', '']) {
    const pipeline = config('static/pipelines/splunk-production-pipeline.yaml');
    // SAFETY: config() returns a pipeline with a mapping-valued input.
    delete (pipeline.input as YamlObject).file;
    pipeline.input = {
      generate: {
        count: 1,
        mapping: `root = ${JSON.stringify(prefix + 'customer person@example.com SSN 123-45-6789 card 4532-1234-5678-9010 phone 4155551234')}`,
      },
    };

    // SAFETY: the Splunk mapping emits the optional HEC envelope fields read
    // by this regression test.
    const rows = (await execute(pipeline)) as Array<{
      sourcetype?: string;
      event?: { message?: string; raw_message?: string };
    }>;

    const hecRows = rows.filter((row) => row.sourcetype === 'app:custom');
    assert.equal(hecRows.length, 1);

    const masked =
      'customer ***@***.*** SSN ***-**-**** card ****-****-****-**** phone ***-***-****';

    assert.equal(hecRows[0].event?.message, masked);
    assert.equal(hecRows[0].event?.raw_message, prefix + masked);
    const delivered = JSON.stringify(rows);
    assert.doesNotMatch(delivered, /person@example\.com/);
    assert.doesNotMatch(delivered, /123-45-6789/);
    assert.doesNotMatch(delivered, /4532-1234-5678-9010/);
    assert.doesNotMatch(delivered, /4155551234/);
  }
});

test('payment HTTPS ingestion rejects unauthenticated requests before forwarding', async () => {
  const token = manifest.environment.PAYMENTS_INGEST_TOKEN;

  for (const configured of [true, false]) {
    const listener = createServer();
    await new Promise<void>((resolve) =>
      listener.listen(0, '127.0.0.1', resolve)
    );
    const port = tcpPort(listener);
    await new Promise<void>((resolve, reject) =>
      listener.close((error) => (error ? reject(error) : resolve()))
    );
    let pipeline = config('examples/data-security/encrypt-data.yaml');

    if (!configured)
      // SAFETY: the replacement preserves the known pipeline mapping shape.
      pipeline = parse(
        stringify(pipeline).replaceAll(
          'env("PAYMENTS_INGEST_TOKEN")',
          'env("REVIEW_EMPTY_ENCRYPTION_KEY")'
        )
      ) as YamlObject;
    // SAFETY: encrypt-data owns a mapping-valued input with http_server.
    const input = pipeline.input as YamlObject;
    // SAFETY: the canonical input contract defines http_server as a mapping.
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
            headers: (() => {
              const headers: RequestHeaders = {
                'Content-Type': 'application/json',
              };

              if (authorization) headers.Authorization = authorization;

              return headers;
            })(),
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
          if (
            !(error instanceof Error) ||
            !('code' in error) ||
            error.code !== 'ECONNREFUSED'
          )
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
        // SAFETY: the encrypt-data fixture owns the encryption contract used
        // to verify the authenticated request output.
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

    // SAFETY: parquet_decode returns the store_region written by the source.
    const regionalRows = rows as Array<{ store_region: string }>;
    assert.equal(new Set(regionalRows.map((row) => row.store_region)).size, 1);
    decoded.push(...rows);
  }

  assert.equal(decoded.length, 25);
  // SAFETY: decoded retail records retain the source transaction identifier.
  const decodedTransactions = decoded as Array<{ txn_id: string }>;
  assert.equal(new Set(decodedTransactions.map((row) => row.txn_id)).size, 25);
});

test('generated normalization fixtures emit stable report paths', () => {
  const path = 'examples/data-transformation/normalize-timestamps.yaml';

  const reports = ['first-', 'second-'].map((prefix): PipelineReport[] => {
    const directory = mkdtempSync(join(work, prefix));
    const fixture = join(directory, 'recent-timestamps.jsonl');

    const recent = rebaseNormalizationFixture(
      readFileSync(
        'tests/fixtures/pipeline-inputs/data-transformation.jsonl',
        'utf8'
      ),
      contracts[path]
    );

    writeFileSync(fixture, recent.source);
    const plan = planRun(config(path), fixture, join(directory, 'output'));

    return [
      {
        file: {
          path,
          kind: 'complete-job',
          category: 'data-transformation',
          family: 'normalize-timestamps',
        },
        validate: { status: 'PASS', mode: 'file', errors: [] },
        run: {
          status: 'PASS',
          mode: plan.mode,
          reason: 'semantic output verified',
          substitutions: plan.substitutions,
        },
      },
    ];
  });

  const options = {
    date: '2026-10-05',
    edgeVersion: edge.version,
    cliVersion: 'v2.1.22',
    inventoryDigest: 'fixture-digest',
  };

  assert.equal(JSON.stringify(reports[0]), JSON.stringify(reports[1]));
  const markdown = renderReport(reports[0], summarize(reports[0], options), 2);
  assert.equal(
    markdown,
    renderReport(reports[1], summarize(reports[1], options), 2)
  );
  assert.match(markdown, /\.validation-input\/recent-timestamps\.jsonl/);
});

test('original ingestion pipelines validate their declared rate limits', () => {
  for (const path of [
    'examples/log-processing/production-pipeline.yaml',
    'examples/log-processing/production-pipeline-complete.yaml',
    'examples/data-security/enforce-schema.yaml',
    'examples/data-security/remove-pii.yaml',
    'examples/data-routing/priority-queues.yaml',
    'examples/data-routing/smart-buffering.yaml',
    'static/files/log-processing/production-pipeline.yaml',
    'static/files/data-security/enforce-schema.yaml',
    'static/files/data-routing/priority-queues.yaml',
    'static/files/data-routing/smart-buffering.yaml',
  ]) {
    const result = validateFile(edge, root, path, manifest.environment);
    assert.equal(result.status, 'PASS', `${path}: ${JSON.stringify(result)}`);
  }
});

test('original validation rejects unresolved input and processor rate limits', () => {
  for (const declared of [false, true]) {
    const pipeline: YamlObject = {
      input: {
        http_server: {
          address: '127.0.0.1:8080',
          path: '/records',
          rate_limit: 'ingest',
        },
      },
      pipeline: { processors: [{ rate_limit: { resource: 'ingest' } }] },
      output: { stdout: {} },
    };

    if (declared)
      pipeline.rate_limit_resources = [
        { label: 'ingest', local: { count: 10, interval: '1s' } },
      ];

    const source = stringify(pipeline);
    const path = join(work, 'rate-limits.yaml');
    writeFileSync(path, source);

    for (const result of [
      validateSource(edge, root, source),
      validateFile(edge, root, path.slice(root.length + 1)),
    ]) {
      assert.equal(
        result.status,
        declared ? 'PASS' : 'FAIL',
        JSON.stringify(result)
      );

      if (!declared) {
        assert.deepEqual(
          result.errors.map((error) => error.path),
          [
            'config.input.http_server.rate_limit',
            'config.pipeline.processors.0.rate_limit',
          ]
        );
      }
    }
  }
});

for (const path of [
  'examples/data-security/cross-border-gdpr/cross-border-gdpr.yaml',
  'static/files/data-security/cross-border-gdpr.yaml',
]) {
  test(`GDPR errors block global transfer while preserving the regional archive: ${path}`, async () => {
    const original = JSON.parse(
      readFileSync(
        'tests/fixtures/pipeline-inputs/cross-border-gdpr.jsonl',
        'utf8'
      ).split('\n')[0]
    );

    original.customer_email = null;
    const fixture = join(work, 'nullable-gdpr.jsonl');
    writeFileSync(fixture, JSON.stringify(original) + '\n');
    const outputs = await capture(config(path), fixture, {}, 'failed');
    assert.equal(outputs.length, 3);
    assert.equal(outputs[0], '');
    assert.equal(outputs[2], '');

    const archive = outputs[1]
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));

    assert.equal(archive.length, 1);
    const { _archive_metadata, ...row } = archive[0];
    assert.deepEqual(row, original);
    assert.equal(_archive_metadata.data_classification, 'personal_data_eu');
  });
}

test('PII processing failures reach only the DLQ before fan-out', async () => {
  const original = JSON.parse(
    readFileSync('tests/fixtures/pipeline-inputs/remove-pii.jsonl', 'utf8')
  );

  delete original.location;
  original.ssn = '123-45-6789';
  const fixture = join(work, 'pii-without-location.jsonl');
  writeFileSync(fixture, JSON.stringify(original) + '\n');

  const outputs = await capture(
    config('examples/data-security/remove-pii.yaml'),
    fixture,
    {},
    'failed'
  );

  assert.equal(outputs.length, 3);
  assert.equal(outputs[0], '');
  assert.equal(outputs[1], '');

  const rows = outputs[2]
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));

  assert.equal(rows.length, 1);
  assert.equal(rows[0].event_id, original.event_id);
  assert.equal(rows[0].ssn, original.ssn);
  assert.equal(
    rows[0].payment_method.full_number,
    original.payment_method.full_number
  );

  const valid = await capture(
    config('examples/data-security/remove-pii.yaml'),
    'tests/fixtures/pipeline-inputs/remove-pii.jsonl'
  );

  verifyOutputs(
    contracts['examples/data-security/remove-pii.yaml'],
    [],
    valid,
    manifest.environment
  );
});

test('ID deduplication accepts SQL timestamps and archives duplicates', async () => {
  const path = 'examples/data-transformation/deduplicate-events-complete.yaml';
  const pipeline = config(path);
  assert.ok(pipeline.cache_resources);

  const rows = [
    { event_id: 'first', timestamp: '2026-10-05 12:00:00' },
    { event_id: 'second', timestamp: '2026-10-05 12:00:01' },
    { event_id: 'first', timestamp: '2026-10-05 12:00:02' },
  ];

  const fixture = join(work, 'id-deduplication.jsonl');
  writeFileSync(
    fixture,
    rows.map((row) => JSON.stringify(row)).join('\n') + '\n'
  );

  // SAFETY: the ID dedup mapping emits these fields for every fixture row.
  const outputs = (await execute(pipeline, fixture)) as Array<{
    event_id: string;
    dedup_key: string;
    is_duplicate: boolean;
    duplicate_metadata?: { strategy: string };
  }>;

  assert.deepEqual(outputs.map((row) => [row.event_id, row.dedup_key]).sort(), [
    ['first', 'first'],
    ['first', 'first'],
    ['second', 'second'],
  ]);
  assert.equal(
    outputs.filter((row) => row.is_duplicate).length,
    1,
    JSON.stringify(outputs)
  );
  assert.equal(
    outputs.find((row) => row.is_duplicate)?.duplicate_metadata?.strategy,
    'event_id'
  );
  writeFileSync(
    fixture,
    [
      {
        event_id: 'a',
        dedup_strategy: 'composite',
        event_type: 'click',
        source: 'web',
        timestamp: '2026-10-05T12:00:00Z',
      },
      {
        event_id: 'b',
        dedup_strategy: 'composite',
        event_type: 'click',
        source: 'web',
        timestamp: '2026-10-05T12:00:30Z',
      },
      {
        event_id: 'c',
        dedup_strategy: 'composite',
        event_type: 'click',
        source: 'web',
        timestamp: '2026-10-05T12:01:00Z',
      },
    ]
      .map((row) => JSON.stringify(row))
      .join('\n') + '\n'
  );

  // SAFETY: the composite strategy uses the same dedup output contract.
  const composite = (await execute(pipeline, fixture)) as Array<{
    dedup_key: string;
    is_duplicate: boolean;
  }>;

  assert.deepEqual(
    composite.map((row) => row.dedup_key).sort(),
    [
      '2026-10-05T12:00:00Z',
      '2026-10-05T12:00:00Z',
      '2026-10-05T12:01:00Z',
    ].map(
      (timestamp) => `click:web:${Math.floor(Date.parse(timestamp) / 60000)}`
    )
  );
  assert.equal(composite.filter((row) => row.is_duplicate).length, 1);
});

for (const path of [
  'examples/enterprise-migration/nightly-backup/nightly-backup.yaml',
  'static/files/enterprise-migration/nightly-backup/nightly-backup.yaml',
]) {
  for (const [route, table] of [
    'orders',
    'inventory',
    'order_items',
  ].entries()) {
    test(`backup batches retain unique Parquet objects for ${table}: ${path}`, async () => {
      const source = parse(readFileSync(path, 'utf8')).config;

      const destination =
        source.output.switch.cases[route].output.gcp_cloud_storage;

      const directory = mkdtempSync(join(work, `${table}-`));

      const pipeline: YamlObject = {
        input: {
          generate: {
            count: 5,
            interval: '1ms',
            mapping: `root = {"_table":"${table}","row_id":counter(),"amount":2.99}`,
          },
        },
        pipeline: source.pipeline,
        output: {
          broker: {
            pattern: 'fan_out',
            batching: { ...destination.batching, count: 2, period: '1s' },
            outputs: [
              {
                file: {
                  path: join(directory, destination.path),
                  codec: 'all-bytes',
                },
              },
            ],
          },
        },
      };

      const validity = validateSource(
        edge,
        root,
        stringify(pipeline),
        manifest.environment
      );

      assert.equal(validity.status, 'PASS', JSON.stringify(validity));

      const deployed = await agent.deploy({
        name: `inventory-${++sequence}`,
        type: 'pipeline',
        config: pipeline,
      });

      assert.ok(deployed.ok, JSON.stringify(deployed));

      try {
        const deadline = Date.now() + 20_000;
        let state = '';

        while (Date.now() < deadline) {
          state = (await agent.executionStatus(deployed.jobId))?.state ?? '';

          if (['completed', 'failed', 'stopped'].includes(state)) break;
          await new Promise((resolve) => setTimeout(resolve, 100));
        }

        assert.equal(state, 'completed');

        const files = readdirSync(directory, { recursive: true }).filter(
          (name) => String(name).endsWith('.parquet')
        );

        assert.ok(files.length >= 3 && files.length <= 5);
        const decoded: Array<{ record: string }> = [];

        for (const file of files) {
          const bytes = readFileSync(join(directory, String(file)));
          // SAFETY: parquet_decode emits a record string for each source row.
          decoded.push(
            ...((await execute({
              input: {
                generate: {
                  count: 1,
                  mapping: `root = ${JSON.stringify(bytes.toString('base64'))}.decode("base64")`,
                },
              },
              pipeline: { processors: [{ parquet_decode: {} }] },
              output: { stdout: {} },
            })) as Array<{ record: string }>)
          );
        }

        assert.equal(decoded.length, 5);
        assert.equal(
          new Set(decoded.map((row) => JSON.parse(row.record).row_id)).size,
          5
        );
      } finally {
        await agent.deleteJob(deployed.jobId);
      }
    });
  }
}

for (const path of [
  'examples/data-routing/smart-buffering-step-4.yaml',
  'examples/data-routing/smart-buffering.yaml',
  'static/files/data-routing/smart-buffering.yaml',
]) {
  test(`smart buffering satisfies its computed priority contract: ${path}`, async () => {
    const outputs = await capture(
      config(path),
      'tests/fixtures/pipeline-inputs/data-routing.jsonl'
    );

    const expectation = contracts[path];
    verifyOutputs(expectation, [], outputs, manifest.environment);

    const corrupted = outputs.map(
      (text) =>
        text
          .trim()
          .split('\n')
          .filter(Boolean)
          .map((line) => {
            const row = JSON.parse(line);
            row.priority_score += 1;

            return JSON.stringify(row);
          })
          .join('\n') + '\n'
    );

    assert.throws(() =>
      verifyOutputs(expectation, [], corrupted, manifest.environment)
    );
  });
}

for (const path of [
  'examples/data-transformation/transform-formats.yaml',
  'static/files/data-transformation/transform-formats.yaml',
]) {
  test(`Avro encoder terminates invalid input without waiting for stdin EOF: ${path}`, async () => {
    const pipeline = parse(readFileSync(path, 'utf8')).config;

    const encoder = pipeline.pipeline.processors.find(
      (processor: { subprocess?: unknown }) => processor.subprocess
    ).subprocess;

    for (const humidity of [undefined, 'not-a-number']) {
      const child = spawn(encoder.name, encoder.args, {
        cwd: work,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      const stdout: Buffer[] = [];
      const stderr: Buffer[] = [];
      child.stdout.on('data', (chunk) => stdout.push(chunk));
      child.stderr.on('data', (chunk) => stderr.push(chunk));

      const closed = new Promise<number | null>((resolve, reject) => {
        child.once('error', reject);
        child.once('close', (code) => resolve(code));
      });

      let timer: ReturnType<typeof setTimeout> | undefined;

      try {
        child.stdin.write(
          JSON.stringify({
            sensor_id: 'sensor-1',
            location: 'warehouse',
            temperature: 20,
            humidity,
            timestamp: '2026-10-05T12:00:00Z',
            device_type: 'sensor',
            firmware_version: '1.0',
          }) + '\n'
        );

        const code = await Promise.race([
          closed,
          new Promise<never>((_, reject) => {
            timer = setTimeout(
              () => reject(new Error('encoder waited for another stdin line')),
              3000
            );
          }),
        ]);

        assert.equal(code, 1);
        assert.equal(Buffer.concat(stdout).length, 0);
        assert.match(Buffer.concat(stderr).toString(), /Invalid double/);
      } finally {
        clearTimeout(timer);

        if (child.exitCode === null && child.signalCode === null)
          child.kill('SIGKILL');
        await closed;
      }
    }
  });
}

test('executor resolution ignores the optional environment override', () => {
  const previous = process.env.EXPANSO_EDGE_BIN;
  process.env.EXPANSO_EDGE_BIN = join(work, 'missing-override');

  try {
    assert.deepEqual(resolveEdgeBinary(root, { log: () => {} }), edge);
  } finally {
    if (previous === undefined) delete process.env.EXPANSO_EDGE_BIN;
    else process.env.EXPANSO_EDGE_BIN = previous;
  }
});

test('executor spawn errors propagate into dated and latest failure reports', async () => {
  const destination = mkdtempSync(join(work, 'spawn-failure-'));

  const unavailable = new LocalEdgeAgent(
    { path: join(destination, 'missing-executor'), version: edge.version },
    destination
  );

  let failure: unknown;

  try {
    await unavailable.start().catch((error) => {
      failure = error;
      writeFailureReport(destination, '2026-10-05', error);
    });
    assert.ok(failure instanceof Error);

    for (const name of ['2026-10-05', 'latest']) {
      const reportRoot = join(destination, 'validation-reports', name);

      const report = JSON.parse(
        readFileSync(join(reportRoot, 'report.json'), 'utf8')
      );

      assert.match(report.summary.failure, /ENOENT/);
      assert.equal(report.summary.date, '2026-10-05');
      assert.match(
        readFileSync(join(reportRoot, 'README.md'), 'utf8'),
        /Overall: \*\*FAIL\*\*/
      );
    }
  } finally {
    await unavailable.stop();
  }
});

for (const path of [
  'examples/log-processing/production-pipeline.yaml',
  'examples/log-processing/production-pipeline-complete.yaml',
  'static/files/log-processing/production-pipeline.yaml',
]) {
  test(`production logs fail closed before every fan-out destination: ${path}`, async () => {
    const complete = path.includes('-complete');
    const common = { timestamp: '2026-10-05T12:00:00Z', service: 'payments' };

    const valid = {
      ...common,
      id: 'safe',
      level: 'ERROR',
      message: complete
        ? 'user ada@example.com SSN 123-45-6789 card 4111111111111111'
        : 'request completed',
      ...(complete
        ? { source_ip: '192.0.2.1' }
        : {
            ip_address: '192.0.2.1',
            password: 'password-to-remove',
            token: 'token-to-remove',
            api_key: 'key-to-remove',
            secret: 'secret-to-remove',
          }),
    };

    const invalid = ['INFO', 'ERROR'].map((level) => ({
      ...common,
      id: `unsafe-${level}`,
      level,
      message: 'user ada@example.com SSN 123-45-6789',
      ...(complete
        ? { source_ip: null }
        : {
            ip_address: null,
            password: 'plaintext-password',
            token: 'plaintext-token',
            secret: 'plaintext-secret',
            api_key: 'plaintext-key',
          }),
    }));

    const fixture = join(work, 'production-redaction.jsonl');
    writeFileSync(
      fixture,
      [valid, ...invalid].map((row) => JSON.stringify(row)).join('\n') + '\n'
    );
    const outputs = await capture(config(path), fixture, {}, 'failed');
    assert.equal(outputs.length, 3);

    for (const destination of outputs) {
      const rows = destination
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line));

      assert.equal(rows.length, 1);
      assert.equal(rows[0].id, 'safe');

      if (complete) {
        assert.equal(rows[0].message, 'user [EMAIL] SSN [SSN] card [CARD]');
        assert.notEqual(rows[0].source_ip, valid.source_ip);
      } else {
        for (const field of ['password', 'token', 'api_key', 'secret'])
          assert.ok(!(field in rows[0]));
        assert.notEqual(rows[0].ip_address, valid.ip_address);
      }
    }

    const healthy = await capture(
      config(path),
      'tests/fixtures/pipeline-inputs/log-processing.jsonl'
    );

    verifyOutputs(contracts[path], [], healthy, manifest.environment);
  });
}
