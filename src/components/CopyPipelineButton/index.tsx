import React, { useState, useEffect } from 'react';

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
  const [copied, setCopied] = useState(false);
  const [pipeline, setPipeline] = useState<string | null>(inlinePipeline || null);

  useEffect(() => {
    if (!inlinePipeline && yamlUrl) {
      fetch(yamlUrl)
        .then((r) => (r.ok ? r.text() : Promise.reject()))
        .then(setPipeline)
        .catch(() => {});
    }
  }, [inlinePipeline, yamlUrl]);

  const handleCopy = async () => {
    if (!pipeline) return;
    try {
      await navigator.clipboard.writeText(pipeline.trim());
    } catch {
      const ta = document.createElement('textarea');
      ta.value = pipeline.trim();
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  if (!pipeline && !yamlUrl) return null;

  return (
    <div
      style={{
        margin: '1.5rem 0',
        padding: '1rem 1.25rem',
        borderRadius: '8px',
        border: '2px solid var(--ifm-color-primary)',
        background:
          'linear-gradient(135deg, var(--ifm-color-primary-lightest, #f0f7ff) 0%, #fff 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1rem',
        flexWrap: 'wrap',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span style={{ fontSize: '1.4rem' }}>📋</span>
        <div>
          <div style={{ fontWeight: 600, fontSize: '1rem' }}>
            Ready to deploy?
          </div>
          <div style={{ fontSize: '0.85rem', opacity: 0.75 }}>
            Copy the complete pipeline YAML and paste it into Expanso Cloud.
          </div>
        </div>
      </div>
      <button
        onClick={handleCopy}
        disabled={!pipeline}
        style={{
          padding: '0.6rem 1.5rem',
          borderRadius: '6px',
          border: 'none',
          backgroundColor: copied
            ? '#2e7d32'
            : !pipeline
              ? '#ccc'
              : 'var(--ifm-color-primary)',
          color: '#fff',
          fontWeight: 600,
          fontSize: '0.95rem',
          cursor: pipeline ? 'pointer' : 'default',
          whiteSpace: 'nowrap',
          transition: 'background-color 0.2s',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        }}
      >
        {copied ? '✅ Copied!' : !pipeline ? 'Loading...' : label}
      </button>
    </div>
  );
}
