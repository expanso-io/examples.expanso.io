import React from 'react';
import Button from '@site/src/components/Button';

export interface ExplorerSectionProps {
  setupLink: string;
  completeLink: string;
  setupLabel?: string;
  completeLabel?: string;
}

/**
 * Shared "Try It Yourself" section for explorer pages
 * Displays two buttons: one for setup/tutorial, one for complete solution
 */
export default function ExplorerSection({
  setupLink,
  completeLink,
  setupLabel = 'Start Tutorial',
  completeLabel = 'Download Complete Solution',
}: ExplorerSectionProps): JSX.Element {
  const containerStyle: React.CSSProperties = {
    display: 'flex',
    gap: '1.5rem',
    marginTop: '2rem',
    marginBottom: '3rem',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
  };

  return (
    <div style={containerStyle}>
      <Button href={setupLink} variant="primary">
        {setupLabel}
      </Button>
      <Button href={completeLink} variant="secondary">
        {completeLabel}
      </Button>
    </div>
  );
}
