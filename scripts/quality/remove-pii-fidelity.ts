import { createHash, createHmac } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';

import {
  buildRemovePiiExplorerStages,
  REMOVE_PII_FIDELITY_CONTRACT_ID,
} from '../../src/catalog/removePiiFidelity';
import type { Stage } from '../../src/components/DataPipelineExplorer/types';

type JsonObject = Record<string, unknown>;

export interface RemovePiiFidelityInput {
  canonicalPipelineYaml: string;
  fixtureJson: string;
  fixtureEnvironmentJson: string;
  expectedOutputJsonl: string;
  stageModuleSource: string;
  stages?: readonly Stage[];
}

export interface RemovePiiFidelityResult {
  contractId: typeof REMOVE_PII_FIDELITY_CONTRACT_ID;
  processorsVerified: 5;
  checkpointsVerified: 6;
  stageInputsVerified: 6;
  stageOutputsVerified: 6;
  fixtureBindingsVerified: 3;
  environmentValuesVerified: 3;
  status: 'PASS';
}

const EXPECTED_GENERATOR_WIRING = `
  import canonicalPipelineYaml from '!!raw-loader!../../examples/data-security/remove-pii-complete.yaml';
  import expectedOutputJsonl from '!!raw-loader!../../examples/data-security/remove-pii/expected-output.jsonl';
  import canonicalFixture from '../../examples/data-security/remove-pii/sample-data.json';
  import fixtureEnvironment from '../../examples/data-security/remove-pii/fixture-environment.json';
  import { buildRemovePiiExplorerStages } from '@site/src/catalog/removePiiFidelity';
  const generatedStages = buildRemovePiiExplorerStages(
    canonicalPipelineYaml,
    JSON.stringify(canonicalFixture),
    JSON.stringify(fixtureEnvironment),
    expectedOutputJsonl
  );
`;

const EXPECTED_PROCESSOR_MAPPINGS = [
  `
    root = this
    root.payment_method = this.payment_method.without(
      "full_number",
      "expiry"
    )
  `,
  `
    root = this.without("ip_address")
    root.ip_hash = this.ip_address.hash(
      "hmac_sha256",
      env("IP_SALT")
    ).encode("hex")
  `,
  `
    root = this.without("email")
    root.email_hash = this.email.hash(
      "hmac_sha256",
      env("EMAIL_SALT")
    ).encode("hex")
    root.email_domain = this.email.split("@").index(1)
  `,
  `
    root = this.without("user_name")
    root.user_id = "user_" + this.user_name.hash(
      "hmac_sha256",
      env("USER_SALT")
    ).encode("hex").slice(0, 12)
  `,
  `
    root = this
    root.location = this.location.without("latitude", "longitude")
  `,
] as const;

function fail(message: string): never {
  throw new Error(`Remove PII Explorer fidelity failed: ${message}`);
}

function compactSource(source: string): string {
  return source.replace(/\s+/g, '');
}

