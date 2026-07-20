import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildExplorerEvidenceSet,
  verifyExplorerEvidenceSet,
} from '../../scripts/quality/explorer-evidence-set';

const expected = {
  repository: 'expanso/examples',
  subjectSha: 'a'.repeat(40),
  foundationRunId: '12345',
  foundationRunAttempt: 2,
  producerAgentId: 'github-actions/expanso/examples/explorer-tests',
  verifierAgentId: '/release/final-verifier',
  now: new Date('2026-07-19T08:05:00.000Z'),
};

function evidenceSet() {
  return buildExplorerEvidenceSet({
    ...expected,
    command: 'npm run validate-catalog',
    exitStatus: 0,
    startedAt: '2026-07-19T08:00:00.000Z',
    completedAt: '2026-07-19T08:01:00.000Z',
  });
}

describe('Explorer projection for external signed provenance', () => {
  it('binds every Explorer verification ID to exact canonical evidence', () => {
    const result = verifyExplorerEvidenceSet(evidenceSet(), expected);
    assert.equal(result.verdict, 'PASS');
    assert.equal(result.records.length, 21);
    assert.equal(
      new Set(result.records.map(({ verificationId }) => verificationId)).size,
      21
    );
  });

  it('rejects self-verification and subject swaps', () => {
    assert.throws(
      () =>
        buildExplorerEvidenceSet({
          ...expected,
          verifierAgentId: expected.producerAgentId,
          command: 'npm run validate-catalog',
          exitStatus: 0,
          startedAt: '2026-07-19T08:00:00.000Z',
          completedAt: '2026-07-19T08:01:00.000Z',
        }),
      /self-verified/
    );
    assert.throws(
      () =>
        verifyExplorerEvidenceSet(evidenceSet(), {
          ...expected,
          subjectSha: 'b'.repeat(40),
        }),
      /subjectSha mismatch/
    );
  });

  it('rejects stale evidence and payload mutation', () => {
    assert.throws(
      () =>
        verifyExplorerEvidenceSet(evidenceSet(), {
          ...expected,
          now: new Date('2026-07-19T15:00:00.000Z'),
        }),
      /stale/
    );
    const mutated = evidenceSet();
    mutated.records[0]!.evidenceSha256 = '0'.repeat(64);
    assert.throws(
      () => verifyExplorerEvidenceSet(mutated, expected),
      /digest mismatch/
    );
  });
});
