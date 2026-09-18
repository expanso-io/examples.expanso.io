import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  validateYamlFiles,
  validateYamlSource,
} from '../../scripts/validate-yaml';

describe('strict YAML inventory validation', () => {
  it('accepts interpolation, block scalars, and unique mappings', () => {
    assert.deepEqual(
      validateYamlSource(`
pipeline:
  processors:
    - mapping: |
        root = this
output:
  file:
    path: "./events-${'${!timestamp_unix()}'}.jsonl"
`),
      []
    );
  });

  it('rejects invalid escapes in double-quoted scalars', () => {
    const findings = validateYamlSource(
      'message: "Unknown format: \\${!content()}"\n'
    );
    assert.equal(findings.length, 1);
    assert.match(findings[0].message, /invalid escape sequence/i);
  });

  it('rejects malformed indentation', () => {
    const findings = validateYamlSource(
      'output:\n  broker:\n    outputs:\n      - stdout: {}\n      fallback:\n        - file: {}\n'
    );
    assert.equal(findings.length, 1);
    assert.match(
      findings[0].message,
      /sequence item|implicit key|indent|mapping items/i
    );
  });

  it('rejects duplicate keys', () => {
    const findings = validateYamlSource('pipeline: {}\npipeline: {}\n');
    assert.equal(findings.length, 1);
    assert.match(findings[0].message, /map keys must be unique/i);
  });

  it('rejects empty and comment-only documents', () => {
    assert.match(validateYamlSource('')[0].message, /empty/i);
    assert.match(
      validateYamlSource('# no document\n')[0].message,
      /no YAML content/i
    );
  });

  it('fails closed when the inventory is empty', async () => {
    const result = await validateYamlFiles([]);
    assert.equal(result.status, 'FAIL');
    assert.match(result.findings[0].message, /inventory is empty/i);
  });
});
