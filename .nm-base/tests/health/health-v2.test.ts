import assert from 'node:assert/strict';
import {
  createHash,
  generateKeyPairSync,
  sign,
  type KeyObject,
} from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';

import { PUBLIC_CATALOG } from '../../src/catalog/registry';
import { CATALOG_SCHEMA_VERSION } from '../../src/catalog/schema';
import {
  HEALTH_DIMENSIONS,
  MACHINE_ARTIFACT_VERSION,
  MACHINE_ATTESTATION_VERSION,
  MACHINE_EVIDENCE_VERSION,
  MACHINE_RERUN_VERSION,
  MACHINE_RESULT_VERSION,
  REPOSITORY_ID,
  generateHealthV2,
  machineResultIdentitySha256,
  type GenerateHealthOptions,
  type HealthDimension,
  type HealthStatus,
  type MachineHealthResult,
  type MachineVerifierTrust,
} from '../../scripts/generate-health-v2';

const SUBJECT_SHA = 'a'.repeat(40);
const GENERATED_AT = '2026-07-18T12:00:00.000Z';
const EXAMPLE_IDS = [...PUBLIC_CATALOG.records]
  .map((record) => record.id)
  .sort();
const EVIDENCE_ROOT = mkdtempSync(join(tmpdir(), 'health-v2-evidence-'));
const RESULT_SCHEMA_PATH = 'machine-result.schema.json';
const RESULT_SCHEMA_BYTES = Buffer.from(
  `${JSON.stringify({
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: 'https://examples.expanso.io/schemas/machine-result-test-v1.json',
    type: 'object',
  })}\n`,
  'utf8'
);
writeFileSync(join(EVIDENCE_ROOT, RESULT_SCHEMA_PATH), RESULT_SCHEMA_BYTES);

interface SignerFixture {
  verifierId: string;
  keyId: string;
  publicKeyPath: string;
  publicKeySha256: string;
  privateKey: KeyObject;
}

function sha256(value: Buffer | string): string {
  return createHash('sha256').update(value).digest('hex');
}

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

function signerFixture(id: string): SignerFixture {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const publicKeyBytes = Buffer.from(
    publicKey.export({ format: 'pem', type: 'spki' })
  );
  const publicKeyPath = `${id}.pub.pem`;
  writeFileSync(join(EVIDENCE_ROOT, publicKeyPath), publicKeyBytes);
  return {
    verifierId: `${id}-verifier`,
    keyId: `${id}-key-v1`,
    publicKeyPath,
    publicKeySha256: sha256(publicKeyBytes),
    privateKey,
  };
}

const TRUSTED_SIGNER = signerFixture('trusted');
const ATTACKER_SIGNER = signerFixture('attacker');
const TRUSTED_VERIFIER: MachineVerifierTrust = {
  verifierId: TRUSTED_SIGNER.verifierId,
  keyId: TRUSTED_SIGNER.keyId,
  publicKeyPath: TRUSTED_SIGNER.publicKeyPath,
  publicKeySha256: TRUSTED_SIGNER.publicKeySha256,
};
const TRUSTED_GENERATE_OPTIONS: Pick<
  GenerateHealthOptions,
  'evidenceRoot' | 'trustedVerifier'
> = {
  evidenceRoot: EVIDENCE_ROOT,
  trustedVerifier: TRUSTED_VERIFIER,
};
const RESULT_SCHEMA = {
  path: RESULT_SCHEMA_PATH,
  sha256: sha256(RESULT_SCHEMA_BYTES),
};
const PRODUCER_EXECUTION = {
  environment: {
    id: 'github-actions-ubuntu-2404',
    runner: 'ubuntu-24.04',
    os: 'linux',
    architecture: 'x64',
  },
  command: 'npm run machine-producer -- --exact-fixture',
  toolVersions: {
    node: '20.19.4',
    producer: 'health-fixture@1.0.0',
  },
};
const VERIFIER_EXECUTION = {
  environment: {
    id: 'github-actions-ubuntu-2404-independent',
    runner: 'ubuntu-24.04',
    os: 'linux',
    architecture: 'x64',
  },
  command: 'npm run machine-verifier -- --rerun-exact-fixture',
  toolVersions: {
    node: '20.19.4',
    verifier: 'health-verifier@1.0.0',
  },
};
let artifactSequence = 0;