function verifyStageModuleWiring(source: string): void {
  const compact = compactSource(source);
  if (!compact.includes(compactSource(EXPECTED_GENERATOR_WIRING))) {
    fail('stage module is not the audited canonical-byte generator wiring');
  }
  if (/\.\.\.|\.map\(|\.pop\(|\.push\(|\.splice\(/.test(source)) {
    fail('stage module may not transform generated stage data');
  }
  if ((source.match(/removePiiFullStages/g) ?? []).length !== 1) {
    fail('stage module must expose exactly one immutable stage manifest');
  }
  for (let index = 0; index < 6; index += 1) {
    for (const field of [
      'id',
      'slug',
      'inputLines',
      'outputLines',
      'yamlCode',
      'yamlFilename',
    ]) {
      if (!compact.includes(`${field}:generatedStages[${index}].${field}`)) {
        fail(`stage ${index + 1} does not bind generated ${field}`);
      }
    }
  }
}

function normalizeMapping(mapping: string): string {
  return mapping.replace(/#.*$/gm, '').replace(/\s+/g, '');
}

function indentation(line: string): number {
  return line.length - line.trimStart().length;
}

function dedent(lines: readonly string[], spaces: number): string {
  const prefix = ' '.repeat(spaces);
  return lines
    .map((line) => (line.startsWith(prefix) ? line.slice(spaces) : line))
    .join('\n')
    .trimEnd();
}

function uniqueLine(lines: readonly string[], value: string): number {
  const indexes = lines.flatMap((line, index) =>
    line === value ? [index] : []
  );
  if (indexes.length !== 1) {
    fail(`expected exactly one ${JSON.stringify(value)} line`);
  }
  return indexes[0];
}

function independentlyExtractCanonical(canonicalPipelineYaml: string): {
  inputYaml: string;
  mappings: string[];
  processorYaml: string[];
} {
  const lines = canonicalPipelineYaml.replace(/\r\n/g, '\n').split('\n');
  const input = uniqueLine(lines, '  input:');
  const pipeline = uniqueLine(lines, '  pipeline:');
  const processors = uniqueLine(lines, '    processors:');
  const output = uniqueLine(lines, '  output:');
  if (!(input < pipeline && pipeline < processors && processors < output)) {
    fail('canonical config section order changed');
  }
  const starts = lines.flatMap((line, index) =>
    index > processors && index < output && line === '      - mapping: |'
      ? [index]
      : []
  );
  if (starts.length !== 5) {
    fail(`expected 5 canonical processors; found ${starts.length}`);
  }
  const mappings: string[] = [];
  const processorYaml: string[] = [];
  for (const start of starts) {
    const nextBoundary = lines.findIndex(
      (line, index) =>
        index > start && line.trim() !== '' && indentation(line) <= 6
    );
    const end = nextBoundary < 0 ? lines.length : nextBoundary;
    if (end > output) fail('a canonical processor crosses the output block');
    mappings.push(dedent(lines.slice(start + 1, end), 10));
    processorYaml.push(dedent(lines.slice(start, end), 6));
  }
  return {
    inputYaml: dedent(lines.slice(input, pipeline), 2),
    mappings,
    processorYaml,
  };
}

function object(value: unknown, path: string): JsonObject {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    fail(`${path} must be an object`);
  }
  return value as JsonObject;
}

function string(value: unknown, path: string): string {
  if (typeof value !== 'string') fail(`${path} must be a string`);
  return value;
}

function clone(record: JsonObject): JsonObject {
  return JSON.parse(JSON.stringify(record)) as JsonObject;
}

function hmacSha256Hex(value: string, key: string): string {
  return createHmac('sha256', key).update(value).digest('hex');
}

function sha256(source: string): string {
  return `sha256:${createHash('sha256').update(source).digest('hex')}`;
}

function independentlyBuildCheckpoints(
  fixtureJson: string,
  fixtureEnvironmentJson: string,
  expectedOutputJsonl: string,
  canonicalPipelineYaml: string
): JsonObject[] {
  let fixtureValue: unknown;
  try {
    fixtureValue = JSON.parse(fixtureJson);
  } catch (error) {
    fail(
      `fixture is not valid JSON: ${error instanceof Error ? error.message : String(error)}`
    );
  }
  const fixture = object(fixtureValue, '$');
  let fixtureEnvironmentValue: unknown;
  try {
    fixtureEnvironmentValue = JSON.parse(fixtureEnvironmentJson);
  } catch (error) {
    fail(
      `fixture environment is not valid JSON: ${error instanceof Error ? error.message : String(error)}`
    );
  }
  const fixtureEnvironment = object(
    fixtureEnvironmentValue,
    'fixture-environment.json'
  );
  if (fixtureEnvironment.pipelineSha256 !== sha256(canonicalPipelineYaml)) {
    fail('fixture environment pipeline digest does not bind canonical YAML');
  }
  if (fixtureEnvironment.inputSha256 !== sha256(fixtureJson)) {
    fail('fixture environment input digest does not bind sample data');
  }
  if (fixtureEnvironment.expectedOutputSha256 !== sha256(expectedOutputJsonl)) {
    fail('fixture environment output digest does not bind expected JSONL');
  }
  const environment = object(
    fixtureEnvironment.environment,
    'fixture-environment.json.environment'
  );
  const ipSalt = string(environment.IP_SALT, 'environment.IP_SALT');
  const emailSalt = string(environment.EMAIL_SALT, 'environment.EMAIL_SALT');
  const userSalt = string(environment.USER_SALT, 'environment.USER_SALT');
  const expectedOutputLines = expectedOutputJsonl.trim().split('\n');
  if (expectedOutputLines.length !== 1) {
    fail('expected output must contain exactly one JSONL record');
  }
  let expectedOutputValue: unknown;
  try {
    expectedOutputValue = JSON.parse(expectedOutputLines[0]);
  } catch (error) {
    fail(
      `expected output is not valid JSONL: ${error instanceof Error ? error.message : String(error)}`
    );
  }
  const expectedOutput = object(expectedOutputValue, 'expected-output.jsonl');
  const ipAddress = string(fixture.ip_address, '$.ip_address');
  const email = string(fixture.email, '$.email');
  const userName = string(fixture.user_name, '$.user_name');

  const checkpoints = [clone(fixture)];

  const paymentRemoved = clone(checkpoints.at(-1)!);
  const payment = object(paymentRemoved.payment_method, '$.payment_method');
  delete payment.full_number;
  delete payment.expiry;
  checkpoints.push(paymentRemoved);

  const ipHashed = clone(checkpoints.at(-1)!);
  delete ipHashed.ip_address;
  ipHashed.ip_hash = hmacSha256Hex(ipAddress, ipSalt);
  checkpoints.push(ipHashed);

  const emailHashed = clone(checkpoints.at(-1)!);
  delete emailHashed.email;
  emailHashed.email_hash = hmacSha256Hex(email, emailSalt);
  emailHashed.email_domain = email.split('@')[1];
  checkpoints.push(emailHashed);

  const userPseudonymized = clone(checkpoints.at(-1)!);
  delete userPseudonymized.user_name;
  userPseudonymized.user_id = `user_${hmacSha256Hex(userName, userSalt).slice(
    0,
    12
  )}`;
  checkpoints.push(userPseudonymized);

  const locationGeneralized = clone(checkpoints.at(-1)!);
  const location = object(locationGeneralized.location, '$.location');
  delete location.latitude;
  delete location.longitude;
  checkpoints.push(locationGeneralized);

  expectDeepEqual(
    locationGeneralized,
    expectedOutput,
    'fixture expected output'
  );

  return checkpoints;
}

function decodeDisplayedJson(
  lines: Stage['inputLines'] | Stage['outputLines'],
  label: string
): JsonObject {
  const rendered = lines
    .map((line) => `${'  '.repeat(line.indent)}${line.content}`)
    .join('\n');
  try {
    return object(JSON.parse(rendered), label);
  } catch (error) {
    fail(
      `${label} is not valid displayed JSON: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

function expectDeepEqual(actual: unknown, expected: unknown, label: string) {
  if (!isDeepStrictEqual(actual, expected)) {
    fail(`${label} does not match the independently computed checkpoint`);
  }
}

export function verifyRemovePiiExplorerFidelity(
  input: RemovePiiFidelityInput
): RemovePiiFidelityResult {
  verifyStageModuleWiring(input.stageModuleSource);
  const canonical = independentlyExtractCanonical(input.canonicalPipelineYaml);
  canonical.mappings.forEach((mapping, index) => {
    if (
      normalizeMapping(mapping) !==
      normalizeMapping(EXPECTED_PROCESSOR_MAPPINGS[index])
    ) {
      fail(`canonical processor ${index + 1} changed or is out of order`);
    }
  });

  const expectedCheckpoints = independentlyBuildCheckpoints(
    input.fixtureJson,
    input.fixtureEnvironmentJson,
    input.expectedOutputJsonl,
    input.canonicalPipelineYaml
  );

  const stages =
    input.stages ??
    buildRemovePiiExplorerStages(
      input.canonicalPipelineYaml,
      input.fixtureJson,
      input.fixtureEnvironmentJson,
      input.expectedOutputJsonl
    );
  if (stages.length !== 6) {
    fail(`expected 6 Explorer stages; found ${stages.length}`);
  }

  stages.forEach((stage, index) => {
    const expectedInput =
      index === 0 ? expectedCheckpoints[0] : expectedCheckpoints[index - 1];
    const expectedOutput = expectedCheckpoints[index];
    if (stage.id !== index + 1) {
      fail(`stage ${index + 1} has id ${stage.id}`);
    }
    const expectedSlug = [
      'original-input',
      'delete-payment-data',
      'hash-ip-address',
      'hash-email',
      'pseudonymize-user',
      'generalize-location',
    ][index];
    if (stage.slug !== expectedSlug) {
      fail(`stage ${index + 1} has unstable slug ${stage.slug}`);
    }
    const expectedFilename =
      index === 0
        ? 'remove-pii-complete.yaml#config-input'
        : `remove-pii-complete.yaml#processor-${index}`;
    if (stage.yamlFilename !== expectedFilename) {
      fail(
        `stage ${index + 1} does not identify its canonical config fragment`
      );
    }
    const expectedYaml =
      index === 0 ? canonical.inputYaml : canonical.processorYaml[index - 1];
    if (stage.yamlCode !== expectedYaml) {
      fail(`stage ${index + 1} YAML is not the exact canonical fragment`);
    }
    const displayedInput = decodeDisplayedJson(
      stage.inputLines,
      `stage ${index + 1} input`
    );
    const displayedOutput = decodeDisplayedJson(
      stage.outputLines,
      `stage ${index + 1} output`
    );
    expectDeepEqual(displayedInput, expectedInput, `stage ${index + 1} input`);
    expectDeepEqual(
      displayedOutput,
      expectedOutput,
      `stage ${index + 1} output`
    );
    if (index > 0) {
      const previousOutput = decodeDisplayedJson(
        stages[index - 1].outputLines,
        `stage ${index} output`
      );
      expectDeepEqual(
        displayedInput,
        previousOutput,
        `stage ${index + 1} input continuity`
      );
    }
  });

  return {
    contractId: REMOVE_PII_FIDELITY_CONTRACT_ID,
    processorsVerified: 5,
    checkpointsVerified: 6,
    stageInputsVerified: 6,
    stageOutputsVerified: 6,
    fixtureBindingsVerified: 3,
    environmentValuesVerified: 3,
    status: 'PASS',
  };
}
