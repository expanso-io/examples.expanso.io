import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { DataPipelineExplorerProps, JsonLine } from './types';
import { transformStages } from './stageTransformer';

const DataPipelineExplorer: React.FC<DataPipelineExplorerProps> = ({
  stages: rawStages,
  title = 'DATA PIPELINE',
  subtitle = 'Interactive Explorer',
}) => {
  // Transform stages to standardized format (handles legacy formats)
  const stages = useMemo(
    () => transformStages(rawStages as any[]),
    [rawStages]
  );

  const [currentStage, setCurrentStage] = useState(1);
  const activeStageButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    activeStageButtonRef.current?.scrollIntoView({
      block: 'nearest',
      inline: 'nearest',
    });
  }, [currentStage]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrevious();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNext();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentStage, stages.length]);

  const handlePrevious = () => {
    if (currentStage > 1) {
      setCurrentStage(currentStage - 1);
    }
  };

  const handleNext = () => {
    if (currentStage < stages.length) {
      setCurrentStage(currentStage + 1);
    }
  };

  const handleStageClick = (stageId: number) => {
    setCurrentStage(stageId);
  };

  const currentStageData = stages.find((s) => s.id === currentStage);

  const renderJsonLine = (line: JsonLine, index: number) => {
    const paddingLeft = line.indent * 24;
    let lineClass =
      'transition-all duration-200 ease-in-out py-0.5 px-3 font-mono';

    if (line.type === 'removed') {
      lineClass += ' bg-red-500/20 line-through border-l-4 border-red-500';
    } else if (line.type === 'highlighted') {
      lineClass += ' bg-emerald-500/20 border-l-4 border-emerald-500';
    }

    const renderValue = () => {
      if (!line.key) {
        // Just braces or brackets
        return <span className="text-muted-foreground">{line.content}</span>;
      }

      const parts = line.content.split(':');
      const key = parts[0].trim();
      const value = parts.slice(1).join(':').trim();

      return (
        <>
          <span className="text-sky-400 font-semibold">{key}</span>
          <span className="text-muted-foreground">: </span>
          {line.valueType === 'string' ? (
            <span className="text-amber-400">{value}</span>
          ) : line.valueType === 'number' ? (
            <span className="text-purple-400">{value}</span>
          ) : (
            <span className="text-pink-400">{value}</span>
          )}
        </>
      );
    };

    return (
      <div
        key={index}
        className={lineClass}
        style={{
          paddingLeft: `${paddingLeft}px`,
        }}
      >
        {renderValue()}
      </div>
    );
  };

  return (
    <div className="data-pipeline-explorer my-6 min-h-[600px] w-full min-w-0 max-w-full overflow-hidden bg-background p-3 sm:p-4 lg:p-8">
      <div className="mx-auto min-w-0 max-w-7xl">
        <div className="flex min-w-0 flex-col gap-4 sm:gap-6">
          {/* Stage Header */}
          <div
            className="rounded-lg border border-border bg-card p-4 text-center shadow-sm sm:p-6"
            aria-live="polite"
            aria-atomic="true"
          >
            <p className="mb-1 text-sm font-semibold text-muted-foreground">
              Stage {currentStage} of {stages.length}
            </p>
            <h3 className="font-semibold text-card-foreground text-2xl mb-2">
              {currentStageData?.title}
            </h3>
            <p className="text-muted-foreground text-base">
              {currentStageData?.description}
            </p>
          </div>

          {/* Navigation Controls */}
          <div className="rounded-lg border border-border bg-card p-3 shadow-sm sm:p-6">
            <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 sm:gap-4">
              {/* Previous Button - Larger and more prominent */}
              <button
                key="nav-previous"
                onClick={handlePrevious}
                disabled={currentStage === 1}
                aria-label="Previous stage (←)"
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white shadow-lg transition-all duration-200 hover:bg-blue-700 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-40 sm:h-16 sm:w-16"
              >
                <ChevronLeft className="h-7 w-7 sm:h-8 sm:w-8" />
              </button>

              {/* Stage Indicators */}
              <div
                className="data-pipeline-explorer__stage-rail flex min-w-0 gap-2 overflow-x-auto px-1 py-2 sm:justify-center"
                role="group"
                aria-label="Choose a pipeline stage"
              >
                {stages.map((stage) => {
                  const isCompleted = stage.id < currentStage;
                  const isActive = stage.id === currentStage;

                  return (
                    <button
                      key={stage.id}
                      ref={isActive ? activeStageButtonRef : undefined}
                      onClick={() => handleStageClick(stage.id)}
                      className={`
                        flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border-2 text-base font-bold
                        transition-all duration-200
                        ${
                          isCompleted
                            ? 'border-emerald-500 bg-emerald-600 text-white hover:bg-emerald-700'
                            : isActive
                              ? 'scale-105 border-blue-500 bg-blue-600 text-white shadow-lg ring-2 ring-blue-500/30'
                              : 'border-gray-600 bg-gray-700 text-gray-300 hover:border-gray-500 hover:text-white'
                        }
                      `}
                      title={stage.title}
                      aria-label={`Stage ${stage.id} of ${stages.length}: ${stage.title}${isActive ? ', current stage' : ''}`}
                      aria-current={isActive ? 'step' : undefined}
                    >
                      {stage.id}
                    </button>
                  );
                })}
              </div>

              {/* Next Button - Larger and more prominent */}
              <button
                key="nav-next"
                onClick={handleNext}
                disabled={currentStage === stages.length}
                aria-label="Next stage (→)"
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white shadow-lg transition-all duration-200 hover:bg-blue-700 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-40 sm:h-16 sm:w-16"
              >
                <ChevronRight className="h-7 w-7 sm:h-8 sm:w-8" />
              </button>
            </div>

            {/* Keyboard hint */}
            <div className="text-center mt-4 text-sm text-muted-foreground">
              Use ← → arrow keys to navigate
            </div>
          </div>

          {/* Data Preview - Side by Side */}
          <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
            {/* Input Column */}
            <div className="flex min-w-0 flex-col">
              <div className="flex h-full min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm">
                <div className="bg-gray-800 px-4 py-3 border-b border-border flex items-center gap-2">
                  <span className="text-xl">📥</span>
                  <span className="font-semibold text-white text-base">
                    Input
                  </span>
                </div>
                <div className="max-w-full flex-1 overflow-auto bg-gray-900 p-4">
                  <div className="min-w-max text-sm leading-relaxed">
                    {currentStageData?.inputLines.map((line, index) =>
                      renderJsonLine(line, index)
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Output Column */}
            <div className="flex min-w-0 flex-col">
              <div className="flex h-full min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm">
                <div className="bg-gray-800 px-4 py-3 border-b border-border flex items-center gap-2">
                  <span className="text-xl">📤</span>
                  <span className="font-semibold text-white text-base">
                    Output
                  </span>
                </div>
                <div className="max-w-full flex-1 overflow-auto bg-gray-900 p-4">
                  <div className="min-w-max text-sm leading-relaxed">
                    {currentStageData?.outputLines.map((line, index) =>
                      renderJsonLine(line, index)
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Legend */}
          <div className="bg-card border border-border rounded-lg p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-sm text-foreground">
              <div key="legend-added" className="flex items-center gap-2">
                <span className="h-6 w-6 bg-emerald-500/20 border-l-4 border-emerald-500 rounded" />
                <span>Added/Changed</span>
              </div>
              <div key="legend-removed" className="flex items-center gap-2">
                <span className="h-6 w-6 bg-red-500/20 border-l-4 border-red-500 rounded" />
                <span>Removed</span>
              </div>
              <div key="legend-completed" className="flex items-center gap-2">
                <span className="h-6 w-6 bg-emerald-600 rounded" />
                <span>Completed Step</span>
              </div>
              <div key="legend-current" className="flex items-center gap-2">
                <span className="h-6 w-6 bg-blue-600 rounded ring-2 ring-blue-500/30" />
                <span>Current Step</span>
              </div>
              <div key="legend-pending" className="flex items-center gap-2">
                <span className="h-6 w-6 bg-gray-700 rounded" />
                <span>Not Done Yet</span>
              </div>
            </div>
          </div>

          {/* YAML Section */}
          <div className="min-w-0 overflow-hidden rounded-lg border border-border bg-card shadow-sm">
            <div className="flex min-w-0 flex-wrap items-center gap-2 border-b border-border bg-gray-800 px-4 py-3">
              <span className="text-xl">📄</span>
              <span className="font-semibold text-white text-base">
                New Pipeline Step
              </span>
              <span className="min-w-0 break-all font-mono text-sm text-gray-300 sm:ml-auto">
                {currentStageData?.yamlFilename}
              </span>
            </div>
            <div className="max-w-full overflow-hidden bg-gray-900 p-4">
              <pre className="m-0 max-w-full overflow-x-auto font-mono text-sm text-gray-300">
                <code>{currentStageData?.yamlCode}</code>
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DataPipelineExplorer;
