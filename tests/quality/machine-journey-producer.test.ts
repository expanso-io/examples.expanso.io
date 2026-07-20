import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, it } from 'node:test';

import {
  readJson,
  type QualityContract,
} from '../../scripts/quality/contract-lib';
import {
  MACHINE_JOURNEY_AGENT_INTERFACE,
  MACHINE_JOURNEY_AGENT_ENVIRONMENT_ALLOWLIST,
  MACHINE_JOURNEY_SIGNER_INTERFACE,
  missingMachineJourneyCapabilities,
  produceMachineJourney,
  requireEmptyAttemptRoot,
} from '../../scripts/quality/produce-machine-journey';
import { sha256Bytes } from '../../scripts/quality/contract-lib';

const SUBJECT_SHA = 'a'.repeat(40);
const ENVIRONMENT_ID = 'github-actions-linux-x64';

function executable(path: string, source: string): void {
  writeFileSync(path, source);
  chmodSync(path, 0o755);
}

function mockAgentSource(options: {
  privateKeyPath: string;
  agentId: string;
  publicKeySha256: string;
  badSignature?: boolean;
}): string {
  return `#!/usr/bin/env node
const { createHash, sign } = require('node:crypto');
const { readFileSync, realpathSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');
const args = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, index, all) => index % 2 === 0 ? [...pairs, [value, all[index + 1]]] : pairs, []));
const request = JSON.parse(readFileSync(args['--request'], 'utf8'));
const root = realpathSync(args['--evidence-root']);
if (process.cwd() !== root) throw new Error('agent cwd was not isolated to its evidence root');
for (const forbidden of ['HOME', 'SECRET_ORACLE', 'QUALITY_VERIFIER_ID', 'QUALITY_VERIFIER_PRIVATE_KEY_FORBIDDEN']) {
  if (process.env[forbidden] !== undefined) throw new Error('agent inherited forbidden environment variable ' + forbidden);
}
if (!request.startUrl.startsWith(request.baseUrl + '/') || !/^https?:\\/\\//.test(request.startUrl)) throw new Error('agent did not receive an absolute candidate URL');
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const canonical = (value) => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => [key, canonical(entry)])) : value;
const artifact = (name, value, raw = false) => {
  const bytes = raw ? value : Buffer.from(JSON.stringify(value, null, 2) + '\\n');
  writeFileSync(join(root, name), bytes);
  return { evidenceVersion: 'journey-artifact-v2', path: name, sha256: digest(bytes), bytes: bytes.length };
};
const header = { contractId: request.contractId, contractSha256: request.contractSha256, subjectSha: request.subjectSha, environmentId: request.environmentId, trialId: request.trialId, taskId: request.taskId };
const boundary = ['checked-in fixture', 'exact output', 'remain local', 'Stays local', 'analytics destination', 'separate system boundary', 'Expanso pipeline', 'Local input', 'Local output'];
const routeId = request.taskId === 'open-shared-stage' ? 'remove-pii-explore' : 'remove-pii-overview';
const sharedUrl = '/data-security/remove-pii/explorer/?stage=hash-email';
const dom = { traceVersion: 'journey-dom-trace-v1', ...header, snapshots: [{ sequence: 0, url: request.taskId === 'open-shared-stage' ? request.baseUrl + sharedUrl : request.baseUrl + '/data-security/remove-pii', routeId, familyId: 'remove-pii', visibleText: request.taskId === 'explain-boundary' ? boundary : ['Remove PII'], attributes: request.taskId === 'open-shared-stage' ? { 'data-stage-id': 'hash-email', 'data-semantic-change': 'Replace the email with a keyed hash and retain its domain as a separate field.' } : {} }] };
const network = { traceVersion: 'journey-network-trace-v1', ...header, requests: request.taskId === 'retrieve-pipeline' ? [{ sequence: 0, method: 'GET', url: 'https://github.invalid/expanso/examples/remove-pii', status: 200, repositoryPath: 'examples/data-security/remove-pii-complete.yaml', responseSha256: 'd70b31e982b67a9a04c3269ebfa6ed8f6961c0f7664919534a0f4cb760e63b96' }] : [] };
const summary = { resultVersion: '2.0.0', scope: 'catalog-offline-runnable', totalCatalogRecords: 26, claimedOfflineRunnable: 1, executed: 1, assertedOutputs: 1, status: 'PASS', reason: 'mock', records: [{ exampleId: 'remove-pii', fixturePath: 'examples/data-security/remove-pii/sample-data.json', fixtureEnvironmentPath: 'examples/data-security/remove-pii/fixture-environment.json', completePipelinePath: 'examples/data-security/remove-pii-complete.yaml', expectedOutputPath: 'examples/data-security/remove-pii/expected-output.jsonl', executorImage: 'jeffail/benthos:4.13.0@sha256:ec9b635d10bf267eb5b5c4c348b36752af1a5444ba768aefc6ca2c92ae2e22dd', executed: true, assertedOutput: true, status: 'PASS', reason: 'mock' }] };
const stdout = '\\n> examples@0.0.0 test-pipelines\\n> tsx scripts/test-pipelines.ts\\n\\n' + JSON.stringify(summary) + '\\n';
const commands = { traceVersion: 'journey-commands-trace-v1', ...header, invocations: request.taskId === 'run-offline-path' ? [{ sequence: 0, command: 'npm run test-pipelines', cwd: '.', exitCode: 0, stdout, stderr: '' }] : [] };
const trace = { dom: artifact('dom.json', dom), network: artifact('network.json', network), screenshot: artifact('screenshot.png', Buffer.from('89504e470d0a1a0a', 'hex'), true), commands: artifact('commands.json', commands) };
const finalAnswer = artifact('final-answer.txt', Buffer.from('Completed journey ' + request.taskId + '\\n'), true);
const timerEvents = { promptVisibleAt: '2026-07-18T12:00:00.000Z', finalAnswerSubmittedAt: '2026-07-18T12:00:01.000Z' };
const identity = { protocolVersion: 'machine-journey-browser-agent-v1', agentId: ${JSON.stringify(options.agentId)}, agentPublicKeySha256: ${JSON.stringify(options.publicKeySha256)}, requestSha256: digest(readFileSync(args['--request'])), contractId: request.contractId, contractSha256: request.contractSha256, subjectSha: request.subjectSha, environmentId: request.environmentId, trialId: request.trialId, taskId: request.taskId, baseUrl: request.baseUrl, startUrl: request.startUrl };
const metrics = { timerEvents, elapsedMs: 1000, wrongTurns: 1, abandonedRoutes: ['/wrong-route'], confidence: 0.9, browser: { name: 'chromium', version: '140.0.7339.186' }, device: { profile: 'desktop', viewport: { width: 1440, height: 900 } }, agentModel: { name: 'mock-uncoached-agent', version: '1.0.0', toolVersions: { browser: '1.0.0' } }, finalAnswer, trace };
const payload = { attestationVersion: 'machine-journey-agent-attestation-v1', ...identity, ...metrics };
let signature = sign(null, Buffer.from(JSON.stringify(canonical(payload))), readFileSync(${JSON.stringify(options.privateKeyPath)})).toString('base64');
${options.badSignature ? "signature = Buffer.alloc(64, 7).toString('base64');" : ''}
const agentAttestation = artifact('agent-attestation.json', { payload, signatureAlgorithm: 'ed25519', signature });
writeFileSync(args['--response'], JSON.stringify({ ...identity, ...metrics, agentAttestation }, null, 2) + '\\n');
`;
}

