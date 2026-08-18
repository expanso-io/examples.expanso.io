import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useHistory, useLocation } from '@docusaurus/router';
import clsx from 'clsx';

import {
  assertionActual,
  assertionPasses,
  runRuntimeScenario,
  validateCheckpointArtifact,
  validateRuntimeSource,
} from './disconnectedEdgeMachine';
import styles from './runtimeStyles.module.css';
import type {
  RuntimeCheckpointArtifact,
  RuntimeEvent,
  RuntimeProofEvidence,
  RuntimeSource,
} from './types';

interface RuntimeExplorerProps {
  checkpoints: RuntimeCheckpointArtifact;
  evidence: RuntimeProofEvidence;
  source: RuntimeSource;
  title: string;
}

function eventLabel(event: RuntimeEvent): string {
  if (event.kind === 'record-arrived') {
    return `${event.record.id} arrives (${event.record.priority})`;
  }
  if (event.kind === 'link-state') {
    return `Modeled link becomes ${event.connection}`;
  }
  return 'Replay modeled buffer';
}

export default function RuntimeExplorer({
  checkpoints: rawCheckpoints,
  evidence,
  source: rawSource,
  title,
}: RuntimeExplorerProps) {
  const history = useHistory();
  const location = useLocation();
  const explorerId = useId();
  const source = useMemo(() => validateRuntimeSource(rawSource), [rawSource]);
  const checkpoints = useMemo(
    () => validateCheckpointArtifact(source, rawCheckpoints),
    [rawCheckpoints, source]
  );
  const requestedScenario = new URLSearchParams(location.search).get(
    'scenario'
  );
  const initialScenario = source.scenarios.some(
    (candidate) => candidate.id === requestedScenario
  )
    ? requestedScenario!
    : source.scenarios[0].id;
  const [scenarioId, setScenarioId] = useState(initialScenario);
  const [checkpointIndex, setCheckpointIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [announcement, setAnnouncement] = useState(
    'Simulation ready at the deterministic initial state.'
  );
  const normalizedInvalidScenarioRef = useRef<string | null>(null);

  const scenario =
    source.scenarios.find((candidate) => candidate.id === scenarioId) ??
    source.scenarios[0];
  const states = useMemo(() => runRuntimeScenario(scenario), [scenario]);
  const artifactScenario = checkpoints.scenarios.find(
    (candidate) => candidate.scenarioId === scenario.id
  )!;
  const state = states[checkpointIndex] ?? states[0];
  const checkpoint =
    artifactScenario.checkpoints[checkpointIndex] ??
    artifactScenario.checkpoints[0];
  const isComplete = checkpointIndex >= scenario.events.length;

  useEffect(() => {
    const requested = new URLSearchParams(location.search).get('scenario');
    const nextScenario = source.scenarios.find(
      (candidate) => candidate.id === requested
    );

    if (nextScenario) {
      normalizedInvalidScenarioRef.current = null;
      if (nextScenario.id !== scenarioId) {
        setScenarioId(nextScenario.id);
        setCheckpointIndex(0);
        setIsPlaying(false);
        setHasStarted(false);
        setAnnouncement(
          'Scenario restored from the URL. Simulation reset to checkpoint 0.'
        );
      }
    } else if (
      requested &&
      normalizedInvalidScenarioRef.current !== requested
    ) {
      normalizedInvalidScenarioRef.current = requested;
      const search = new URLSearchParams(location.search);
      search.set('scenario', source.scenarios[0].id);
      history.replace({
        pathname: location.pathname,
        search: `?${search.toString()}`,
        hash: location.hash,
      });
      if (scenarioId !== source.scenarios[0].id) {
        setScenarioId(source.scenarios[0].id);
        setCheckpointIndex(0);
        setIsPlaying(false);
        setHasStarted(false);
      }
      setAnnouncement(
        'Unknown scenario replaced with the default. Simulation reset to checkpoint 0.'
      );
    } else if (!requested && scenarioId !== source.scenarios[0].id) {
      setScenarioId(source.scenarios[0].id);
      setCheckpointIndex(0);
      setIsPlaying(false);
      setHasStarted(false);
      setAnnouncement(
        'Default scenario restored. Simulation reset to checkpoint 0.'
      );
    }
  }, [
    history,
    location.hash,
    location.pathname,
    location.search,
    scenarioId,
    source.scenarios,
  ]);

  useEffect(() => {
    if (!isPlaying) return;
    if (isComplete) {
      setIsPlaying(false);
      return;
    }
    const timer = window.setTimeout(() => {
      setCheckpointIndex((index) =>
        Math.min(index + 1, scenario.events.length)
      );
    }, 650);
    return () => window.clearTimeout(timer);
  }, [checkpointIndex, isComplete, isPlaying, scenario.events.length]);

  useEffect(() => {
    if (checkpointIndex === 0) return;
    if (isComplete) {
      setAnnouncement(
        `Simulation complete at checkpoint ${scenario.events.length} of ${scenario.events.length}.`
      );
      return;
    }
    const event = scenario.events[checkpointIndex - 1];
    setAnnouncement(
      `Checkpoint ${checkpointIndex} of ${scenario.events.length}: ${eventLabel(event)}.`
    );
  }, [checkpointIndex, isComplete, scenario]);

  function selectScenario(nextId: string) {
    if (!source.scenarios.some((candidate) => candidate.id === nextId)) return;
    setScenarioId(nextId);
    setCheckpointIndex(0);
    setIsPlaying(false);
    setHasStarted(false);
    setAnnouncement('Scenario changed. Simulation reset to checkpoint 0.');
    const search = new URLSearchParams(location.search);
    search.set('scenario', nextId);
    history.push({
      pathname: location.pathname,
      search: `?${search.toString()}`,
      hash: location.hash,
    });
  }

  async function copyShareLink() {
    const search = new URLSearchParams(location.search);
    search.set('scenario', scenario.id);
    const url = new URL(location.pathname, window.location.origin);
    url.search = search.toString();
    url.hash = location.hash;
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error('Clipboard permission is unavailable');
      }
      await navigator.clipboard.writeText(url.toString());
      setAnnouncement('Share link copied.');
    } catch {
      setAnnouncement(
        'Could not copy the share link. Select the browser address and copy it manually.'
      );
    }
  }

  function pauseOrResume() {
    if (isComplete) return;
    setHasStarted(true);
    setIsPlaying((playing) => !playing);
    setAnnouncement(isPlaying ? 'Simulation paused.' : 'Simulation resumed.');
  }

  function reset() {
    setCheckpointIndex(0);
    setIsPlaying(false);
    setHasStarted(false);
    setAnnouncement('Simulation reset to checkpoint 0.');
  }

  function replay() {
    setCheckpointIndex(0);
    setIsPlaying(true);
    setHasStarted(true);
    setAnnouncement('Deterministic replay started from checkpoint 0.');
  }

  function step() {
    if (isComplete || isPlaying) return;
    setIsPlaying(false);
    setHasStarted(true);
    setCheckpointIndex((index) => Math.min(index + 1, scenario.events.length));
  }

  return (
    <section
      className={clsx(styles.runtime, 'data-pipeline-explorer')}
      aria-labelledby={`${explorerId}-title`}
      data-explorer-version="2"
      data-explorer-mode="runtime"
      data-provenance="deterministic-simulation"
      data-verification-id={evidence.verificationId}
    >
      <header className={styles.identity}>
        <div>
          <p className={styles.kicker}>Runtime Explorer V2 proof</p>
          <h1 id={`${explorerId}-title`}>{title}</h1>
          <p className={styles.constraint}>
            Simulation — deterministic state machine. Not an Expanso execution.
          </p>
        </div>
        <dl className={styles.provenance} aria-label="Simulation provenance">
          <div>
            <dt>Provenance</dt>
            <dd>Deterministic simulation</dd>
          </div>
          <div>
            <dt>Evidence</dt>
            <dd>{evidence.verificationId}</dd>
          </div>
          <div>
            <dt>Checkpoint</dt>
            <dd>
              {checkpointIndex} / {scenario.events.length}
            </dd>
          </div>
        </dl>
      </header>

      <div
        className={styles.controls}
        role="group"
        aria-label="Simulation controls"
      >
        <label>
          Scenario
          <select
            value={scenario.id}
            onChange={(event) => selectScenario(event.target.value)}
          >
            {source.scenarios.map((candidate) => (
              <option value={candidate.id} key={candidate.id}>
                {candidate.label}
              </option>
            ))}
          </select>
        </label>
        <button type="button" disabled={isComplete} onClick={pauseOrResume}>
          {isPlaying
            ? 'Pause simulation'
            : checkpointIndex === 0 && !hasStarted
              ? 'Start simulation'
              : 'Resume simulation'}
        </button>
        <button type="button" disabled={isComplete || isPlaying} onClick={step}>
          Next event
        </button>
        <button type="button" onClick={reset}>
          Reset simulation
        </button>
        <button type="button" onClick={replay}>
          Replay simulation
        </button>
        <button type="button" onClick={() => void copyShareLink()}>
          Copy share link
        </button>
      </div>

      <p className={styles.announcement} role="status" aria-live="polite">
        {announcement}
      </p>

      <div className={styles.workspace}>
        <section
          className={styles.statePanel}
          aria-labelledby={`${explorerId}-state`}
        >
          <div className={styles.panelHeading}>
            <h2 id={`${explorerId}-state`}>Modeled state</h2>
            <span data-connection={state.connection}>{state.connection}</span>
          </div>
          <div className={styles.stateColumns}>
            <div>
              <h3>Buffered queue</h3>
              {state.queue.length === 0 ? (
                <p className={styles.empty}>Empty</p>
              ) : (
                <ol data-testid="runtime-queue">
                  {state.queue.map((record) => (
                    <li key={record.id}>
                      <strong>{record.id}</strong>
                      <span>{record.priority}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
            <div>
              <h3>Delivered</h3>
              {state.delivered.length === 0 ? (
                <p className={styles.empty}>Empty</p>
              ) : (
                <ol data-testid="runtime-delivered">
                  {state.delivered.map((record) => (
                    <li key={`${record.id}-${record.via}`}>
                      <strong>{record.id}</strong>
                      <span>{record.via}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        </section>

        <section
          className={styles.timeline}
          aria-labelledby={`${explorerId}-timeline`}
        >
          <h2 id={`${explorerId}-timeline`}>Event timeline</h2>
          <ol tabIndex={0} aria-labelledby={`${explorerId}-timeline`}>
            {scenario.events.map((event, index) => {
              const eventCheckpoint = index + 1;
              const processed = eventCheckpoint <= checkpointIndex;
              const current = eventCheckpoint === checkpointIndex;
              return (
                <li
                  aria-current={current ? 'step' : undefined}
                  data-state={
                    current ? 'current' : processed ? 'processed' : 'upcoming'
                  }
                  key={event.id}
                >
                  <span>{eventCheckpoint}</span>
                  <div>
                    <strong>{eventLabel(event)}</strong>
                    <small>{processed ? 'Processed' : 'Upcoming'}</small>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      </div>

      <section
        className={styles.assertions}
        aria-labelledby={`${explorerId}-assertions`}
      >
        <h2 id={`${explorerId}-assertions`}>Checkpoint assertions</h2>
        <ul>
          {checkpoint.assertions.map((assertion) => {
            const passes = assertionPasses(assertion, state);
            return (
              <li data-result={passes ? 'pass' : 'fail'} key={assertion.id}>
                <strong>{passes ? 'Pass' : 'Fail'}</strong>
                <span>{assertion.label}</span>
                <code>{JSON.stringify(assertionActual(assertion, state))}</code>
              </li>
            );
          })}
        </ul>
      </section>

      <details className={styles.evidence}>
        <summary>Simulation scope and immutable digests</summary>
        <div>
          <p>{scenario.description}</p>
          <h2>Modeled behavior</h2>
          <ul>
            {source.modeledBehaviors.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <h2>Not tested</h2>
          <ul>
            {evidence.excludedClaims.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <dl>
            <div>
              <dt>Source</dt>
              <dd>{evidence.sourceSha256}</dd>
            </div>
            <div>
              <dt>Checkpoints</dt>
              <dd>{evidence.checkpointSha256}</dd>
            </div>
            <div>
              <dt>State machine</dt>
              <dd>{evidence.stateMachineSha256}</dd>
            </div>
            <div>
              <dt>Command</dt>
              <dd>
                <code>{evidence.command}</code>
              </dd>
            </div>
          </dl>
        </div>
      </details>
    </section>
  );
}

export type { RuntimeExplorerProps };
