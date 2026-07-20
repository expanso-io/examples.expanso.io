import { spawnSync } from 'node:child_process';
import {
  createHash,
  createPublicKey,
  verify as verifySignature,
} from 'node:crypto';
import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  writeFileSync,
} from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, isAbsolute, posix, relative, resolve, sep } from 'node:path';

import {
  loadContract,
  sha256Bytes,
  type QualityContract,
} from './contract-lib';
import {
  machineJourneyResultIdentitySha256,
  reduceMachineJourney,
  type JourneyReduction,
} from './reduce-machine-journey';

const SHA_PATTERN = /^[a-f0-9]{40}$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const ZERO_SHA = '0'.repeat(40);
const PRODUCER_ID = 'machine-journey-producer-v1';
const RESULT_VERSION = '2.0.0';
const AGENT_ATTESTATION_VERSION = 'machine-journey-agent-attestation-v1';
const TRACE_FIELDS = ['dom', 'network', 'screenshot', 'commands'] as const;

type RecordValue = Record<string, unknown>;

interface ArtifactBinding {
  evidenceVersion: 'journey-artifact-v2';
  path: string;
  sha256: string;
  bytes: number;
}

interface AgentCellOutput {
  taskResult: RecordValue;
  verifierEvidence: {
    trialId: string;
    taskId: string;
    request: ArtifactBinding;
    response: ArtifactBinding;
    cellEvidenceRoot: string;
  };
}

interface ProducerManifest {
  producerResultVersion: 'machine-journey-producer-v1';
  status: 'PASS' | 'BLOCKED_CAPABILITY' | 'FAIL';
  subjectSha: string;
  environmentId: string;
  contractId: string;
  contractSha256: string;
  attemptId: string;
  reasonCode: string;
  reason: string;
  missingCapabilities?: string[];
  resultPath?: string;
  reduction?: JourneyReduction;
  agentInterface: typeof MACHINE_JOURNEY_AGENT_INTERFACE;
  verifierInterface: typeof MACHINE_JOURNEY_SIGNER_INTERFACE;
  actualRuntime: {
    node: string;
    platform: NodeJS.Platform;
    architecture: string;
  };
}

export interface ProduceMachineJourneyOptions {
  environment?: NodeJS.ProcessEnv;
  subjectSha?: string;
  environmentId?: string;
  attemptId?: string;
  evidenceRoot?: string;
  contractPath?: string;
  now?: () => Date;
}

export interface ProduceMachineJourneyOutput {
  manifest: ProducerManifest;
  exitCode: 0 | 1 | 2;
}

export const MACHINE_JOURNEY_AGENT_INTERFACE = {
  interfaceVersion: 'machine-journey-browser-agent-v1',
  requiredEnvironment: [
    'QUALITY_JOURNEY_BASE_URL',
    'QUALITY_JOURNEY_AGENT_COMMAND',
    'QUALITY_JOURNEY_AGENT_ID',
    'QUALITY_JOURNEY_AGENT_PROTOCOL_VERSION',
    'QUALITY_JOURNEY_AGENT_PUBLIC_KEY_PATH',
    'QUALITY_JOURNEY_AGENT_PUBLIC_KEY_SHA256',
  ],
  requiredProtocolVersion: 'machine-journey-browser-agent-v1',
  invocation:
    '$QUALITY_JOURNEY_AGENT_COMMAND --request <absolute-request-path> --evidence-root <empty-cell-evidence-root> --response <absolute-response-path>',
  requestMustBind: [
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
  ],
  responseMustRetain: [
    'prompt-visible event',
    'final-answer-submitted event',
    'canonical final answer artifact bytes and SHA-256 digest',
    'ordered browser and terminal action trace',
    'DOM snapshots',
    'network responses',
    'PNG screenshots',
    'offline command trace',
    'wrong turns',
    'abandoned routes',
    'confidence',
    'elapsed time',
    'browser name and exact version',
    'device profile and viewport',
    'agent model and tool versions',
    'agent Ed25519 attestation',
  ],
  agentAttestationMustBind: [
    'request identity and exact subject SHA',
    'canonical final answer artifact digest',
    'all raw evidence artifact paths, byte counts, and digests',
    'wrong turns, abandoned routes, confidence, and elapsed time',
    'browser, device, agent model, and tool-version identity',
  ],
  autonomyPolicy:
    'The agent receives only the versioned prompt, persona, seed, start URL, and allowed tools. The producer must not supply route hints, selectors, scripted actions, or oracle values.',
} as const;

export const MACHINE_JOURNEY_AGENT_ENVIRONMENT_ALLOWLIST = [
  'PATH',
  'TMPDIR',
  'TEMP',
  'TMP',
  'LANG',
  'LC_ALL',
  'TZ',
  'CI',
  'PLAYWRIGHT_BROWSERS_PATH',
  'CHROME_PATH',
  'CHROMIUM_PATH',
  'SSL_CERT_FILE',
  'SSL_CERT_DIR',
  'NODE_EXTRA_CA_CERTS',
] as const;

export const MACHINE_JOURNEY_SIGNER_INTERFACE = {
  interfaceVersion: 'machine-journey-external-verifier-v1',
  requiredEnvironment: [
    'QUALITY_VERIFIER_COMMAND',
    'QUALITY_VERIFIER_ID',
    'QUALITY_VERIFIER_KEY_ID',
    'QUALITY_VERIFIER_PUBLIC_KEY_PATH',
    'QUALITY_VERIFIER_PUBLIC_KEY_SHA256',
  ],
  invocation:
    '$QUALITY_VERIFIER_COMMAND --request <absolute-request-path> --result <absolute-result-path> --evidence-root <absolute-evidence-root> --attestation <absolute-output-path>',
  verifierPolicy:
    'The external verifier independently reduces the raw agent evidence before signing. It owns the Ed25519 private key; the producer never receives, generates, or persists it.',
} as const;

function isObject(value: unknown): value is RecordValue {
  return value !== null && !Array.isArray(value) && typeof value === 'object';
}

function object(value: unknown, location: string): RecordValue {
  if (!isObject(value)) throw new Error(`${location} must be an object`);
  return value;
}

