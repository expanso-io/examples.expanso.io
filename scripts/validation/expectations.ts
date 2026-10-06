import { createDecipheriv } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { Type } from 'avsc';
import assert from 'node:assert/strict';

export interface RecordCheck {
  match?: Record<string, unknown>;
  equals?: Record<string, unknown>;
  present?: string[];
  absent?: string[];
}

export interface OutputExpectation {
  count?: number;
  format?: 'jsonl' | 'avro' | 'parquet' | 'gzip';
  unwrap?: string;
  records?: RecordCheck[];
  every?: RecordCheck;
  invariant?: string;
}

export interface RecordsExpectation {
  kind: 'records';
  outputs: OutputExpectation[];
}

export type Expectation = EncryptionExpectation | RecordsExpectation;

export const SENSOR_READING_SCHEMA = {
  type: 'record',
  name: 'SensorReading',
  fields: [
    { name: 'sensor_id', type: 'string' },
    { name: 'location', type: 'string' },
    { name: 'temperature', type: 'double' },
    { name: 'humidity', type: 'double' },
    { name: 'timestamp', type: 'string' },
    { name: 'device_type', type: 'string' },
    { name: 'firmware_version', type: 'string' },
  ],
} as const;

export interface EncryptionExpectation {
  kind: 'encryption';
  fields: Array<{
    source: string;
    ciphertext: string;
    nonce: string;
    key: string;
  }>;
  removed: string[];
}

function valueAt(record: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((value, key) => {
    if (!value || typeof value !== 'object') return undefined;
    return (value as Record<string, unknown>)[key];
  }, record);
}

function subset(actual: unknown, expected: unknown): boolean {
  if (expected && typeof expected === 'object' && !Array.isArray(expected)) {
    if (!actual || typeof actual !== 'object') return false;
    return Object.entries(expected).every(([key, value]) =>
      subset(valueAt(actual, key), value)
    );
  }
  try {
    assert.deepEqual(actual, expected);
    return true;
  } catch {
    return false;
  }
}

function checkRecord(row: unknown, check: RecordCheck): void {
  for (const [path, value] of Object.entries(check.equals ?? {})) {
    assert.ok(
      subset(valueAt(row, path), value),
      `unexpected ${path}: ${JSON.stringify(valueAt(row, path))}`
    );
  }
  for (const path of check.present ?? [])
    assert.notEqual(valueAt(row, path), undefined, `missing ${path}`);
  for (const path of check.absent ?? [])
    assert.equal(valueAt(row, path), undefined, `unexpected ${path}`);
}

function decodeOutput(text: string, contract: OutputExpectation): unknown[] {
  const lines = text.split('\n').filter((line) => line.trim());
  let records: unknown[];
  if (contract.format === 'avro') {
    const schema = Type.forSchema(
      JSON.parse(JSON.stringify(SENSOR_READING_SCHEMA))
    );
    records = lines.map((line) =>
      schema.fromBuffer(Buffer.from(line, 'base64'))
    );
  } else if (contract.format === 'gzip') {
    records = lines.flatMap((line) =>
      gunzipSync(Buffer.from(line, 'base64'))
        .toString('utf8')
        .split('\n')
        .filter(Boolean)
        .map((value) => JSON.parse(value))
    );
  } else records = lines.flatMap((line) => JSON.parse(line));
  if (contract.unwrap)
    records = records.map((row) =>
      JSON.parse(String(valueAt(row, contract.unwrap!)))
    );
  return records;
}

function numberAt(row: unknown, field: string): number {
  const value = valueAt(row, field);
  assert.equal(typeof value, 'number', `non-number ${field}`);
  assert.ok(Number.isFinite(value), `non-finite ${field}`);
  return value as number;
}

