import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import { verifyCurrentEstateAttestation } from '../../scripts/quality/verify-current-estate-attestation';

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalize(entry)])
    );
  }
  return value;
}

const { privateKey, publicKey } = generateKeyPairSync('ed25519');
const publicKeyPem = Buffer.from(
  publicKey.export({ type: 'spki', format: 'pem' })
);
const publicKeySha256 = createHash('sha256').update(publicKeyPem).digest('hex');
const now = new Date('2026-07-19T08:00:00.000Z');
const expected = {
  stage: 'POST_DEPLOY_FINALIZATION' as const,
  repository: 'expanso/examples',
  subjectSha: 'a'.repeat(40),
  foundationRunId: '12345',
  foundationRunAttempt: 2,
  releaseRunId: '67890',
  releaseRunAttempt: 1,
  artifactContentSha256: 'b'.repeat(64),
  artifactArchiveSha256: '1'.repeat(64),
  gateManifestSha256: 'c'.repeat(64),
  reducerPolicySha256: 'd'.repeat(64),
  evidenceSha256: 'e'.repeat(64),
  stageEvidenceSha256: 'f'.repeat(64),
  producerAgentId: 'github-actions/expanso/examples/explorer-tests',
  verifierAgentId: '/release/final-verifier',
  keyId: 'current-estate-release-v1',
  publicKeyPem,
  publicKeySha256,
  now,
};

function envelope(overrides: Record<string, unknown> = {}) {
  const payload = {
    attestationVersion: 'current-estate-release-attestation-v1',
    stage: expected.stage,
    authorizedAction: 'FINALIZE_CURRENT_ESTATE_RELEASE',
    target: 'CURRENT_ESTATE_RELEASE',
    repository: expected.repository,
    subjectSha: expected.subjectSha,
    foundationRunId: expected.foundationRunId,
    foundationRunAttempt: expected.foundationRunAttempt,
    releaseRunId: expected.releaseRunId,
    releaseRunAttempt: expected.releaseRunAttempt,
    artifactContentSha256: expected.artifactContentSha256,
    artifactArchiveSha256: expected.artifactArchiveSha256,
    gateManifestSha256: expected.gateManifestSha256,
    reducerPolicySha256: expected.reducerPolicySha256,
    evidenceSha256: expected.evidenceSha256,
    stageEvidenceSha256: expected.stageEvidenceSha256,
    producerAgentId: expected.producerAgentId,
    verdict: 'PASS',
    verifierAgentId: expected.verifierAgentId,
    keyId: expected.keyId,
    publicKeySha256,
    issuedAt: '2026-07-19T07:55:00.000Z',
    validUntil: '2026-07-19T08:05:00.000Z',
    ...overrides,
  };
  return {
    payload,
    signatureAlgorithm: 'ed25519',
    signature: sign(
      null,
      Buffer.from(JSON.stringify(canonicalize(payload)), 'utf8'),
      privateKey
    ).toString('base64'),
  };
}