function array(value: unknown, location: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${location} must be an array`);
  return value;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (isObject(value)) {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalize(entry)])
    );
  }
  return value;
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function valueDigest(value: unknown): string {
  return sha256Bytes(canonicalJson(value));
}

function exactKeys(value: RecordValue, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  return (
    actual.length === expected.length &&
    [...expected].sort().every((entry, index) => entry === actual[index])
  );
}

function readJsonFile(path: string, location: string): RecordValue {
  try {
    return object(JSON.parse(readFileSync(path, 'utf8')), location);
  } catch (error) {
    throw new Error(
      `${location} is not a readable JSON object: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function runtimeManifestFields(): ProducerManifest['actualRuntime'] {
  return {
    node: process.versions.node,
    platform: process.platform,
    architecture: process.arch,
  };
}

export function requireEmptyAttemptRoot(path: string): void {
  const root = resolve(path);
  if (existsSync(root) && readdirSync(root).length > 0) {
    throw new Error(
      `Machine-journey attempt root must be empty; refusing mixed terminal evidence: ${root}`
    );
  }
  mkdirSync(root, { recursive: true });
}

export function missingMachineJourneyCapabilities(
  environment: NodeJS.ProcessEnv
): string[] {
  return [
    ...MACHINE_JOURNEY_AGENT_INTERFACE.requiredEnvironment,
    ...MACHINE_JOURNEY_SIGNER_INTERFACE.requiredEnvironment,
  ].filter((name) => !environment[name]?.trim());
}

function writeManifest(root: string, manifest: ProducerManifest): void {
  const target = resolve(root, 'machine-journey-producer-manifest.json');
  const temporary = resolve(
    root,
    `.machine-journey-producer-manifest.${process.pid}.tmp`
  );
  writeFileSync(temporary, `${JSON.stringify(manifest, null, 2)}\n`);
  renameSync(temporary, target);
}

function repositorySha(): string {
  const result = spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' });
  if (result.status !== 0)
    throw new Error(result.stderr || 'git rev-parse failed');
  return result.stdout.trim();
}

function generatedAttemptId(now: Date): string {
  return `${now.toISOString().replace(/[:.]/g, '-')}-${process.pid}`;
}

function commandFailure(
  label: string,
  command: string,
  args: string[],
  environment: NodeJS.ProcessEnv,
  timeout: number,
  cwd?: string
): void {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    env: environment,
    maxBuffer: 10 * 1024 * 1024,
    timeout,
    cwd,
  });
  if (result.error)
    throw new Error(`${label} could not run: ${result.error.message}`);
  if (result.status !== 0) {
    throw new Error(
      `${label} exited ${String(result.status)}: ${(result.stderr || result.stdout || '').trim()}`
    );
  }
}

function isolatedAgentEnvironment(
  environment: NodeJS.ProcessEnv
): NodeJS.ProcessEnv {
  return Object.fromEntries(
    MACHINE_JOURNEY_AGENT_ENVIRONMENT_ALLOWLIST.flatMap((name) =>
      environment[name] === undefined ? [] : [[name, environment[name]]]
    )
  );
}

function canonicalJourneyBaseUrl(rawValue: string): string {
  let parsed: URL;
  try {
    parsed = new URL(rawValue);
  } catch {
    throw new Error('QUALITY_JOURNEY_BASE_URL must be an absolute http(s) URL');
  }
  if (
    !['http:', 'https:'].includes(parsed.protocol) ||
    parsed.username !== '' ||
    parsed.password !== '' ||
    parsed.pathname !== '/' ||
    parsed.search !== '' ||
    parsed.hash !== ''
  ) {
    throw new Error(
      'QUALITY_JOURNEY_BASE_URL must be a credential-free http(s) origin without a path, query, or fragment'
    );
  }
  return parsed.origin;
}

function pinnedEd25519PublicKey(
  rawPath: string,
  expectedSha256: string,
  label: string
): Buffer {
  if (!SHA256_PATTERN.test(expectedSha256)) {
    throw new Error(`${label} public-key digest must be lowercase SHA-256`);
  }
  const path = resolve(rawPath);
  const metadata = lstatSync(path);
  if (metadata.isSymbolicLink() || !metadata.isFile()) {
    throw new Error(`${label} public key must be a non-symlink regular file`);
  }
  const bytes = readFileSync(path);
  if (sha256Bytes(bytes) !== expectedSha256) {
    throw new Error(`${label} public-key digest mismatch`);
  }
  const key = createPublicKey(bytes);
  if (key.asymmetricKeyType !== 'ed25519') {
    throw new Error(`${label} public key must be Ed25519`);
  }
  return bytes;
}

function normalizeBinding(
  value: unknown,
  cellRoot: string,
  location: string,
  usedPaths: Set<string>,
  usedFiles: Set<string>
): ArtifactBinding {
  const binding = object(value, location);
  if (!exactKeys(binding, ['evidenceVersion', 'path', 'sha256', 'bytes'])) {
    throw new Error(`${location} has invalid artifact binding fields`);
  }
  if (
    binding.evidenceVersion !== 'journey-artifact-v2' ||
    typeof binding.path !== 'string' ||
    typeof binding.sha256 !== 'string' ||
    !SHA256_PATTERN.test(binding.sha256) ||
    !Number.isInteger(binding.bytes) ||
    Number(binding.bytes) < 1
  ) {
    throw new Error(`${location} has an invalid artifact binding`);
  }
  const rawPath = binding.path;
  if (
    isAbsolute(rawPath) ||
    rawPath.includes('\\') ||
    rawPath !== posix.normalize(rawPath) ||
    rawPath === '.' ||
    rawPath.startsWith('../') ||
    usedPaths.has(rawPath)
  ) {
    throw new Error(
      `${location}.path must be unique, normalized, and root-relative`
    );
  }
  const absolute = resolve(cellRoot, rawPath);
  const relativePath = relative(cellRoot, absolute);
  if (
    relativePath === '..' ||
    relativePath.startsWith(`..${sep}`) ||
    isAbsolute(relativePath)
  ) {
    throw new Error(`${location}.path escapes its cell evidence root`);
  }
  const metadata = lstatSync(absolute);
  if (metadata.isSymbolicLink() || !metadata.isFile()) {
    throw new Error(`${location}.path must name a non-symlink regular file`);
  }
  const canonical = realpathSync(absolute);
  const canonicalRelative = relative(realpathSync(cellRoot), canonical);
  if (
    canonicalRelative === '..' ||
    canonicalRelative.startsWith(`..${sep}`) ||
    isAbsolute(canonicalRelative) ||
    usedFiles.has(canonical)
  ) {
    throw new Error(
      `${location}.path aliases or escapes its cell evidence root`
    );
  }
  const bytes = readFileSync(canonical);
  if (
    bytes.byteLength !== binding.bytes ||
    sha256Bytes(bytes) !== binding.sha256
  ) {
    throw new Error(`${location} byte count or digest mismatch`);
  }
  usedPaths.add(rawPath);
  usedFiles.add(canonical);
  return binding as unknown as ArtifactBinding;
}

