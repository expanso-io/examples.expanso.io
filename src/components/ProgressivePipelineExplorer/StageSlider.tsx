import React from 'react';
import type { PipelineStage } from './types';
import styles from './styles.module.css';

interface StageSliderProps {
  stages: PipelineStage[];
  currentStage: number;
  onStageChange: (stageId: number) => void;
}

/**
 * Interactive slider for navigating pipeline stages
 */
export function StageSlider({
  stages,
  currentStage,
  onStageChange,
}: StageSliderProps): JSX.Element {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onStageChange(parseInt(e.target.value, 10));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft' && currentStage > 1) {
      onStageChange(currentStage - 1);
    } else if (e.key === 'ArrowRight' && currentStage < stages.length) {
      onStageChange(currentStage + 1);
    }
  };

  const currentStageData = stages.find(s => s.id === currentStage);

  return (
    <div className={styles.stageSlider}>
      <div className={styles.sliderHeader}>
        <h3 className={styles.stageTitle}>{currentStageData?.title || ''}</h3>
        <p className={styles.stageDescription}>
          {currentStageData?.description || ''}
        </p>
      </div>

      <div className={styles.sliderControl}>
        <input
          type="range"
          min="1"
          max={stages.length}
          value={currentStage}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          className={styles.slider}
          aria-label="Pipeline stage"
          aria-valuemin={1}
          aria-valuemax={stages.length}
          aria-valuenow={currentStage}
          aria-valuetext={currentStageData?.title}
        />
        <div className={styles.sliderLabels}>
          {stages.map((stage) => (
            <button
              key={stage.id}
              className={`${styles.sliderLabel} ${
                stage.id === currentStage ? styles.active : ''
              }`}
              onClick={() => onStageChange(stage.id)}
              aria-label={stage.title}
            >
              {stage.id}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.sliderNavigation}>
        <button
          className={styles.navButton}
          onClick={() => onStageChange(Math.max(1, currentStage - 1))}
          disabled={currentStage === 1}
          aria-label="Previous stage"
        >
          ← Previous
        </button>
        <span className={styles.stageCounter}>
          Stage {currentStage} of {stages.length}
        </span>
        <button
          className={styles.navButton}
          onClick={() => onStageChange(Math.min(stages.length, currentStage + 1))}
          disabled={currentStage === stages.length}
          aria-label="Next stage"
        >
          Next →
        </button>
      </div>
    </div>
  );
}
