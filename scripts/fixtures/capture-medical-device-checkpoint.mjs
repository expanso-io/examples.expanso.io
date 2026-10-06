import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { format } from 'prettier';
import ts from 'typescript';
import { parse, stringify } from 'yaml';
import { checkpointLines } from './checkpoint-lines.mjs';

const stagePath =
  'docs/integrations/medical-device-intelligence-full.stages.ts';
const fragment = parse(
  readFileSync(
    'examples/explorer-stages/medical-device-intelligence/01-collect-synthetic-fixtures.yaml',
    'utf8'
  )
);
const source = fragment.input.broker.inputs.find((input) =>
  input.file?.paths.some((path) => path.endsWith('/error-events.json'))
);
const fixturePath = resolve(
  'examples/integrations/medical-device-intelligence/error-events.json'
);
const scratch = mkdtempSync(resolve('.nm-medical-checkpoint-'));
try {
  const configPath = resolve(scratch, 'pipeline.yaml');
  writeFileSync(
    configPath,
    stringify({
      http: { enabled: false },
      logger: { level: 'ERROR' },
      input: { ...source, file: { ...source.file, paths: [fixturePath] } },
      output: { stdout: { codec: 'lines' } },
    })
  );
  const result = spawnSync('benthos', ['run', configPath], {
    encoding: 'utf8',
    timeout: 30000,
  });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
  const actual = JSON.parse(result.stdout);
  const fixture = JSON.parse(readFileSync(fixturePath, 'utf8'));
  assert.deepEqual(actual, { source: 'error_events', data: fixture });

  const compiled = ts.transpileModule(readFileSync(stagePath, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ESNext },
  }).outputText;
  const { medicalDeviceIntelligenceStages: stages } = await import(
    `data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`
  );
  const output = stages[0].outputLines;
  const messages = [];
  let start;
  output.forEach((line, index) => {
    if (line.indent === 0 && line.content === '{') start = index;
    if (line.indent === 0 && line.content === '}') {
      messages.push({
        start,
        end: index + 1,
        value: JSON.parse(
          output
            .slice(start, index + 1)
            .map((entry) => entry.content)
            .join('\n')
        ),
      });
    }
  });
  const matches = messages.filter(
    (message) => message.value.source === 'error_events'
  );
  assert.equal(matches.length, 1);
  const checkpoint = matches[0];
  if (process.argv.includes('--write')) {
    output.splice(
      checkpoint.start,
      checkpoint.end - checkpoint.start,
      ...checkpointLines(actual, { data: fixture })
    );
    writeFileSync(
      stagePath,
      await format(
        `import type { Stage } from '@site/src/components/DataPipelineExplorer/types';\n\nexport const medicalDeviceIntelligenceStages: Stage[] = ${JSON.stringify(stages, null, 2)};\n`,
        { parser: 'typescript', singleQuote: true }
      )
    );
    process.stdout.write(
      'Captured the complete medical-device error-events checkpoint.\n'
    );
  } else {
    assert.deepEqual(checkpoint.value, actual);
    process.stdout.write(
      'PASS: medical-device collection preserves the complete error-events fixture.\n'
    );
  }
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
