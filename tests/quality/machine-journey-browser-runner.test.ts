import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { classifyMachineJourneyBrowserRun } from '../../scripts/quality/run-machine-journey-browser';

describe('machine journey browser capability classification', () => {
  it('reports a local browser sandbox denial as unavailable, never pass', () => {
    assert.deepEqual(
      classifyMachineJourneyBrowserRun({
        ci: false,
        output: 'mach_port_rendezvous.cc Permission denied (1100)',
        status: 1,
      }).status,
      'UNAVAILABLE'
    );
  });

  it('treats the same browser denial as a CI failure', () => {
    assert.deepEqual(
      classifyMachineJourneyBrowserRun({
        ci: true,
        output: 'mach_port_rendezvous.cc Permission denied (1100)',
        status: 1,
      }).status,
      'FAIL'
    );
  });

  it('fails an ordinary assertion failure and passes only exit zero', () => {
    assert.equal(
      classifyMachineJourneyBrowserRun({
        ci: false,
        output: 'expected heading to be visible',
        status: 1,
      }).status,
      'FAIL'
    );
    assert.equal(
      classifyMachineJourneyBrowserRun({
        ci: true,
        output: '5 passed',
        status: 0,
      }).status,
      'PASS'
    );
  });
});
