import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useHistory, useLocation } from '@docusaurus/router';
import clsx from 'clsx';

import {
  createExplorerCopyEvent,
  createExplorerShareEvent,
  createExplorerStageChangeEvent,
  createExplorerViewChangeEvent,
  createPipelineDownloadEvent,
  recordAnalyticsEvent,
  type ExplorerCopyScope,
  type ExplorerNavigationMethod,
} from '../../analytics/events';
import { captureExampleEvent } from '../../lib/analytics';
import { normalizeExplorerStages } from './normalize';
import styles from './styles.module.css';
import type {
  ExplorerDiffState,
  ExplorerLine,
  ExplorerPayloadFormat,
  ExplorerV2Props,
} from './types';

const diffLabels: Record<ExplorerDiffState, string> = {
  added: 'Added',
  removed: 'Removed',
  changed: 'Updated',
  unchanged: 'Unchanged',
};

const diffMarks: Record<ExplorerDiffState, string> = {
  added: '+',
  removed: '−',
  changed: '~',
  unchanged: ' ',
};

const payloadFormatLabels: Record<ExplorerPayloadFormat, string> = {
  json: 'JSON',
  text: 'text',
  binary: 'binary data',
  tabular: 'table',
  route: 'route map',
};

type DataPanelName = 'input' | 'output';
type ExplorerIssueKind = 'empty' | 'malformed' | 'oversized';

const MAX_EXPLORER_SOURCE_CHARACTERS = 2_000_000;

const unavailableStage = {
  slug: 'unavailable',
  title: 'Unavailable',
  description: 'No stage data is available.',
  inputLines: [],
  outputLines: [],
  yamlCode: '',
  yamlFilename: 'unavailable.yaml',
  provenance: 'curated-explanation',
} as const;

const issueMessages: Record<ExplorerIssueKind, string> = {
  empty:
    'No stages are available for this walkthrough. Use the reference links on this page while the stage fixture is repaired.',
  malformed:
    'The stage fixture is invalid and cannot be shown safely. Use the reference links on this page while the fixture is repaired.',
  oversized:
    'The stage fixture exceeds the safe inline preview limit. Use the canonical configuration or reference links on this page instead.',
};

function serializeLines(lines: ExplorerLine[]): string {
  return lines
    .map((line) => `${'  '.repeat(line.indent)}${line.content}`)
    .join('\n');
}

function DataLines({
  lines,
  changesOnly,
  comparisonMode,
}: {
  lines: ExplorerLine[];
  changesOnly: boolean;
  comparisonMode: 'diff' | 'highlights';
}) {
  const visibleLines = changesOnly
    ? lines.filter((line) => line.state !== 'unchanged')
    : lines;

  if (visibleLines.length === 0) {
    return (
      <p className={styles.empty}>
        {comparisonMode === 'highlights'
          ? 'No authored highlights in this view.'
          : 'No marked changes in this view.'}
      </p>
    );
  }

  return (
    <pre className={styles.codeLines}>
      <code>
        {visibleLines.map((line, index) => (
          <span
            className={styles.codeLine}
            data-diff={line.state}
            key={`${index}-${line.content}`}
            style={{ '--line-indent': line.indent } as React.CSSProperties}
          >
            <span className={styles.diffMark} aria-hidden="true">
              {comparisonMode === 'highlights' && line.state !== 'unchanged'
                ? '•'
                : diffMarks[line.state]}
            </span>
            {line.state !== 'unchanged' ? (
              <span className={styles.visuallyHidden}>
                {comparisonMode === 'highlights'
                  ? 'Authored highlight'
                  : diffLabels[line.state]}
                :{' '}
              </span>
            ) : null}
            <span>{line.content}</span>
          </span>
        ))}
      </code>
    </pre>
  );
}

