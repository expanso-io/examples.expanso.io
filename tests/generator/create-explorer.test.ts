import assert from 'node:assert/strict';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { afterEach, describe, it } from 'node:test';

import {
  createExplorerDraft,
  parseArguments,
  renderExplorerDraft,
} from '../../scripts/create-explorer';

const temporaryRoots: string[] = [];

function repositoryRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'create-explorer-test-'));
  temporaryRoots.push(root);
  mkdirSync(join(root, 'src/catalog'), { recursive: true });
  writeFileSync(
    join(root, 'src/catalog/registry.ts'),
    'export const records = [];\n'
  );
  return root;
}

function argumentsFor(
  name: string,
  stages: number,
  extra: string[] = []
): string[] {
  return [
    '--name',
    name,
    '--category',
    'generated-tests',
    '--stages',
    String(stages),
    '--title',
    'Generated Test',
    ...extra,
  ];
}

function generatedBytes(root: string, files: string[]): Record<string, string> {
  return Object.fromEntries(
    files.map((file) => [relative(root, file), readFileSync(file, 'utf8')])
  );
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe('create-explorer draft generator', () => {
  it('fails closed for zero stages before creating output directories', () => {
    const root = repositoryRoot();

    assert.throws(
      () => createExplorerDraft(argumentsFor('zero-stage', 0), root),
      /--stages must be an integer from 1 through 8/
    );
    assert.equal(existsSync(join(root, 'docs')), false);
    assert.equal(existsSync(join(root, 'examples')), false);
  });

  it('rejects stage counts outside the complete 1 through 8 range', () => {
    for (const stages of [9, 1.5]) {
      assert.throws(
        () => parseArguments(argumentsFor('invalid-stage-count', stages)),
        /--stages must be an integer from 1 through 8/
      );
    }
  });

  it('rejects unknown and duplicate arguments', () => {
    assert.throws(
      () =>
        parseArguments(
          argumentsFor('unknown-argument', 1, ['--unexpected', 'value'])
        ),
      /Unknown argument: --unexpected/
    );
    assert.throws(
      () =>
        parseArguments(
          argumentsFor('duplicate-argument', 1, ['--stages', '2'])
        ),
      /Duplicate argument: --stages/
    );
  });

  it('reads the catalog before making any filesystem changes', () => {
    const root = mkdtempSync(join(tmpdir(), 'create-explorer-test-'));
    temporaryRoots.push(root);

    assert.throws(
      () => createExplorerDraft(argumentsFor('missing-catalog', 1), root),
      /ENOENT/
    );
    assert.equal(existsSync(join(root, 'docs')), false);
    assert.equal(existsSync(join(root, 'examples')), false);
  });

  it('generates one stage deterministically', () => {
    const firstRoot = repositoryRoot();
    const secondRoot = repositoryRoot();
    const first = createExplorerDraft(argumentsFor('one-stage', 1), firstRoot);
    const second = createExplorerDraft(
      argumentsFor('one-stage', 1),
      secondRoot
    );

    assert.deepEqual(
      generatedBytes(firstRoot, first.files),
      generatedBytes(secondRoot, second.files)
    );
    const stages = generatedBytes(firstRoot, first.files)[
      'docs/generated-tests/one-stage-full.stages.ts'
    ];
    assert.equal((stages.match(/slug: 'stage-/g) ?? []).length, 1);
    assert.doesNotMatch(stages, /stage-2/);
  });

  it('generates the maximum stage count deterministically', () => {
    const config = parseArguments(argumentsFor('many-stages', 8));
    const first = renderExplorerDraft(config);
    const second = renderExplorerDraft(config);

    assert.deepEqual(first, second);
    assert.equal((first.stages.match(/slug: 'stage-/g) ?? []).length, 8);
    assert.match(first.stages, /slug: 'stage-8'/);
  });

  for (const format of ['text', 'binary', 'tabular', 'route'] as const) {
    it(`represents ${format} payloads without JSON-only draft assumptions`, () => {
      const config = parseArguments(
        argumentsFor(`${format}-payload`, 1, ['--payload-format', format])
      );
      const files = renderExplorerDraft(config);

      assert.match(files.stages, new RegExp(`inputFormat: '${format}'`));
      assert.match(files.stages, new RegExp(`outputFormat: '${format}'`));
      assert.doesNotMatch(files.stages, /\{"replace"/);
      assert.doesNotMatch(files.stages, /JSON/);
      assert.match(
        files.pipeline,
        new RegExp(`Draft payload format: ${format}`)
      );
      assert.match(files.explorer, new RegExp(`${format} payload draft`));
    });
  }

  it('generates an architecture-only draft by default', () => {
    const files = renderExplorerDraft(
      parseArguments(argumentsFor('architecture-draft', 1))
    );

    assert.match(files.overview, /executionStatus: architecture-only/);
    assert.match(files.overview, /executionStatus="architecture-only"/);
    assert.match(
      files.overview,
      /architecture-only and has no runtime evidence/
    );
  });

  it('generates an explicit canonical Explorer identity and full-pipeline binding', () => {
    const files = renderExplorerDraft(
      parseArguments(argumentsFor('canonical-binding', 1))
    );

    assert.match(files.explorer, /exampleId="canonical-binding"/);
    assert.match(
      files.explorer,
      /!!raw-loader!@site\/examples\/generated-tests\/canonical-binding\/pipeline\.yaml/
    );
    assert.match(files.explorer, /fullYaml=\{fullYaml\}/);
    assert.match(files.explorer, /fullYamlFilename="pipeline\.yaml"/);
  });

  it('generates a named requires-integration draft', () => {
    const files = renderExplorerDraft(
      parseArguments(
        argumentsFor('integration-draft', 1, [
          '--execution-status',
          'requires-integration',
          '--integration',
          'Example object store',
        ])
      )
    );

    assert.match(files.overview, /executionStatus: requires-integration/);
    assert.match(files.overview, /executionStatus="requires-integration"/);
    assert.match(files.overview, /requires Example object store/);
    assert.match(files.reference, /result for Example object store/);
  });

  it('rejects requires-integration without a named integration', () => {
    assert.throws(
      () =>
        parseArguments(
          argumentsFor('missing-integration', 1, [
            '--execution-status',
            'requires-integration',
          ])
        ),
      /--integration is required for requires-integration/
    );
  });

  it('rejects unsupported execution statuses and payload formats', () => {
    assert.throws(
      () =>
        parseArguments(
          argumentsFor('offline-draft', 1, [
            '--execution-status',
            'offline-runnable',
          ])
        ),
      /--execution-status must be requires-integration or architecture-only/
    );
    assert.throws(
      () =>
        parseArguments(
          argumentsFor('xml-draft', 1, ['--payload-format', 'xml'])
        ),
      /--payload-format must be json, text, binary, tabular, or route/
    );
  });
});