function invariant(row: unknown, name: string): void {
  if (name === 'priority-age-score') {
    const boost = numberAt(row, 'age_boost_applied');
    assert.ok(boost >= 0 && boost <= 30);
    assert.equal(
      numberAt(row, 'final_score'),
      numberAt(row, 'priority_score') + boost
    );
  } else if (name === 'buffer-age-score') {
    const age = numberAt(row, 'age_seconds');
    const boost = numberAt(row, 'age_boost');
    assert.ok(age >= 0 && boost >= 0);
    const tier = numberAt(row, 'priority_tier');
    assert.equal(
      numberAt(row, 'priority_score'),
      (tier === 1 ? 1000 : tier === 2 ? 500 : 100) + boost
    );
    assert.equal(valueAt(row, 'age_escalated'), boost > 0);
  } else if (name === 'sensor-foundation') {
    assert.match(String(valueAt(row, 'sensor_id')), /^sensor-[0-9]$/);
    const temperature = numberAt(row, 'temperature');
    assert.ok(temperature >= 20 && temperature <= 29);
    assert.ok(Number.isFinite(Date.parse(String(valueAt(row, 'timestamp')))));
  } else if (name === 'dedup-foundation') {
    assert.match(String(valueAt(row, 'event_id')), /^evt-[0-9]{1,2}$/);
  } else if (name === 'filtering-foundation') {
    assert.ok(
      [
        '{"timestamp": "2025-11-22T23:50:00Z", "level": "INFO", "message": "Structured log"}',
        'This is a simple plain text log',
      ].includes(String(valueAt(row, 'message')))
    );
  } else if (name === 'generated-log') {
    assert.match(String(valueAt(row, 'id')), /^[a-f0-9-]{36}$/);
    assert.match(String(valueAt(row, 'request_id')), /^[a-f0-9-]{36}$/);
    assert.ok(
      ['INFO', 'WARN', 'ERROR', 'FATAL'].includes(String(valueAt(row, 'level')))
    );
    assert.ok(
      [
        'auth',
        'payment',
        'user',
        'auth-service',
        'payment-service',
        'user-service',
      ].includes(String(valueAt(row, 'service')))
    );
    assert.ok(
      numberAt(row, 'duration_ms') >= 50 && numberAt(row, 'duration_ms') <= 5049
    );
  } else if (name === 'enrich-export') {
    assert.equal(
      valueAt(row, 'metadata.quality.is_error'),
      valueAt(row, 'event.application.level') === 'ERROR'
    );
    assert.equal(numberAt(row, 'metadata.quality.completeness_score'), 1);
    assert.ok(
      ['INFO', 'WARN', 'ERROR'].includes(
        String(valueAt(row, 'event.application.level'))
      )
    );
    assert.ok(
      numberAt(row, 'event.application.duration_ms') >= 50 &&
        numberAt(row, 'event.application.duration_ms') <= 5049
    );
  } else if (name === 'retail') {
    const items = JSON.parse(String(valueAt(row, 'items_json'))) as Array<{
      qty: number;
      unit_price: number;
    }>;
    const round = (value: number) => Math.round(value * 100) / 100;
    const total = round(
      items.reduce((sum, item) => sum + item.qty * item.unit_price, 0)
    );
    const sign = valueAt(row, 'type') === 'return' ? -1 : 1;
    assert.equal(numberAt(row, 'subtotal'), sign * total);
    assert.equal(numberAt(row, 'tax_amount'), sign * round(total * 0.0875));
    assert.equal(
      numberAt(row, 'total_amount'),
      round(numberAt(row, 'subtotal') + numberAt(row, 'tax_amount'))
    );
    assert.equal(numberAt(row, 'basket_size'), items.length);
    assert.equal(numberAt(row, 'item_count'), items.length);
    assert.equal(numberAt(row, 'avg_item_price'), round(total / items.length));
    assert.equal(
      valueAt(row, 'is_anomaly'),
      JSON.parse(String(valueAt(row, 'anomaly_flags'))).length > 0
    );
  } else throw new Error(`unknown output invariant: ${name}`);
}

