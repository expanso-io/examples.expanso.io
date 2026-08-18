import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(
  fileURLToPath(new URL('../..', import.meta.url))
);
const tsxCli = join(repositoryRoot, 'node_modules/tsx/dist/cli.mjs');
const manifestPath = 'content/explorer-stage-bindings-v1.json';
const generatedPath = 'src/catalog/explorerStageConfigs.generated.ts';
let fixtureRoot = '';

type Manifest = {
  explorers: Array<{
    exampleId: string;
    sourceKind: string;
    stageModule: string;
    stageExport: string;
    pipelineSha256: string;
    stages: Array<{
      slug: string;
      configPath: string;
      configSha256: string;
    }>;
  }>;
};

function digest(bytes: string): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function runGenerator(...args: string[]) {
  return spawnSync(
    process.execPath,
    [tsxCli, 'scripts/generate-explorer-stage-configs.ts', ...args],
    {
      cwd: fixtureRoot,
      encoding: 'utf8',
      env: { ...process.env, NO_COLOR: '1' },
    }
  );
}

function expectFailure(pattern: RegExp, ...args: string[]): void {
  const result = runGenerator(...args);
  assert.notEqual(result.status, 0, result.stdout);
  assert.match(`${result.stdout}\n${result.stderr}`, pattern);
}

function readManifest(): Manifest {
  return JSON.parse(
    readFileSync(join(fixtureRoot, manifestPath), 'utf8')
  ) as Manifest;
}

function writeManifest(manifest: Manifest): void {
  writeFileSync(
    join(fixtureRoot, manifestPath),
    `${JSON.stringify(manifest, null, 2)}\n`
  );
}

function withRestoredFile(path: string, action: () => void): void {
  const absolutePath = join(fixtureRoot, path);
  const original = readFileSync(absolutePath);
  try {
    action();
  } finally {
    writeFileSync(absolutePath, original);
  }
}

function withInvalidManifest(
  pattern: RegExp,
  mutate: (manifest: Manifest) => void
): void {
  withRestoredFile(manifestPath, () => {
    const manifest = readManifest();
    mutate(manifest);
    writeManifest(manifest);
    expectFailure(pattern);
  });
}

