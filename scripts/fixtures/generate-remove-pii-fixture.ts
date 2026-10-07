#!/usr/bin/env tsx

import { createHash, createHmac } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { resolveInstalledExpansoBinary } from '../validation/expanso-binary';

const paths = {
  pipeline: 'examples/data-security/remove-pii-complete.yaml',
  input: 'examples/data-security/remove-pii/sample-data.json',
  environment: 'examples/data-security/remove-pii/fixture-environment.json',
  output: 'examples/data-security/remove-pii/expected-output.jsonl',
} as const;

const salts = {
  IP_SALT: 'remove-pii-fixture-ip-salt-v1',
  EMAIL_SALT: 'remove-pii-fixture-email-salt-v1',
  USER_SALT: 'remove-pii-fixture-user-salt-v1',
} as const;

const input = {
  event_id: 'evt_20240115_1030',
  timestamp: '2024-01-15T10:30:00Z',
  event_type: 'purchase',
  user_name: 'Sarah Johnson',
  email: 'sarah.johnson@example.com',
  ip_address: '192.168.1.100',
  payment_method: {
    type: 'credit_card',
    full_number: '4532-1234-5678-9010',
    expiry: '12/25',
    last_four: '9010',
  },
  location: {
    latitude: 37.7749,
    longitude: -122.4194,
    city: 'San Francisco',
    country: 'USA',
  },
  purchase_amount: 49.99,
  currency: 'USD',
};

function sha256(bytes: string | Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function hmac(value: string, salt: string): string {
  return createHmac('sha256', salt).update(value).digest('hex');
}

const inputBytes = `${JSON.stringify(input, null, 2)}\n`;

const output = {
  currency: input.currency,
  email_domain: input.email.split('@').at(-1),
  email_hash: hmac(input.email, salts.EMAIL_SALT),
  event_id: input.event_id,
  event_type: input.event_type,
  ip_hash: hmac(input.ip_address, salts.IP_SALT),
  location: {
    city: input.location.city,
    country: input.location.country,
  },
  payment_method: {
    last_four: input.payment_method.last_four,
    type: input.payment_method.type,
  },
  purchase_amount: input.purchase_amount,
  timestamp: input.timestamp,
  user_id: `user_${hmac(input.user_name, salts.USER_SALT).slice(0, 12)}`,
};

const outputBytes = `${JSON.stringify(output)}\n`;

const pipelineBytes = readFileSync(resolve(paths.pipeline));

const edge = resolveInstalledExpansoBinary('edge');

const environment = {
  schemaVersion: '1.0.0',
  executor: 'expanso-edge-local',
  version: edge.version,
  pipelineSha256: `sha256:${sha256(pipelineBytes)}`,
  inputSha256: `sha256:${sha256(inputBytes)}`,
  expectedOutputSha256: `sha256:${sha256(outputBytes)}`,
  environment: salts,
  timeoutsMs: {
    execution: 15000,
    output: 5000,
  },
};

const environmentBytes = `${JSON.stringify(environment, null, 2)}\n`;

const generated = new Map<string, string>([
  [paths.input, inputBytes],
  [paths.environment, environmentBytes],
  [paths.output, outputBytes],
]);

if (process.argv.slice(2).includes('--write')) {
  for (const [path, bytes] of generated) writeFileSync(resolve(path), bytes);
  process.stdout.write(
    `Wrote ${generated.size} deterministic fixture files.\n`
  );
} else {
  const mismatches = [...generated].filter(([path, bytes]) => {
    const committed = readFileSync(resolve(path), 'utf8');
    if (path !== paths.environment) return committed !== bytes;
    const normalizeVersion = (content: string) =>
      content.replace(
        /^  "version": "[^"\n]*",$/m,
        '  "version": "<execution-version>",'
      );
    return normalizeVersion(committed) !== normalizeVersion(bytes);
  });

  if (mismatches.length > 0) {
    throw new Error(
      `Remove PII fixture drift: ${mismatches.map(([path]) => path).join(', ')}`
    );
  }

  process.stdout.write('Remove PII synthetic fixture is deterministic.\n');
}
