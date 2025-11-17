import React from 'react';

export interface ButtonProps {
  href: string;
  variant: 'primary' | 'secondary';
  children: React.ReactNode;
}

/**
 * Shared button component for explorer pages
 * Provides consistent styling across all interactive examples
 */
export default function Button({ href, variant, children }: ButtonProps): JSX.Element {
  const baseClassName = `button button--${variant} button--lg`;

  const buttonStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    textDecoration: 'none',
    borderRadius: '8px',
    padding: '1rem 2rem',
    fontWeight: '600',
    minWidth: '240px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  };

  return (
    <a href={href} className={baseClassName} style={buttonStyle}>
      {children}
    </a>
  );
}