function mockVerifierSource(options: {
  privateKeyPath: string;
  badSignature?: boolean;
}): string {
  return `#!/usr/bin/env node
const { sign } = require('node:crypto');
const { readFileSync, writeFileSync } = require('node:fs');
const args = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, index, all) => index % 2 === 0 ? [...pairs, [value, all[index + 1]]] : pairs, []));
const request = JSON.parse(readFileSync(args['--request'], 'utf8'));
const result = JSON.parse(readFileSync(args['--result'], 'utf8'));
const canonical = (value) => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => [key, canonical(entry)])) : value;
const payload = { attestationVersion: '1.0.0', verifierId: request.verifierId, keyId: request.keyId, publicKeySha256: request.publicKeySha256, signedAt: new Date(new Date(result.finishedAt).valueOf() + 1).toISOString(), producerId: result.producerId, subjectSha: result.subjectSha, contractId: result.contractId, contractSha256: result.contractSha256, resultSchemaSha256: result.resultSchemaSha256, scorerSchemaSha256: result.scorerSchemaSha256, environmentId: result.environmentId, execution: result.execution, resultIdentitySha256: request.resultIdentitySha256, verdict: request.expectedVerdict };
let signature = sign(null, Buffer.from(JSON.stringify(canonical(payload))), readFileSync(${JSON.stringify(options.privateKeyPath)})).toString('base64');
${options.badSignature ? "signature = Buffer.alloc(64, 9).toString('base64');" : ''}
writeFileSync(args['--attestation'], JSON.stringify({ payload, signatureAlgorithm: 'ed25519', signature }, null, 2) + '\\n');
`;
}