export function verifyOutputs(
  expectation: Expectation,
  inputs: readonly unknown[],
  outputTexts: readonly string[],
  environment: Readonly<Record<string, string>>
): void {
  if (expectation.kind === 'encryption') {
    verifyEncryption(
      expectation,
      inputs,
      outputTexts.flatMap((text) => decodeOutput(text, {})),
      environment
    );
    return;
  }
  assert.equal(
    outputTexts.length,
    expectation.outputs.length,
    'output destination count'
  );
  const decoded = expectation.outputs.map((contract, index) => {
    const rows = decodeOutput(outputTexts[index], contract);
    if (contract.count !== undefined)
      assert.equal(
        rows.length,
        contract.count,
        `record count at output ${index}`
      );
    const available = new Set(rows.map((_, index) => index));
    for (const record of contract.records ?? []) {
      const index = [...available].find((index) => {
        try {
          checkRecord(rows[index], { equals: record.match ?? record.equals });
          return true;
        } catch {
          return false;
        }
      });
      assert.notEqual(
        index,
        undefined,
        `missing expected record at output ${index}`
      );
      checkRecord(rows[index!], record);
      available.delete(index!);
    }
    for (const row of rows) {
      if (contract.every) checkRecord(row, contract.every);
      if (contract.invariant) invariant(row, contract.invariant);
    }
    return rows;
  });
  if (
    expectation.outputs.some((output) => output.invariant === 'enrich-export')
  ) {
    const errors = decoded[0].filter(
      (row) => valueAt(row, 'event.application.level') === 'ERROR'
    );
    assert.deepEqual(
      decoded[1],
      errors,
      'error stream differs from primary errors'
    );
  }
}

export function verifyEncryption(
  expectation: EncryptionExpectation,
  inputs: readonly unknown[],
  outputs: readonly unknown[],
  environment: Readonly<Record<string, string>>
): void {
  if (
    expectation.kind !== 'encryption' ||
    expectation.fields.length === 0 ||
    inputs.length === 0
  )
    throw new Error(
      'encryption expectation requires fields and fixture records'
    );
  const nonces = new Map<string, string>();
  for (const input of inputs) {
    const id = valueAt(input, 'transaction_id');
    if (typeof id !== 'string') throw new Error('fixture lacks transaction_id');
    const matches = outputs.filter(
      (row) => valueAt(row, 'transaction_id') === id
    );
    if (matches.length === 0) throw new Error(`no encrypted output for ${id}`);
    for (const output of matches) {
      for (const path of expectation.removed) {
        if (valueAt(output, path) !== undefined)
          throw new Error(`plaintext remains at ${path}`);
      }
      for (const field of expectation.fields) {
        const plaintext = valueAt(input, field.source);
        if (plaintext === undefined) continue;
        const ciphertext = valueAt(output, field.ciphertext);
        const nonce = valueAt(output, field.nonce);
        const key = environment[field.key];
        if (typeof ciphertext !== 'string' || typeof nonce !== 'string' || !key)
          throw new Error(`missing encryption material for ${field.source}`);
        const iv = Buffer.from(nonce, 'base64');
        if (iv.length !== 12)
          throw new Error(`invalid nonce for ${field.source}`);
        const identity = `${id}:${field.source}`;
        const nonceKey = `${key}:${nonce}`;
        const previous = nonces.get(nonceKey);
        if (previous && previous !== identity)
          throw new Error(`reused nonce for ${field.source}`);
        nonces.set(nonceKey, identity);
        const bytes = Buffer.from(ciphertext, 'base64');
        const decipher = createDecipheriv('aes-256-gcm', Buffer.from(key), iv);
        decipher.setAuthTag(bytes.subarray(-16));
        const decoded = Buffer.concat([
          decipher.update(bytes.subarray(0, -16)),
          decipher.final(),
        ]).toString('utf8');
        if (decoded !== String(plaintext))
          throw new Error(`decryption mismatch for ${field.source}`);
      }
    }
  }
}
