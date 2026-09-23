import type { JsonLine, Stage } from '../components/DataPipelineExplorer/types';

type JsonObject = Record<string, unknown>;

interface CanonicalProcessor {
  mapping: string;
  yamlCode: string;
}

export interface CanonicalRemovePiiConfig {
  inputYaml: string;
  processors: readonly CanonicalProcessor[];
}

export const REMOVE_PII_FIDELITY_CONTRACT_ID =
  'remove-pii-explorer-fidelity-v1' as const;

const PROCESSOR_SIGNATURES = [
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

const STAGE_METADATA = [
  {
    slug: 'original-input',
    title: 'Step 1: Original Input',
    description:
      'Start with a synthetic purchase record containing payment, identity, network, and location fields.',
    removedKeys: [],
    highlightedKeys: [],
  },
  {
    slug: 'delete-payment-data',
    title: 'Step 2: Delete Payment Data',
    description:
      'Delete the full card number and expiry while retaining the last four digits.',
    removedKeys: ['full_number', 'expiry'],
    highlightedKeys: ['payment_method'],
  },
  {
    slug: 'hash-ip-address',
    title: 'Step 3: Hash IP Address',
    description:
      'Replace the source IP address with a keyed, hex-encoded HMAC-SHA-256 value.',
    removedKeys: ['ip_address'],
    highlightedKeys: ['ip_hash'],
  },
  {
    slug: 'hash-email',
    title: 'Step 4: Hash Email',
    description:
      'Replace the email with a keyed hash and retain its domain as a separate field.',
    removedKeys: ['email'],
    highlightedKeys: ['email_hash', 'email_domain'],
  },
  {
    slug: 'pseudonymize-user',
    title: 'Step 5: Pseudonymize User',
    description:
      'Replace the name with a stable pseudonymous identifier derived from the input.',
    removedKeys: ['user_name'],
    highlightedKeys: ['user_id'],
  },
  {
    slug: 'generalize-location',
    title: 'Step 6: Generalize Location',
    description:
      'Remove precise coordinates while retaining the fixture city and country.',
    removedKeys: ['latitude', 'longitude'],
    highlightedKeys: ['location'],
  },
] as const;

function normalizeMapping(mapping: string): string {
  return mapping.replace(/#.*$/gm, '').replace(/\s+/g, '');
}

function lineIndent(line: string): number {
  return line.length - line.trimStart().length;
}

function findUniqueLine(lines: readonly string[], value: string): number {
  const matches = lines.flatMap((line, index) =>
    line === value ? [index] : []
  );
  if (matches.length !== 1) {
    throw new Error(
      `Remove PII canonical config expected exactly one ${JSON.stringify(value)} line; found ${matches.length}`
    );
  }
  return matches[0];
}

function dedent(lines: readonly string[], spaces: number): string {
  const prefix = ' '.repeat(spaces);
  return lines
    .map((line) => (line.startsWith(prefix) ? line.slice(spaces) : line))
    .join('\n')
    .trimEnd();
}

export function parseCanonicalRemovePiiConfig(
  canonicalPipelineYaml: string
): CanonicalRemovePiiConfig {
  const lines = canonicalPipelineYaml.replace(/\r\n/g, '\n').split('\n');
  const inputStart = findUniqueLine(lines, '  input:');
  const pipelineStart = findUniqueLine(lines, '  pipeline:');
  const processorsStart = findUniqueLine(lines, '    processors:');
  const outputStart = findUniqueLine(lines, '  output:');

  if (
    !(
      inputStart < pipelineStart &&
      pipelineStart < processorsStart &&
      processorsStart < outputStart
    )
  ) {
    throw new Error('Remove PII canonical config sections are out of order');
  }

  const mappingStarts = lines.flatMap((line, index) =>
    index > processorsStart &&
    index < outputStart &&
    line === '      - mapping: |'
      ? [index]
      : []
  );
  if (mappingStarts.length !== PROCESSOR_SIGNATURES.length) {
    throw new Error(
      `Remove PII canonical config expected ${PROCESSOR_SIGNATURES.length} mapping processors; found ${mappingStarts.length}`
    );
  }

  const processors = mappingStarts.map((start, index) => {
    const end = lines.findIndex(
      (line, lineIndex) =>
        lineIndex > start && line.trim() !== '' && lineIndent(line) <= 6
    );
    const boundedEnd = end < 0 ? lines.length : end;
    if (boundedEnd > outputStart) {
      throw new Error(
        `Remove PII processor ${index + 1} crosses output config`
      );
    }
    const body = dedent(lines.slice(start + 1, boundedEnd), 10);
    const expected = PROCESSOR_SIGNATURES[index];
    if (normalizeMapping(body) !== normalizeMapping(expected)) {
      throw new Error(
        `Remove PII canonical processor ${index + 1} does not match fidelity contract ${REMOVE_PII_FIDELITY_CONTRACT_ID}`
      );
    }
    return {
      mapping: body,
      yamlCode: dedent(lines.slice(start, boundedEnd), 6),
    };
  });

  return {
    inputYaml: dedent(lines.slice(inputStart, pipelineStart), 2),
    processors,
  };
}

function isJsonObject(value: unknown): value is JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function requireObject(value: unknown, path: string): JsonObject {
  if (!isJsonObject(value)) {
    throw new Error(`Remove PII fixture ${path} must be an object`);
  }
  return value;
}

function requireString(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Remove PII fixture ${path} must be a non-empty string`);
  }
  return value;
}

function cloneRecord(record: JsonObject): JsonObject {
  return JSON.parse(JSON.stringify(record)) as JsonObject;
}

function parseJsonObject(source: string, path: string): JsonObject {
  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch (error) {
    throw new Error(
      `Remove PII fixture ${path} must be valid JSON: ${error instanceof Error ? error.message : String(error)}`
    );
  }
  return requireObject(parsed, path);
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (isJsonObject(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

export function buildRemovePiiCheckpoints(
  fixtureJson: string,
  fixtureEnvironmentJson: string,
  expectedOutputJsonl: string
): readonly JsonObject[] {
  const fixture = parseJsonObject(fixtureJson, '$');
  const fixtureEnvironment = parseJsonObject(
    fixtureEnvironmentJson,
    'fixture-environment.json'
  );
  const environment = requireObject(
    fixtureEnvironment.environment,
    'fixture-environment.json.environment'
  );
  for (const key of ['IP_SALT', 'EMAIL_SALT', 'USER_SALT'] as const) {
    requireString(
      environment[key],
      `fixture-environment.json.environment.${key}`
    );
  }
  const expectedLines = expectedOutputJsonl.trim().split('\n');
  if (expectedLines.length !== 1) {
    throw new Error(
      'Remove PII expected output must contain exactly one JSONL record'
    );
  }
  const expectedOutput = parseJsonObject(
    expectedLines[0],
    'expected-output.jsonl'
  );
  const email = requireString(fixture.email, '$.email');
  requireString(fixture.ip_address, '$.ip_address');
  requireString(fixture.user_name, '$.user_name');
  const expectedIpHash = requireString(
    expectedOutput.ip_hash,
    'expected-output.jsonl.ip_hash'
  );
  const expectedEmailHash = requireString(
    expectedOutput.email_hash,
    'expected-output.jsonl.email_hash'
  );
  const expectedUserId = requireString(
    expectedOutput.user_id,
    'expected-output.jsonl.user_id'
  );
  if (!/^[0-9a-f]{64}$/.test(expectedIpHash)) {
    throw new Error('Remove PII expected IP hash must be 64 lowercase hex');
  }
  if (!/^[0-9a-f]{64}$/.test(expectedEmailHash)) {
    throw new Error('Remove PII expected email hash must be 64 lowercase hex');
  }
  if (!/^user_[0-9a-f]{12}$/.test(expectedUserId)) {
    throw new Error('Remove PII expected user id must be user_ plus 12 hex');
  }

  const checkpoints: JsonObject[] = [cloneRecord(fixture)];

  const paymentRemoved = cloneRecord(checkpoints.at(-1)!);
  const paymentMethod = requireObject(
    paymentRemoved.payment_method,
    '$.payment_method'
  );
  delete paymentMethod.full_number;
  delete paymentMethod.expiry;
  checkpoints.push(paymentRemoved);

  const ipHashed = cloneRecord(checkpoints.at(-1)!);
  delete ipHashed.ip_address;
  ipHashed.ip_hash = expectedIpHash;
  checkpoints.push(ipHashed);

  const emailHashed = cloneRecord(checkpoints.at(-1)!);
  delete emailHashed.email;
  emailHashed.email_hash = expectedEmailHash;
  emailHashed.email_domain = email.split('@')[1];
  checkpoints.push(emailHashed);

  const userPseudonymized = cloneRecord(checkpoints.at(-1)!);
  delete userPseudonymized.user_name;
  userPseudonymized.user_id = expectedUserId;
  checkpoints.push(userPseudonymized);

  const locationGeneralized = cloneRecord(checkpoints.at(-1)!);
  const location = requireObject(locationGeneralized.location, '$.location');
  delete location.latitude;
  delete location.longitude;
  checkpoints.push(locationGeneralized);

  if (canonicalJson(locationGeneralized) !== canonicalJson(expectedOutput)) {
    throw new Error(
      'Remove PII generated final checkpoint does not match expected-output.jsonl'
    );
  }

  return checkpoints;
}

function jsonLines(
  value: JsonObject,
  markedKeys: readonly string[],
  type: JsonLine['type']
): JsonLine[] {
  const marked = new Set(markedKeys);
  return JSON.stringify(value, null, 2)
    .split('\n')
    .map((line) => {
      const leadingSpaces = line.length - line.trimStart().length;
      const content = line.trimStart();
      const key = content.match(/^"([^"]+)":/)?.[1];
      return {
        content,
        indent: leadingSpaces / 2,
        ...(key === undefined ? {} : { key }),
        ...(key !== undefined && marked.has(key) ? { type } : {}),
      };
    });
}

export function buildRemovePiiExplorerStages(
  canonicalPipelineYaml: string,
  fixtureJson: string,
  fixtureEnvironmentJson: string,
  expectedOutputJsonl: string
): Stage[] {
  const canonical = parseCanonicalRemovePiiConfig(canonicalPipelineYaml);
  const checkpoints = buildRemovePiiCheckpoints(
    fixtureJson,
    fixtureEnvironmentJson,
    expectedOutputJsonl
  );

  return STAGE_METADATA.map((metadata, index) => {
    const input = index === 0 ? checkpoints[0] : checkpoints[index - 1];
    const output = checkpoints[index];
    return {
      id: index + 1,
      slug: metadata.slug,
      title: metadata.title,
      description: metadata.description,
      yamlFilename:
        index === 0
          ? 'remove-pii-complete.yaml#config-input'
          : `remove-pii-complete.yaml#processor-${index}`,
      yamlCode:
        index === 0
          ? canonical.inputYaml
          : canonical.processors[index - 1].yamlCode,
      inputLines: jsonLines(input, metadata.removedKeys, 'removed'),
      outputLines: jsonLines(output, metadata.highlightedKeys, 'highlighted'),
    };
  });
}
