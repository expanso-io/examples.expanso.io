import assert from 'node:assert/strict';
import {
  createHash,
  generateKeyPairSync,
  sign,
  type KeyObject,
} from 'node:crypto';
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { after, describe, it } from 'node:test';

import {
  machineJourneyResultIdentitySha256,
  reduceMachineJourney,
  type JourneyVerifierTrust,
} from '../../scripts/quality/reduce-machine-journey';
import {
  contractDigest,
  readJson,
  ZERO_SHA256,
  type QualityContract,
} from '../../scripts/quality/contract-lib';

const SUBJECT_SHA = 'a'.repeat(40);
const ENVIRONMENT_ID = 'github-actions-linux-x64';
const NOW = new Date('2026-07-18T12:10:00.000Z');
const evidenceRoot = mkdtempSync(join(tmpdir(), 'journey-evidence-'));
const contractPath = join(evidenceRoot, 'machine-journey-test-contract.json');
const contract = structuredClone(
  readJson('tests/contracts/machine-journey-v1.json')
) as QualityContract;
contract.fixtures = [];
contract.contractSha256 = ZERO_SHA256;
contract.contractSha256 = contractDigest(contract);
writeFileSync(contractPath, `${JSON.stringify(contract, null, 2)}\n`);
const resultSchemaBytes = readFileSync(resolve(contract.resultSchema));
const scorerContract = contract.scorer as Record<string, any>;
const scorerSchemaBytes = readFileSync(
  resolve(scorerContract.outputSchema.path)
);
const RESULT_SCHEMA_SHA256 = digest(resultSchemaBytes);
const SCORER_SCHEMA_SHA256 = digest(scorerSchemaBytes);
const TRACE_SCHEMA_SHA256 = Object.fromEntries(
  Object.entries(contract.traceSchemas as Record<string, any>).map(
    ([field, binding]) => [field, digest(readFileSync(resolve(binding.path)))]
  )
);
const EXECUTION = {
  command: contract.commands.run,
  toolVersions: contract.tools,
};
let sequence = 0;

interface ArtifactBinding {
  evidenceVersion: 'journey-artifact-v2';
  path: string;
  sha256: string;
  bytes: number;
}

interface SignerFixture extends JourneyVerifierTrust {
  privateKey: KeyObject;
}

function digest(value: string | Buffer): string {
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

function valueDigest(value: unknown): string {
  return digest(JSON.stringify(canonicalize(value)));
}

function signerFixture(id: string): SignerFixture {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const bytes = Buffer.from(publicKey.export({ type: 'spki', format: 'pem' }));
  const publicKeyPath = `${id}.pub.pem`;
  writeFileSync(join(evidenceRoot, publicKeyPath), bytes);
  return {
    verifierId: `${id}-verifier`,
    keyId: `${id}-key-v1`,
    publicKeyPath,
    publicKeySha256: digest(bytes),
    privateKey,
  };
}

const TRUSTED_SIGNER = signerFixture('trusted');
const ATTACKER_SIGNER = signerFixture('attacker');
const TRUST: JourneyVerifierTrust = {
  verifierId: TRUSTED_SIGNER.verifierId,
  keyId: TRUSTED_SIGNER.keyId,
  publicKeyPath: TRUSTED_SIGNER.publicKeyPath,
  publicKeySha256: TRUSTED_SIGNER.publicKeySha256,
};

after(() => rmSync(evidenceRoot, { recursive: true, force: true }));

function writeArtifact(prefix: string, value: unknown): ArtifactBinding {
  sequence += 1;
  const path = `${String(sequence).padStart(5, '0')}-${prefix}.json`;
  const bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`, 'utf8');
  writeFileSync(join(evidenceRoot, path), bytes);
  return {
    evidenceVersion: 'journey-artifact-v2',
    path,
    sha256: digest(bytes),
    bytes: bytes.byteLength,
  };
}

function rewriteArtifact(binding: ArtifactBinding, value: unknown): void {
  const bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`, 'utf8');
  writeFileSync(join(evidenceRoot, binding.path), bytes);
  binding.sha256 = digest(bytes);
  binding.bytes = bytes.byteLength;
}