function orchestrationFixture(
  options: {
    badAgentSignature?: boolean;
    badVerifierSignature?: boolean;
  } = {}
): {
  root: string;
  evidenceRoot: string;
  environment: NodeJS.ProcessEnv;
} {
  const root = mkdtempSync(join(tmpdir(), 'journey-producer-'));
  const evidenceRoot = join(root, 'attempt');
  const agent = generateKeyPairSync('ed25519');
  const verifier = generateKeyPairSync('ed25519');
  const agentPrivatePath = join(root, 'agent-private.pem');
  const agentPublicPath = join(root, 'agent-public.pem');
  const verifierPrivatePath = join(root, 'verifier-private.pem');
  const verifierPublicPath = join(root, 'verifier-public.pem');
  const agentPublicBytes = Buffer.from(
    agent.publicKey.export({ type: 'spki', format: 'pem' })
  );
  const verifierPublicBytes = Buffer.from(
    verifier.publicKey.export({ type: 'spki', format: 'pem' })
  );
  writeFileSync(
    agentPrivatePath,
    agent.privateKey.export({ type: 'pkcs8', format: 'pem' })
  );
  writeFileSync(agentPublicPath, agentPublicBytes);
  writeFileSync(
    verifierPrivatePath,
    verifier.privateKey.export({ type: 'pkcs8', format: 'pem' })
  );
  writeFileSync(verifierPublicPath, verifierPublicBytes);
  const agentCommand = join(root, 'agent-adapter.js');
  const verifierCommand = join(root, 'verifier.js');
  executable(
    agentCommand,
    mockAgentSource({
      privateKeyPath: agentPrivatePath,
      agentId: 'mock-agent-v1',
      publicKeySha256: sha256Bytes(agentPublicBytes),
      badSignature: options.badAgentSignature,
    })
  );
  executable(
    verifierCommand,
    mockVerifierSource({
      privateKeyPath: verifierPrivatePath,
      badSignature: options.badVerifierSignature,
    })
  );
  return {
    root,
    evidenceRoot,
    environment: {
      PATH: process.env.PATH,
      HOME: '/forbidden-home',
      SECRET_ORACLE: 'must-not-reach-agent',
      QUALITY_VERIFIER_PRIVATE_KEY_FORBIDDEN: verifierPrivatePath,
      QUALITY_JOURNEY_BASE_URL: 'http://127.0.0.1:4173/',
      QUALITY_JOURNEY_AGENT_COMMAND: agentCommand,
      QUALITY_JOURNEY_AGENT_ID: 'mock-agent-v1',
      QUALITY_JOURNEY_AGENT_PROTOCOL_VERSION:
        'machine-journey-browser-agent-v1',
      QUALITY_JOURNEY_AGENT_PUBLIC_KEY_PATH: agentPublicPath,
      QUALITY_JOURNEY_AGENT_PUBLIC_KEY_SHA256: sha256Bytes(agentPublicBytes),
      QUALITY_VERIFIER_COMMAND: verifierCommand,
      QUALITY_VERIFIER_ID: 'mock-independent-verifier-v1',
      QUALITY_VERIFIER_KEY_ID: 'mock-key-v1',
      QUALITY_VERIFIER_PUBLIC_KEY_PATH: verifierPublicPath,
      QUALITY_VERIFIER_PUBLIC_KEY_SHA256: sha256Bytes(verifierPublicBytes),
    },
  };
}

