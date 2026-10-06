import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  compareFeaturePreservation,
  FEATURE_EXCEPTIONS,
  formatPreservationFailures,
  PRE_SWEEP_BASELINE,
} from '../../scripts/validation/feature-preservation';

test('changed pipelines and published copies preserve pre-sweep features', () => {
  const result = compareFeaturePreservation(process.cwd());

  assert.ok(
    result.checked > 0,
    `no baseline pipelines were checked at ${PRE_SWEEP_BASELINE}`
  );
  assert.equal(
    result.failures.length,
    0,
    `pre-sweep pipeline features were removed:\n${formatPreservationFailures(
      result.failures
    )}`
  );
});

test('platform compatibility exceptions are narrow and documented', () => {
  for (const exception of FEATURE_EXCEPTIONS) {
    assert.match(exception.path, /\.(?:yaml|yml)$/);
    assert.ok(exception.value.length > 0);
    assert.ok(
      exception.reason.length >= 24,
      `${exception.path}: exception reason is not specific enough`
    );
  }
});
