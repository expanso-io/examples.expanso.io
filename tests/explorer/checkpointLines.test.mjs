import assert from 'node:assert/strict';
import { it } from 'node:test';
import { checkpointLines } from '../../scripts/fixtures/checkpoint-lines.mjs';

it('compares nested fields by identity despite reordering and array expansion', () => {
  const input = {
    compliance: {
      original_fields: ['customer_id', 'customer_name'],
      applied: true,
    },
    unchanged: null,
  };
  const output = {
    unchanged: null,
    compliance: {
      fields_removed: ['customer_id', 'customer_name'],
      applied: true,
      original_fields: ['customer_id', 'customer_name'],
      verification_timestamp: '2026-10-05T18:00:00Z',
    },
  };
  const lines = checkpointLines(output, input);
  assert.deepEqual(
    JSON.parse(lines.map((line) => line.content).join('\n')),
    output
  );
  assert.equal(
    lines.find((line) => line.key === 'verification_timestamp').type,
    'added'
  );
  assert.equal(
    lines.find((line) => line.key === 'verification_timestamp').valueType,
    'string'
  );
  assert.equal(lines.find((line) => line.key === 'applied').type, 'normal');
  assert.equal(lines.find((line) => line.key === 'unchanged').type, 'normal');
  const duplicates = lines.filter((line) => line.content === '"customer_id",');
  assert.deepEqual(
    duplicates.map((line) => line.type),
    ['added', 'normal']
  );
  assert.ok(duplicates.every((line) => line.key === undefined));
});

it('marks removed input fields and changed values without conflating null or empty containers', () => {
  const input = { removed: ['value'], changed: 1, nullable: null, list: [] };
  const output = { changed: 2, nullable: null, list: {} };
  const inputLines = checkpointLines(input, output, 'removed');
  assert.equal(
    inputLines.find((line) => line.key === 'removed').type,
    'removed'
  );
  assert.equal(
    inputLines.find((line) => line.content === '"value"').type,
    'removed'
  );
  const outputLines = checkpointLines(output, input);
  assert.equal(
    outputLines.find((line) => line.key === 'changed').type,
    'highlighted'
  );
  assert.equal(
    outputLines.find((line) => line.key === 'nullable').type,
    'normal'
  );
  assert.equal(
    outputLines.find((line) => line.key === 'list').type,
    'highlighted'
  );
});