before(() => {
  fixtureRoot = mkdtempSync(join(tmpdir(), 'explorer-stage-contract-'));
  cpSync(repositoryRoot, fixtureRoot, {
    recursive: true,
    filter: (source) => {
      const relative = source.slice(repositoryRoot.length).replace(/^\//, '');
      return ![
        '.git',
        'node_modules',
        '.docusaurus',
        'build',
        'test-results',
      ].some(
        (excluded) =>
          relative === excluded || relative.startsWith(`${excluded}/`)
      );
    },
  });
  symlinkSync(
    join(repositoryRoot, 'node_modules'),
    join(fixtureRoot, 'node_modules')
  );
});

after(() => {
  if (
    fixtureRoot &&
    fixtureRoot.startsWith(`${tmpdir()}/explorer-stage-contract-`)
  ) {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

describe('canonical Explorer stage generator', () => {
  it('passes the canonical 21-family / 100-stage snapshot', () => {
    const result = runGenerator();
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /21 explorers \/ 100 stages/);
    assert.match(result.stdout, /0 unbound/);
  });

  it('rejects stale stage and pipeline digests', () => {
    withInvalidManifest(/digest is stale/, (manifest) => {
      manifest.explorers[0].stages[0].configSha256 = `sha256:${'0'.repeat(64)}`;
    });
    withInvalidManifest(/pipeline binding is stale/, (manifest) => {
      manifest.explorers[0].pipelineSha256 = `sha256:${'0'.repeat(64)}`;
    });
  });

  it('rejects stale generated provenance when either verifier lane changes', () => {
    for (const path of [
      'scripts/generate-explorer-stage-configs.ts',
      'scripts/quality/verify-explorer-provenance.ts',
    ]) {
      withRestoredFile(path, () => {
        const absolutePath = join(fixtureRoot, path);
        writeFileSync(
          absolutePath,
          `${readFileSync(absolutePath, 'utf8')}\n// negative fixture\n`
        );
        expectFailure(/generated\.ts is stale/);
      });
    }
  });

  it('rejects missing stages and duplicate paths or slugs', () => {
    withInvalidManifest(/stage count does not match/, (manifest) => {
      manifest.explorers[0].stages.pop();
    });
    withInvalidManifest(/Duplicate stage config path/, (manifest) => {
      manifest.explorers[0].stages[1].configPath =
        manifest.explorers[0].stages[0].configPath;
    });
    withInvalidManifest(/duplicate stage slugs/, (manifest) => {
      manifest.explorers[0].stages[1].slug =
        manifest.explorers[0].stages[0].slug;
    });
  });

  it('rejects malformed, empty, missing, symlinked, and orphan YAML', () => {
    const manifest = readManifest();
    const configPath = manifest.explorers[0].stages[0].configPath;
    withRestoredFile(configPath, () => {
      writeFileSync(join(fixtureRoot, configPath), 'pipeline: [\n');
      expectFailure(/not warning-free YAML/);
    });
    withRestoredFile(configPath, () => {
      writeFileSync(join(fixtureRoot, configPath), '# comment only\n');
      expectFailure(/empty YAML/);
    });
    withRestoredFile(configPath, () => {
      unlinkSync(join(fixtureRoot, configPath));
      expectFailure(/does not exist/);
    });
    withRestoredFile(configPath, () => {
      const absolutePath = join(fixtureRoot, configPath);
      unlinkSync(absolutePath);
      symlinkSync(join(fixtureRoot, 'package.json'), absolutePath);
      expectFailure(/not a regular file/);
      unlinkSync(absolutePath);
    });

    const orphanPath = join(
      fixtureRoot,
      'examples/explorer-stages/circuit-breakers/orphan.yaml'
    );
    assert.equal(existsSync(orphanPath), false);
    try {
      writeFileSync(orphanPath, 'pipeline: {}\n');
      expectFailure(/inventory drift: 1 unbound/);
    } finally {
      rmSync(orphanPath, { force: true });
    }
  });

  it('rejects wrong source kind, module, export, and Explorer ordering', () => {
    withInvalidManifest(/invalid source kind/, (manifest) => {
      manifest.explorers[0].sourceKind = 'remove-pii-canonical-generator';
    });
    withInvalidManifest(/stage module binding is stale/, (manifest) => {
      manifest.explorers[0].stageModule = 'docs/wrong.ts';
    });
    withInvalidManifest(/stage module binding is stale/, (manifest) => {
      manifest.explorers[0].stageExport = 'wrongExport';
    });
    withInvalidManifest(/Manifest Explorer 1 must be/, (manifest) => {
      [manifest.explorers[0], manifest.explorers[1]] = [
        manifest.explorers[1],
        manifest.explorers[0],
      ];
    });
  });

  it('rejects generated-map drift', () => {
    withRestoredFile(generatedPath, () => {
      writeFileSync(
        join(fixtureRoot, generatedPath),
        `${readFileSync(join(fixtureRoot, generatedPath), 'utf8')}\n// drift\n`
      );
      expectFailure(/generated\.ts is stale/);
    });
  });

  it('fails before write-mode output changes and writes deterministically', () => {
    const manifest = readManifest();
    const configPath = manifest.explorers[0].stages[0].configPath;
    const generatedBefore = readFileSync(
      join(fixtureRoot, generatedPath),
      'utf8'
    );
    withRestoredFile(configPath, () => {
      writeFileSync(join(fixtureRoot, configPath), 'pipeline: [\n');
      expectFailure(/not warning-free YAML/, '--write');
      assert.equal(
        readFileSync(join(fixtureRoot, generatedPath), 'utf8'),
        generatedBefore
      );
    });

    const first = runGenerator('--write');
    assert.equal(first.status, 0, first.stderr);
    const firstBytes = readFileSync(join(fixtureRoot, generatedPath), 'utf8');
    const second = runGenerator('--write');
    assert.equal(second.status, 0, second.stderr);
    const secondBytes = readFileSync(join(fixtureRoot, generatedPath), 'utf8');
    assert.equal(digest(firstBytes), digest(secondBytes));
    assert.equal(firstBytes, secondBytes);
  });

  it('rejects a config path that escapes its canonical family', () => {
    withInvalidManifest(/canonical path is stale/, (manifest) => {
      const stage = manifest.explorers[0].stages[0];
      stage.configPath = `examples/explorer-stages/${basename(fixtureRoot)}/../escape.yaml`;
    });
  });
});
