import type { ReactNode } from 'react';
import clsx from 'clsx';

import {
  copyButtonLabel,
  feedbackFor,
  type CopyFeedback,
} from './copyFeedback';
import styles from './copyFeedback.module.css';

interface CopyToastProps {
  feedback: CopyFeedback;
  /** Inline toasts flow with menu items instead of floating over them. */
  inline?: boolean;
}

/** Small confirmation anchored to the control that was clicked. */
export function CopyToast({ feedback, inline = false }: CopyToastProps) {
  return (
    <span
      className={clsx(styles.toast, inline && styles.inlineToast)}
      data-copy-toast=""
      data-kind={feedback.kind}
      role={feedback.kind === 'error' ? 'alert' : 'status'}
    >
      {feedback.message}
    </span>
  );
}

function CheckIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      width="14"
      height="14"
      focusable="false"
    >
      <path
        d="M3 8.5l3 3 7-7"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

interface CopyActionButtonProps {
  feedbackKey: string;
  feedback: CopyFeedback | null;
  onCopy: () => void;
  children: ReactNode;
  /** Menu items show success on the menu trigger instead, so they opt out. */
  toast?: 'always' | 'error-only';
  toastPlacement?: 'floating' | 'inline';
  anchorClassName?: string;
  'aria-label'?: string;
}

/**
 * Copy control whose own label confirms the result where the click happened:
 * "Copied" with a check for a success, "Copy failed" for an error.
 */
export default function CopyActionButton({
  feedbackKey,
  feedback,
  onCopy,
  children,
  toast = 'always',
  toastPlacement = 'floating',
  anchorClassName,
  'aria-label': ariaLabel,
}: CopyActionButtonProps) {
  const active = feedbackFor(feedback, feedbackKey);
  const label = copyButtonLabel(children, feedback, feedbackKey);

  const showToast =
    active !== null && (toast === 'always' || active.kind === 'error');

  return (
    <span className={clsx(styles.anchor, anchorClassName)}>
      <button
        type="button"
        className={styles.button}
        data-copy-state={active?.kind ?? 'idle'}
        aria-label={ariaLabel}
        onClick={onCopy}
      >
        {active?.kind === 'success' ? (
          <>
            <CheckIcon />
            <span>{label}</span>
          </>
        ) : (
          label
        )}
      </button>
      {showToast ? (
        <CopyToast feedback={active} inline={toastPlacement === 'inline'} />
      ) : null}
    </span>
  );
}
