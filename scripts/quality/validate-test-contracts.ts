import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  CONTRACT_PATHS,
  loadContract,
  sha256Bytes,
  type QualityContract,
} from './contract-lib';

type UnknownRecord = Record<string, unknown>;

function objectAt(value: unknown, location: string): UnknownRecord {
  if (value === null || Array.isArray(value) || typeof value !== 'object') {
    throw new Error(`${location} must be an object`);
  }
  return value as UnknownRecord;
}

function arrayAt(value: unknown, location: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`${location} must be an array`);
  }
  return value;
}

function numberAt(value: unknown, location: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${location} must be a finite number`);
  }
  return value;
}

function stringAt(value: unknown, location: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${location} must be a non-empty string`);
  }
  return value;
}

function uniqueStrings(values: unknown[], location: string): string[] {
  const strings = values.map((value, index) =>
    stringAt(value, `${location}[${index}]`)
  );
  if (new Set(strings).size !== strings.length) {
    throw new Error(`${location} must contain unique values`);
  }
  return strings;
}

function validatePerformance(contract: QualityContract): void {
  if (
    contract.resultSchema !==
    'tests/contracts/schemas/performance-result-v1.schema.json'
  ) {
    throw new Error('performance.resultSchema must pin performance result v1');
  }
  if (
    contract.evidenceSchema !==
      'tests/contracts/schemas/performance-evidence-v1.schema.json' ||
    !existsSync(resolve(String(contract.evidenceSchema)))
  ) {
    throw new Error(
      'performance.evidenceSchema must pin an existing evidence v1 schema'
    );
  }
  const schemaBindings = objectAt(
    contract.schemaBindings,
    'performance.schemaBindings'
  );
  const expectedSchemaPaths = {
    evidence: String(contract.evidenceSchema),
    result: contract.resultSchema,
  };
  for (const [bindingId, expectedPath] of Object.entries(expectedSchemaPaths)) {
    const binding = objectAt(
      schemaBindings[bindingId],
      `performance.schemaBindings.${bindingId}`
    );
    if (binding.path !== expectedPath) {
      throw new Error(`performance.schemaBindings.${bindingId}.path mismatch`);
    }
    const actualDigest = sha256Bytes(readFileSync(resolve(expectedPath)));
    if (binding.sha256 !== actualDigest) {
      throw new Error(
        `performance.schemaBindings.${bindingId}.sha256 mismatch; expected ${actualDigest}`
      );
    }
  }
  const harnessBindings = objectAt(
    contract.harnessBindings,
    'performance.harnessBindings'
  );
  const expectedHarnessPaths = {
    collector: 'tests/quality/performance.spec.ts',
    reducer: 'scripts/quality/reduce-performance.ts',
    evidence: 'scripts/quality/performance-evidence.ts',
  };
  if (
    Object.keys(harnessBindings).length !==
    Object.keys(expectedHarnessPaths).length
  ) {
    throw new Error(
      'performance.harnessBindings must contain the exact v1 harness set'
    );
  }
  for (const [bindingId, expectedPath] of Object.entries(
    expectedHarnessPaths
  )) {
    const binding = objectAt(
      harnessBindings[bindingId],
      `performance.harnessBindings.${bindingId}`
    );
    if (binding.path !== expectedPath) {
      throw new Error(`performance.harnessBindings.${bindingId}.path mismatch`);
    }
    const actualDigest = sha256Bytes(readFileSync(resolve(expectedPath)));
    if (binding.sha256 !== actualDigest) {
      throw new Error(
        `performance.harnessBindings.${bindingId}.sha256 mismatch; expected ${actualDigest}`
      );
    }
  }
  const freshness = objectAt(
    contract.evidenceFreshness,
    'performance.evidenceFreshness'
  );
  if (
    numberAt(
      freshness.maxAgeMinutes,
      'performance.evidenceFreshness.maxAgeMinutes'
    ) !== 120 ||
    numberAt(
      freshness.maxFutureSkewMinutes,
      'performance.evidenceFreshness.maxFutureSkewMinutes'
    ) !== 5 ||
    freshness.sameEnvironmentRequired !== true
  ) {
    throw new Error(
      'performance.evidenceFreshness must pin the v1 freshness policy'
    );
  }
  const attribution = objectAt(
    contract.assetAttribution,
    'performance.assetAttribution'
  );
  if (
    attribution.source !== 'docusaurus-production-chunk-manifest-v1' ||
    attribution.shared !== 'entrypoint-assets' ||
    attribution.explorer !== 'route-assets-excluding-shared' ||
    attribution.compression !== 'gzip-level-9'
  ) {
    throw new Error(
      'performance.assetAttribution must pin production chunk attribution'
    );
  }

  const expectedTools = {
    node: '20.19.4',
    playwright: '1.55.1',
    chromium: '140.0.7339.186',
    lighthouse: '12.8.2',
  };
  if (
    !Object.entries(expectedTools).every(
      ([tool, version]) => contract.tools[tool] === version
    ) ||
    Object.keys(contract.tools).length !== Object.keys(expectedTools).length
  ) {
    throw new Error('performance.tools must pin the v1 execution toolchain');
  }

  const requiredEvidence = uniqueStrings(
    arrayAt(contract.requiredEvidence, 'performance.requiredEvidence'),
    'performance.requiredEvidence'
  );
  const expectedEvidence = [
    'baselineSha',
    'candidateSha',
    'fixtureIds',
    'stageIds',
    'toolVersions',
    'timestamps',
    'rawTraces',
    'environmentId',
  ];
  if (
    requiredEvidence.length !== expectedEvidence.length ||
    !expectedEvidence.every((field) => requiredEvidence.includes(field))
  ) {
    throw new Error(
      'performance.requiredEvidence must pin all v1 evidence fields'
    );
  }

  const comparison = objectAt(contract.comparison, 'performance.comparison');
  if (
    comparison.baselineRequired !== true ||
    comparison.candidateRequired !== true ||
    comparison.contractDigestMustMatch !== true ||
    comparison.missingFieldData !== 'UNKNOWN'
  ) {
    throw new Error(
      'performance.comparison must fail closed under the v1 policy'
    );
  }

  const aggregation = objectAt(contract.aggregation, 'performance.aggregation');
  if (
    aggregation.pageLoad !== 'p75' ||
    aggregation.transferredGzipBytes !== 'max' ||
    aggregation.explorerScripting !== 'p95'
  ) {
    throw new Error('performance.aggregation must pin p75/max/p95');
  }
  const cacheModes = uniqueStrings(
    arrayAt(contract.cacheModes, 'performance.cacheModes'),
    'performance.cacheModes'
  );
  if (
    cacheModes.length !== 2 ||
    !cacheModes.includes('cold-page-load') ||
    !cacheModes.includes('warm-explorer-interaction')
  ) {
    throw new Error(
      'performance.cacheModes must pin cold load and warm Explorer'
    );
  }

  const requiredRouteIds = contract.routes.required.map((route) => route.id);
  for (const id of [
    'catalog',
    'remove-pii-pilot',
    'scada-pilot',
    'runtime-proof',
  ]) {
    if (!requiredRouteIds.includes(id)) {
      throw new Error(`performance.routes.required is missing ${id}`);
    }
  }
  for (const fixtureId of ['remove-pii-input', 'scada-input']) {
    if (!contract.fixtures.some((fixture) => fixture.id === fixtureId)) {
      throw new Error(`performance.fixtures is missing ${fixtureId}`);
    }
  }

  const profiles = objectAt(contract.profiles, 'performance.profiles');
  const mobile = objectAt(profiles.mobile, 'performance.profiles.mobile');
  const desktop = objectAt(profiles.desktop, 'performance.profiles.desktop');

  const expectedProfiles = {
    mobile: {
      width: 390,
      height: 844,
      deviceScaleFactor: 3,
      cpuSlowdown: 4,
      latencyMs: 150,
      downloadKbps: 1600,
      uploadKbps: 750,
    },
    desktop: {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      cpuSlowdown: 1,
      latencyMs: 40,
      downloadKbps: 10000,
      uploadKbps: 10000,
    },
  } as const;

  for (const [profileName, expected] of Object.entries(expectedProfiles)) {
    const profile = profileName === 'mobile' ? mobile : desktop;
    for (const [field, expectedValue] of Object.entries(expected)) {
      const actualValue = numberAt(
        profile[field],
        `performance.profiles.${profileName}.${field}`
      );
      if (actualValue !== expectedValue) {
        throw new Error(
          `performance.profiles.${profileName}.${field} must be ${expectedValue}`
        );
      }
    }
  }

  const runs = objectAt(contract.runs, 'performance.runs');
  if (
    numberAt(runs.pageLoadsPerCell, 'performance.runs.pageLoadsPerCell') !== 7
  ) {
    throw new Error('performance.runs.pageLoadsPerCell must be 7');
  }
  if (runs.discardOutliers !== false) {
    throw new Error('performance.runs.discardOutliers must be false');
  }
  if (
    numberAt(runs.explorerWarmups, 'performance.runs.explorerWarmups') !== 3
  ) {
    throw new Error('performance.runs.explorerWarmups must be 3');
  }
  if (
    numberAt(
      runs.explorerMeasuredTransitions,
      'performance.runs.explorerMeasuredTransitions'
    ) !== 30
  ) {
    throw new Error('performance.runs.explorerMeasuredTransitions must be 30');
  }

  const thresholds = objectAt(contract.thresholds, 'performance.thresholds');
  const expectedThresholds = {
    sharedJavaScriptGzipBytes: 180 * 1024,
    explorerIncrementGzipBytes: 25 * 1024,
    globalCssGzipBytes: 25 * 1024,
    mobileLcpMsP75: 2500,
    mobileClsP75Exclusive: 0.1,
    mobileInpMsP75: 200,
    explorerScriptingMsP95Exclusive: 100,
    pageOverflowCssPixels: 0,
  };
  for (const [field, expected] of Object.entries(expectedThresholds)) {
    if (
      numberAt(thresholds[field], `performance.thresholds.${field}`) !==
      expected
    ) {
      throw new Error(`performance.thresholds.${field} must be ${expected}`);
    }
  }

  const themes = uniqueStrings(
    arrayAt(contract.themes, 'performance.themes'),
    'performance.themes'
  );
  if (!themes.includes('light') || !themes.includes('dark')) {
    throw new Error('performance.themes must include light and dark');
  }
  if (themes.length !== 2) {
    throw new Error('performance.themes must contain only light and dark');
  }
}

