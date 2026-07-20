import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';

import { buildReleaseEvidence } from '../../scripts/quality/build-release-evidence';

const SHA = 'a'.repeat(40);

function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), 'release-evidence-'));
  const files: Record<string, unknown> = {
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
      assert.equal((result.artifacts as unknown[]).length, 6);
      assert.deepEqual(
        (result.diagnostics as Array<{ status: string }>).map(
          (entry) => entry.status
        ),
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
      assert.equal(
        (result.diagnostics as Array<{ status: string }>)[0]?.status,
        'FAIL'
      );
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
