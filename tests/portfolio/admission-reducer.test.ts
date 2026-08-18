import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { after, describe, it } from 'node:test';

import { reducePortfolioAdmission } from '../../scripts/portfolio/reduce-admission';

type RecordValue = Record<string, unknown>;

const RESULT_PATH =
  'tests/prototypes/industrial-vision/admission-result-v1.json';
const tempRoot = mkdtempSync(join(tmpdir(), 'portfolio-admission-test-'));
let sequence = 0;

after(() => rmSync(tempRoot, { recursive: true, force: true }));

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && !Array.isArray(value) && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as RecordValue)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalize(entry)])
    );
  }
  return value;
}

function resultFixture(): RecordValue {
  return JSON.parse(readFileSync(resolve(RESULT_PATH), 'utf8')) as RecordValue;
}

function writeMutatedResult(mutate: (result: RecordValue) => void): string {
  const result = structuredClone(resultFixture());
  mutate(result);
  result.resultSha256 = createHash('sha256')
    .update(
      JSON.stringify(canonicalize({ ...result, resultSha256: '0'.repeat(64) }))
    )
    .digest('hex');
  sequence += 1;
  const path = join(tempRoot, `${sequence}.json`);
  writeFileSync(path, `${JSON.stringify(result, null, 2)}\n`);
  return path;
}

describe('Portfolio admission fail-closed reducer', () => {
  it('derives a non-public prototype disposition from all 12 evidenced answers', () => {
    const reduction = reducePortfolioAdmission({
      now: new Date('2026-07-18T12:31:00.000Z'),
    });

    assert.deepEqual(reduction, {
      reductionVersion: '1.0.0',
      contractId: 'portfolio-admission-v1',
      contractSha256:
        '57d87c3c5e6b4b9933e22796ece0b5a48ed7bb7ef9adae9af8a095f537f8fbcb',
      admissionResultId: 'industrial-vision-media-ai-spine-admission-v1',
      candidateId: 'industrial-vision-media-ai-spine-v1',
      declaredDisposition: 'prototype',
      derivedDisposition: 'prototype',
      status: 'PASS',
      errors: [],
    });
  });

  it('fails when any of the 12 admission answers is missing', () => {
    const path = writeMutatedResult((result) => {
      result.answers = (result.answers as RecordValue[]).filter(
        (answer) => answer.questionId !== 'Q10'
      );
    });
    const reduction = reducePortfolioAdmission({
      resultPath: path,
      now: new Date('2026-07-18T12:31:00.000Z'),
    });

    assert.equal(reduction.status, 'FAIL');
    assert.equal(reduction.derivedDisposition, 'defer');
    assert.ok(
      reduction.errors.some((error) =>
        error.includes('answer each of the 12 questions exactly once')
      )
    );
  });

  it('fails when a blocking answer is not PASS', () => {
    const path = writeMutatedResult((result) => {
      const answer = (result.answers as RecordValue[]).find(
        (entry) => entry.questionId === 'Q3'
      )!;
      answer.outcome = 'DEFER';
    });
    const reduction = reducePortfolioAdmission({
      resultPath: path,
      now: new Date('2026-07-18T12:31:00.000Z'),
    });

    assert.equal(reduction.status, 'FAIL');
    assert.equal(reduction.derivedDisposition, 'defer');
    assert.ok(
      reduction.errors.includes('Blocking admission question is not PASS: Q3')
    );
  });

  it('fails when configured producer and verifier review lanes collide', () => {
    const path = writeMutatedResult((result) => {
      const lanes = result.configuredReviewLanes as RecordValue;
      const producer = lanes.producer as RecordValue;
      const verifier = lanes.verifier as RecordValue;
      verifier.id = producer.id;
    });
    const reduction = reducePortfolioAdmission({
      resultPath: path,
      now: new Date('2026-07-18T12:31:00.000Z'),
    });

    assert.equal(reduction.status, 'FAIL');
    assert.ok(
      reduction.errors.some((error) =>
        error.includes('review lanes are missing, colliding, or incomplete')
      )
    );
  });

  it('fails after the bound public-market hypothesis evidence expires', () => {
    const reduction = reducePortfolioAdmission({
      now: new Date('2027-07-18T00:00:00.000Z'),
    });

    assert.equal(reduction.status, 'FAIL');
    assert.ok(
      reduction.errors.includes(
        'Public-market hypothesis evidence is invalid or expired'
      )
    );
  });

  it('fails if decision signals imply a different disposition', () => {
    const path = writeMutatedResult((result) => {
      const signals = result.decisionSignals as RecordValue;
      signals.reframeCurrentExample = 'scada-energy-edge';
    });
    const reduction = reducePortfolioAdmission({
      resultPath: path,
      now: new Date('2026-07-18T12:31:00.000Z'),
    });

    assert.equal(reduction.status, 'FAIL');
    assert.equal(reduction.derivedDisposition, 'reframe-current-example');
    assert.ok(
      reduction.errors.some((error) =>
        error.includes('does not match the evidence-derived disposition')
      )
    );
  });

  it('fails when the required result is missing', () => {
    const reduction = reducePortfolioAdmission({
      resultPath: join(tempRoot, 'missing.json'),
      now: new Date('2026-07-18T12:31:00.000Z'),
    });

    assert.equal(reduction.status, 'FAIL');
    assert.ok(
      reduction.errors.some((error) =>
        error.includes('Missing admission result')
      )
    );
  });
});