function validateAccessibility(contract: QualityContract): void {
  const cells = objectAt(contract.cells, 'accessibility.cells');
  const local = arrayAt(
    cells.localRequired,
    'accessibility.cells.localRequired'
  ).map((value, index) =>
    objectAt(value, `accessibility.cells.localRequired[${index}]`)
  );
  const localIds = new Set(
    local.map((cell, index) =>
      stringAt(cell.id, `accessibility.cells.localRequired[${index}].id`)
    )
  );
  const requiredLocalIds = [
    'chromium-structural-scan',
    'accessibility-tree',
    'keyboard-trace',
    'forced-colors',
    'text-spacing',
    'orientation',
    'reflow-320',
    'zoom-200',
    'zoom-400',
    'reduced-motion',
    'clipboard-denial',
    'download-failure',
    'target-size',
    'dark-light-viewports',
  ];
  for (const id of requiredLocalIds) {
    if (!localIds.has(id)) {
      throw new Error(`accessibility.cells.localRequired is missing ${id}`);
    }
  }
  if (
    local.length !== requiredLocalIds.length ||
    localIds.size !== local.length
  ) {
    throw new Error(
      'accessibility.cells.localRequired must contain each declared local oracle exactly once'
    );
  }

  const claimBound = arrayAt(
    cells.claimBoundRequired,
    'accessibility.cells.claimBoundRequired'
  ).map((value, index) =>
    objectAt(value, `accessibility.cells.claimBoundRequired[${index}]`)
  );
  const claimIds = new Set(
    claimBound.map((cell, index) =>
      stringAt(cell.id, `accessibility.cells.claimBoundRequired[${index}].id`)
    )
  );
  for (const id of [
    'voiceover-safari',
    'narrator-edge',
    'talkback-android-chrome',
    'physical-ios-safari',
    'physical-android-chrome',
  ]) {
    if (!claimIds.has(id)) {
      throw new Error(
        `accessibility.cells.claimBoundRequired is missing ${id}`
      );
    }
  }
  if (claimBound.length !== 5 || claimIds.size !== claimBound.length) {
    throw new Error(
      'accessibility.cells.claimBoundRequired must contain each claim exactly once'
    );
  }
  for (const [index, cell] of claimBound.entries()) {
    if (cell.unavailable !== 'BLOCKED_CAPABILITY') {
      throw new Error(
        `accessibility.cells.claimBoundRequired[${index}].unavailable must be BLOCKED_CAPABILITY`
      );
    }
  }

  const environments = arrayAt(
    contract.environments,
    'accessibility.environments'
  ).map((value, index) =>
    objectAt(value, `accessibility.environments[${index}]`)
  );
  const environmentIds = environments.map((environment, index) =>
    stringAt(environment.id, `accessibility.environments[${index}].id`)
  );
  if (
    new Set(environmentIds).size !== environmentIds.length ||
    !['desktop', 'tablet', 'mobile', 'reflow-320'].every((id) =>
      environmentIds.includes(id)
    )
  ) {
    throw new Error(
      'accessibility.environments must uniquely declare desktop, tablet, mobile, and reflow-320'
    );
  }

  const themes = uniqueStrings(
    arrayAt(contract.themes, 'accessibility.themes'),
    'accessibility.themes'
  );
  if (
    themes.length !== 2 ||
    !themes.includes('dark') ||
    !themes.includes('light')
  ) {
    throw new Error('accessibility.themes must be exactly dark and light');
  }
  const interactionModes = uniqueStrings(
    arrayAt(contract.interactionModes, 'accessibility.interactionModes'),
    'accessibility.interactionModes'
  );
  if (
    interactionModes.length !== 2 ||
    !interactionModes.includes('transformation') ||
    !interactionModes.includes('runtime')
  ) {
    throw new Error(
      'accessibility.interactionModes must be exactly transformation and runtime'
    );
  }
  for (const [index, cell] of local.entries()) {
    const coverage = objectAt(
      cell.requiredCoverage,
      `accessibility.cells.localRequired[${index}].requiredCoverage`
    );
    const requiredEnvironments = uniqueStrings(
      arrayAt(
        coverage.environments,
        `accessibility.cells.localRequired[${index}].requiredCoverage.environments`
      ),
      `accessibility.cells.localRequired[${index}].requiredCoverage.environments`
    );
    const requiredThemes = uniqueStrings(
      arrayAt(
        coverage.themes,
        `accessibility.cells.localRequired[${index}].requiredCoverage.themes`
      ),
      `accessibility.cells.localRequired[${index}].requiredCoverage.themes`
    );
    const requiredModes = uniqueStrings(
      arrayAt(
        coverage.interactionModes,
        `accessibility.cells.localRequired[${index}].requiredCoverage.interactionModes`
      ),
      `accessibility.cells.localRequired[${index}].requiredCoverage.interactionModes`
    );
    if (
      requiredEnvironments.length === 0 ||
      requiredEnvironments.some((id) => !environmentIds.includes(id))
    ) {
      throw new Error(
        `accessibility.cells.localRequired[${index}] has invalid required environments`
      );
    }
    if (
      requiredThemes.length === 0 ||
      requiredThemes.some((id) => !themes.includes(id))
    ) {
      throw new Error(
        `accessibility.cells.localRequired[${index}] has invalid required themes`
      );
    }
    if (
      requiredModes.length === 0 ||
      requiredModes.some((id) => !interactionModes.includes(id))
    ) {
      throw new Error(
        `accessibility.cells.localRequired[${index}] has invalid required interaction modes`
      );
    }
    if (!['all', 'explorer-v2'].includes(String(coverage.routeCapability))) {
      throw new Error(
        `accessibility.cells.localRequired[${index}] has invalid routeCapability`
      );
    }
  }
  const unavailableModes = arrayAt(
    contract.unavailableInteractionModes,
    'accessibility.unavailableInteractionModes'
  ).map((value, index) =>
    objectAt(value, `accessibility.unavailableInteractionModes[${index}]`)
  );
  if (unavailableModes.length !== 0) {
    throw new Error(
      'accessibility.unavailableInteractionModes must be empty once the runtime proof is bound'
    );
  }

  const distinctStates = uniqueStrings(
    arrayAt(
      contract.materiallyDistinctStates,
      'accessibility.materiallyDistinctStates'
    ),
    'accessibility.materiallyDistinctStates'
  );
  const requiredStates = [
    'default',
    'stage-selected',
    'changes-only',
    'highlights-only',
    'full-data',
    'clipboard-error',
    'download-error',
    'missing-full-yaml',
    'malformed-fixture',
    'oversized-fixture',
    'zero-stage',
    'one-stage',
    'long-stage-name',
    'high-density',
  ];
  if (
    distinctStates.length !== requiredStates.length ||
    requiredStates.some((id) => !distinctStates.includes(id))
  ) {
    throw new Error(
      'accessibility.materiallyDistinctStates must contain every bound Explorer state exactly once'
    );
  }
  const unavailableStates = arrayAt(
    contract.unavailableStates,
    'accessibility.unavailableStates'
  ).map((value, index) =>
    objectAt(value, `accessibility.unavailableStates[${index}]`)
  );
  if (unavailableStates.length !== 0) {
    throw new Error(
      'accessibility.unavailableStates must be empty once edge fixtures are bound'
    );
  }

  if (
    contract.resultSchema !==
    'tests/contracts/schemas/accessibility-result-v1.schema.json'
  ) {
    throw new Error(
      'accessibility.resultSchema must use accessibility-result-v1.schema.json'
    );
  }

  const harnessFiles = arrayAt(
    contract.harnessFiles,
    'accessibility.harnessFiles'
  );
  for (const [index, value] of harnessFiles.entries()) {
    const binding = objectAt(value, `accessibility.harnessFiles[${index}]`);
    const filePath = stringAt(
      binding.path,
      `accessibility.harnessFiles[${index}].path`
    );
    const expectedDigest = stringAt(
      binding.sha256,
      `accessibility.harnessFiles[${index}].sha256`
    );
    if (!existsSync(resolve(filePath))) {
      throw new Error(`accessibility harness file is missing: ${filePath}`);
    }
    const actualDigest = sha256Bytes(readFileSync(resolve(filePath)));
    if (actualDigest !== expectedDigest) {
      throw new Error(
        `accessibility harness file digest mismatch: ${filePath}`
      );
    }
  }

  const standard = objectAt(contract.standard, 'accessibility.standard');
  if (
    standard.name !== 'WCAG' ||
    standard.version !== '2.2' ||
    standard.level !== 'AA'
  ) {
    throw new Error('accessibility.standard must be WCAG 2.2 AA');
  }
  if (
    numberAt(
      standard.minimumTargetCssPixels,
      'accessibility.standard.minimumTargetCssPixels'
    ) !== 44
  ) {
    throw new Error('accessibility.standard.minimumTargetCssPixels must be 44');
  }
}