after(() => rmSync(EVIDENCE_ROOT, { recursive: true, force: true }));

function writeJsonArtifact(prefix: string, value: unknown) {
  artifactSequence += 1;
  const path = `${String(artifactSequence).padStart(4, '0')}-${prefix}.json`;
  const bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`, 'utf8');
  writeFileSync(join(EVIDENCE_ROOT, path), bytes);
  return { path, sha256: sha256(bytes) };
}

interface EvidenceFixtureOptions {
  signer?: SignerFixture;
  signatureKey?: KeyObject;
  producerId?: string;
}

function machineResult(
  dimension: MachineHealthResult['dimension'],
  statuses: Array<{ exampleId: string; status: HealthStatus }>,
  overrides: Partial<MachineHealthResult> = {},
  evidenceOptions: EvidenceFixtureOptions = {}
): MachineHealthResult {
  const result: MachineHealthResult = {
    resultVersion: MACHINE_RESULT_VERSION,
    resultId: `${dimension}-test-v1`,
    dimension,
    subject: {
      repository: REPOSITORY_ID,
      sha: SUBJECT_SHA,
      catalogSchemaVersion: CATALOG_SCHEMA_VERSION,
    },
    scope: {
      type: 'catalog-example-ids',
      exampleIds: statuses.map((entry) => entry.exampleId),
    },
    results: statuses.map((entry) => ({
      ...entry,
      evidence: [],
      reasons:
        entry.status === 'PASS'
          ? []
          : [`fixture reason for ${entry.exampleId}`],
    })),
    ...overrides,
  };
  const resultIdentitySha256 = machineResultIdentitySha256(result);
  result.results = result.results.map((entry) => {
    if (entry.status !== 'PASS') return entry;

    const fixtureSigner = evidenceOptions.signer ?? TRUSTED_SIGNER;
    const assertionId = `verified-${entry.exampleId}`;
    const producer = {
      id: evidenceOptions.producerId ?? `${dimension}-producer`,
      ...PRODUCER_EXECUTION,
    };
    const producerArtifact = writeJsonArtifact(`${assertionId}-producer`, {
      artifactVersion: MACHINE_ARTIFACT_VERSION,
      subjectSha: result.subject.sha,
      resultId: result.resultId,
      resultIdentitySha256,
      assertionId,
      dimension,
      exampleId: entry.exampleId,
      status: 'PASS',
      producer,
      resultSchema: RESULT_SCHEMA,
    });
    const rerun = writeJsonArtifact(`${assertionId}-rerun`, {
      rerunVersion: MACHINE_RERUN_VERSION,
      subjectSha: result.subject.sha,
      resultId: result.resultId,
      resultIdentitySha256,
      assertionId,
      dimension,
      exampleId: entry.exampleId,
      verifier: {
        id: fixtureSigner.verifierId,
        keyId: fixtureSigner.keyId,
        ...VERIFIER_EXECUTION,
      },
      evidenceArtifact: producerArtifact,
      resultSchema: RESULT_SCHEMA,
      startedAt: '2026-07-18T11:58:00.000Z',
      endedAt: '2026-07-18T11:59:00.000Z',
      exitCode: 0,
      verdict: 'PASS',
      checks: ['independent deterministic rerun matched expected output'],
    });
    const signedAssertion = {
      evidenceVersion: MACHINE_EVIDENCE_VERSION,
      subjectSha: result.subject.sha,
      resultId: result.resultId,
      resultIdentitySha256,
      assertionId,
      dimension,
      exampleId: entry.exampleId,
      status: 'PASS',
      artifact: producerArtifact,
      resultSchema: RESULT_SCHEMA,
      producer,
      verifier: {
        id: fixtureSigner.verifierId,
        keyId: fixtureSigner.keyId,
        publicKeySha256: fixtureSigner.publicKeySha256,
        ...VERIFIER_EXECUTION,
        rerunArtifact: rerun,
      },
      rerunExitCode: 0,
      rerunVerdict: 'PASS',
    };
    const payload = {
      attestationVersion: MACHINE_ATTESTATION_VERSION,
      verifierId: fixtureSigner.verifierId,
      keyId: fixtureSigner.keyId,
      publicKeySha256: fixtureSigner.publicKeySha256,
      signedAt: '2026-07-18T12:00:00.000Z',
      assertion: signedAssertion,
    };
    const signature = sign(
      null,
      Buffer.from(JSON.stringify(canonicalize(payload)), 'utf8'),
      evidenceOptions.signatureKey ?? fixtureSigner.privateKey
    ).toString('base64');
    const attestation = writeJsonArtifact(`${assertionId}-attestation`, {
      payload,
      signatureAlgorithm: 'ed25519',
      signature,
    });
    return {
      ...entry,
      evidence: [
        {
          evidenceVersion: MACHINE_EVIDENCE_VERSION,
          kind: 'signed-machine-verification',
          subjectSha: result.subject.sha,
          resultId: result.resultId,
          resultIdentitySha256,
          assertionId,
          artifact: producerArtifact,
          resultSchema: RESULT_SCHEMA,
          producer,
          verifier: {
            id: fixtureSigner.verifierId,
            keyId: fixtureSigner.keyId,
            publicKeySha256: fixtureSigner.publicKeySha256,
            ...VERIFIER_EXECUTION,
            attestation,
            rerunArtifact: rerun,
          },
        },
      ],
    };
  });
  return result;
}

function dimension(
  report: ReturnType<typeof generateHealthV2>,
  id: HealthDimension
) {
  const value = report.dimensions.find((entry) => entry.id === id);
  assert.ok(value, `missing dimension ${id}`);
  return value;
}

describe('Health V2', () => {
  it('reports all nine dimensions separately and leaves untested dimensions UNKNOWN', () => {
    const report = generateHealthV2({
      subjectSha: SUBJECT_SHA,
      generatedAt: GENERATED_AT,
    });

    assert.deepEqual(
      report.dimensions.map((entry) => entry.id),
      HEALTH_DIMENSIONS
    );
    assert.equal('status' in report, false, 'must not emit a site-wide status');
    assert.equal(dimension(report, 'catalog').status, 'UNKNOWN');
    assert.equal(dimension(report, 'maintenance').status, 'UNKNOWN');

    for (const id of HEALTH_DIMENSIONS.filter(
      (entry) => entry !== 'catalog' && entry !== 'maintenance'
    )) {
      const result = dimension(report, id);
      assert.equal(result.status, 'UNKNOWN');
      assert.deepEqual(result.summary, {
        total: 26,
        tested: 0,
        testedPercent: 0,
        pass: 0,
        fail: 0,
        unknown: 26,
        blockedCapability: 0,
      });
      assert.ok(result.examples.every((entry) => entry.status === 'UNKNOWN'));
    }
  });

  it('does not turn a passing partial-scope result into a green dimension', () => {
    const report = generateHealthV2({
      subjectSha: SUBJECT_SHA,
      generatedAt: GENERATED_AT,
      ...TRUSTED_GENERATE_OPTIONS,
      machineResults: [
        machineResult('content', [
          { exampleId: EXAMPLE_IDS[0], status: 'PASS' },
        ]),
      ],
    });
    const content = dimension(report, 'content');

    assert.equal(content.status, 'UNKNOWN');
    assert.equal(content.summary.pass, 0);
    assert.equal(content.summary.unknown, 26);
    assert.equal(content.summary.testedPercent, 0);
  });

  it('fails both catalog currency and maintenance when reviews expire', () => {
    const report = generateHealthV2({
      subjectSha: SUBJECT_SHA,
      generatedAt: '2028-07-18T12:00:00.000Z',
    });

    assert.equal(dimension(report, 'catalog').status, 'FAIL');
    assert.equal(dimension(report, 'maintenance').status, 'FAIL');
  });

  it('keeps a fully claimed dimension UNKNOWN while evidence is validation-only', () => {
    const report = generateHealthV2({
      subjectSha: SUBJECT_SHA,
      generatedAt: GENERATED_AT,
      ...TRUSTED_GENERATE_OPTIONS,
      machineResults: [
        machineResult(
          'routes',
          EXAMPLE_IDS.map((exampleId) => ({ exampleId, status: 'PASS' }))
        ),
      ],
    });
    const routes = dimension(report, 'routes');

    assert.equal(routes.status, 'UNKNOWN');
    assert.equal(routes.summary.testedPercent, 0);
    assert.equal(routes.summary.pass, 0);
    assert.equal(routes.summary.unknown, 26);
  });

  it('does not let signed metadata alone make catalog or maintenance PASS', () => {
    const statuses = EXAMPLE_IDS.map((exampleId) => ({
      exampleId,
      status: 'PASS' as const,
    }));
    const report = generateHealthV2({
      subjectSha: SUBJECT_SHA,
      generatedAt: GENERATED_AT,
      ...TRUSTED_GENERATE_OPTIONS,
      machineResults: [
        machineResult('catalog', statuses),
        machineResult('maintenance', statuses),
      ],
    });

    assert.equal(dimension(report, 'catalog').status, 'UNKNOWN');
    assert.equal(dimension(report, 'maintenance').status, 'UNKNOWN');
  });

  it('preserves FAIL, UNKNOWN, and BLOCKED_CAPABILITY as separate states', () => {
    const report = generateHealthV2({
      subjectSha: SUBJECT_SHA,
      generatedAt: GENERATED_AT,
      machineResults: [
        machineResult('accessibility', [
          { exampleId: EXAMPLE_IDS[0], status: 'FAIL' },
          { exampleId: EXAMPLE_IDS[1], status: 'UNKNOWN' },
          { exampleId: EXAMPLE_IDS[2], status: 'BLOCKED_CAPABILITY' },
        ]),
      ],
    });
    const accessibility = dimension(report, 'accessibility');

    assert.equal(accessibility.status, 'FAIL');
    assert.equal(accessibility.summary.fail, 1);
    assert.equal(accessibility.summary.unknown, 24);
    assert.equal(accessibility.summary.blockedCapability, 1);
    assert.equal(accessibility.summary.tested, 1);
  });

  it('reports a capability blocker ahead of untested UNKNOWN cells', () => {
    const report = generateHealthV2({
      subjectSha: SUBJECT_SHA,
      generatedAt: GENERATED_AT,
      machineResults: [
        machineResult('explorer', [
          {
            exampleId: EXAMPLE_IDS[0],
            status: 'BLOCKED_CAPABILITY',
          },
        ]),
      ],
    });

    assert.equal(dimension(report, 'explorer').status, 'BLOCKED_CAPABILITY');
  });

  it('rejects a machine result bound to a different subject SHA', () => {
    const input = machineResult(
      'pipeline',
      [{ exampleId: EXAMPLE_IDS[0], status: 'PASS' }],
      {
        subject: {
          repository: REPOSITORY_ID,
          sha: 'b'.repeat(40),
          catalogSchemaVersion: CATALOG_SCHEMA_VERSION,
        },
      }
    );

    assert.throws(
      () =>
        generateHealthV2({
          subjectSha: SUBJECT_SHA,
          generatedAt: GENERATED_AT,
          machineResults: [input],
        }),
      /subject\.sha does not match/
    );
  });

  it('rejects result cells that do not exactly match their declared scope', () => {
    const input = machineResult('cli', [
      { exampleId: EXAMPLE_IDS[0], status: 'PASS' },
    ]) as unknown as Record<string, unknown>;
    input.scope = {
      type: 'catalog-example-ids',
      exampleIds: [EXAMPLE_IDS[0], EXAMPLE_IDS[1]],
    };

    assert.throws(
      () =>
        generateHealthV2({
          subjectSha: SUBJECT_SHA,
          generatedAt: GENERATED_AT,
          machineResults: [input],
        }),
      /results must bind exactly/
    );
  });

  it('rejects an evidence-free PASS result', () => {
    const input = machineResult('claims', [
      { exampleId: EXAMPLE_IDS[0], status: 'PASS' },
    ]) as unknown as {
      results: Array<{ evidence: unknown[] }>;
    };
    input.results[0].evidence = [];

    assert.throws(
      () =>
        generateHealthV2({
          subjectSha: SUBJECT_SHA,
          generatedAt: GENERATED_AT,
          machineResults: [input],
        }),
      /evidence must contain structured evidence for PASS/
    );
  });

  it('rejects 26 PASS cells whose only evidence is "trust me"', () => {
    const input = machineResult(
      'routes',
      EXAMPLE_IDS.map((exampleId) => ({ exampleId, status: 'PASS' }))
    ) as unknown as { results: Array<{ evidence: unknown[] }> };
    for (const result of input.results) result.evidence = ['trust me'];

    assert.throws(
      () =>
        generateHealthV2({
          subjectSha: SUBJECT_SHA,
          generatedAt: GENERATED_AT,
          machineResults: [input],
        }),
      /must be a structured evidence descriptor/
    );
  });

  it('rejects evidence copied from a different result identity', () => {
    const input = machineResult('content', [
      { exampleId: EXAMPLE_IDS[0], status: 'PASS' },
    ]);
    input.results[0].evidence[0].resultIdentitySha256 = 'b'.repeat(64);

    assert.throws(
      () =>
        generateHealthV2({
          subjectSha: SUBJECT_SHA,
          generatedAt: GENERATED_AT,
          machineResults: [input],
        }),
      /does not match the exact result identity/
    );
  });

  it('keeps a structurally valid claimed PASS UNKNOWN when no trust root is configured', () => {
    const report = generateHealthV2({
      subjectSha: SUBJECT_SHA,
      generatedAt: GENERATED_AT,
      evidenceRoot: EVIDENCE_ROOT,
      machineResults: [
        machineResult('content', [
          { exampleId: EXAMPLE_IDS[0], status: 'PASS' },
        ]),
      ],
    });
    const content = dimension(report, 'content');

    assert.equal(content.summary.pass, 0);
    assert.equal(content.summary.unknown, 26);
    assert.equal(content.examples[0].status, 'UNKNOWN');
    assert.match(
      String(content.examples[0].evidence.at(-1)),
      /no independently configured trusted verifier/
    );
  });

  it('rejects a PASS whose declared evidence artifact bytes are missing', () => {
    const input = machineResult('content', [
      { exampleId: EXAMPLE_IDS[0], status: 'PASS' },
    ]);
    input.results[0].evidence[0].artifact.path = 'missing-evidence.json';

    assert.throws(
      () =>
        generateHealthV2({
          subjectSha: SUBJECT_SHA,
          generatedAt: GENERATED_AT,
          ...TRUSTED_GENERATE_OPTIONS,
          machineResults: [input],
        }),
      /artifact\.path cannot be snapshotted/
    );
  });

  it('rejects swapped evidence bytes even when the descriptor still claims the old digest', () => {
    const input = machineResult('content', [
      { exampleId: EXAMPLE_IDS[0], status: 'PASS' },
    ]);
    const descriptor = input.results[0].evidence[0];
    const rerunBytes = readFileSync(
      join(EVIDENCE_ROOT, descriptor.verifier.rerunArtifact.path)
    );
    writeFileSync(join(EVIDENCE_ROOT, descriptor.artifact.path), rerunBytes);

    assert.throws(
      () =>
        generateHealthV2({
          subjectSha: SUBJECT_SHA,
          generatedAt: GENERATED_AT,
          ...TRUSTED_GENERATE_OPTIONS,
          machineResults: [input],
        }),
      /artifact\.sha256 does not match snapshotted file bytes/
    );
  });

  it('rejects a wrong artifact digest and a substituted result schema', () => {
    const digestInput = machineResult('content', [
      { exampleId: EXAMPLE_IDS[0], status: 'PASS' },
    ]);
    digestInput.results[0].evidence[0].artifact.sha256 = 'b'.repeat(64);
    assert.throws(
      () =>
        generateHealthV2({
          subjectSha: SUBJECT_SHA,
          generatedAt: GENERATED_AT,
          ...TRUSTED_GENERATE_OPTIONS,
          machineResults: [digestInput],
        }),
      /artifact\.sha256 does not match snapshotted file bytes/
    );

    const schemaInput = machineResult('content', [
      { exampleId: EXAMPLE_IDS[0], status: 'PASS' },
    ]);
    schemaInput.results[0].evidence[0].resultSchema = writeJsonArtifact(
      'substituted-schema',
      { type: 'object', additionalProperties: true }
    );
    assert.throws(
      () =>
        generateHealthV2({
          subjectSha: SUBJECT_SHA,
          generatedAt: GENERATED_AT,
          ...TRUSTED_GENERATE_OPTIONS,
          machineResults: [schemaInput],
        }),
      /artifact does not match the signed evidence binding/
    );
  });

  it('rejects descriptor changes to the signed environment, command, or tool versions', () => {
    const mutations: Array<{
      label: string;
      mutate: (input: MachineHealthResult) => void;
    }> = [
      {
        label: 'environment',
        mutate: (input) => {
          input.results[0].evidence[0].producer.environment.runner =
            'self-reported-runner';
        },
      },
      {
        label: 'command',
        mutate: (input) => {
          input.results[0].evidence[0].producer.command = 'true';
        },
      },
      {
        label: 'tool version',
        mutate: (input) => {
          input.results[0].evidence[0].producer.toolVersions.node = '99.0.0';
        },
      },
    ];

    for (const mutation of mutations) {
      const input = machineResult('content', [
        { exampleId: EXAMPLE_IDS[0], status: 'PASS' },
      ]);
      mutation.mutate(input);
      assert.throws(
        () =>
          generateHealthV2({
            subjectSha: SUBJECT_SHA,
            generatedAt: GENERATED_AT,
            ...TRUSTED_GENERATE_OPTIONS,
            machineResults: [input],
          }),
        /artifact does not match the signed evidence binding/,
        mutation.label
      );
    }
  });

  it('rejects a self-authored PASS signed by an untrusted key', () => {
    const input = machineResult(
      'content',
      [{ exampleId: EXAMPLE_IDS[0], status: 'PASS' }],
      {},
      { signer: ATTACKER_SIGNER, producerId: 'self-authored-producer' }
    );

    assert.throws(
      () =>
        generateHealthV2({
          subjectSha: SUBJECT_SHA,
          generatedAt: GENERATED_AT,
          ...TRUSTED_GENERATE_OPTIONS,
          machineResults: [input],
        }),
      /verifier does not match the pinned trust root/
    );
  });

  it('rejects a forged signature made with the wrong private key', () => {
    const input = machineResult(
      'content',
      [{ exampleId: EXAMPLE_IDS[0], status: 'PASS' }],
      {},
      { signatureKey: ATTACKER_SIGNER.privateKey }
    );

    assert.throws(
      () =>
        generateHealthV2({
          subjectSha: SUBJECT_SHA,
          generatedAt: GENERATED_AT,
          ...TRUSTED_GENERATE_OPTIONS,
          machineResults: [input],
        }),
      /signature verification failed/
    );
  });

  it('rejects stale evidence versions and descriptors bound to another SHA or result', () => {
    const mutations: Array<{
      field: string;
      value: unknown;
      expected: RegExp;
    }> = [
      {
        field: 'evidenceVersion',
        value: '0.0.1',
        expected: /evidenceVersion must be 2\.0\.0/,
      },
      {
        field: 'kind',
        value: 'trust-me',
        expected: /kind must be signed-machine-verification/,
      },
      {
        field: 'subjectSha',
        value: 'b'.repeat(40),
        expected: /subjectSha does not match the result subject/,
      },
      {
        field: 'resultId',
        value: 'another-result-v1',
        expected: /resultId does not match the result identity/,
      },
      {
        field: 'assertionId',
        value: 'trust me',
        expected: /assertionId must be stable kebab-case/,
      },
    ];

    for (const mutation of mutations) {
      const input = machineResult('content', [
        { exampleId: EXAMPLE_IDS[0], status: 'PASS' },
      ]) as unknown as {
        results: Array<{ evidence: Array<Record<string, unknown>> }>;
      };
      input.results[0].evidence[0][mutation.field] = mutation.value;
      assert.throws(
        () =>
          generateHealthV2({
            subjectSha: SUBJECT_SHA,
            generatedAt: GENERATED_AT,
            machineResults: [input],
          }),
        mutation.expected,
        mutation.field
      );
    }
  });

  it('rejects zero SHAs and non-PASS cells without reasons', () => {
    assert.throws(
      () =>
        generateHealthV2({
          subjectSha: '0'.repeat(40),
          generatedAt: GENERATED_AT,
        }),
      /nonzero lowercase 40-character Git SHA/
    );

    const input = machineResult('claims', [
      { exampleId: EXAMPLE_IDS[0], status: 'UNKNOWN' },
    ]);
    input.results[0].reasons = [];
    assert.throws(
      () =>
        generateHealthV2({
          subjectSha: SUBJECT_SHA,
          generatedAt: GENERATED_AT,
          machineResults: [input],
        }),
      /reasons must explain a non-PASS result/
    );
  });

  it('rejects overlapping inputs instead of accepting ambiguous evidence', () => {
    const first = machineResult('explorer', [
      { exampleId: EXAMPLE_IDS[0], status: 'PASS' },
    ]);
    const second = {
      ...machineResult('explorer', [
        { exampleId: EXAMPLE_IDS[0], status: 'FAIL' },
      ]),
      resultId: 'explorer-second-v1',
    };

    assert.throws(
      () =>
        generateHealthV2({
          subjectSha: SUBJECT_SHA,
          generatedAt: GENERATED_AT,
          machineResults: [first, second],
        }),
      /multiple machine results cover explorer:/
    );
  });

  it('is deterministic apart from generatedAt and input ordering', () => {
    const content = machineResult('content', [
      { exampleId: EXAMPLE_IDS[0], status: 'PASS' },
    ]);
    const claims = machineResult('claims', [
      { exampleId: EXAMPLE_IDS[1], status: 'BLOCKED_CAPABILITY' },
    ]);
    const first = generateHealthV2({
      subjectSha: SUBJECT_SHA,
      generatedAt: '2026-07-18T12:00:00.000Z',
      machineResults: [content, claims],
    });
    const second = generateHealthV2({
      subjectSha: SUBJECT_SHA,
      generatedAt: '2026-07-18T12:00:01.000Z',
      machineResults: [claims, content],
    });

    const { generatedAt: firstTimestamp, ...firstStable } = first;
    const { generatedAt: secondTimestamp, ...secondStable } = second;
    assert.notEqual(firstTimestamp, secondTimestamp);
    assert.deepEqual(firstStable, secondStable);
  });
});
