import { useCallback, useEffect, useRef, useState } from 'react';

/** Success confirmation lingers long enough to be read, then clears itself. */
export const COPY_SUCCESS_VISIBLE_MS = 2000;

/** Errors stay longer: the reader has to act on them. */
export const COPY_ERROR_VISIBLE_MS = 6000;

export type CopyFeedbackKind = 'success' | 'error';

export interface CopyFeedback {
  /** Identifies the control that was clicked so only it changes. */
  key: string;
  kind: CopyFeedbackKind;
  message: string;
}

export function copyFeedbackDuration(kind: CopyFeedbackKind): number {
  return kind === 'success' ? COPY_SUCCESS_VISIBLE_MS : COPY_ERROR_VISIBLE_MS;
}

export function copyResultFeedback(
  key: string,
  label: string,
  kind: CopyFeedbackKind
): CopyFeedback {
  return kind === 'success'
    ? { key, kind, message: `${label} copied.` }
    : {
        key,
        kind,
        message: `Could not copy ${label.toLowerCase()}. Select the text and copy it manually.`,
      };
}

export function feedbackFor(
  feedback: CopyFeedback | null,
  key: string
): CopyFeedback | null {
  return feedback !== null && feedback.key === key ? feedback : null;
}

export function copyButtonLabel<Idle>(
  idleLabel: Idle,
  feedback: CopyFeedback | null,
  key: string
): Idle | 'Copied' | 'Copy failed' {
  const active = feedbackFor(feedback, key);

  if (active === null) return idleLabel;

  return active.kind === 'success' ? 'Copied' : 'Copy failed';
}

export async function writeClipboardText(value: string): Promise<void> {
  if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
    throw new Error('Clipboard permission is unavailable');
  }

  await navigator.clipboard.writeText(value);
}

export function useCopyFeedback() {
  const [feedback, setFeedback] = useState<CopyFeedback | null>(null);
  const timerRef = useRef<number | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const show = useCallback(
    (next: CopyFeedback) => {
      clearTimer();
      setFeedback(next);
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        setFeedback(null);
      }, copyFeedbackDuration(next.kind));
    },
    [clearTimer]
  );

  useEffect(() => clearTimer, [clearTimer]);

  return { feedback, show };
}
