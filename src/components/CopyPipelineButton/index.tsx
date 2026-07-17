import React, { useEffect, useId, useState } from 'react';

type CopyStatus = 'idle' | 'success' | 'error';

interface CopyPipelineButtonProps {
  /** Raw pipeline string (from raw-loader import) */
  pipeline?: string;
  /** OR: path to YAML in /static */
  yamlUrl?: string;
  /** Optional label */
  label?: string;
}

export default function CopyPipelineButton({
  pipeline: inlinePipeline,
  yamlUrl,
  label = 'Copy Full Pipeline',
}: CopyPipelineButtonProps) {
  const statusId = useId();
  const [copyStatus, setCopyStatus] = useState<CopyStatus>('idle');
  const [loadError, setLoadError] = useState(false);
  const [pipeline, setPipeline] = useState<string | null>(
    inlinePipeline || null
  );

  useEffect(() => {
    if (inlinePipeline) {
      setPipeline(inlinePipeline);
      setLoadError(false);
      return;
    }

    if (!yamlUrl) {
      setPipeline(null);
      setLoadError(false);
      return;
    }

    const controller = new AbortController();
    setPipeline(null);
    setLoadError(false);

    fetch(yamlUrl, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Pipeline request failed: ${response.status}`);
        }
        return response.text();
      })
      .then(setPipeline)
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          setLoadError(true);
        }
      });

    return () => controller.abort();
  }, [inlinePipeline, yamlUrl]);

  useEffect(() => {
    if (copyStatus === 'idle') return;

    const timeout = window.setTimeout(
      () => setCopyStatus('idle'),
      copyStatus === 'success' ? 2500 : 5000
    );
    return () => window.clearTimeout(timeout);
  }, [copyStatus]);

  const copyWithFallback = async (text: string) => {
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch {
        // The legacy fallback still works in contexts where Clipboard API
        // permission is unavailable (for example, a non-secure local preview).
      }
    }

    const previouslyFocusedElement =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);

    try {
      textarea.focus();
      textarea.select();
      return document.execCommand('copy');
    } finally {
      document.body.removeChild(textarea);
      if (previouslyFocusedElement?.isConnected) {
        previouslyFocusedElement.focus();
      }
    }
  };

  const handleCopy = async () => {
    if (!pipeline) return;

    try {
      const copied = await copyWithFallback(pipeline.trim());
      setCopyStatus(copied ? 'success' : 'error');
    } catch {
      setCopyStatus('error');
    }
  };

  if (!pipeline && !yamlUrl) return null;

  return (
    <div className="copy-pipeline">
      <div className="copy-pipeline__content">
        <span className="copy-pipeline__icon" aria-hidden="true">
          📋
        </span>
        <div className="copy-pipeline__text">
          <div className="copy-pipeline__title">Copy pipeline YAML</div>
          <div className="copy-pipeline__description">
            Review it for your environment before you deploy.
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={handleCopy}
        disabled={!pipeline}
        className={`copy-pipeline__button${copyStatus === 'success' ? ' copy-pipeline__button--success' : ''}`}
        aria-describedby={statusId}
      >
        {copyStatus === 'success'
          ? 'Copied'
          : !pipeline && !loadError
            ? 'Loading…'
            : label}
      </button>
      <div
        id={statusId}
        className={`copy-pipeline__status${copyStatus === 'error' || loadError ? ' copy-pipeline__status--error' : ''}`}
        role={copyStatus === 'error' || loadError ? 'alert' : 'status'}
        aria-live={copyStatus === 'error' || loadError ? 'assertive' : 'polite'}
        aria-atomic="true"
      >
        {loadError
          ? 'The pipeline could not be loaded. Refresh the page and try again.'
          : copyStatus === 'success'
            ? 'Pipeline YAML copied to the clipboard.'
            : copyStatus === 'error'
              ? 'The pipeline could not be copied. Select the YAML and copy it manually.'
              : ''}
      </div>
    </div>
  );
}