describe('current-estate release attestation verifier', () => {
  it('accepts a fresh exact-subject independent signature', () => {
    const payload = verifyCurrentEstateAttestation(envelope(), expected);
    assert.equal(payload.verdict, 'PASS');
  });

  it('rejects subject swaps, expired evidence, and non-PASS verdicts', () => {
    for (const [label, candidate] of [
      ['subject', envelope({ subjectSha: 'f'.repeat(40) })],
      [
        'expired',
        envelope({
          issuedAt: '2026-07-19T07:20:00.000Z',
          validUntil: '2026-07-19T07:50:00.000Z',
        }),
      ],
      ['verdict', envelope({ verdict: 'UNKNOWN' })],
    ] as const) {
      assert.throws(
        () => verifyCurrentEstateAttestation(candidate, expected),
        undefined,
        label
      );
    }
  });

  it('rejects payload mutation and an unpinned key', () => {
    const mutated = envelope();
    mutated.payload.issuedAt = '2026-07-19T07:56:00.000Z';
    assert.throws(
      () => verifyCurrentEstateAttestation(mutated, expected),
      /signature is invalid/
    );
    assert.throws(
      () =>
        verifyCurrentEstateAttestation(envelope(), {
          ...expected,
          publicKeySha256: '0'.repeat(64),
        }),
      /publicKeySha256|public key digest/
    );
  });

  it('rejects evidence swaps, self-verification, and a missing signature', () => {
    assert.throws(
      () =>
        verifyCurrentEstateAttestation(
          envelope({ evidenceSha256: '0'.repeat(64) }),
          expected
        ),
      /evidenceSha256/
    );
    assert.throws(
      () =>
        verifyCurrentEstateAttestation(envelope(), {
          ...expected,
          producerAgentId: expected.verifierAgentId,
        }),
      /producerAgentId|self-verified/
    );
    const missing = envelope() as Record<string, unknown>;
    delete missing.signature;
    assert.throws(
      () => verifyCurrentEstateAttestation(missing, expected),
      /attestation must contain exactly/
    );
  });

  it('rejects release-attempt replay and canary evidence swaps', () => {
    assert.throws(
      () =>
        verifyCurrentEstateAttestation(envelope(), {
          ...expected,
          releaseRunId: '67891',
        }),
      /releaseRunId/
    );
    assert.throws(
      () =>
        verifyCurrentEstateAttestation(envelope(), {
          ...expected,
          stageEvidenceSha256: '0'.repeat(64),
        }),
      /stageEvidenceSha256/
    );
  });
});

describe('current-estate release workflow structure', () => {
  const deployWorkflow = readFileSync('.github/workflows/deploy.yml', 'utf8');
  const foundationWorkflow = readFileSync(
    '.github/workflows/phase1-foundation.yml',
    'utf8'
  );
  const evidenceBuilder = readFileSync(
    'scripts/quality/build-release-evidence.ts',
    'utf8'
  );

  it('deploys only an exact successful main-branch foundation artifact', () => {
    assert.match(
      deployWorkflow,
      /workflows: \['Phase 1 Foundation'\][\s\S]*?workflow_run\.conclusion == 'success'[\s\S]*?workflow_run\.head_branch == 'main'/
    );
    assert.match(
      deployWorkflow,
      /name: Download exact-SHA production artifact[\s\S]*?production-build-\$\{\{ steps\.subject\.outputs\.sha \}\}[\s\S]*?run-id: \$\{\{ steps\.subject\.outputs\.run_id \}\}/
    );
  });

  it('requires an all-gates PASS manifest and exact artifact digest', () => {
    assert.match(
      deployWorkflow,
      /release-evidence\.json[\s\S]*?evidence\.status !== 'PASS'/
    );
    assert.match(
      deployWorkflow,
      /subject\.artifactContentSha256 !== contentSha256/
    );
    assert.doesNotMatch(
      deployWorkflow,
      /CURRENT_ESTATE_|QUALITY_VERIFIER_|vars\./
    );
  });

  it('binds repository-owned scoped release gate and reducer policy documents', () => {
    assert.match(
      evidenceBuilder,
      /tests\/contracts\/site-refresh-release-gate-manifest-v1\.json/
    );
    assert.match(
      evidenceBuilder,
      /tests\/contracts\/site-refresh-release-reducer-policy-v1\.json/
    );
  });

  it('retains exact-SHA rollback artifacts and verifies production bytes', () => {
    assert.match(
      foundationWorkflow,
      /name: Upload exact-SHA production artifact[\s\S]*?retention-days: 90/
    );
    assert.match(
      foundationWorkflow,
      /name: Upload exact-SHA rollback archive[\s\S]*?retention-days: 90/
    );
    assert.doesNotMatch(
      foundationWorkflow,
      /PRIVATE_MARKERS=\$\(grep[\s\S]*?build \|\| true\)/
    );
    assert.match(foundationWorkflow, /if \[ "\$GREP_STATUS" -gt 1 \]/);
    assert.match(deployWorkflow, /production-canary-v1/);
    assert.match(
      deployWorkflow,
      /production bytes do not match admitted artifact/
    );
    assert.match(deployWorkflow, /name: Upload production canary evidence/);
    assert.match(
      foundationWorkflow,
      /release-canary-manifest-v1[\s\S]*?canaryManifestSha256/
    );
  });
});