describe('machine-journey producer capability gate', () => {
  it('keeps the 9x5 machine-journey contract blocked without an agent adapter', () => {
    const contract = readJson(
      'tests/contracts/machine-journey-v1.json'
    ) as QualityContract;
    const trials = contract.trials as Array<{ tasks: unknown[] }>;
    assert.equal(trials.length, 9);
    assert.equal(
      trials.reduce((count, trial) => count + trial.tasks.length, 0),
      45
    );
    const capability = (contract.capabilities as Record<string, any>)[
      'journey-producer'
    ];
    assert.equal(capability.status, 'BLOCKED_CAPABILITY');
    assert.equal(
      capability.reasonCode,
      'NO_VERSIONED_UNCOACHED_BROWSER_AGENT_ADAPTER'
    );
  });

  it('requires prompts, personas, seeds, timer events, and observed navigation metrics', () => {
    assert.deepEqual(MACHINE_JOURNEY_AGENT_INTERFACE.requestMustBind, [
      'contractId',
      'contractSha256',
      'subjectSha',
      'environmentId',
      'trialId',
      'persona',
      'seed',
      'taskId',
      'prompt',
      'baseUrl',
      'startUrl',
      'allowedTools',
      'timeoutMs',
      'timerStartEvent',
      'timerStopEvent',
    ]);
    for (const field of [
      'wrong turns',
      'abandoned routes',
      'confidence',
      'prompt-visible event',
      'final-answer-submitted event',
      'canonical final answer artifact bytes and SHA-256 digest',
      'browser name and exact version',
      'device profile and viewport',
      'agent model and tool versions',
    ]) {
      assert.ok(
        MACHINE_JOURNEY_AGENT_INTERFACE.responseMustRetain.includes(field)
      );
    }
    assert.deepEqual(MACHINE_JOURNEY_AGENT_INTERFACE.agentAttestationMustBind, [
      'request identity and exact subject SHA',
      'canonical final answer artifact digest',
      'all raw evidence artifact paths, byte counts, and digests',
      'wrong turns, abandoned routes, confidence, and elapsed time',
      'browser, device, agent model, and tool-version identity',
    ]);
    assert.match(
      MACHINE_JOURNEY_AGENT_INTERFACE.autonomyPolicy,
      /must not supply/
    );
    assert.ok(MACHINE_JOURNEY_AGENT_ENVIRONMENT_ALLOWLIST.includes('PATH'));
    for (const forbidden of [
      'HOME',
      'GITHUB_TOKEN',
      'QUALITY_VERIFIER_ID',
      'QUALITY_VERIFIER_PRIVATE_KEY',
    ]) {
      assert.ok(
        !MACHINE_JOURNEY_AGENT_ENVIRONMENT_ALLOWLIST.includes(
          forbidden as never
        )
      );
    }
  });

  it('reports every missing agent and independent verifier input', () => {
    assert.deepEqual(missingMachineJourneyCapabilities({}), [
      ...MACHINE_JOURNEY_AGENT_INTERFACE.requiredEnvironment,
      ...MACHINE_JOURNEY_SIGNER_INTERFACE.requiredEnvironment,
    ]);
  });

  it('emits BLOCKED_CAPABILITY only when required external inputs are absent', () => {
    const root = mkdtempSync(join(tmpdir(), 'journey-producer-blocked-'));
    const evidenceRoot = join(root, 'attempt');
    try {
      const output = produceMachineJourney({
        environment: {},
        subjectSha: SUBJECT_SHA,
        environmentId: ENVIRONMENT_ID,
        attemptId: 'missing-capabilities',
        evidenceRoot,
      });
      assert.equal(output.exitCode, 2);
      assert.equal(output.manifest.status, 'BLOCKED_CAPABILITY');
      assert.deepEqual(output.manifest.missingCapabilities, [
        ...MACHINE_JOURNEY_AGENT_INTERFACE.requiredEnvironment,
        ...MACHINE_JOURNEY_SIGNER_INTERFACE.requiredEnvironment,
      ]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('refuses to mix contradictory attempts in a non-empty evidence root', () => {
    mkdirSync(resolve('test-results/quality'), { recursive: true });
    const parent = mkdtempSync(
      resolve('test-results/quality/journey-attempt-test-')
    );
    try {
      const empty = join(parent, 'empty');
      assert.doesNotThrow(() => requireEmptyAttemptRoot(empty));
      const occupied = join(parent, 'occupied');
      mkdirSync(occupied);
      writeFileSync(join(occupied, 'stale-terminal.json'), '{}\n');
      assert.throws(
        () => requireEmptyAttemptRoot(occupied),
        /refusing mixed terminal evidence/
      );
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });

  it('orchestrates all 45 signed cells, invokes the verifier, and requires literal PASS', () => {
    const fixture = orchestrationFixture();
    try {
      const output = produceMachineJourney({
        environment: fixture.environment,
        subjectSha: SUBJECT_SHA,
        environmentId: ENVIRONMENT_ID,
        attemptId: 'positive-mock',
        evidenceRoot: fixture.evidenceRoot,
        now: () => new Date('2026-07-18T12:05:00.000Z'),
      });
      assert.equal(output.exitCode, 0, output.manifest.reason);
      assert.equal(output.manifest.status, 'PASS');
      assert.equal(output.manifest.reduction?.status, 'PASS');
      assert.equal(output.manifest.reduction?.errors.length, 0);
      const contract = readJson(
        'tests/contracts/machine-journey-v1.json'
      ) as QualityContract;
      for (const trial of contract.trials as Array<Record<string, any>>) {
        for (const task of trial.tasks) {
          assert.ok(
            existsSync(
              resolve(
                fixture.evidenceRoot,
                'requests',
                `${trial.trialId}--${task.taskId}.json`
              )
            )
          );
          const request = readJson(
            resolve(
              fixture.evidenceRoot,
              'requests',
              `${trial.trialId}--${task.taskId}.json`
            )
          ) as Record<string, unknown>;
          assert.equal(request.baseUrl, 'http://127.0.0.1:4173');
          assert.match(
            String(request.startUrl),
            /^http:\/\/127\.0\.0\.1:4173\//
          );
          assert.equal(request.intendedFamilyId, undefined);
          assert.equal(request.boundaryOracle, undefined);
        }
      }
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it('fails closed when an agent response is not signed by the pinned identity', () => {
    const fixture = orchestrationFixture({ badAgentSignature: true });
    try {
      const output = produceMachineJourney({
        environment: fixture.environment,
        subjectSha: SUBJECT_SHA,
        environmentId: ENVIRONMENT_ID,
        attemptId: 'bad-agent-signature',
        evidenceRoot: fixture.evidenceRoot,
      });
      assert.equal(output.exitCode, 1);
      assert.equal(output.manifest.status, 'FAIL');
      assert.match(output.manifest.reason, /signature does not verify/);
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it('fails closed when the independent verifier signature is invalid', () => {
    const fixture = orchestrationFixture({ badVerifierSignature: true });
    try {
      const output = produceMachineJourney({
        environment: fixture.environment,
        subjectSha: SUBJECT_SHA,
        environmentId: ENVIRONMENT_ID,
        attemptId: 'bad-verifier-signature',
        evidenceRoot: fixture.evidenceRoot,
        now: () => new Date('2026-07-18T12:05:00.000Z'),
      });
      assert.equal(output.exitCode, 1);
      assert.equal(output.manifest.status, 'FAIL');
      assert.match(
        output.manifest.reason,
        /repository reducer did not return literal PASS/
      );
      assert.match(output.manifest.reason, /signature does not verify/);
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it('rejects a verifier that reuses the browser-agent identity', () => {
    const fixture = orchestrationFixture();
    fixture.environment.QUALITY_VERIFIER_ID =
      fixture.environment.QUALITY_JOURNEY_AGENT_ID;
    try {
      const output = produceMachineJourney({
        environment: fixture.environment,
        subjectSha: SUBJECT_SHA,
        environmentId: ENVIRONMENT_ID,
        attemptId: 'reused-agent-identity',
        evidenceRoot: fixture.evidenceRoot,
      });
      assert.equal(output.exitCode, 1);
      assert.match(output.manifest.reason, /identities must differ/);
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it('rejects a verifier that reuses the browser-agent trust root', () => {
    const fixture = orchestrationFixture();
    fixture.environment.QUALITY_VERIFIER_PUBLIC_KEY_PATH =
      fixture.environment.QUALITY_JOURNEY_AGENT_PUBLIC_KEY_PATH;
    fixture.environment.QUALITY_VERIFIER_PUBLIC_KEY_SHA256 =
      fixture.environment.QUALITY_JOURNEY_AGENT_PUBLIC_KEY_SHA256;
    try {
      const output = produceMachineJourney({
        environment: fixture.environment,
        subjectSha: SUBJECT_SHA,
        environmentId: ENVIRONMENT_ID,
        attemptId: 'reused-agent-trust-root',
        evidenceRoot: fixture.evidenceRoot,
      });
      assert.equal(output.exitCode, 1);
      assert.match(output.manifest.reason, /trust roots must differ/);
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it('treats a configured but unsupported protocol as FAIL, not missing capability', () => {
    const fixture = orchestrationFixture();
    fixture.environment.QUALITY_JOURNEY_AGENT_PROTOCOL_VERSION = 'wrong-v0';
    try {
      const output = produceMachineJourney({
        environment: fixture.environment,
        subjectSha: SUBJECT_SHA,
        environmentId: ENVIRONMENT_ID,
        attemptId: 'wrong-protocol',
        evidenceRoot: fixture.evidenceRoot,
      });
      assert.equal(output.exitCode, 1);
      assert.equal(output.manifest.status, 'FAIL');
      assert.match(output.manifest.reason, /protocol version is unsupported/);
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });
});