function prefixedBinding(
  binding: ArtifactBinding,
  cellEvidenceRoot: string,
  attemptRoot: string
): ArtifactBinding {
  return {
    ...binding,
    path: posix.join(
      relative(attemptRoot, cellEvidenceRoot).split(sep).join('/'),
      binding.path
    ),
  };
}

function isoDate(value: unknown, location: string): Date {
  if (typeof value !== 'string')
    throw new Error(`${location} must be an ISO date-time`);
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.valueOf()) || parsed.toISOString() !== value) {
    throw new Error(`${location} must be a canonical ISO date-time`);
  }
  return parsed;
}

function verifyAgentAttestation(
  response: RecordValue,
  attestationPath: string,
  expectedPayload: RecordValue,
  publicKeyBytes: Buffer
): void {
  const envelope = readJsonFile(attestationPath, 'agent attestation');
  if (!exactKeys(envelope, ['payload', 'signatureAlgorithm', 'signature'])) {
    throw new Error('agent attestation envelope has invalid fields');
  }
  if (
    envelope.signatureAlgorithm !== 'ed25519' ||
    !isObject(envelope.payload) ||
    canonicalJson(envelope.payload) !== canonicalJson(expectedPayload)
  ) {
    throw new Error(
      'agent attestation does not bind the exact response evidence'
    );
  }
  const encoded =
    typeof envelope.signature === 'string' ? envelope.signature : '';
  const signature = Buffer.from(encoded, 'base64');
  if (signature.byteLength !== 64 || signature.toString('base64') !== encoded) {
    throw new Error(
      'agent attestation signature is not canonical Ed25519 base64'
    );
  }
  if (
    !verifySignature(
      null,
      Buffer.from(canonicalJson(expectedPayload), 'utf8'),
      createPublicKey(publicKeyBytes),
      signature
    )
  ) {
    throw new Error('agent attestation signature does not verify');
  }
  if (response.agentAttestation === undefined) {
    throw new Error('agent response is missing its attestation binding');
  }
}

function actualValues(
  task: RecordValue,
  dom: RecordValue,
  network: RecordValue,
  commands: RecordValue
): Map<string, unknown> {
  const values = new Map<string, unknown>();
  const snapshots = array(dom.snapshots, 'DOM snapshots').map((entry) =>
    object(entry, 'DOM snapshot')
  );
  if (task.taskId === 'find-example') {
    const final = snapshots.at(-1);
    values.set('family-match', final?.familyId ?? null);
    values.set('route-match', final?.routeId ?? null);
  } else if (task.taskId === 'explain-boundary') {
    const boundary = object(task.boundaryOracle, 'task.boundaryOracle');
    const visible = snapshots
      .flatMap((snapshot) =>
        Array.isArray(snapshot.visibleText) ? snapshot.visibleText : []
      )
      .filter((entry): entry is string => typeof entry === 'string')
      .join('\n')
      .toLocaleLowerCase('en-US');
    values.set(
      'boundary-oracle-match',
      Object.fromEntries(
        Object.entries(boundary).map(([category, phrases]) => [
          category,
          Array.isArray(phrases)
            ? phrases.filter(
                (phrase): phrase is string =>
                  typeof phrase === 'string' &&
                  visible.includes(phrase.toLocaleLowerCase('en-US'))
              )
            : [],
        ])
      )
    );
  } else if (task.taskId === 'open-shared-stage') {
    const final = snapshots.at(-1);
    const attributes = isObject(final?.attributes) ? final.attributes : {};
    let sharedUrl: string | null = null;
    try {
      const parsed = new URL(String(final?.url));
      sharedUrl = `${parsed.pathname}${parsed.search}`;
    } catch {
      sharedUrl = null;
    }
    values.set('stage-match', attributes['data-stage-id'] ?? null);
    values.set(
      'semantic-change-match',
      attributes['data-semantic-change'] ?? null
    );
    values.set('shared-url-match', sharedUrl);
  } else if (task.taskId === 'retrieve-pipeline') {
    const requests = array(network.requests, 'network requests')
      .map((entry) => object(entry, 'network request'))
      .filter((entry) => entry.method === 'GET' && entry.status === 200);
    const response = requests.length === 1 ? requests[0] : null;
    values.set('pipeline-path-match', response?.repositoryPath ?? null);
    values.set('pipeline-digest-match', response?.responseSha256 ?? null);
  } else if (task.taskId === 'run-offline-path') {
    const invocations = array(commands.invocations, 'command invocations').map(
      (entry) => object(entry, 'command invocation')
    );
    const invocation = invocations.length === 1 ? invocations[0] : null;
    values.set('command-match', invocation?.command ?? null);
    let record: RecordValue | null = null;
    try {
      const match =
        /^\s*> examples@0\.0\.0 test-pipelines\r?\n> tsx scripts\/test-pipelines\.ts\r?\n\r?\n(\{[\s\S]*\})\s*$/.exec(
          typeof invocation?.stdout === 'string' ? invocation.stdout : ''
        );
      const summary =
        invocation?.exitCode === 0 &&
        invocation.cwd === '.' &&
        invocation.stderr === '' &&
        match
          ? object(JSON.parse(match[1]), 'offline summary')
          : null;
      const records = Array.isArray(summary?.records)
        ? summary.records.filter(isObject)
        : [];
      const candidate = records.length === 1 ? records[0] : null;
      if (
        summary?.resultVersion === '2.0.0' &&
        summary.scope === 'catalog-offline-runnable' &&
        summary.status === 'PASS' &&
        summary.claimedOfflineRunnable === 1 &&
        summary.executed === 1 &&
        summary.assertedOutputs === 1 &&
        candidate?.exampleId === 'remove-pii' &&
        candidate.completePipelinePath ===
          'examples/data-security/remove-pii-complete.yaml' &&
        candidate.fixtureEnvironmentPath ===
          'examples/data-security/remove-pii/fixture-environment.json' &&
        candidate.expectedOutputPath ===
          'examples/data-security/remove-pii/expected-output.jsonl' &&
        candidate.executorImage ===
          'jeffail/benthos:4.13.0@sha256:ec9b635d10bf267eb5b5c4c348b36752af1a5444ba768aefc6ca2c92ae2e22dd' &&
        candidate.executed === true &&
        candidate.assertedOutput === true &&
        candidate.status === 'PASS'
      ) {
        record = candidate;
      }
    } catch {
      record = null;
    }
    values.set('fixture-match', record?.fixturePath ?? null);
    values.set(
      'output-assertions-match',
      record
        ? object(task.localRunOracle, 'task.localRunOracle').expectedAssertions
        : []
    );
  }
  return values;
}

