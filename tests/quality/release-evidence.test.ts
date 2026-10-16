import assert from 'node:assert/strict';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { parse } from 'yaml';

import { buildReleaseEvidence } from '../../scripts/quality/build-release-evidence';

const SHA = 'a'.repeat(40);

function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), 'release-evidence-'));

  const files = {
    'content/content-estate.json': { status: 'PASS' },
    'health/health-v2.json': {
      schemaVersion: '2.0.0',
      subject: { sha: SHA },
      dimensions: [{ id: 'catalog', status: 'UNKNOWN' }],
    },
    'explorer/evidence-set-v1.json': { verdict: 'PASS', subjectSha: SHA },
    'browser-smoke/browser-smoke-readiness-v1.json': {
      status: 'PASS',
      subjectSha: SHA,
    },
    'machine-journey/machine-journey-producer-manifest.json': {
      status: 'BLOCKED_CAPABILITY',
      subjectSha: SHA,
    },
    'visual/visual-regression-result-v1.json': {
      status: 'PASS',
      subjectSha: SHA,
    },
    'accessibility/accessibility-reduction.json': {
      status: 'PASS',
      resultStatus: 'PASS',
      coverageStatus: 'UNKNOWN',
      subjectSha: SHA,
      summary: { missingLocalCells: 0, missingStateCells: 0 },
    },
    'performance/performance-result-v1.json': {
      status: 'PASS',
      candidateSha: SHA,
    },
  };

  for (const [path, value] of Object.entries(files)) {
    const absolute = join(root, path);
    mkdirSync(dirname(absolute), { recursive: true });
    writeFileSync(absolute, `${JSON.stringify(value)}\n`);
  }

  return root;
}

describe('release evidence manifest', () => {
  it('collects browser evidence from required jobs in the same foundation run', () => {
    const workflow = parse(
      readFileSync('.github/workflows/phase1-foundation.yml', 'utf8')
    );

    const production = workflow.jobs['production-build'];

    for (const [producerId, artifactName, destination] of [
      ['visual-regression', 'visual-regression-result', 'evidence/visual'],
      [
        'browser-accessibility',
        'browser-accessibility-evidence',
        'evidence/accessibility',
      ],
    ]) {
      assert.ok(production.needs.includes(producerId), producerId);
      const producer = workflow.jobs[producerId];
      assert.ok(producer, `${producerId} must run in the foundation workflow`);
      assert.equal(producer.if, undefined);
      assert.equal(producer['continue-on-error'], undefined);
      const name = artifactName + '-${{ github.sha }}';

      const upload = producer.steps.find(
        (step) =>
          step.uses === 'actions/upload-artifact@v4' && step.with.name === name
      );

      assert.ok(upload, `${producerId} must upload exact-SHA evidence`);

      const download = production.steps.find(
        (step) =>
          step.uses === 'actions/download-artifact@v4' &&
          step.with.name === name
      );

      assert.ok(download, `${producerId} evidence must reach production-build`);
      assert.equal(download.with.path, destination);
      assert.equal(download.with['run-id'], undefined);
      assert.equal(download.with.repository, undefined);
      assert.equal(download.if, undefined);
      assert.equal(download['continue-on-error'], undefined);
    }

    assert.deepEqual(workflow.jobs['browser-accessibility'].needs, [
      'browser-accessibility-shard',
    ]);
    assert.deepEqual(
      workflow.jobs['browser-accessibility-shard'].strategy.matrix.shard,
      [1, 2, 3, 4]
    );
  });

  for (const path of [
    'visual/visual-regression-result-v1.json',
    'accessibility/accessibility-reduction.json',
  ]) {
    it(`rejects a stale subject in ${path}`, () => {
      const root = fixture();

      try {
        const absolute = join(root, path);
        const evidence = JSON.parse(readFileSync(absolute, 'utf8'));

        evidence.subjectSha = 'b'.repeat(40);
        writeFileSync(absolute, JSON.stringify(evidence));
        assert.throws(
          () =>
            buildReleaseEvidence({
              repository: 'expanso-io/examples.expanso.io',
              subjectSha: SHA,
              foundationRunId: '123',
              foundationRunAttempt: 1,
              evidenceRoot: root,
              outputPath: join(root, 'release-evidence.json'),
            }),
          /does not match the release subject/
        );
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    });

    it(`fails closed when ${path} is absent`, () => {
      const root = fixture();

      try {
        rmSync(join(root, path));
        assert.throws(
          () =>
            buildReleaseEvidence({
              repository: 'expanso-io/examples.expanso.io',
              subjectSha: SHA,
              foundationRunId: '123',
              foundationRunAttempt: 1,
              evidenceRoot: root,
              outputPath: join(root, 'release-evidence.json'),
            }),
          /ENOENT/
        );
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    });
  }

  it('binds every required evidence file to the exact release subject', () => {
    const root = fixture();

    try {
      const result = buildReleaseEvidence({
        repository: 'expanso-io/examples.expanso.io',
        subjectSha: SHA,
        foundationRunId: '123',
        foundationRunAttempt: 1,
        evidenceRoot: root,
        outputPath: join(root, 'release-evidence.json'),
        generatedAt: '2026-07-19T12:00:00.000Z',
      });

      assert.equal(result.status, 'PASS');
      assert.ok(Array.isArray(result.artifacts));
      assert.equal(result.artifacts.length, 6);
      assert.ok(Array.isArray(result.diagnostics));
      assert.deepEqual(
        result.diagnostics.map((entry) => entry.status),
        ['UNKNOWN', 'BLOCKED_CAPABILITY']
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('retains diagnostic states without promoting them to release PASS', () => {
    const root = fixture();

    try {
      writeFileSync(
        join(root, 'health/health-v2.json'),
        `${JSON.stringify({
          schemaVersion: '2.0.0',
          subject: { sha: SHA },
          dimensions: [{ id: 'catalog', status: 'FAIL' }],
        })}\n`
      );

      const result = buildReleaseEvidence({
        repository: 'expanso-io/examples.expanso.io',
        subjectSha: SHA,
        foundationRunId: '123',
        foundationRunAttempt: 1,
        evidenceRoot: root,
        outputPath: join(root, 'release-evidence.json'),
      });

      assert.equal(result.status, 'PASS');
      assert.ok(Array.isArray(result.diagnostics));
      assert.equal(result.diagnostics[0]?.status, 'FAIL');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails closed on a non-PASS gate or subject swap', () => {
    const root = fixture();

    try {
      writeFileSync(
        join(root, 'visual/visual-regression-result-v1.json'),
        `${JSON.stringify({ status: 'FAIL', subjectSha: SHA })}\n`
      );
      assert.throws(
        () =>
          buildReleaseEvidence({
            repository: 'expanso-io/examples.expanso.io',
            subjectSha: SHA,
            foundationRunId: '123',
            foundationRunAttempt: 1,
            evidenceRoot: root,
            outputPath: join(root, 'release-evidence.json'),
          }),
        /literal PASS/
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