function oracleValues(task: Record<string, any>): Record<string, unknown> {
  if (task.taskId === 'find-example') {
    return {
      'family-match': task.intendedFamilyId,
      'route-match': task.intendedRouteId,
    };
  }
  if (task.taskId === 'explain-boundary') {
    return { 'boundary-oracle-match': task.boundaryOracle };
  }
  if (task.taskId === 'open-shared-stage') {
    return {
      'stage-match': task.explorerOracle.stageId,
      'semantic-change-match': task.explorerOracle.semanticChange,
      'shared-url-match': task.explorerOracle.sharedUrl,
    };
  }
  if (task.taskId === 'retrieve-pipeline') {
    return {
      'pipeline-path-match': task.pipelineOracle.path,
      'pipeline-digest-match': task.pipelineOracle.sha256,
    };
  }
  if (task.taskId === 'run-offline-path') {
    return {
      'command-match': task.localRunOracle.command,
      'fixture-match': task.localRunOracle.fixturePath,
      'output-assertions-match': task.localRunOracle.expectedAssertions,
    };
  }
  return {};
}

function traceHeader(
  trial: Record<string, any>,
  task: Record<string, any>
): Record<string, unknown> {
  return {
    contractId: contract.contractId,
    contractSha256: contract.contractSha256,
    subjectSha: SUBJECT_SHA,
    environmentId: ENVIRONMENT_ID,
    trialId: trial.trialId,
    taskId: task.taskId,
  };
}

function pipelineSummary(): Record<string, unknown> {
  return {
    resultVersion: '2.0.0',
    scope: 'catalog-offline-runnable',
    totalCatalogRecords: 26,
    claimedOfflineRunnable: 1,
    executed: 1,
    assertedOutputs: 1,
    status: 'PASS',
    reason:
      'Exactly one catalog record was executed by its pinned offline runner and matched its exact output oracle.',
    records: [
      {
        exampleId: 'remove-pii',
        fixturePath: 'examples/data-security/remove-pii/sample-data.json',
        fixtureEnvironmentPath:
          'examples/data-security/remove-pii/fixture-environment.json',
        completePipelinePath: 'examples/data-security/remove-pii-complete.yaml',
        expectedOutputPath:
          'examples/data-security/remove-pii/expected-output.jsonl',
        executorImage:
          'jeffail/benthos:4.13.0@sha256:ec9b635d10bf267eb5b5c4c348b36752af1a5444ba768aefc6ca2c92ae2e22dd',
        executed: true,
        assertedOutput: true,
        status: 'PASS',
        reason:
          'Pinned Benthos executed the canonical HTTP-to-file config and produced the exact expected JSONL bytes.',
      },
    ],
  };
}

function taskEvidence(
  trial: Record<string, any>,
  task: Record<string, any>
): Record<string, unknown> {
  const header = traceHeader(trial, task);
  const visibleText =
    task.taskId === 'explain-boundary'
      ? Object.values(task.boundaryOracle).flat()
      : ['Remove PII'];
  const attributes =
    task.taskId === 'open-shared-stage'
      ? {
          'data-stage-id': task.explorerOracle.stageId,
          'data-semantic-change': task.explorerOracle.semanticChange,
        }
      : {};
  const dom = {
    traceVersion: 'journey-dom-trace-v1',
    ...header,
    snapshots: [
      {
        sequence: 0,
        url:
          task.taskId === 'open-shared-stage'
            ? `https://examples.expanso.io${task.explorerOracle.sharedUrl}`
            : `https://examples.expanso.io${task.startUrl}`,
        routeId: task.intendedRouteId,
        familyId: task.intendedFamilyId,
        visibleText,
        attributes,
      },
    ],
  };
  const network = {
    traceVersion: 'journey-network-trace-v1',
    ...header,
    requests:
      task.taskId === 'retrieve-pipeline'
        ? [
            {
              sequence: 0,
              method: 'GET',
              url: `https://github.invalid/expanso/examples/${task.pipelineOracle.path}`,
              status: 200,
              repositoryPath: task.pipelineOracle.path,
              responseSha256: task.pipelineOracle.sha256,
            },
          ]
        : [],
  };
  const commands = {
    traceVersion: 'journey-commands-trace-v1',
    ...header,
    invocations:
      task.taskId === 'run-offline-path'
        ? [
            {
              sequence: 0,
              command: task.localRunOracle.command,
              cwd: '.',
              exitCode: 0,
              stdout: `\n> examples@0.0.0 test-pipelines\n> tsx scripts/test-pipelines.ts\n\n${JSON.stringify(pipelineSummary())}\n`,
              stderr: '',
            },
          ]
        : [],
  };
  const trace = {
    dom: writeArtifact(`${trial.trialId}-${task.taskId}-dom`, dom),
    network: writeArtifact(`${trial.trialId}-${task.taskId}-network`, network),
    screenshot: writeArtifact(`${trial.trialId}-${task.taskId}-screenshot`, {
      screenshotPresenceOnly: true,
    }),
    commands: writeArtifact(
      `${trial.trialId}-${task.taskId}-commands`,
      commands
    ),
  };
  const values = oracleValues(task);
  const oracleEvidence = writeArtifact(
    `${trial.trialId}-${task.taskId}-oracle`,
    {
      oracleVersion: '2.0.0',
      contractId: contract.contractId,
      contractSha256: contract.contractSha256,
      subjectSha: SUBJECT_SHA,
      environmentId: ENVIRONMENT_ID,
      trialId: trial.trialId,
      taskId: task.taskId,
      trace,
    }
  );
  const assertions = Object.entries(values).map(([assertionId, actual]) => ({
    assertionId,
    expectedSha256: valueDigest(actual),
    actualSha256: valueDigest(actual),
    outcome: 'PASS',
  }));
  const scorerOutput = writeArtifact(`${trial.trialId}-${task.taskId}-scorer`, {
    scorerOutputVersion: '2.0.0',
    scorerVersion: scorerContract.version,
    scorerSchemaSha256: SCORER_SCHEMA_SHA256,
    contractId: contract.contractId,
    contractSha256: contract.contractSha256,
    subjectSha: SUBJECT_SHA,
    environmentId: ENVIRONMENT_ID,
    trialId: trial.trialId,
    taskId: task.taskId,
    execution: EXECUTION,
    trace,
    traceSchemaSha256: TRACE_SCHEMA_SHA256,
    oracleEvidence,
    assertions,
    status: 'PASS',
  });
  return {
    taskId: task.taskId,
    claimedStatus: 'PASS',
    elapsedMs: Math.min(1000, task.timeoutMs),
    wrongTurns: 0,
    abandonedRoutes: [],
    confidence: 0.95,
    browserDevice: 'desktop',
    trace,
    oracleEvidence,
    scorerOutput,
    blockedReason: null,
  };
}