function expectedValues(task: RecordValue): Map<string, unknown> {
  const values = new Map<string, unknown>();
  if (task.taskId === 'find-example') {
    values.set('family-match', task.intendedFamilyId);
    values.set('route-match', task.intendedRouteId);
  } else if (task.taskId === 'explain-boundary') {
    values.set('boundary-oracle-match', task.boundaryOracle);
  } else if (task.taskId === 'open-shared-stage') {
    const oracle = object(task.explorerOracle, 'task.explorerOracle');
    values.set('stage-match', oracle.stageId);
    values.set('semantic-change-match', oracle.semanticChange);
    values.set('shared-url-match', oracle.sharedUrl);
  } else if (task.taskId === 'retrieve-pipeline') {
    const oracle = object(task.pipelineOracle, 'task.pipelineOracle');
    values.set('pipeline-path-match', oracle.path);
    values.set('pipeline-digest-match', oracle.sha256);
  } else if (task.taskId === 'run-offline-path') {
    const oracle = object(task.localRunOracle, 'task.localRunOracle');
    values.set('command-match', oracle.command);
    values.set('fixture-match', oracle.fixturePath);
    values.set('output-assertions-match', oracle.expectedAssertions);
  }
  return values;
}

function producerArtifact(
  attemptRoot: string,
  relativePath: string,
  value: unknown
): ArtifactBinding {
  const bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`, 'utf8');
  const absolute = resolve(attemptRoot, relativePath);
  writeFileSync(absolute, bytes);
  return {
    evidenceVersion: 'journey-artifact-v2',
    path: relativePath,
    sha256: sha256Bytes(bytes),
    bytes: bytes.byteLength,
  };
}

function deriveCellArtifacts(
  attemptRoot: string,
  cellId: string,
  contract: QualityContract,
  subjectSha: string,
  environmentId: string,
  trial: RecordValue,
  task: RecordValue,
  trace: Record<string, ArtifactBinding>,
  traceDocuments: Record<string, RecordValue>,
  execution: RecordValue
): { oracleEvidence: ArtifactBinding; scorerOutput: ArtifactBinding } {
  const derivedRoot = `derived/${cellId}`;
  mkdirSync(resolve(attemptRoot, derivedRoot), { recursive: true });
  const oracleEvidence = producerArtifact(
    attemptRoot,
    `${derivedRoot}/oracle.json`,
    {
      oracleVersion: '2.0.0',
      contractId: contract.contractId,
      contractSha256: contract.contractSha256,
      subjectSha,
      environmentId,
      trialId: trial.trialId,
      taskId: task.taskId,
      trace,
    }
  );
  const expected = expectedValues(task);
  const actual = actualValues(
    task,
    traceDocuments.dom,
    traceDocuments.network,
    traceDocuments.commands
  );
  const assertions = [...expected.entries()].map(([assertionId, value]) => {
    const actualValue = actual.get(assertionId) ?? null;
    return {
      assertionId,
      expectedSha256: valueDigest(value),
      actualSha256: valueDigest(actualValue),
      outcome:
        canonicalJson(value) === canonicalJson(actualValue) ? 'PASS' : 'FAIL',
    };
  });
  const scorer = object(contract.scorer, 'contract.scorer');
  const scorerSchema = object(
    scorer.outputSchema,
    'contract.scorer.outputSchema'
  );
  const traceSchemas = object(contract.traceSchemas, 'contract.traceSchemas');
  const scorerOutput = producerArtifact(
    attemptRoot,
    `${derivedRoot}/scorer.json`,
    {
      scorerOutputVersion: '2.0.0',
      scorerVersion: scorer.version,
      scorerSchemaSha256: scorerSchema.sha256,
      contractId: contract.contractId,
      contractSha256: contract.contractSha256,
      subjectSha,
      environmentId,
      trialId: trial.trialId,
      taskId: task.taskId,
      execution,
      trace,
      traceSchemaSha256: Object.fromEntries(
        ['dom', 'network', 'commands'].map((field) => [
          field,
          object(traceSchemas[field], `contract.traceSchemas.${field}`).sha256,
        ])
      ),
      oracleEvidence,
      assertions,
      status: assertions.every((assertion) => assertion.outcome === 'PASS')
        ? 'PASS'
        : 'FAIL',
    }
  );
  if (assertions.some((assertion) => assertion.outcome !== 'PASS')) {
    throw new Error(
      `${String(trial.trialId)}/${String(task.taskId)} failed independently derived assertions`
    );
  }
  return { oracleEvidence, scorerOutput };
}

function runAgentCell(
  attemptRoot: string,
  contract: QualityContract,
  subjectSha: string,
  environmentId: string,
  trial: RecordValue,
  task: RecordValue,
  baseUrl: string,
  environment: NodeJS.ProcessEnv,
  agentPublicKey: Buffer,
  execution: RecordValue
): AgentCellOutput {
  const trialId = String(trial.trialId);
  const taskId = String(task.taskId);
  const cellId = `${trialId}--${taskId}`;
  const requestPath = resolve(attemptRoot, 'requests', `${cellId}.json`);
  const responsePath = resolve(attemptRoot, 'responses', `${cellId}.json`);
  const cellEvidenceRoot = resolve(attemptRoot, 'cells', cellId);
  mkdirSync(dirname(requestPath), { recursive: true });
  mkdirSync(dirname(responsePath), { recursive: true });
  requireEmptyAttemptRoot(cellEvidenceRoot);
  const absoluteStartUrl = new URL(
    String(task.startUrl),
    `${baseUrl}/`
  ).toString();
  if (new URL(absoluteStartUrl).origin !== baseUrl) {
    throw new Error(`${cellId}.startUrl escapes QUALITY_JOURNEY_BASE_URL`);
  }
  const request = {
    requestVersion: MACHINE_JOURNEY_AGENT_INTERFACE.interfaceVersion,
    contractId: contract.contractId,
    contractSha256: contract.contractSha256,
    subjectSha,
    environmentId,
    trialId,
    persona: trial.persona,
    seed: trial.seed,
    taskId,
    prompt: task.prompt,
    baseUrl,
    startUrl: absoluteStartUrl,
    allowedTools: task.allowedTools,
    timeoutMs: task.timeoutMs,
    timerStartEvent: task.timerStartEvent,
    timerStopEvent: task.timerStopEvent,
  };
  writeJson(requestPath, request);
  const requestSha256 = sha256Bytes(readFileSync(requestPath));
  commandFailure(
    `browser agent ${trialId}/${taskId}`,
    String(environment.QUALITY_JOURNEY_AGENT_COMMAND),
    [
      '--request',
      requestPath,
      '--evidence-root',
      cellEvidenceRoot,
      '--response',
      responsePath,
    ],
    isolatedAgentEnvironment(environment),
    Number(task.timeoutMs) + 15_000,
    cellEvidenceRoot
  );
  const response = readJsonFile(responsePath, `agent response ${cellId}`);
  const responseFields = [
    'protocolVersion',
    'agentId',
    'agentPublicKeySha256',
    'requestSha256',
    'contractId',
    'contractSha256',
    'subjectSha',
    'environmentId',
    'trialId',
    'taskId',
    'baseUrl',
    'startUrl',
    'timerEvents',
    'elapsedMs',
    'wrongTurns',
    'abandonedRoutes',
    'confidence',
    'browser',
    'device',
    'agentModel',
    'finalAnswer',
    'trace',
    'agentAttestation',
  ];
  if (!exactKeys(response, responseFields)) {
    throw new Error(`agent response ${cellId} has invalid protocol fields`);
  }
  const exactIdentity: RecordValue = {
    protocolVersion: MACHINE_JOURNEY_AGENT_INTERFACE.requiredProtocolVersion,
    agentId: environment.QUALITY_JOURNEY_AGENT_ID,
    agentPublicKeySha256: environment.QUALITY_JOURNEY_AGENT_PUBLIC_KEY_SHA256,
    requestSha256,
    contractId: contract.contractId,
    contractSha256: contract.contractSha256,
    subjectSha,
    environmentId,
    trialId,
    taskId,
    baseUrl,
    startUrl: absoluteStartUrl,
  };
  for (const [field, expected] of Object.entries(exactIdentity)) {
    if (response[field] !== expected) {
      throw new Error(`agent response ${cellId}.${field} identity mismatch`);
    }
  }
  const timerEvents = object(response.timerEvents, `${cellId}.timerEvents`);
  if (!exactKeys(timerEvents, ['promptVisibleAt', 'finalAnswerSubmittedAt'])) {
    throw new Error(`${cellId}.timerEvents has invalid fields`);
  }
  const started = isoDate(
    timerEvents.promptVisibleAt,
    `${cellId}.promptVisibleAt`
  );
  const finished = isoDate(
    timerEvents.finalAnswerSubmittedAt,
    `${cellId}.finalAnswerSubmittedAt`
  );
  if (
    !Number.isFinite(response.elapsedMs) ||
    Number(response.elapsedMs) < 0 ||
    finished.valueOf() - started.valueOf() !== response.elapsedMs
  ) {
    throw new Error(`${cellId}.elapsedMs does not match retained timer events`);
  }
  if (
    !Number.isInteger(response.wrongTurns) ||
    Number(response.wrongTurns) < 0 ||
    !Array.isArray(response.abandonedRoutes) ||
    new Set(response.abandonedRoutes).size !==
      response.abandonedRoutes.length ||
    !response.abandonedRoutes.every(
      (entry) => typeof entry === 'string' && entry.length > 0
    ) ||
    typeof response.confidence !== 'number' ||
    response.confidence < 0 ||
    response.confidence > 1
  ) {
    throw new Error(`${cellId} has invalid observed navigation metrics`);
  }
  const browser = object(response.browser, `${cellId}.browser`);
  const device = object(response.device, `${cellId}.device`);
  const agentModel = object(response.agentModel, `${cellId}.agentModel`);
  if (
    !exactKeys(browser, ['name', 'version']) ||
    typeof browser.name !== 'string' ||
    typeof browser.version !== 'string' ||
    !exactKeys(device, ['profile', 'viewport']) ||
    !['desktop', 'tablet', 'mobile'].includes(String(device.profile)) ||
    !isObject(device.viewport) ||
    !exactKeys(device.viewport, ['width', 'height']) ||
    !Number.isInteger(device.viewport.width) ||
    !Number.isInteger(device.viewport.height) ||
    Number(device.viewport.width) < 1 ||
    Number(device.viewport.height) < 1 ||
    !exactKeys(agentModel, ['name', 'version', 'toolVersions']) ||
    typeof agentModel.name !== 'string' ||
    typeof agentModel.version !== 'string' ||
    !isObject(agentModel.toolVersions) ||
    Object.keys(agentModel.toolVersions).length === 0 ||
    !Object.values(agentModel.toolVersions).every(
      (entry) => typeof entry === 'string' && entry.length > 0
    )
  ) {
    throw new Error(`${cellId} has invalid browser, device, or agent identity`);
  }
  const usedPaths = new Set<string>();
  const usedFiles = new Set<string>();
  const finalAnswer = normalizeBinding(
    response.finalAnswer,
    cellEvidenceRoot,
    `${cellId}.finalAnswer`,
    usedPaths,
    usedFiles
  );
  const responseTrace = object(response.trace, `${cellId}.trace`);
  if (!exactKeys(responseTrace, TRACE_FIELDS)) {
    throw new Error(`${cellId}.trace has invalid fields`);
  }
  const cellTrace = Object.fromEntries(
    TRACE_FIELDS.map((field) => [
      field,
      normalizeBinding(
        responseTrace[field],
        cellEvidenceRoot,
        `${cellId}.trace.${field}`,
        usedPaths,
        usedFiles
      ),
    ])
  ) as Record<string, ArtifactBinding>;
  const agentAttestation = normalizeBinding(
    response.agentAttestation,
    cellEvidenceRoot,
    `${cellId}.agentAttestation`,
    usedPaths,
    usedFiles
  );
  const screenshotBytes = readFileSync(
    resolve(cellEvidenceRoot, cellTrace.screenshot.path)
  );
  if (
    screenshotBytes.byteLength < 8 ||
    !screenshotBytes
      .subarray(0, 8)
      .equals(Buffer.from('89504e470d0a1a0a', 'hex'))
  ) {
    throw new Error(`${cellId}.trace.screenshot is not a PNG artifact`);
  }
  const attestationPayload = {
    attestationVersion: AGENT_ATTESTATION_VERSION,
    ...exactIdentity,
    timerEvents,
    elapsedMs: response.elapsedMs,
    wrongTurns: response.wrongTurns,
    abandonedRoutes: response.abandonedRoutes,
    confidence: response.confidence,
    browser,
    device,
    agentModel,
    finalAnswer,
    trace: cellTrace,
  };
  verifyAgentAttestation(
    response,
    resolve(cellEvidenceRoot, agentAttestation.path),
    attestationPayload,
    agentPublicKey
  );
  const trace = Object.fromEntries(
    Object.entries(cellTrace).map(([field, binding]) => [
      field,
      prefixedBinding(binding, cellEvidenceRoot, attemptRoot),
    ])
  ) as Record<string, ArtifactBinding>;
  const traceDocuments: Record<string, RecordValue> = {};
  for (const field of ['dom', 'network', 'commands']) {
    traceDocuments[field] = readJsonFile(
      resolve(cellEvidenceRoot, cellTrace[field].path),
      `${cellId}.${field}`
    );
  }
  for (const [index, snapshotValue] of array(
    traceDocuments.dom.snapshots,
    `${cellId}.dom.snapshots`
  ).entries()) {
    const snapshot = object(snapshotValue, `${cellId}.dom.snapshots[${index}]`);
    let snapshotOrigin: string | null = null;
    try {
      snapshotOrigin = new URL(String(snapshot.url)).origin;
    } catch {
      snapshotOrigin = null;
    }
    if (snapshotOrigin !== baseUrl) {
      throw new Error(
        `${cellId}.dom.snapshots[${index}] was not captured from the bound candidate origin`
      );
    }
  }
  const { oracleEvidence, scorerOutput } = deriveCellArtifacts(
    attemptRoot,
    cellId,
    contract,
    subjectSha,
    environmentId,
    trial,
    task,
    trace,
    traceDocuments,
    execution
  );
  if (Number(response.elapsedMs) > Number(task.timeoutMs)) {
    throw new Error(`${cellId} exceeded its contract timeout`);
  }
  const requestBytes = readFileSync(requestPath);
  const responseBytes = readFileSync(responsePath);
  return {
    taskResult: {
      taskId,
      claimedStatus: 'PASS',
      elapsedMs: response.elapsedMs,
      wrongTurns: response.wrongTurns,
      abandonedRoutes: response.abandonedRoutes,
      confidence: response.confidence,
      browserDevice: device.profile,
      trace,
      oracleEvidence,
      scorerOutput,
      blockedReason: null,
    },
    verifierEvidence: {
      trialId,
      taskId,
      request: {
        evidenceVersion: 'journey-artifact-v2',
        path: relative(attemptRoot, requestPath).split(sep).join('/'),
        sha256: sha256Bytes(requestBytes),
        bytes: requestBytes.byteLength,
      },
      response: {
        evidenceVersion: 'journey-artifact-v2',
        path: relative(attemptRoot, responsePath).split(sep).join('/'),
        sha256: sha256Bytes(responseBytes),
        bytes: responseBytes.byteLength,
      },
      cellEvidenceRoot: relative(attemptRoot, cellEvidenceRoot)
        .split(sep)
        .join('/'),
    },
  };
}

function blockedReasonCode(missing: string[]): string {
  const missingAgent = missing.some((entry) =>
    entry.startsWith('QUALITY_JOURNEY_')
  );
  const missingVerifier = missing.some((entry) =>
    entry.startsWith('QUALITY_VERIFIER_')
  );
  if (missingAgent && !missingVerifier)
    return 'NO_VERSIONED_UNCOACHED_BROWSER_AGENT_ADAPTER';
  if (missingVerifier && !missingAgent)
    return 'EXTERNAL_ED25519_VERIFIER_UNAVAILABLE';
  return 'REQUIRED_MACHINE_JOURNEY_CAPABILITIES_UNAVAILABLE';
}

export function produceMachineJourney(
  options: ProduceMachineJourneyOptions = {}
): ProduceMachineJourneyOutput {
  const environment = options.environment ?? process.env;
  const now = options.now ?? (() => new Date());
  const subjectSha =
    options.subjectSha ??
    environment.QUALITY_SUBJECT_SHA ??
    environment.GITHUB_SHA ??
    repositorySha();
  const environmentId =
    options.environmentId ??
    environment.QUALITY_ENVIRONMENT_ID ??
    `${process.platform}-${process.arch}`;
  const currentAttemptId =
    options.attemptId ??
    environment.JOURNEY_ATTEMPT_ID ??
    generatedAttemptId(now());
  const evidenceRoot = resolve(
    options.evidenceRoot ??
      environment.JOURNEY_EVIDENCE_ROOT ??
      `test-results/quality/machine-journey/${subjectSha}/${currentAttemptId}`
  );
  const rootWasOccupied =
    existsSync(evidenceRoot) && readdirSync(evidenceRoot).length > 0;
  let contractId = 'machine-journey-v1';
  let contractSha256 = '0'.repeat(64);
  let rootClaimed = false;
  try {
    if (!SHA_PATTERN.test(subjectSha) || subjectSha === ZERO_SHA) {
      throw new Error(
        'subjectSha must be a nonzero lowercase 40-character SHA'
      );
    }
    requireEmptyAttemptRoot(evidenceRoot);
    rootClaimed = true;
    const contract = loadContract(
      options.contractPath ?? 'tests/contracts/machine-journey-v1.json'
    );
    contractId = contract.contractId;
    contractSha256 = contract.contractSha256;
    const missing = missingMachineJourneyCapabilities(environment);
    if (missing.length > 0) {
      const manifest: ProducerManifest = {
        producerResultVersion: 'machine-journey-producer-v1',
        status: 'BLOCKED_CAPABILITY',
        subjectSha,
        environmentId,
        contractId,
        contractSha256,
        attemptId: currentAttemptId,
        reasonCode: blockedReasonCode(missing),
        reason: `Required external machine-journey capabilities are absent: ${missing.join(', ')}`,
        missingCapabilities: missing,
        agentInterface: MACHINE_JOURNEY_AGENT_INTERFACE,
        verifierInterface: MACHINE_JOURNEY_SIGNER_INTERFACE,
        actualRuntime: runtimeManifestFields(),
      };
      writeManifest(evidenceRoot, manifest);
      return { manifest, exitCode: 2 };
    }
    if (
      environment.QUALITY_JOURNEY_AGENT_PROTOCOL_VERSION !==
      MACHINE_JOURNEY_AGENT_INTERFACE.requiredProtocolVersion
    ) {
      throw new Error(
        'configured browser-agent protocol version is unsupported'
      );
    }
    if (environment.QUALITY_VERIFIER_ID === PRODUCER_ID) {
      throw new Error('producer and verifier identities must differ');
    }
    if (
      environment.QUALITY_JOURNEY_AGENT_ID === environment.QUALITY_VERIFIER_ID
    ) {
      throw new Error('browser-agent and verifier identities must differ');
    }
    if (
      environment.QUALITY_JOURNEY_AGENT_PUBLIC_KEY_SHA256 ===
      environment.QUALITY_VERIFIER_PUBLIC_KEY_SHA256
    ) {
      throw new Error('browser-agent and verifier trust roots must differ');
    }
    const agentPublicKey = pinnedEd25519PublicKey(
      String(environment.QUALITY_JOURNEY_AGENT_PUBLIC_KEY_PATH),
      String(environment.QUALITY_JOURNEY_AGENT_PUBLIC_KEY_SHA256),
      'agent'
    );
    pinnedEd25519PublicKey(
      String(environment.QUALITY_VERIFIER_PUBLIC_KEY_PATH),
      String(environment.QUALITY_VERIFIER_PUBLIC_KEY_SHA256),
      'verifier'
    );
    const baseUrl = canonicalJourneyBaseUrl(
      String(environment.QUALITY_JOURNEY_BASE_URL)
    );
    mkdirSync(resolve(evidenceRoot, 'trust'), { recursive: true });
    const agentKeyRelative = 'trust/agent-public-key.pem';
    const verifierKeyRelative = 'trust/verifier-public-key.pem';
    copyFileSync(
      resolve(String(environment.QUALITY_JOURNEY_AGENT_PUBLIC_KEY_PATH)),
      resolve(evidenceRoot, agentKeyRelative)
    );
    copyFileSync(
      resolve(String(environment.QUALITY_VERIFIER_PUBLIC_KEY_PATH)),
      resolve(evidenceRoot, verifierKeyRelative)
    );
    if (
      sha256Bytes(readFileSync(resolve(evidenceRoot, agentKeyRelative))) !==
        environment.QUALITY_JOURNEY_AGENT_PUBLIC_KEY_SHA256 ||
      sha256Bytes(readFileSync(resolve(evidenceRoot, verifierKeyRelative))) !==
        environment.QUALITY_VERIFIER_PUBLIC_KEY_SHA256
    ) {
      throw new Error('copied agent or verifier trust-root digest mismatch');
    }
    const resultSchemaBytes = readFileSync(resolve(contract.resultSchema));
    const scorer = object(contract.scorer, 'contract.scorer');
    const scorerOutput = object(
      scorer.outputSchema,
      'contract.scorer.outputSchema'
    );
    const execution = {
      command: contract.commands.run,
      toolVersions: contract.tools,
    };
    const startedAt = now();
    const agentEvidence: AgentCellOutput['verifierEvidence'][] = [];
    const trials = array(contract.trials, 'contract.trials').map(
      (trialValue) => {
        const trial = object(trialValue, 'contract trial');
        return {
          trialId: trial.trialId,
          persona: trial.persona,
          seed: trial.seed,
          tasks: array(trial.tasks, `${String(trial.trialId)}.tasks`).map(
            (taskValue) => {
              const cell = runAgentCell(
                evidenceRoot,
                contract,
                subjectSha,
                environmentId,
                trial,
                object(taskValue, 'contract task'),
                baseUrl,
                environment,
                agentPublicKey,
                execution
              );
              agentEvidence.push(cell.verifierEvidence);
              return cell.taskResult;
            }
          ),
        };
      }
    );
    let finishedAt = now();
    if (finishedAt <= startedAt) finishedAt = new Date(startedAt.valueOf() + 1);
    const result: RecordValue = {
      resultVersion: RESULT_VERSION,
      contractId,
      contractSha256,
      resultSchemaSha256: sha256Bytes(resultSchemaBytes),
      scorerSchemaSha256: scorerOutput.sha256,
      subjectSha,
      environmentId,
      producerId: PRODUCER_ID,
      agentTrust: {
        protocolVersion:
          MACHINE_JOURNEY_AGENT_INTERFACE.requiredProtocolVersion,
        agentId: environment.QUALITY_JOURNEY_AGENT_ID,
        publicKeyPath: agentKeyRelative,
        publicKeySha256: environment.QUALITY_JOURNEY_AGENT_PUBLIC_KEY_SHA256,
      },
      execution,
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      trials,
      verifierAttestation: null,
    };
    const resultPath = resolve(evidenceRoot, 'machine-journey-result.json');
    writeJson(resultPath, result);
    mkdirSync(resolve(evidenceRoot, 'verifier'), { recursive: true });
    const verifierRequestPath = resolve(
      evidenceRoot,
      'verifier',
      'request.json'
    );
    const verifierAttestationPath = resolve(
      evidenceRoot,
      'verifier',
      'attestation.json'
    );
    const verifierRequest = {
      requestVersion: MACHINE_JOURNEY_SIGNER_INTERFACE.interfaceVersion,
      verifierId: environment.QUALITY_VERIFIER_ID,
      keyId: environment.QUALITY_VERIFIER_KEY_ID,
      publicKeySha256: environment.QUALITY_VERIFIER_PUBLIC_KEY_SHA256,
      producerId: PRODUCER_ID,
      subjectSha,
      contractId,
      contractSha256,
      environmentId,
      baseUrl,
      resultIdentitySha256: machineJourneyResultIdentitySha256(result),
      expectedVerdict: 'PASS',
      independentReductionRequired: true,
      agentTrust: {
        protocolVersion:
          MACHINE_JOURNEY_AGENT_INTERFACE.requiredProtocolVersion,
        agentId: environment.QUALITY_JOURNEY_AGENT_ID,
        publicKeyPath: agentKeyRelative,
        publicKeySha256: environment.QUALITY_JOURNEY_AGENT_PUBLIC_KEY_SHA256,
      },
      agentEvidence,
    };
    writeJson(verifierRequestPath, verifierRequest);
    commandFailure(
      'independent verifier',
      String(environment.QUALITY_VERIFIER_COMMAND),
      [
        '--request',
        verifierRequestPath,
        '--result',
        resultPath,
        '--evidence-root',
        evidenceRoot,
        '--attestation',
        verifierAttestationPath,
      ],
      environment,
      120_000
    );
    const attestationBytes = readFileSync(verifierAttestationPath);
    const verifierAttestation: ArtifactBinding = {
      evidenceVersion: 'journey-artifact-v2',
      path: 'verifier/attestation.json',
      sha256: sha256Bytes(attestationBytes),
      bytes: attestationBytes.byteLength,
    };
    result.verifierAttestation = verifierAttestation;
    writeJson(resultPath, result);
    const reduction = reduceMachineJourney(result, {
      expectedSubjectSha: subjectSha,
      evidenceRoot,
      contractPath: options.contractPath,
      expectedEnvironmentId: environmentId,
      trustedVerifier: {
        verifierId: String(environment.QUALITY_VERIFIER_ID),
        keyId: String(environment.QUALITY_VERIFIER_KEY_ID),
        publicKeyPath: verifierKeyRelative,
        publicKeySha256: String(environment.QUALITY_VERIFIER_PUBLIC_KEY_SHA256),
      },
      trustedAgent: {
        protocolVersion:
          MACHINE_JOURNEY_AGENT_INTERFACE.requiredProtocolVersion,
        agentId: String(environment.QUALITY_JOURNEY_AGENT_ID),
        publicKeyPath: agentKeyRelative,
        publicKeySha256: String(
          environment.QUALITY_JOURNEY_AGENT_PUBLIC_KEY_SHA256
        ),
      },
      now: now(),
    });
    if (reduction.status !== 'PASS' || reduction.errors.length > 0) {
      throw new Error(
        `repository reducer did not return literal PASS: ${reduction.status}: ${reduction.errors.join('; ')}`
      );
    }
    const manifest: ProducerManifest = {
      producerResultVersion: 'machine-journey-producer-v1',
      status: 'PASS',
      subjectSha,
      environmentId,
      contractId,
      contractSha256,
      attemptId: currentAttemptId,
      reasonCode: 'REPOSITORY_REDUCER_PASS',
      reason:
        'All 45 uncoached agent cells and the independent verifier reduced to literal PASS.',
      resultPath: relative(evidenceRoot, resultPath).split(sep).join('/'),
      reduction,
      agentInterface: MACHINE_JOURNEY_AGENT_INTERFACE,
      verifierInterface: MACHINE_JOURNEY_SIGNER_INTERFACE,
      actualRuntime: runtimeManifestFields(),
    };
    writeManifest(evidenceRoot, manifest);
    return { manifest, exitCode: 0 };
  } catch (error) {
    if (!rootClaimed && !rootWasOccupied)
      mkdirSync(evidenceRoot, { recursive: true });
    const manifest: ProducerManifest = {
      producerResultVersion: 'machine-journey-producer-v1',
      status: 'FAIL',
      subjectSha,
      environmentId,
      contractId,
      contractSha256,
      attemptId: currentAttemptId,
      reasonCode: 'PRODUCER_OR_REDUCTION_FAILED',
      reason: error instanceof Error ? error.message : String(error),
      agentInterface: MACHINE_JOURNEY_AGENT_INTERFACE,
      verifierInterface: MACHINE_JOURNEY_SIGNER_INTERFACE,
      actualRuntime: runtimeManifestFields(),
    };
    if (
      !rootWasOccupied &&
      !existsSync(
        resolve(evidenceRoot, 'machine-journey-producer-manifest.json')
      )
    ) {
      writeManifest(evidenceRoot, manifest);
    }
    return { manifest, exitCode: 1 };
  }
}

function main(): void {
  const output = produceMachineJourney();
  const stream = output.exitCode === 1 ? process.stderr : process.stdout;
  stream.write(`${JSON.stringify(output.manifest, null, 2)}\n`);
  process.exitCode = output.exitCode;
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : '';
if (fileURLToPath(import.meta.url) === invokedPath) main();
