import type {
  RuntimeAssertion,
  RuntimeCheckpointArtifact,
  RuntimeConnection,
  RuntimeEvent,
  RuntimePriority,
  RuntimeScenario,
  RuntimeSource,
  RuntimeState,
} from './types';

const priorities: readonly RuntimePriority[] = ['critical', 'normal'];
const connections: readonly RuntimeConnection[] = ['online', 'offline'];

function priorityRank(priority: RuntimePriority): number {
  return priorities.indexOf(priority);
}

function cloneState(state: RuntimeState): RuntimeState {
  return {
    ...state,
    queue: state.queue.map((record) => ({ ...record })),
    delivered: state.delivered.map((record) => ({ ...record })),
    processedEventIds: [...state.processedEventIds],
  };
}

function fail(message: string): never {
  throw new Error(`Invalid disconnected-edge runtime source: ${message}`);
}

export function validateRuntimeSource(source: RuntimeSource): RuntimeSource {
  if (source.schemaVersion !== '1.0.0') fail('schemaVersion must be 1.0.0');
  if (source.exampleId !== 'runtime-proof-disconnected-edge') {
    fail('exampleId must identify the non-public proof');
  }
  if (source.timelineUnit !== 'event') fail('timelineUnit must be event');
  if (
    source.modeledBehaviors.length === 0 ||
    source.modeledBehaviors.some((item) => !item.trim())
  ) {
    fail('modeledBehaviors must contain non-empty declarations');
  }
  if (source.scenarios.length === 0) fail('at least one scenario is required');

  const scenarioIds = new Set<string>();
  for (const scenario of source.scenarios) {
    if (!scenario.id || scenarioIds.has(scenario.id)) {
      fail(`scenario id is missing or duplicated: ${scenario.id}`);
    }
    scenarioIds.add(scenario.id);
    if (!scenario.label.trim() || !scenario.description.trim()) {
      fail(`scenario ${scenario.id} must have a label and description`);
    }
    if (!scenario.deterministicSeed) {
      fail(`scenario ${scenario.id} has no deterministic seed`);
    }
    if (!connections.includes(scenario.initialConnection)) {
      fail(`scenario ${scenario.id} has an invalid initial connection`);
    }
    const eventIds = new Set<string>();
    const recordIds = new Set<string>();
    scenario.events.forEach((event, index) => {
      if (!event.id || eventIds.has(event.id)) {
        fail(`scenario ${scenario.id} has a missing or duplicate event id`);
      }
      eventIds.add(event.id);
      if (event.at !== index + 1) {
        fail(`scenario ${scenario.id} event positions must be sequential`);
      }
      if (event.kind === 'record-arrived') {
        if (
          !event.record.id ||
          recordIds.has(event.record.id) ||
          !priorities.includes(event.record.priority)
        ) {
          fail(`scenario ${scenario.id} has an invalid record event`);
        }
        recordIds.add(event.record.id);
      } else if (
        event.kind === 'link-state' &&
        !connections.includes(event.connection)
      ) {
        fail(`scenario ${scenario.id} has an invalid link state`);
      } else if (
        event.kind !== 'link-state' &&
        event.kind !== 'replay-buffer'
      ) {
        fail(`scenario ${scenario.id} has an unsupported event kind`);
      }
    });
  }
  return source;
}

export function initialRuntimeState(scenario: RuntimeScenario): RuntimeState {
  return {
    tick: 0,
    connection: scenario.initialConnection,
    queue: [],
    delivered: [],
    processedEventIds: [],
  };
}

export function applyRuntimeEvent(
  current: RuntimeState,
  event: RuntimeEvent
): RuntimeState {
  if (event.at !== current.tick + 1) {
    fail(`event ${event.id} is out of sequence`);
  }
  if (current.processedEventIds.includes(event.id)) {
    fail(`event ${event.id} was already processed`);
  }

  const next = cloneState(current);
  next.tick = event.at;
  next.processedEventIds.push(event.id);

  if (event.kind === 'link-state') {
    next.connection = event.connection;
    return next;
  }

  if (event.kind === 'record-arrived') {
    if (next.connection === 'online') {
      next.delivered.push({ ...event.record, via: 'direct' });
    } else {
      next.queue.push({ ...event.record });
      next.queue.sort(
        (left, right) =>
          priorityRank(left.priority) - priorityRank(right.priority)
      );
    }
    return next;
  }

  if (next.connection !== 'online') {
    fail(`event ${event.id} cannot replay while the link is offline`);
  }
  next.delivered.push(
    ...next.queue.map((record) => ({
      ...record,
      via: 'buffer-replay' as const,
    }))
  );
  next.queue = [];
  return next;
}

export function runRuntimeScenario(scenario: RuntimeScenario): RuntimeState[] {
  const states = [initialRuntimeState(scenario)];
  for (const event of scenario.events) {
    states.push(applyRuntimeEvent(states.at(-1)!, event));
  }
  return states;
}

export function assertionActual(
  assertion: RuntimeAssertion,
  state: RuntimeState
): RuntimeConnection | string[] {
  switch (assertion.path) {
    case '/connection':
      return state.connection;
    case '/queue/ids':
      return state.queue.map((record) => record.id);
    case '/delivered/ids':
      return state.delivered.map((record) => record.id);
    default:
      return fail(
        `assertion has an unsupported path: ${(assertion as { path: string }).path}`
      );
  }
}

export function assertionPasses(
  assertion: RuntimeAssertion,
  state: RuntimeState
): boolean {
  return (
    JSON.stringify(assertionActual(assertion, state)) ===
    JSON.stringify(assertion.equals)
  );
}

export function validateCheckpointArtifact(
  source: RuntimeSource,
  artifact: RuntimeCheckpointArtifact
): RuntimeCheckpointArtifact {
  if (
    artifact.schemaVersion !== '1.0.0' ||
    artifact.exampleId !== source.exampleId
  ) {
    fail('checkpoint artifact header does not match the source');
  }
  if (artifact.scenarios.length !== source.scenarios.length) {
    fail('checkpoint artifact scenario count does not match the source');
  }

  for (const scenario of source.scenarios) {
    const expected = artifact.scenarios.find(
      (candidate) => candidate.scenarioId === scenario.id
    );
    if (!expected) fail(`checkpoint artifact is missing ${scenario.id}`);
    const states = runRuntimeScenario(scenario);
    if (expected.checkpoints.length !== states.length) {
      fail(`checkpoint count does not match for ${scenario.id}`);
    }
    expected.checkpoints.forEach((checkpoint, index) => {
      const eventId = index === 0 ? null : scenario.events[index - 1].id;
      if (
        checkpoint.index !== index ||
        checkpoint.eventId !== eventId ||
        JSON.stringify(checkpoint.state) !== JSON.stringify(states[index])
      ) {
        fail(`checkpoint ${scenario.id}/${index} does not match replay`);
      }
      if (
        checkpoint.assertions.some(
          (assertion) => !assertionPasses(assertion, states[index])
        )
      ) {
        fail(`checkpoint assertion failed for ${scenario.id}/${index}`);
      }
      if (checkpoint.assertions.length === 0) {
        fail(`checkpoint ${scenario.id}/${index} has no assertions`);
      }
      const assertionIds = new Set(
        checkpoint.assertions.map((assertion) => assertion.id)
      );
      if (
        assertionIds.size !== checkpoint.assertions.length ||
        checkpoint.assertions.some(
          (assertion) => !assertion.id.trim() || !assertion.label.trim()
        )
      ) {
        fail(`checkpoint ${scenario.id}/${index} has invalid assertions`);
      }
    });
  }
  return artifact;
}