function attest(
  result: Record<string, any>,
  options: {
    signer?: SignerFixture;
    signatureKey?: KeyObject;
    verdict?: 'PASS' | 'FAIL' | 'BLOCKED_CAPABILITY';
  } = {}
): void {
  const signerFixture = options.signer ?? TRUSTED_SIGNER;
  const payload = {
    attestationVersion: '1.0.0',
    verifierId: signerFixture.verifierId,
    keyId: signerFixture.keyId,
    publicKeySha256: signerFixture.publicKeySha256,
    signedAt: '2026-07-18T12:06:00.000Z',
    producerId: result.producerId,
    subjectSha: result.subjectSha,
    contractId: result.contractId,
    contractSha256: result.contractSha256,
    resultSchemaSha256: result.resultSchemaSha256,
    scorerSchemaSha256: result.scorerSchemaSha256,
    environmentId: result.environmentId,
    execution: result.execution,
    resultIdentitySha256: machineJourneyResultIdentitySha256(result),
    verdict: options.verdict ?? 'PASS',
  };
  const signature = sign(
    null,
    Buffer.from(JSON.stringify(canonicalize(payload)), 'utf8'),
    options.signatureKey ?? signerFixture.privateKey
  ).toString('base64');
  result.verifierAttestation = writeArtifact('verifier-attestation', {
    payload,
    signatureAlgorithm: 'ed25519',
    signature,
  });
}

function validResult(): Record<string, any> {
  const result = {
    resultVersion: '2.0.0',
    contractId: contract.contractId,
    contractSha256: contract.contractSha256,
    resultSchemaSha256: RESULT_SCHEMA_SHA256,
    scorerSchemaSha256: SCORER_SCHEMA_SHA256,
    subjectSha: SUBJECT_SHA,
    environmentId: ENVIRONMENT_ID,
    producerId: 'journey-producer-v1',
    execution: EXECUTION,
    startedAt: '2026-07-18T12:00:00.000Z',
    finishedAt: '2026-07-18T12:05:00.000Z',
    trials: (contract.trials as Array<Record<string, any>>).map((trial) => ({
      trialId: trial.trialId,
      persona: trial.persona,
      seed: trial.seed,
      tasks: trial.tasks.map((task: Record<string, any>) =>
        taskEvidence(trial, task)
      ),
    })),
    verifierAttestation: null,
  };
  attest(result);
  return result;
}

