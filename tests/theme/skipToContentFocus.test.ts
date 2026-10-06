import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { shouldResetFocusAfterNavigation } from '../../src/theme/SkipToContent/focusReset';

const page = { pathname: '/data-security/remove-pii/explorer', hash: '' };

describe('shouldResetFocusAfterNavigation', () => {
  it('keeps focus when only the query string changes on the same page', () => {
    assert.equal(
      shouldResetFocusAfterNavigation({
        action: 'PUSH',
        location: page,
        previousLocation: page,
      }),
      false
    );
  });

  it('resets focus when a PUSH lands on a different page', () => {
    assert.equal(
      shouldResetFocusAfterNavigation({
        action: 'PUSH',
        location: { pathname: '/data-routing/content-routing/', hash: '' },
        previousLocation: page,
      }),
      true
    );
  });

  it('never resets focus for a hash destination', () => {
    assert.equal(
      shouldResetFocusAfterNavigation({
        action: 'PUSH',
        location: { pathname: '/data-routing/content-routing/', hash: '#io' },
        previousLocation: page,
      }),
      false
    );
  });

  it('never resets focus for history traversal or replace', () => {
    for (const action of ['POP', 'REPLACE'] as const) {
      assert.equal(
        shouldResetFocusAfterNavigation({
          action,
          location: { pathname: '/other/', hash: '' },
          previousLocation: page,
        }),
        false
      );
    }
  });

  it('never resets focus on the first render', () => {
    assert.equal(
      shouldResetFocusAfterNavigation({
        action: 'PUSH',
        location: page,
        previousLocation: null,
      }),
      false
    );
  });
});