function validateMachineJourney(contract: QualityContract): void {
  if (
    contract.resultSchema !==
    'tests/contracts/schemas/machine-journey-result-v2.schema.json'
  ) {
    throw new Error('machineJourney.resultSchema must pin result v2');
  }
  const scorer = objectAt(contract.scorer, 'machineJourney.scorer');
  if (
    scorer.version !== 'machine-journey-scorer@2.0.0' ||
    scorer.deterministic !== true
  ) {
    throw new Error('machineJourney.scorer.deterministic must be true');
  }
  const outputSchema = objectAt(
    scorer.outputSchema,
    'machineJourney.scorer.outputSchema'
  );
  if (
    outputSchema.path !==
    'tests/contracts/schemas/machine-journey-scorer-output-v2.schema.json'
  ) {
    throw new Error('machineJourney scorer output schema path is not pinned');
  }
  const scorerSchemaDigest = sha256Bytes(
    readFileSync(resolve(String(outputSchema.path)))
  );
  if (outputSchema.sha256 !== scorerSchemaDigest) {
    throw new Error('machineJourney scorer output schema digest mismatch');
  }

  const traceSchemas = objectAt(
    contract.traceSchemas,
    'machineJourney.traceSchemas'
  );
  const expectedTraceSchemas = {
    dom: {
      format: 'journey-dom-trace-v1',
      path: 'tests/contracts/schemas/machine-journey-dom-trace-v1.schema.json',
    },
    network: {
      format: 'journey-network-trace-v1',
      path: 'tests/contracts/schemas/machine-journey-network-trace-v1.schema.json',
    },
    commands: {
      format: 'journey-commands-trace-v1',
      path: 'tests/contracts/schemas/machine-journey-commands-trace-v1.schema.json',
    },
  } as const;
  if (
    JSON.stringify(Object.keys(traceSchemas).sort()) !==
    JSON.stringify(Object.keys(expectedTraceSchemas).sort())
  ) {
    throw new Error(
      'machineJourney.traceSchemas must pin DOM/network/commands'
    );
  }
  for (const [field, expected] of Object.entries(expectedTraceSchemas)) {
    const binding = objectAt(
      traceSchemas[field],
      `machineJourney.traceSchemas.${field}`
    );
    if (binding.format !== expected.format || binding.path !== expected.path) {
      throw new Error(`machineJourney trace schema binding mismatch: ${field}`);
    }
    const digest = sha256Bytes(readFileSync(resolve(expected.path)));
    if (binding.sha256 !== digest) {
      throw new Error(`machineJourney trace schema digest mismatch: ${field}`);
    }
  }

  const sourceBindings = objectAt(
    contract.sourceBindings,
    'machineJourney.sourceBindings'
  );
  const expectedSources = {
    scorer: 'scripts/quality/reduce-machine-journey.ts',
    runner: 'scripts/test-pipelines.ts',
    harness: 'tests/quality/machine-journey-reducer.test.ts',
  } as const;
  if (
    JSON.stringify(Object.keys(sourceBindings).sort()) !==
    JSON.stringify(Object.keys(expectedSources).sort())
  ) {
    throw new Error('machineJourney must bind scorer, runner, and harness');
  }
  for (const [role, path] of Object.entries(expectedSources)) {
    const binding = objectAt(
      sourceBindings[role],
      `machineJourney.sourceBindings.${role}`
    );
    if (binding.path !== path) {
      throw new Error(`machineJourney source path mismatch: ${role}`);
    }
    if (binding.sha256 !== sha256Bytes(readFileSync(resolve(path)))) {
      throw new Error(`machineJourney source digest mismatch: ${role}`);
    }
  }

  const capabilities = objectAt(
    contract.capabilities,
    'machineJourney.capabilities'
  );
  const localRunCapability = objectAt(
    capabilities['run-offline-path'],
    'machineJourney.capabilities.run-offline-path'
  );
  if (
    localRunCapability.status !== 'AVAILABLE' ||
    localRunCapability.command !== 'npm run test-pipelines' ||
    localRunCapability.runnerSourceBinding !== 'runner'
  ) {
    throw new Error(
      'machineJourney run-offline-path must bind the deterministic fixture runner'
    );
  }
  const producerCapability = objectAt(
    capabilities['journey-producer'],
    'machineJourney.capabilities.journey-producer'
  );
  if (
    producerCapability.status !== 'BLOCKED_CAPABILITY' ||
    producerCapability.reasonCode !== 'NO_RAW_BROWSER_EVIDENCE_PRODUCER'
  ) {
    throw new Error(
      'machineJourney producer must remain blocked until raw browser evidence is automated'
    );
  }

  const trials = arrayAt(contract.trials, 'machineJourney.trials');
  if (trials.length !== 9) {
    throw new Error('machineJourney.trials must contain exactly nine trials');
  }

  const trialIds: string[] = [];
  const personaCounts = new Map<string, number>();
  const seedsByPersona = new Map<string, Set<string>>();
  const requiredTaskIds = [
    'find-example',
    'explain-boundary',
    'open-shared-stage',
    'retrieve-pipeline',
    'run-offline-path',
  ];

  for (const [trialIndex, trialValue] of trials.entries()) {
    const trial = objectAt(trialValue, `machineJourney.trials[${trialIndex}]`);
    const trialId = stringAt(
      trial.trialId,
      `machineJourney.trials[${trialIndex}].trialId`
    );
    const persona = stringAt(
      trial.persona,
      `machineJourney.trials[${trialIndex}].persona`
    );
    const seed = stringAt(
      trial.seed,
      `machineJourney.trials[${trialIndex}].seed`
    );
    if (
      !['evaluator', 'practitioner', 'existing-user-context'].includes(persona)
    ) {
      throw new Error(
        `machineJourney.trials[${trialIndex}].persona is invalid`
      );
    }
    trialIds.push(trialId);
    personaCounts.set(persona, (personaCounts.get(persona) ?? 0) + 1);
    const personaSeeds = seedsByPersona.get(persona) ?? new Set<string>();
    personaSeeds.add(seed);
    seedsByPersona.set(persona, personaSeeds);

    const tasks = arrayAt(
      trial.tasks,
      `machineJourney.trials[${trialIndex}].tasks`
    );
    if (tasks.length !== 5) {
      throw new Error(
        `machineJourney.trials[${trialIndex}].tasks must contain five tasks`
      );
    }
    const taskIds = new Set<string>();
    for (const [taskIndex, taskValue] of tasks.entries()) {
      const location = `machineJourney.trials[${trialIndex}].tasks[${taskIndex}]`;
      const task = objectAt(taskValue, location);
      taskIds.add(stringAt(task.taskId, `${location}.taskId`));
      stringAt(task.prompt, `${location}.prompt`);
      stringAt(task.startUrl, `${location}.startUrl`);
      uniqueStrings(
        arrayAt(task.allowedTools, `${location}.allowedTools`),
        `${location}.allowedTools`
      );
      stringAt(task.intendedFamilyId, `${location}.intendedFamilyId`);
      stringAt(task.intendedRouteId, `${location}.intendedRouteId`);
      arrayAt(task.acceptedAliases, `${location}.acceptedAliases`);
      objectAt(task.boundaryOracle, `${location}.boundaryOracle`);
      objectAt(task.explorerOracle, `${location}.explorerOracle`);
      objectAt(task.pipelineOracle, `${location}.pipelineOracle`);
      const localRunOracle = objectAt(
        task.localRunOracle,
        `${location}.localRunOracle`
      );
      if (localRunOracle.command !== 'npm run test-pipelines') {
        throw new Error(`${location}.localRunOracle.command is stale`);
      }
      numberAt(task.timeoutMs, `${location}.timeoutMs`);
      stringAt(task.timerStartEvent, `${location}.timerStartEvent`);
      stringAt(task.timerStopEvent, `${location}.timerStopEvent`);
    }
    for (const taskId of requiredTaskIds) {
      if (!taskIds.has(taskId)) {
        throw new Error(`${trialId} is missing task ${taskId}`);
      }
    }
  }

  if (new Set(trialIds).size !== trialIds.length) {
    throw new Error('machineJourney trial ids must be unique');
  }
  for (const persona of [
    'evaluator',
    'practitioner',
    'existing-user-context',
  ]) {
    if (
      personaCounts.get(persona) !== 3 ||
      seedsByPersona.get(persona)?.size !== 3
    ) {
      throw new Error(
        `${persona} must have exactly three trials with three unique seeds`
      );
    }
  }

  const aggregation = objectAt(
    contract.aggregation,
    'machineJourney.aggregation'
  );
  if (
    aggregation.successesRequiredPerTask !== 7 ||
    aggregation.successesRequiredPerPersona !== 2 ||
    JSON.stringify(aggregation.blockedTaskIds) !== JSON.stringify([])
  ) {
    throw new Error(
      'machineJourney aggregation must require 7/9 overall and 2/3 per persona without blocked task cells'
    );
  }
}

const validators: Record<string, (contract: QualityContract) => void> = {
  'performance-v1': validatePerformance,
  'accessibility-v1': validateAccessibility,
  'machine-journey-v1': validateMachineJourney,
};

const errors: string[] = [];
const summaries: Array<{ contractId: string; digest: string; status: 'PASS' }> =
  [];

for (const path of CONTRACT_PATHS) {
  try {
    const contract = loadContract(path);
    const validate = validators[contract.contractId];
    if (!validate) {
      throw new Error(`No validator exists for ${contract.contractId}`);
    }
    validate(contract);
    summaries.push({
      contractId: contract.contractId,
      digest: contract.contractSha256,
      status: 'PASS',
    });
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }
}

const result = {
  schemaVersion: 'quality-contract-validation-v1',
  status: errors.length === 0 ? 'PASS' : 'FAIL',
  contracts: summaries,
  errors,
};

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
if (errors.length > 0) {
  process.exitCode = 1;
}