function reduce(
  input: unknown,
  trustedVerifier: JourneyVerifierTrust | undefined = TRUST
) {
  return reduceMachineJourney(input, {
    expectedSubjectSha: SUBJECT_SHA,
    expectedEnvironmentId: ENVIRONMENT_ID,
    evidenceRoot,
    contractPath,
    trustedVerifier,
    now: NOW,
  });
}

describe('machine journey evidence reducer', () => {
  it('independently reduces strict raw evidence for every task', () => {
    const input = validResult();
    const result = reduce(input);

    assert.equal(result.status, 'PASS', JSON.stringify(result.errors, null, 2));
    assert.deepEqual(result.errors, []);
    for (const trial of input.trials) {
      const localRun = trial.tasks.find(
        (task: Record<string, unknown>) => task.taskId === 'run-offline-path'
      );
      assert.equal(localRun.claimedStatus, 'PASS');
      assert.equal(localRun.blockedReason, null);
      assert.ok(localRun.trace.commands);
    }
  });

  it('returns UNKNOWN, never PASS, when the independent trust root is absent', () => {
    const result = reduceMachineJourney(validResult(), {
      expectedSubjectSha: SUBJECT_SHA,
      expectedEnvironmentId: ENVIRONMENT_ID,
      evidenceRoot,
      contractPath,
      now: NOW,
    });
    assert.equal(result.status, 'UNKNOWN');
    assert.deepEqual(result.errors, []);
  });

  it('rejects arbitrary retained bytes plus an author supplied passed flag', () => {
    const input = validResult();
    const task = input.trials[0].tasks[0];
    task.passed = true;
    rewriteArtifact(task.oracleEvidence, { arbitrary: true, passed: true });
    attest(input);

    const result = reduce(input);
    assert.equal(result.status, 'FAIL');
    assert.match(
      result.errors.join('\n'),
      /unknown field passed|invalid oracle artifact fields/
    );
  });

  it('rejects copied observations even when they repeat the correct oracle', () => {
    const input = validResult();
    const task = input.trials[0].tasks[0];
    const oracle = JSON.parse(
      readFileSync(join(evidenceRoot, task.oracleEvidence.path), 'utf8')
    );
    oracle.observations = Object.entries(
      oracleValues(contract.trials[0].tasks[0])
    ).map(([assertionId, actual]) => ({ assertionId, actual }));
    rewriteArtifact(task.oracleEvidence, oracle);
    const scorer = JSON.parse(
      readFileSync(join(evidenceRoot, task.scorerOutput.path), 'utf8')
    );
    scorer.oracleEvidence = task.oracleEvidence;
    rewriteArtifact(task.scorerOutput, scorer);
    attest(input);

    const result = reduce(input);
    assert.equal(result.status, 'FAIL');
    assert.match(result.errors.join('\n'), /invalid oracle artifact fields/);
  });

  it('rejects generic placeholder traces even with a signed PASS scorer', () => {
    const input = validResult();
    const task = input.trials[0].tasks[0];
    rewriteArtifact(task.trace.dom, {
      traceVersion: '1.0.0',
      events: ['retained-dom-event'],
    });
    const oracle = JSON.parse(
      readFileSync(join(evidenceRoot, task.oracleEvidence.path), 'utf8')
    );
    oracle.trace = task.trace;
    rewriteArtifact(task.oracleEvidence, oracle);
    const scorer = JSON.parse(
      readFileSync(join(evidenceRoot, task.scorerOutput.path), 'utf8')
    );
    scorer.trace = task.trace;
    scorer.oracleEvidence = task.oracleEvidence;
    rewriteArtifact(task.scorerOutput, scorer);
    attest(input);

    const result = reduce(input);
    assert.equal(result.status, 'FAIL');
    assert.match(result.errors.join('\n'), /trace\.dom|required field/);
  });

  it('rejects a fake offline command and copied successful stdout', () => {
    const input = validResult();
    const localRun = input.trials[0].tasks.find(
      (task: Record<string, unknown>) => task.taskId === 'run-offline-path'
    );
    const commands = JSON.parse(
      readFileSync(join(evidenceRoot, localRun.trace.commands.path), 'utf8')
    );
    commands.invocations[0].command = 'printf fake-pass';
    rewriteArtifact(localRun.trace.commands, commands);
    const oracle = JSON.parse(
      readFileSync(join(evidenceRoot, localRun.oracleEvidence.path), 'utf8')
    );
    oracle.trace = localRun.trace;
    rewriteArtifact(localRun.oracleEvidence, oracle);
    const scorer = JSON.parse(
      readFileSync(join(evidenceRoot, localRun.scorerOutput.path), 'utf8')
    );
    scorer.trace = localRun.trace;
    scorer.oracleEvidence = localRun.oracleEvidence;
    rewriteArtifact(localRun.scorerOutput, scorer);
    attest(input);

    const result = reduce(input);
    assert.equal(result.status, 'FAIL');
    assert.match(
      result.errors.join('\n'),
      /does not match the independently reduced oracle assertions/
    );
  });

  it('rejects missing, swapped, stale-digest, and byte-mismatched raw evidence', () => {
    const missing = validResult();
    missing.trials[0].tasks[0].trace.dom.path = 'missing.json';
    assert.match(
      reduce(missing).errors.join('\n'),
      /cannot snapshot evidence artifact/
    );

    const swapped = validResult();
    const swappedTask = swapped.trials[0].tasks[0];
    writeFileSync(
      join(evidenceRoot, swappedTask.trace.dom.path),
      readFileSync(join(evidenceRoot, swappedTask.trace.network.path))
    );
    assert.match(reduce(swapped).errors.join('\n'), /digest mismatch/);

    const stale = validResult();
    stale.trials[0].tasks[0].trace.dom.sha256 = 'b'.repeat(64);
    assert.match(reduce(stale).errors.join('\n'), /digest mismatch/);

    const bytes = validResult();
    bytes.trials[0].tasks[0].trace.dom.bytes += 1;
    assert.match(reduce(bytes).errors.join('\n'), /byte count mismatch/);
  });

  it('rejects wrong subject, contract, result-schema, and scorer-schema digests', () => {
    const mutations: Array<[string, string, RegExp]> = [
      ['subjectSha', 'b'.repeat(40), /subjectSha mismatch/],
      ['contractSha256', 'b'.repeat(64), /contractSha256 mismatch/],
      ['resultSchemaSha256', 'b'.repeat(64), /resultSchemaSha256 mismatch/],
      ['scorerSchemaSha256', 'b'.repeat(64), /scorerSchemaSha256 mismatch/],
    ];
    for (const [field, value, expected] of mutations) {
      const input = validResult();
      input[field] = value;
      attest(input);
      assert.match(reduce(input).errors.join('\n'), expected, field);
    }
  });

  it('rejects changed command, tool versions, and environment', () => {
    const command = validResult();
    command.execution.command = 'true';
    attest(command);
    assert.match(
      reduce(command).errors.join('\n'),
      /execution command or tool versions/
    );

    const tools = validResult();
    tools.execution.toolVersions.node = '99.0.0';
    attest(tools);
    assert.match(
      reduce(tools).errors.join('\n'),
      /execution command or tool versions/
    );

    const environment = validResult();
    environment.environmentId = 'author-laptop';
    attest(environment);
    assert.match(
      reduce(environment).errors.join('\n'),
      /environmentId mismatch/
    );
  });

  it('rejects forged signatures, untrusted self-signers, and self-verification', () => {
    const wrongKey = validResult();
    attest(wrongKey, { signatureKey: ATTACKER_SIGNER.privateKey });
    assert.match(
      reduce(wrongKey).errors.join('\n'),
      /signature verification failed/
    );

    const untrusted = validResult();
    attest(untrusted, { signer: ATTACKER_SIGNER });
    assert.match(
      reduce(untrusted).errors.join('\n'),
      /payload does not bind|does not match the pinned trust root/
    );

    const selfVerified = validResult();
    selfVerified.producerId = TRUST.verifierId;
    attest(selfVerified);
    assert.match(
      reduce(selfVerified).errors.join('\n'),
      /producer and verifier identities must differ/
    );
  });

  it('rejects symbolic-link evidence and artifact aliasing', () => {
    const symlink = validResult();
    const source = symlink.trials[0].tasks[0].trace.dom.path;
    const link = `symlink-${sequence}.json`;
    symlinkSync(source, join(evidenceRoot, link));
    symlink.trials[0].tasks[0].trace.dom.path = link;
    assert.match(reduce(symlink).errors.join('\n'), /non-symlink regular file/);

    const alias = validResult();
    alias.trials[0].tasks[0].trace.network = alias.trials[0].tasks[0].trace.dom;
    assert.match(
      reduce(alias).errors.join('\n'),
      /aliases another evidence artifact/
    );
  });
});
