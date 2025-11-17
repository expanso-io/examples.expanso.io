import React, { useEffect, useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { DataPipelineExplorerProps, JsonLine } from './types';
import { transformStages } from './stageTransformer';

const DataPipelineExplorer: React.FC<DataPipelineExplorerProps> = ({
  stages: rawStages,
  title = 'DATA PIPELINE',
  subtitle = 'Interactive Explorer',
}) => {
  // Transform stages to standardized format (handles legacy formats)
  const stages = useMemo(() => transformStages(rawStages as any[]), [rawStages]);

  const [currentStage, setCurrentStage] = useState(1);

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
    <div className="w-full min-h-[600px] bg-background p-8 my-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col gap-6">
          {/* Stage Header */}
          <div className="bg-card border border-border rounded-lg p-6 text-center shadow-sm">
            <h3 className="font-semibold text-card-foreground text-2xl mb-2">
              {currentStageData?.title}
            </h3>
            <p className="text-muted-foreground text-base">
              {currentStageData?.description}
            </p>
          </div>

          {/* Navigation Controls */}
          <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
            <div className="flex items-center justify-center gap-4">
              {/* Previous Button - Larger and more prominent */}
              <button
                key="nav-previous"
                onClick={handlePrevious}
                disabled={currentStage === 1}
                aria-label="Previous stage (←)"
                className="flex items-center justify-center w-16 h-16 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-20 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-105"
              >
                <ChevronLeft className="w-8 h-8" />
              </button>

              {/* Stage Indicators */}
              {stages.map((stage) => {
                const isCompleted = stage.id < currentStage;
                const isActive = stage.id === currentStage;
                const isInactive = stage.id > currentStage;

                return (
                  <button
                    key={stage.id}
                    onClick={() => handleStageClick(stage.id)}
                    className={`
                      flex items-center justify-center w-12 h-12 rounded-lg font-bold text-base
                      transition-all duration-200 border-2
                      ${
                        isCompleted
                          ? 'bg-emerald-600 border-emerald-500 text-white hover:bg-emerald-700'
                          : isActive
                            ? 'bg-blue-600 border-blue-500 text-white scale-110 shadow-lg ring-4 ring-blue-500/30'
                            : 'bg-gray-700 border-gray-600 text-gray-400 hover:border-gray-500 hover:text-gray-300'
                      }
                    `}
                    title={stage.title}
                    aria-label={`Stage ${stage.id}`}
                  >
                    {stage.id}
                  </button>
                );
              })}

              {/* Next Button - Larger and more prominent */}
              <button
                key="nav-next"
                onClick={handleNext}
                disabled={currentStage === stages.length}
                aria-label="Next stage (→)"
                className="flex items-center justify-center w-16 h-16 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-20 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-105"
              >
                <ChevronRight className="w-8 h-8" />
              </button>
            </div>

            {/* Keyboard hint */}
            <div className="text-center mt-4 text-sm text-muted-foreground">
              Use ← → arrow keys to navigate
            </div>
          </div>

          {/* Data Preview - Side by Side */}
          <div className="grid grid-cols-2 gap-6">
            {/* Input Column */}
            <div className="flex flex-col">
              <div className="bg-card border border-border rounded-lg overflow-hidden flex flex-col h-full shadow-sm">
                <div className="bg-gray-800 px-4 py-3 border-b border-border flex items-center gap-2">
                  <span className="text-xl">📥</span>
                  <span className="font-semibold text-white text-base">
                    Input
                  </span>
                </div>
                <div className="flex-1 bg-gray-900 p-4 overflow-auto">
                  <div className="text-sm leading-relaxed">
                    {currentStageData?.inputLines.map((line, index) =>
                      renderJsonLine(line, index)
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Output Column */}
            <div className="flex flex-col">
              <div className="bg-card border border-border rounded-lg overflow-hidden flex flex-col h-full shadow-sm">
                <div className="bg-gray-800 px-4 py-3 border-b border-border flex items-center gap-2">
                  <span className="text-xl">📤</span>
                  <span className="font-semibold text-white text-base">
                    Output
                  </span>
                </div>
                <div className="flex-1 bg-gray-900 p-4 overflow-auto">
                  <div className="text-sm leading-relaxed">
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
            <div className="flex gap-8 justify-center items-center text-sm text-foreground">
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
          <div className="bg-card border border-border rounded-lg overflow-hidden shadow-sm">
            <div className="bg-gray-800 px-4 py-3 border-b border-border flex items-center gap-2">
              <span className="text-xl">📄</span>
              <span className="font-semibold text-white text-base">
                New Pipeline Step
              </span>
              <span className="ml-auto text-sm text-muted-foreground font-mono">
                {currentStageData?.yamlFilename}
              </span>
            </div>
            <div className="bg-gray-900 p-4">
              <pre className="font-mono text-sm text-gray-300 overflow-x-auto">
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

