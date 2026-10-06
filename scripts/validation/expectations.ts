import { createDecipheriv } from 'node:crypto';

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
