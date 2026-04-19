declare module '*.module.css' {
  const classes: { readonly [key: string]: string };
  export default classes;
}

declare module '@theme/CodeBlock' {
  import type React from 'react';

  interface CodeBlockProps {
    children?: React.ReactNode;
    className?: string;
    language?: string;
    title?: string;
  }

  const CodeBlock: React.ComponentType<CodeBlockProps>;
  export default CodeBlock;
}
