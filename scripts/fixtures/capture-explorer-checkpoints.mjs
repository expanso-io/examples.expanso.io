import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';
import { parse, stringify } from 'yaml';
import { format } from 'prettier';

const write = process.argv.includes('--write');
const scratch = resolve('.nm-checkpoint-capture');
const families = [
  ['enterprise-migration', 'db2-to-bigquery', 'db2ToBigqueryStages'],
  ['data-security', 'cross-border-gdpr', 'crossBorderGdprStages'],
  ['enterprise-migration', 'nightly-backup', 'nightlyBackupStages'],
];

function execute(processors, rows) {
  mkdirSync(scratch, { recursive: true });
  const path = `${scratch}/pipeline.yaml`;
  writeFileSync(
    path,
    stringify({
      http: { enabled: false },
      logger: { level: 'ERROR' },
      input: {
        generate: { count: 1, mapping: `root = ${JSON.stringify(rows)}` },
      },
      pipeline: {
        threads: 1,
        processors: [{ unarchive: { format: 'json_array' } }, ...processors],
      },
      output: { stdout: { codec: 'lines' } },
    })
  );
  const result = spawnSync('benthos', ['run', path], {
    encoding: 'utf8',
    timeout: 30000,
    env: {
      ...process.env,
      NODE_ID: 'unknown',
      DB_HOST: 'unknown',
      DB_NAME: 'unknown',
      SOURCE_COUNTRY: 'DE',
      ANONYMIZATION_SALT: 'gdpr-compliance-2024',
    },
  });
  if (result.error || result.status !== 0 || result.stderr.trim()) {
    throw new Error(result.error?.message || result.stderr);
  }
  return result.stdout
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

async function load(path) {
  const source = ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ESNext },
  }).outputText;
  return import(
    `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
  );
}

function json(lines) {
  return JSON.parse(
    lines
      .filter((line) => line.content.trim() && !line.content.startsWith('#'))
      .map((line) => line.content)
      .join('\n')
  );
}

function lines(value, previous = []) {
  return JSON.stringify(value, null, 2)
    .split('\n')
    .map((line, index) => ({
      ...previous[index],
      content: line.trimStart(),
      indent: (line.length - line.trimStart().length) / 2,
    }))
    .concat(
      previous.filter(
        (line) => !line.content.trim() || line.content.startsWith('#')
      )
    );
}

function highlightChanges(output, input) {
  const unchanged = new Set(input.map((line) => line.content));
  return output.map((line) => ({
    ...line,
    type:
      unchanged.has(line.content) || /^[\s{}\[\],]*$/.test(line.content)
        ? 'normal'
        : 'highlighted',
  }));
}

async function save(path, name, stages) {
  writeFileSync(
    path,
    await format(
      `import type { Stage } from '@site/src/components/DataPipelineExplorer/types';\n\nexport const ${name}: Stage[] = ${JSON.stringify(stages, null, 2)};\n`,
      { parser: 'typescript', singleQuote: true }
    )
  );
}

try {
  if (!write) {
    for (const path of [
      'examples/enterprise-migration/db2-to-bigquery/db2-to-bigquery.yaml',
      'static/files/enterprise-migration/db2-to-bigquery/db2-to-bigquery.yaml',
      'examples/explorer-stages/db2-to-bigquery/02-normalize-currency.yaml',
    ]) {
      const config = parse(readFileSync(path, 'utf8'));
      const currency = config.pipeline.processors.find(
        (processor) => processor.branch
      );
      const rows = [
        { AMOUNT: 1, CURRENCY: 'JPY' },
        { AMOUNT: 1.125, CURRENCY: 'USD' },
        { AMOUNT: 2, CURRENCY: 'EUR' },
      ];
      assert.deepEqual(
        execute([currency], rows),
        rows.map((row, index) => ({
          ...row,
          original_amount: row.AMOUNT,
          original_currency: row.CURRENCY,
          amount_usd: [0.0067, 1.125, 2.16][index],
        })),
        `${path}: currency precision and branch result mapping`
      );
    }
    for (const path of [
      'examples/data-security/cross-border-gdpr/cross-border-gdpr.yaml',
      'static/files/data-security/cross-border-gdpr.yaml',
    ]) {
      const config = parse(readFileSync(path, 'utf8'));
      assert.equal(config.name, 'eu-cross-border-compliance');
      const [row] = execute([config.pipeline.processors[0]], [{}]);
      assert.equal(row._data_origin.pipeline, config.name);
    }
  }
  for (const [category, id, name] of families) {
    const path = `docs/${category}/${id}-full.stages.ts`;
    const stages = (await load(path))[name];
    const start = id === 'nightly-backup' ? 1 : 0;
    let current = json(stages[start].inputLines);
    for (let index = start; index < stages.length; index++) {
      const stage = stages[index];
      if (write) stage.inputLines = lines(current, stage.inputLines);
      else
        assert.deepEqual(
          json(stage.inputLines),
          current,
          `${id}: stage input continuity`
        );
      const fragment = parse(
        readFileSync(
          `examples/explorer-stages/${id}/${String(stage.id).padStart(2, '0')}-${stage.slug}.yaml`,
          'utf8'
        )
      );
      if (!fragment.pipeline) break;
      const [actual] = execute(fragment.pipeline.processors, [current]);
      if (write) stage.outputLines = lines(actual, stage.outputLines);
      else {
        const expected = json(stage.outputLines);
        if (index === start) {
          if (id === 'nightly-backup') {
            actual._backup_metadata.backup_timestamp =
              expected._backup_metadata.backup_timestamp;
            actual._backup_metadata.backup_date =
              expected._backup_metadata.backup_date;
          } else if (id === 'db2-to-bigquery')
            actual._lineage.extracted_at = expected._lineage.extracted_at;
          else
            actual._data_origin.extracted_at =
              expected._data_origin.extracted_at;
        }
        if (id === 'cross-border-gdpr' && index === stages.length - 1) {
          actual._gdpr_compliance.verification_timestamp =
            expected._gdpr_compliance.verification_timestamp;
        }
        assert.deepEqual(actual, expected, `${id}: ${stage.slug} output`);
      }
      current = actual;
    }
    if (write) await save(path, name, stages);
  }

  const retailPath =
    'docs/integrations/motherduck-retail-analytics-full.stages.ts';
  const retail = await load(retailPath);
  const [retailName] = Object.keys(retail);
  const stages = retail[retailName];
  const fragment = parse(
    readFileSync(
      'examples/explorer-stages/motherduck-retail-analytics/04-batch-and-encode-to-parquet.yaml',
      'utf8'
    )
  );
  const batching = fragment.output.aws_s3.batching.processors;
  const sample = readFileSync(
    'examples/integrations/motherduck-retail-analytics/sample-pos-events.jsonl',
    'utf8'
  )
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));
  const enrichment = readdirSync(
    'examples/explorer-stages/motherduck-retail-analytics'
  )
    .filter((name) => /^0[23]-/.test(name))
    .sort()
    .flatMap(
      (name) =>
        parse(
          readFileSync(
            `examples/explorer-stages/motherduck-retail-analytics/${name}`,
            'utf8'
          )
        ).pipeline.processors
    );
  const groups = execute(
    [
      ...enrichment,
      ...fragment.pipeline.processors,
      ...batching.slice(0, -1),
      { archive: { format: 'json_array' } },
      {
        mapping:
          'root.region = meta("store_region")\nroot.rows = content().parse_json()',
      },
    ],
    sample
  ).sort((a, b) => a.region.localeCompare(b.region));
  assert.deepEqual(
    groups.map((group) => group.region),
    ['NW', 'SE', 'SW']
  );
  for (const group of groups)
    assert.ok(group.rows.every((row) => row.store_region === group.region));
  assert.equal(
    groups.reduce((count, group) => count + group.rows.length, 0),
    sample.length
  );
  if (!write) {
    assert.deepEqual(json(stages[0].outputLines), sample);
    let current = sample;
    for (const stage of stages.slice(1, 3)) {
      assert.deepEqual(json(stage.inputLines), current);
      const config = parse(
        readFileSync(
          `examples/explorer-stages/motherduck-retail-analytics/0${stage.id}-${stage.slug}.yaml`,
          'utf8'
        )
      );
      current = execute(config.pipeline.processors, current);
      assert.deepEqual(json(stage.outputLines), current);
    }
    assert.deepEqual(json(stages[3].inputLines), current);
    assert.deepEqual(stages[4].inputLines, stages[3].outputLines);
  }
  if (write) {
    stages[0].outputLines = lines(sample);
    let current = sample;
    for (const stage of stages.slice(1, 3)) {
      stage.inputLines = lines(current);
      const config = parse(
        readFileSync(
          `examples/explorer-stages/motherduck-retail-analytics/0${stage.id}-${stage.slug}.yaml`,
          'utf8'
        )
      );
      current = execute(config.pipeline.processors, current);
      stage.outputLines = lines(current);
    }
    stages[3].inputLines = lines(current);
    stages[3].description =
      'Flatten items to JSON text, batch 1000 events or 10 seconds, group by store region, and encode each region group as a separate Parquet object.';
    stages[3].outputLines = [
      {
        content: '[Parquet encoding plan for the sample region groups]',
        indent: 0,
      },
      ...groups.map((group) => ({
        content: `# region=${group.region}: ${group.rows.length} row; metadata store_region=${group.region}`,
        indent: 0,
      })),
      {
        content:
          '# Encoding: zstd; items_json and anomaly_flags serialized as text',
        indent: 0,
      },
      {
        content:
          '# Binary encoding and S3 delivery: not assessed by this capture',
        indent: 0,
      },
    ];
    stages[4].inputLines = stages[3].outputLines;
    stages[4].outputLines = [
      { content: '# Bucket: ${S3_BUCKET}', indent: 0 },
      ...groups.map((group) => ({
        content: `# Key: transactions/region=${group.region}/date=<yyyy-mm-dd>/batch_<unix>_<n>.parquet`,
        indent: 0,
      })),
      { content: '# Delivery behavior: not assessed', indent: 0 },
    ];
    for (const stage of stages) {
      stage.outputLines = highlightChanges(stage.outputLines, stage.inputLines);
    }
    stages[4].inputLines = stages[3].outputLines;
    await save(retailPath, retailName, stages);
  }
  process.stdout.write(
    write
      ? 'Captured sequential checkpoints and region grouping.\n'
      : 'PASS: sequential stage outputs preserve metadata; mixed-region batch separates all three regions.\n'
  );
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
