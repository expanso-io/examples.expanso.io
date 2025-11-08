import React from 'react';
import styles from './styles.module.css';

interface JSONViewerProps {
  data: any;
  title: string;
  highlightPaths?: string[];
  removedPaths?: string[];
  isInput?: boolean;
}

/**
 * Recursive JSON viewer with highlighting support
 */
export function JSONViewer({
  data,
  title,
  highlightPaths = [],
  removedPaths = [],
  isInput = false,
}: JSONViewerProps): JSX.Element {
  const renderValue = (
    value: any,
    key: string,
    path: string,
    indent: number
  ): JSX.Element => {
    const isHighlighted = highlightPaths.some(p => path.startsWith(p) || p.startsWith(path));
    const isRemoved = removedPaths.some(p => path === p);

    const className = [
      styles.jsonLine,
      isHighlighted && styles.highlighted,
      isRemoved && styles.removed,
    ]
      .filter(Boolean)
      .join(' ');

    if (value === null || value === undefined) {
      return (
        <div className={className} style={{ paddingLeft: `${indent * 20}px` }}>
          <span className={styles.jsonKey}>"{key}"</span>:{' '}
          <span className={styles.jsonNull}>null</span>
        </div>
      );
    }

    if (typeof value === 'object' && !Array.isArray(value)) {
      return (
        <div key={path}>
          <div className={className} style={{ paddingLeft: `${indent * 20}px` }}>
            <span className={styles.jsonKey}>"{key}"</span>: {'{'}
          </div>
          {Object.entries(value).map(([k, v]) =>
            renderValue(v, k, `${path}.${k}`, indent + 1)
          )}
          <div className={styles.jsonLine} style={{ paddingLeft: `${indent * 20}px` }}>
            {'}'}
          </div>
        </div>
      );
    }

    if (Array.isArray(value)) {
      return (
        <div key={path}>
          <div className={className} style={{ paddingLeft: `${indent * 20}px` }}>
            <span className={styles.jsonKey}>"{key}"</span>: [
          </div>
          {value.map((item, i) =>
            renderValue(item, String(i), `${path}[${i}]`, indent + 1)
          )}
          <div className={styles.jsonLine} style={{ paddingLeft: `${indent * 20}px` }}>
            ]
          </div>
        </div>
      );
    }

    const formattedValue =
      typeof value === 'string' ? `"${value}"` : String(value);
    const valueClass =
      typeof value === 'string'
        ? styles.jsonString
        : typeof value === 'number'
        ? styles.jsonNumber
        : styles.jsonBoolean;

    return (
      <div className={className} style={{ paddingLeft: `${indent * 20}px` }} key={path}>
        <span className={styles.jsonKey}>"{key}"</span>:{' '}
        <span className={valueClass}>{formattedValue}</span>
      </div>
    );
  };

  return (
    <div className={`${styles.jsonViewer} ${isInput ? styles.jsonInput : styles.jsonOutput}`}>
      <div className={styles.jsonTitle}>{title}</div>
      <div className={styles.jsonContent}>
        <div className={styles.jsonLine}>{'{'}</div>
        {Object.entries(data).map(([key, value]) =>
          renderValue(value, key, key, 1)
        )}
        <div className={styles.jsonLine}>{'}'}</div>
      </div>
    </div>
  );
}