export default function ExplorerV2({
  exampleId,
  stages: rawStages,
  title,
  subtitle,
  fullYaml,
  fullYamlFilename = 'pipeline.yaml',
  presentation,
  comparisonMode = 'diff',
}: ExplorerV2Props) {
  const history = useHistory();
  const location = useLocation();
  const explorerId = useId();
  const explorerPresentation = presentation;
  const normalized = useMemo(() => {
    try {
      const serialized = JSON.stringify(rawStages);
      if (serialized.length > MAX_EXPLORER_SOURCE_CHARACTERS) {
        return { issue: 'oversized' as const, stages: [] };
      }
      const stages = normalizeExplorerStages(
        rawStages,
        explorerPresentation.kind,
        comparisonMode
      );
      return {
        issue: stages.length === 0 ? ('empty' as const) : null,
        stages,
      };
    } catch {
      return { issue: 'malformed' as const, stages: [] };
    }
  }, [comparisonMode, explorerPresentation.kind, rawStages]);
  const stages = useMemo(
    () =>
      normalized.stages.length > 0
        ? normalized.stages
        : [{ ...unavailableStage, provenance: explorerPresentation.kind }],
    [explorerPresentation.kind, normalized]
  );
  const explorerIssue = normalized.issue;
  const query = useMemo(
    () => new URLSearchParams(location.search),
    [location.search]
  );
  const requestedStage = query.get('stage');
  const requestedIndex = stages.findIndex(
    (stage) => stage.slug === requestedStage
  );
  const [currentIndex, setCurrentIndex] = useState(Math.max(0, requestedIndex));
  const [changesOnly, setChangesOnly] = useState(
    query.get('view') ===
      (comparisonMode === 'highlights' ? 'highlights' : 'changes')
  );
  const [status, setStatus] = useState('');
  const [statusKind, setStatusKind] = useState<'success' | 'error'>('success');
  const activeStageRef = useRef<HTMLButtonElement | null>(null);
  const stageRailRef = useRef<HTMLDivElement | null>(null);
  const focusStageAfterChangeRef = useRef(false);
  const normalizedInvalidStageRef = useRef<string | null>(null);
  const hasCapturedEngagementRef = useRef(false);

  const currentStage = stages[currentIndex];
  if (!currentStage) throw new Error('Explorer requires at least one stage');
  const filteredView =
    comparisonMode === 'highlights' ? 'highlights' : 'changes';

  const rawInput =
    currentStage.rawInput ?? serializeLines(currentStage.inputLines);
  const rawOutput =
    currentStage.rawOutput ?? serializeLines(currentStage.outputLines);
  const isFinalStage = currentIndex === stages.length - 1;
  const visibleYaml =
    isFinalStage && fullYaml ? fullYaml : currentStage.yamlCode;
  const visibleYamlFilename =
    isFinalStage && fullYaml ? fullYamlFilename : currentStage.yamlFilename;
  const visibleYamlScope = isFinalStage && fullYaml ? 'full' : 'stage';
  const changeCounts = useMemo(
    () => ({
      added: currentStage.outputLines.filter((line) => line.state === 'added')
        .length,
      changed: currentStage.outputLines.filter(
        (line) => line.state === 'changed'
      ).length,
      removed: currentStage.inputLines.filter(
        (line) => line.state === 'removed'
      ).length,
      highlighted: [
        ...currentStage.inputLines,
        ...currentStage.outputLines,
      ].filter((line) => line.state !== 'unchanged').length,
    }),
    [currentStage]
  );

  useEffect(() => {
    if (explorerIssue) return;
    const requested = new URLSearchParams(location.search).get('stage');
    const nextIndex = stages.findIndex((stage) => stage.slug === requested);

    if (nextIndex >= 0) {
      normalizedInvalidStageRef.current = null;
      if (nextIndex !== currentIndex) setCurrentIndex(nextIndex);
    } else if (requested && normalizedInvalidStageRef.current !== requested) {
      normalizedInvalidStageRef.current = requested;
      const search = new URLSearchParams(location.search);
      search.set('stage', stages[0].slug);
      history.replace({
        pathname: location.pathname,
        search: `?${search.toString()}`,
        hash: location.hash,
      });
      if (currentIndex !== 0) setCurrentIndex(0);
    } else if (!requested && currentIndex !== 0) {
      setCurrentIndex(0);
    }

    setChangesOnly(
      new URLSearchParams(location.search).get('view') === filteredView
    );
  }, [
    currentIndex,
    history,
    location.hash,
    location.pathname,
    location.search,
    explorerIssue,
    filteredView,
    stages,
  ]);

  useEffect(() => {
    if (explorerIssue) return;
    const button = activeStageRef.current;
    const rail = stageRailRef.current;
    if (button && rail) {
      const targetLeft =
        button.offsetLeft -
        rail.offsetLeft -
        (rail.clientWidth - button.offsetWidth) / 2;
      rail.scrollTo({ left: Math.max(0, targetLeft), behavior: 'auto' });
    }
    if (focusStageAfterChangeRef.current) {
      activeStageRef.current?.focus({ preventScroll: true });
      focusStageAfterChangeRef.current = false;
    }
  }, [currentIndex, explorerIssue]);

  function selectStage(
    index: number,
    method: ExplorerNavigationMethod,
    focusStage = false
  ) {
    if (index < 0 || index >= stages.length) return;
    focusStageAfterChangeRef.current = focusStage && index !== currentIndex;
    if (index !== currentIndex) setCurrentIndex(index);
    setStatus('');

    const search = new URLSearchParams(location.search);
    const slug = stages[index].slug;
    if (search.get('stage') !== slug) {
      search.set('stage', slug);
      history.push({
        pathname: location.pathname,
        search: `?${search.toString()}`,
        hash: location.hash,
      });
    }

    recordAnalyticsEvent(
      createExplorerStageChangeEvent(exampleId, slug, method)
    );
    if (!hasCapturedEngagementRef.current) {
      hasCapturedEngagementRef.current = true;
      captureExampleEvent('example_explorer_engaged', {
        control: method,
        destination_stage: index + 1,
        stage_count: stages.length,
      });
    }
  }

  function handleStageKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    let nextIndex = currentIndex;
    if (event.key === 'ArrowLeft') nextIndex = Math.max(0, currentIndex - 1);
    else if (event.key === 'ArrowRight')
      nextIndex = Math.min(stages.length - 1, currentIndex + 1);
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = stages.length - 1;
    else return;

    event.preventDefault();
    selectStage(nextIndex, 'keyboard', true);
  }

  function updateChangesOnly(nextValue: boolean) {
    setChangesOnly(nextValue);
    setStatus('');
    const search = new URLSearchParams(location.search);
    if (nextValue) search.set('view', filteredView);
    else search.delete('view');
    history.replace({
      pathname: location.pathname,
      search: search.toString() ? `?${search.toString()}` : '',
      hash: location.hash,
    });
    recordAnalyticsEvent(
      createExplorerViewChangeEvent(
        exampleId,
        nextValue ? filteredView : 'full'
      )
    );
  }

  async function copyText(
    value: string,
    label: string,
    scope: 'stage' | 'full' | 'input' | 'output' | 'share'
  ) {
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error('Clipboard permission is unavailable');
      }
      await navigator.clipboard.writeText(value);
      setStatusKind('success');
      setStatus(`${label} copied.`);
      recordAnalyticsEvent(
        scope === 'share'
          ? createExplorerShareEvent(exampleId, currentStage.slug)
          : createExplorerCopyEvent(
              exampleId,
              currentStage.slug,
              scope satisfies ExplorerCopyScope
            )
      );
    } catch {
      setStatusKind('error');
      setStatus(
        `Could not copy ${label.toLowerCase()}. Select the text and copy it manually.`
      );
    }
  }

  function copyShareLink() {
    const search = new URLSearchParams(location.search);
    search.set('stage', currentStage.slug);
    if (changesOnly) search.set('view', filteredView);
    else search.delete('view');
    const url = new URL(location.pathname, window.location.origin);
    url.search = search.toString();
    url.hash = location.hash;
    void copyText(url.toString(), 'Share link', 'share');
  }

  function downloadYaml(
    value: string,
    filename: string,
    scope: 'stage' | 'full'
  ) {
    try {
      const url = URL.createObjectURL(
        new Blob([value], { type: 'text/yaml;charset=utf-8' })
      );
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
      setStatusKind('success');
      setStatus(`${filename} download started.`);
      recordAnalyticsEvent(
        createPipelineDownloadEvent(exampleId, currentStage.slug, scope)
      );
    } catch {
      setStatusKind('error');
      setStatus(
        `Could not download ${scope === 'full' ? 'the full YAML' : 'the stage YAML'}. Copy it instead.`
      );
    }
  }

  if (explorerIssue) {
    return (
      <section
        className={clsx(styles.explorer, 'data-pipeline-explorer')}
        data-explorer-version="2"
        data-explorer-state="unavailable"
        data-example-id={exampleId}
        data-provenance={explorerPresentation.kind}
        data-comparison-mode={comparisonMode}
      >
        <div className={styles.issue} role="alert">
          <p className={styles.kicker}>Interactive pipeline</p>
          <h2>Explorer unavailable</h2>
          <p>{issueMessages[explorerIssue]}</p>
        </div>
      </section>
    );
  }

  return (
    <section
      className={clsx(styles.explorer, 'data-pipeline-explorer')}
      aria-labelledby={`${explorerId}-title`}
      data-explorer-version="2"
      data-example-id={exampleId}
      data-provenance={explorerPresentation.kind}
      data-comparison-mode={comparisonMode}
    >
      <header className={styles.identity}>
        <div className={styles.identityCopy}>
          <p className={styles.kicker}>Interactive pipeline</p>
          <h2 id={`${explorerId}-title`}>{title}</h2>
          {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
        </div>
      </header>

      <div className={styles.stageNavigator}>
        <button
          type="button"
          className={styles.stageArrow}
          aria-label="Previous stage"
          disabled={currentIndex === 0}
          onClick={() => selectStage(currentIndex - 1, 'previous')}
        >
          <span aria-hidden="true">←</span>
        </button>
        <div className={styles.mobileStage}>
          <label htmlFor={`${explorerId}-stage`}>Stage</label>
          <select
            id={`${explorerId}-stage`}
            value={currentStage.slug}
            onChange={(event) =>
              selectStage(
                stages.findIndex((stage) => stage.slug === event.target.value),
                'select'
              )
            }
          >
            {stages.map((stage, index) => (
              <option value={stage.slug} key={stage.slug}>
                {index + 1}. {stage.title}
              </option>
            ))}
          </select>
        </div>
        <div
          className={clsx(
            styles.stageRail,
            'data-pipeline-explorer__stage-rail'
          )}
          aria-label="Pipeline stages"
          onKeyDown={handleStageKeyDown}
          ref={stageRailRef}
        >
          {stages.map((stage, index) => {
            const isCurrent = index === currentIndex;
            return (
              <button
                type="button"
                className={styles.stageButton}
                ref={isCurrent ? activeStageRef : undefined}
                aria-current={isCurrent ? 'step' : undefined}
                aria-controls={`${explorerId}-stage-panel`}
                aria-label={`Stage ${index + 1} of ${stages.length}: ${stage.title}${isCurrent ? ', current stage' : ''}`}
                tabIndex={isCurrent ? 0 : -1}
                onClick={() => selectStage(index, 'click')}
                key={stage.slug}
              >
                <span>{index + 1}</span>
                <strong>{stage.title}</strong>
              </button>
            );
          })}
        </div>
        <button
          type="button"
          className={styles.stageArrow}
          aria-label="Next stage"
          disabled={currentIndex === stages.length - 1}
          onClick={() => selectStage(currentIndex + 1, 'next')}
        >
          <span aria-hidden="true">→</span>
        </button>
      </div>

      <div
        className={styles.stageSummary}
        id={`${explorerId}-stage-panel`}
        aria-live="polite"
        aria-atomic="true"
      >
        <p className={styles.stagePosition}>
          Stage {currentIndex + 1} of {stages.length}
        </p>
        <div className={styles.stageCopy}>
          <h3>{currentStage.title}</h3>
          <p>{currentStage.description}</p>
        </div>
        {comparisonMode === 'highlights' ? (
          <div className={styles.highlightSummary}>
            <strong>{changeCounts.highlighted}</strong>
            <span>Highlights</span>
            <small>Authored emphasis only—not a computed diff.</small>
          </div>
        ) : (
          <ul className={styles.changeSummary} aria-label="Marked changes">
            <li>
              <strong>{changeCounts.added}</strong>
              <span>Added</span>
            </li>
            <li data-change="updated">
              <strong>{changeCounts.changed}</strong>
              <span>Updated</span>
            </li>
            <li data-change="removed">
              <strong>{changeCounts.removed}</strong>
              <span>Removed</span>
            </li>
          </ul>
        )}
      </div>

      <div className={styles.controlBar}>
        <label className={styles.toggle}>
          <input
            type="checkbox"
            checked={changesOnly}
            onChange={(event) => updateChangesOnly(event.target.checked)}
          />
          <span>
            {comparisonMode === 'highlights'
              ? 'Highlights only'
              : 'Changes only'}
          </span>
        </label>
        <details className={styles.actionMenu}>
          <summary>Copy &amp; download</summary>
          <div>
            <button type="button" onClick={copyShareLink}>
              Copy share link
            </button>
            <button
              type="button"
              onClick={() =>
                copyText(currentStage.yamlCode, 'Stage YAML', 'stage')
              }
            >
              Copy stage YAML
            </button>
            <button
              type="button"
              onClick={() =>
                downloadYaml(
                  currentStage.yamlCode,
                  currentStage.yamlFilename,
                  'stage'
                )
              }
            >
              Download stage YAML
            </button>
            {fullYaml ? (
              <>
                <button
                  type="button"
                  onClick={() => copyText(fullYaml, 'Full YAML', 'full')}
                >
                  Copy full YAML
                </button>
                <button
                  type="button"
                  onClick={() =>
                    downloadYaml(fullYaml, fullYamlFilename, 'full')
                  }
                >
                  Download full YAML
                </button>
              </>
            ) : (
              <p className={styles.actionNote}>
                Full pipeline file not included. Stage YAML remains available.
              </p>
            )}
          </div>
        </details>
      </div>

      <div
        className={styles.inspection}
        data-filtered={changesOnly ? 'true' : 'false'}
      >
        <div className={styles.dataGrid}>
          {(['input', 'output'] as DataPanelName[]).map((panel) => {
            const isInput = panel === 'input';
            const label = isInput ? 'Input' : 'Output';
            const value = isInput ? rawInput : rawOutput;
            const payloadFormat =
              (isInput
                ? currentStage.inputFormat
                : currentStage.outputFormat) ?? 'text';
            const payloadLabel = payloadFormatLabels[payloadFormat];
            return (
              <section
                className={clsx(
                  styles.dataPanel,
                  isInput ? styles.inputPanel : styles.outputPanel
                )}
                id={`${explorerId}-${panel}-panel`}
                key={panel}
              >
                <div className={styles.panelHeader}>
                  <h4>{label}</h4>
                  <button
                    type="button"
                    aria-label={`Copy ${label.toLowerCase()} ${payloadLabel} for ${currentStage.title}`}
                    onClick={() =>
                      copyText(
                        value,
                        `${label} ${payloadLabel}`,
                        isInput ? 'input' : 'output'
                      )
                    }
                  >
                    Copy {payloadLabel}
                  </button>
                </div>
                <div
                  className={styles.dataScroll}
                  tabIndex={0}
                  aria-label={`${label} ${payloadLabel} for ${currentStage.title}`}
                >
                  <DataLines
                    lines={
                      isInput
                        ? currentStage.inputLines
                        : currentStage.outputLines
                    }
                    changesOnly={changesOnly}
                    comparisonMode={comparisonMode}
                  />
                </div>
              </section>
            );
          })}
        </div>

        <section
          className={styles.yamlTabPanel}
          id={`${explorerId}-yaml-panel`}
        >
          <div className={styles.yamlPanel}>
            <div className={styles.yamlHeader}>
              <span>
                {isFinalStage && fullYaml
                  ? 'Complete pipeline'
                  : 'Stage configuration'}
              </span>
              <code>{visibleYamlFilename}</code>
              <button
                type="button"
                onClick={() =>
                  copyText(
                    visibleYaml,
                    visibleYamlScope === 'full' ? 'Full YAML' : 'Stage YAML',
                    visibleYamlScope
                  )
                }
              >
                Copy YAML
              </button>
            </div>
            <pre tabIndex={0}>
              <code>{visibleYaml}</code>
            </pre>
          </div>
        </section>
      </div>

      {status ? (
        <p
          className={styles.status}
          data-kind={statusKind}
          role={statusKind === 'error' ? 'alert' : 'status'}
          aria-live="polite"
        >
          {status}
        </p>
      ) : null}
    </section>
  );
}

export type {
  ExplorerDiffState,
  ExplorerLine,
  ExplorerPayloadFormat,
  ExplorerPresentation,
  ExplorerProvenance,
  ExplorerProvenanceKind,
  ExplorerStage,
  ExplorerV2Props,
} from './types';
