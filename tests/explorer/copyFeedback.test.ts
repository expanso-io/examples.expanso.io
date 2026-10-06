import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  COPY_ERROR_VISIBLE_MS,
  COPY_SUCCESS_VISIBLE_MS,
  copyButtonLabel,
  copyFeedbackDuration,
  copyResultFeedback,
  feedbackFor,
  writeClipboardText,
} from '../../src/components/ExplorerV2/copyFeedback';

describe('copy feedback', () => {
  it('confirms success with the copied label and a short duration', () => {
    const feedback = copyResultFeedback('menu-full', 'Full YAML', 'success');
    assert.deepEqual(feedback, {
      key: 'menu-full',
      kind: 'success',
      message: 'Full YAML copied.',
    });
    assert.equal(copyFeedbackDuration('success'), COPY_SUCCESS_VISIBLE_MS);
    assert.equal(COPY_SUCCESS_VISIBLE_MS, 2000);
  });

  it('tells the reader how to recover from a failure and keeps it longer', () => {
    const feedback = copyResultFeedback('yaml', 'Stage YAML', 'error');
    assert.equal(feedback.kind, 'error');
    assert.match(feedback.message, /Could not copy stage yaml/);
    assert.match(feedback.message, /copy it manually/);
    assert.ok(copyFeedbackDuration('error') > COPY_SUCCESS_VISIBLE_MS);
    assert.equal(copyFeedbackDuration('error'), COPY_ERROR_VISIBLE_MS);
  });

  it('changes only the control that was clicked', () => {
    const feedback = copyResultFeedback('input', 'Input JSON', 'success');
    assert.equal(copyButtonLabel('Copy JSON', feedback, 'input'), 'Copied');
    assert.equal(copyButtonLabel('Copy JSON', feedback, 'output'), 'Copy JSON');
    assert.equal(copyButtonLabel('Copy JSON', null, 'input'), 'Copy JSON');
    assert.equal(feedbackFor(feedback, 'output'), null);
    assert.equal(feedbackFor(feedback, 'input'), feedback);
  });

  it('labels a failed copy on the clicked control', () => {
    const feedback = copyResultFeedback('share', 'Share link', 'error');
    assert.equal(
      copyButtonLabel('Copy share link', feedback, 'share'),
      'Copy failed'
    );
  });

  it('rejects when the clipboard API is unavailable', async () => {
    await assert.rejects(
      () => writeClipboardText('value'),
      /Clipboard permission is unavailable/
    );
  });
});
