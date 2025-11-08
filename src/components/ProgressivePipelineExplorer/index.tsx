import React, { useState } from 'react';
import CodeBlock from '@theme/CodeBlock';
import type { ProgressivePipelineExplorerProps } from './types';
import { JSONViewer } from './JSONViewer';
import { Slider } from '../ui/slider';
import styles from './styles.module.css';

/**
 * Progressive Pipeline Explorer
 *
 * Interactive component that lets users explore pipeline complexity
 * step-by-step, seeing how data transforms at each stage.
 */
export default function ProgressivePipelineExplorer({
  stages,
  inputData,
  title = 'Interactive Pipeline Explorer',
  initialStage = 1,
}: ProgressivePipelineExplorerProps): JSX.Element {
  const [currentStage, setCurrentStage] = useState(initialStage);

  const stage = stages.find(s => s.id === currentStage);

  if (!stage) {
    return (
      <div className={styles.error}>
        Error: Stage {currentStage} not found
      </div>
    );
  }

  return (
    <div className={styles.explorerWrapper}>
      <div className={styles.explorer}>
        {/* Stage Header with Horizontal Slider */}
        <div className={styles.stageHeader}>
          <h3 className={styles.stageTitle}>{stage.title}</h3>
          <p className={styles.stageDescription}>{stage.description}</p>
        </div>

        {/* Horizontal Stage Slider */}
        <div className={styles.sliderContainer}>
          <button
            className={styles.navButton}
            onClick={() => setCurrentStage(Math.max(1, currentStage - 1))}
            disabled={currentStage === 1}
            aria-label="Previous stage"
          >
            ←
          </button>

          <div className={styles.sliderWrapper}>
            <Slider
              value={[currentStage]}
              onValueChange={(value) => setCurrentStage(value[0])}
              min={1}
              max={stages.length}
              step={1}
              className={styles.shadcnSlider}
            />
            <div className={styles.sliderLabels}>
              {stages.map((s) => (
                <button
                  key={s.id}
                  className={`${styles.stageLabel} ${
                    s.id === currentStage ? styles.active : ''
                  } ${s.id < currentStage ? styles.completed : ''}`}
                  onClick={() => setCurrentStage(s.id)}
                  title={s.title}
                  aria-label={`Stage ${s.id}`}
                >
                  {s.id}
                </button>
              ))}
            </div>
          </div>

          <button
            className={styles.navButton}
            onClick={() => setCurrentStage(Math.min(stages.length, currentStage + 1))}
            disabled={currentStage === stages.length}
            aria-label="Next stage"
          >
            →
          </button>
        </div>

        {/* Data Preview Section */}
        <div className={styles.dataPreview}>
          <div className={styles.dataColumn}>
            <JSONViewer
              data={inputData}
              title="📥 Input"
              removedPaths={stage.removedPaths}
              isInput={true}
            />
          </div>
          <div className={styles.dataColumn}>
            <JSONViewer
              data={stage.outputData}
              title="📤 Output"
              highlightPaths={stage.highlightPaths}
              isInput={false}
            />
          </div>
        </div>

        {/* Legend */}
        <div className={styles.legend}>
          <div className={styles.legendItem}>
            <span className={styles.legendBox + ' ' + styles.legendHighlight}></span>
            <span>Added/Changed</span>
          </div>
          <div className={styles.legendItem}>
            <span className={styles.legendBox + ' ' + styles.legendRemoved}></span>
            <span>Removed</span>
          </div>
        </div>

        {/* YAML Configuration */}
        <div className={styles.yamlSection}>
          <h4 className={styles.yamlTitle}>📄 New Pipeline Step</h4>
          <CodeBlock language="yaml" title={`stage-${currentStage}.yaml`}>
            {stage.yaml}
          </CodeBlock>
        </div>
      </div>
    </div>
  );
}
