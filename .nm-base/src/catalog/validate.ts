import {
  AGENT_LANES,
  CATALOG_SCHEMA_VERSION,
  COMPONENTS,
  EXPLORER_EVIDENCE_SCHEMA_DIGEST,
  GOAL_FACETS,
  INDUSTRY_FACETS,
  LOCATION_FACETS,
  VERIFICATION_POLICY_DIGEST,
  type PublicCatalog,
} from './schema';

export interface CatalogValidationResult {
  valid: boolean;
  errors: string[];
}

const RECORD_KEYS = new Set([
  'claimIds',
  'completePipelinePath',
  'difficulty',
  'executionStatus',
  'expectedOutputPath',
  'expectedTime',
  'explorerEvidence',
  'fixturePath',
  'goals',
  'id',
  'industries',
  'interaction',
  'lastEditorialVerification',
  'lastTechnicalVerification',
  'legacyRoutes',
  'oneLineOutcome',
  'operationalEvidence',
  'primaryGoal',
  'producerLane',
  'replaces',
  'retirementReason',
  'routes',
  'status',
  'title',
  'topology',
  'verificationPolicyDigest',
  'verifierLane',
]);

const NODE_KEYS = new Set([
  'componentId',
  'id',
  'kind',
  'label',
  'location',
  'publicVerification',
  'requiredForCorePath',
]);

const EXPLORER_EVIDENCE_KEYS = new Set([
  'authoredStageModulePath',
  'authoredStageModuleSha256',
  'bindingManifestPath',
  'bindingManifestSha256',
  'canonicalPipelinePath',
  'command',
  'environment',
  'exampleId',
  'executionStatus',
  'fixturePath',
  'fixtureSha256',
  'fixtureEnvironmentPath',
  'fixtureEnvironmentSha256',
  'expectedOutputPath',
  'expectedOutputSha256',
  'fidelityContractId',
  'fidelityOraclePath',
  'fidelityOracleSha256',
  'generatedAt',
  'kind',
  'inputCheckpointPath',
  'inputCheckpointSha256',
  'outputOrCheckpointPath',
  'outputOrCheckpointSha256',
  'operationalEvidence',
  'outputCheckpointPath',
  'outputCheckpointSha256',
  'pipelineSha256',
  'processorCount',
  'checkpointCount',
  'schemaDigest',
  'semanticsVerifierPath',
  'semanticsVerifierSha256',
  'stageCount',
  'toolVersions',
  'verificationId',
  'verifierLane',
]);

const INTEGRATION_COMPONENTS = new Set([
  'amazon-s3',
  'anthropic-claude',
  'db2',
  'elasticsearch',
  'fleet-management',
  'google-bigquery',
  'grafana',
  'kafka',
  'motherduck',
  'postgresql',
  'redis',
  'scada-gateway',
  'splunk-hec',
]);

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function rejectUnknownKeys(
  value: Record<string, unknown>,
  allowed: ReadonlySet<string>,
  path: string,
  errors: string[]
) {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) errors.push(`${path}.${key}: unknown field`);
  }
}

function requireString(value: unknown, path: string, errors: string[]) {
  if (typeof value !== 'string' || value.trim() === '') {
    errors.push(`${path}: expected a non-empty string`);
    return undefined;
  }
  return value;
}

function requireEnum(
  value: unknown,
  allowed: ReadonlySet<string>,
  path: string,
  errors: string[]
) {
  const text = requireString(value, path, errors);
  if (text !== undefined && !allowed.has(text)) {
    errors.push(`${path}: unknown value ${JSON.stringify(text)}`);
    return undefined;
  }
  return text;
}

function requireInteger(value: unknown, path: string, errors: string[]) {
  if (!Number.isInteger(value) || (value as number) < 1) {
    errors.push(`${path}: expected a positive integer`);
  }
}

function validateStringArray(
  value: unknown,
  path: string,
  errors: string[],
  allowed?: ReadonlySet<string>
) {
  if (!Array.isArray(value)) {
    errors.push(`${path}: expected an array`);
    return [];
  }

  const seen = new Set<string>();
  const values: string[] = [];
  value.forEach((entry, index) => {
    const text = requireString(entry, `${path}[${index}]`, errors);
    if (text === undefined) return;
    if (seen.has(text))
      errors.push(`${path}[${index}]: duplicate value ${JSON.stringify(text)}`);
    if (allowed && !allowed.has(text))
      errors.push(`${path}[${index}]: unknown value ${JSON.stringify(text)}`);
    seen.add(text);
    values.push(text);
  });
  return values;
}

function validateDate(value: unknown, path: string, errors: string[]) {
  const text = requireString(value, path, errors);
  if (text !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    errors.push(`${path}: expected an ISO calendar date (YYYY-MM-DD)`);
  }
}

function validateRoute(value: unknown, path: string, errors: string[]) {
  const text = requireString(value, path, errors);
  if (
    text !== undefined &&
    (!/^\/[a-z0-9][a-z0-9/-]*\/$/.test(text) || text.includes('//'))
  ) {
    errors.push(
      `${path}: expected a canonical lowercase route with leading and trailing slash`
    );
  }
  return text;
}

function validateRepositoryPath(
  value: unknown,
  path: string,
  errors: string[]
) {
  const text = requireString(value, path, errors);
  if (
    text !== undefined &&
    (text.startsWith('/') ||
      text.includes('..') ||
      text.includes('\\') ||
      text.includes('/Us' + 'ers/'))
  ) {
    errors.push(`${path}: expected a repository-relative public path`);
  }
}

function validateExplorerEvidence(
  value: unknown,
  path: string,
  recordId: string | undefined,
  producerLane: string | undefined,
  executionStatus: string | undefined,
  operationalEvidence: string | undefined,
  interaction: unknown,
  errors: string[]
) {
  if (!isObject(value)) {
    errors.push(`${path}: expected an object`);
    return;
  }
  rejectUnknownKeys(value, EXPLORER_EVIDENCE_KEYS, path, errors);
  const exampleId = requireString(value.exampleId, `${path}.exampleId`, errors);
  if (recordId && exampleId !== recordId) {
    errors.push(`${path}.exampleId: must match the catalog record id`);
  }
  const kind = requireEnum(
    value.kind,
    new Set([
      'executed-pipeline',
      'deterministic-simulation',
      'curated-explanation',
    ]),
    `${path}.kind`,
    errors
  );
  const verificationId = requireString(
    value.verificationId,
    `${path}.verificationId`,
    errors
  );
  if (verificationId && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(verificationId)) {
    errors.push(`${path}.verificationId: expected a stable kebab-case id`);
  }
  if (value.schemaDigest !== EXPLORER_EVIDENCE_SCHEMA_DIGEST) {
    errors.push(`${path}.schemaDigest: expected the active schema digest`);
  }
  for (const field of [
    'canonicalPipelinePath',
    'bindingManifestPath',
    'authoredStageModulePath',
    'inputCheckpointPath',
    'outputCheckpointPath',
    'fidelityOraclePath',
    'semanticsVerifierPath',
  ] as const) {
    validateRepositoryPath(value[field], `${path}.${field}`, errors);
  }
  for (const field of [
    'pipelineSha256',
    'bindingManifestSha256',
    'authoredStageModuleSha256',
    'inputCheckpointSha256',
    'outputCheckpointSha256',
    'fidelityOracleSha256',
    'semanticsVerifierSha256',
  ] as const) {
    const digest = requireString(value[field], `${path}.${field}`, errors);
    if (digest && !/^sha256:[0-9a-f]{64}$/.test(digest)) {
      errors.push(`${path}.${field}: expected a lowercase SHA-256 digest`);
    }
  }
  requireInteger(value.stageCount, `${path}.stageCount`, errors);
  const strengthenedFields = [
    'fixturePath',
    'fixtureSha256',
    'outputOrCheckpointPath',
    'outputOrCheckpointSha256',
    'fidelityContractId',
    'processorCount',
    'checkpointCount',
    'fixtureEnvironmentPath',
    'fixtureEnvironmentSha256',
    'expectedOutputPath',
    'expectedOutputSha256',
  ] as const;
  const hasStrengthenedFidelity = strengthenedFields.some(
    (field) => value[field] !== undefined
  );
  if (hasStrengthenedFidelity) {
    for (const field of [
      'fixturePath',
      'outputOrCheckpointPath',
      'fixtureEnvironmentPath',
      'expectedOutputPath',
    ] as const) {
      validateRepositoryPath(value[field], `${path}.${field}`, errors);
    }
    for (const field of [
      'fixtureSha256',
      'outputOrCheckpointSha256',
      'fixtureEnvironmentSha256',
      'expectedOutputSha256',
    ] as const) {
      const digest = requireString(value[field], `${path}.${field}`, errors);
      if (digest && !/^sha256:[0-9a-f]{64}$/.test(digest)) {
        errors.push(`${path}.${field}: expected a lowercase SHA-256 digest`);
      }
    }
    const fidelityContractId = requireString(
      value.fidelityContractId,
      `${path}.fidelityContractId`,
      errors
    );
    if (
      fidelityContractId &&
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(fidelityContractId)
    ) {
      errors.push(
        `${path}.fidelityContractId: expected a stable kebab-case id`
      );
    }
    requireInteger(value.processorCount, `${path}.processorCount`, errors);
    requireInteger(value.checkpointCount, `${path}.checkpointCount`, errors);
  } else if (executionStatus !== 'architecture-only') {
    errors.push(
      `${path}: non-architecture evidence requires strengthened fidelity fields`
    );
  }
  if (value.command !== 'npm run validate-catalog') {
    errors.push(`${path}.command: expected npm run validate-catalog`);
  }
  if (value.environment !== 'phase1-foundation-node-20.19.4') {
    errors.push(`${path}.environment: expected phase1-foundation-node-20.19.4`);
  }
  if (!isObject(value.toolVersions)) {
    errors.push(`${path}.toolVersions: expected an object`);
  } else {
    rejectUnknownKeys(
      value.toolVersions,
      new Set(['docusaurus', 'node']),
      `${path}.toolVersions`,
      errors
    );
    if (value.toolVersions.docusaurus !== '3.9.2') {
      errors.push(`${path}.toolVersions.docusaurus: expected 3.9.2`);
    }
    if (value.toolVersions.node !== '20.19.4') {
      errors.push(`${path}.toolVersions.node: expected 20.19.4`);
    }
  }
  const generatedAt = requireString(
    value.generatedAt,
    `${path}.generatedAt`,
    errors
  );
  if (
    generatedAt &&
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(generatedAt)
  ) {
    errors.push(`${path}.generatedAt: expected an ISO-8601 UTC timestamp`);
  }
  const verifierLane = requireEnum(
    value.verifierLane,
    new Set<string>(AGENT_LANES),
    `${path}.verifierLane`,
    errors
  );
  if (producerLane && verifierLane === producerLane) {
    errors.push(`${path}.verifierLane: must be independent from producerLane`);
  }
  if (
    executionStatus === 'architecture-only' &&
    kind !== 'curated-explanation'
  ) {
    errors.push(
      `${path}.kind: architecture-only records require curated-explanation provenance`
    );
  }
  const evidenceExecution = requireEnum(
    value.executionStatus,
    new Set(['offline-runnable', 'requires-integration', 'architecture-only']),
    `${path}.executionStatus`,
    errors
  );
  if (executionStatus && evidenceExecution !== executionStatus) {
    errors.push(`${path}.executionStatus: must match the catalog record`);
  }
  const evidenceOperational = requireEnum(
    value.operationalEvidence,
    new Set(['not-assessed', 'component-tested', 'operating-envelope-tested']),
    `${path}.operationalEvidence`,
    errors
  );
  if (operationalEvidence && evidenceOperational !== operationalEvidence) {
    errors.push(`${path}.operationalEvidence: must match the catalog record`);
  }
  if (
    kind === 'deterministic-simulation' &&
    interaction !== 'runtime-simulation'
  ) {
    errors.push(
      `${path}.kind: deterministic-simulation requires runtime-simulation interaction`
    );
  }
}

export function validatePublicCatalog(input: unknown): CatalogValidationResult {
  const errors: string[] = [];
  if (!isObject(input))
    return { valid: false, errors: ['catalog: expected an object'] };

  rejectUnknownKeys(
    input,
    new Set(['schemaVersion', 'records']),
    'catalog',
    errors
  );
  if (input.schemaVersion !== CATALOG_SCHEMA_VERSION) {
    errors.push(`catalog.schemaVersion: expected ${CATALOG_SCHEMA_VERSION}`);
  }
  if (!Array.isArray(input.records)) {
    errors.push('catalog.records: expected an array');
    return { valid: false, errors };
  }

  const goalIds = new Set(GOAL_FACETS.map((facet) => facet.id));
  const industryIds = new Set(INDUSTRY_FACETS.map((facet) => facet.id));
  const locationIds = new Set(LOCATION_FACETS.map((facet) => facet.id));
  const componentIds = new Set(COMPONENTS.map((component) => component.id));
  const laneIds = new Set<string>(AGENT_LANES);
  const recordIds = new Set<string>();
  const currentRoutes = new Set<string>();
  const legacyRoutes = new Set<string>();

  input.records.forEach((unknownRecord, recordIndex) => {
    const base = `catalog.records[${recordIndex}]`;
    if (!isObject(unknownRecord)) {
      errors.push(`${base}: expected an object`);
      return;
    }
    const record = unknownRecord;
    rejectUnknownKeys(record, RECORD_KEYS, base, errors);

    const id = requireString(record.id, `${base}.id`, errors);
    if (id !== undefined) {
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id))
        errors.push(`${base}.id: expected a stable kebab-case id`);
      if (recordIds.has(id))
        errors.push(`${base}.id: duplicate id ${JSON.stringify(id)}`);
      recordIds.add(id);
    }

    const producer = requireEnum(
      record.producerLane,
      laneIds,
      `${base}.producerLane`,
      errors
    );
    const verifier = requireEnum(
      record.verifierLane,
      laneIds,
      `${base}.verifierLane`,
      errors
    );
    if (producer !== undefined && producer === verifier) {
      errors.push(
        `${base}.verifierLane: must be independent from producerLane`
      );
    }
    if (record.verificationPolicyDigest !== VERIFICATION_POLICY_DIGEST) {
      errors.push(
        `${base}.verificationPolicyDigest: expected the active policy digest`
      );
    }

    requireString(record.title, `${base}.title`, errors);
    const outcome = requireString(
      record.oneLineOutcome,
      `${base}.oneLineOutcome`,
      errors
    );
    if (outcome?.includes('\n'))
      errors.push(`${base}.oneLineOutcome: must be one line`);

    const primaryGoal = requireEnum(
      record.primaryGoal,
      goalIds,
      `${base}.primaryGoal`,
      errors
    );
    const goals = validateStringArray(
      record.goals,
      `${base}.goals`,
      errors,
      goalIds
    );
    if (goals.length === 0)
      errors.push(`${base}.goals: expected at least one goal`);
    if (primaryGoal !== undefined && !goals.includes(primaryGoal)) {
      errors.push(`${base}.primaryGoal: must also appear in goals`);
    }
    const industries = validateStringArray(
      record.industries,
      `${base}.industries`,
      errors,
      industryIds
    );
    if (industries.length === 0)
      errors.push(`${base}.industries: expected at least one industry`);

    const nodeIds = new Set<string>();
    const requiredIntegrationNodes: string[] = [];
    if (!isObject(record.topology)) {
      errors.push(`${base}.topology: expected an object`);
    } else {
      rejectUnknownKeys(
        record.topology,
        new Set(['nodes', 'flows']),
        `${base}.topology`,
        errors
      );
      if (
        !Array.isArray(record.topology.nodes) ||
        record.topology.nodes.length < 2
      ) {
        errors.push(`${base}.topology.nodes: expected at least two nodes`);
      } else {
        record.topology.nodes.forEach((unknownNode, nodeIndex) => {
          const nodePath = `${base}.topology.nodes[${nodeIndex}]`;
          if (!isObject(unknownNode)) {
            errors.push(`${nodePath}: expected an object`);
            return;
          }
          rejectUnknownKeys(unknownNode, NODE_KEYS, nodePath, errors);
          const nodeId = requireString(
            unknownNode.id,
            `${nodePath}.id`,
            errors
          );
          if (nodeId !== undefined) {
            if (nodeIds.has(nodeId))
              errors.push(
                `${nodePath}.id: duplicate node id ${JSON.stringify(nodeId)}`
              );
            nodeIds.add(nodeId);
          }
          requireString(unknownNode.label, `${nodePath}.label`, errors);
          requireEnum(
            unknownNode.kind,
            new Set([
              'expanso-native',
              'protocol-adapter',
              'custom',
              'external',
            ]),
            `${nodePath}.kind`,
            errors
          );
          requireEnum(
            unknownNode.location,
            locationIds,
            `${nodePath}.location`,
            errors
          );
          if (unknownNode.componentId !== undefined) {
            const componentId = requireEnum(
              unknownNode.componentId,
              componentIds,
              `${nodePath}.componentId`,
              errors
            );
            if (
              unknownNode.requiredForCorePath === true &&
              componentId &&
              INTEGRATION_COMPONENTS.has(componentId)
            ) {
              requiredIntegrationNodes.push(nodePath);
            }
          }
          if (typeof unknownNode.requiredForCorePath !== 'boolean') {
            errors.push(`${nodePath}.requiredForCorePath: expected a boolean`);
          }
          if (unknownNode.publicVerification !== undefined) {
            const verification = unknownNode.publicVerification;
            if (!isObject(verification)) {
              errors.push(`${nodePath}.publicVerification: expected an object`);
            } else {
              rejectUnknownKeys(
                verification,
                new Set(['source', 'verifiedAt', 'version']),
                `${nodePath}.publicVerification`,
                errors
              );
              const source = requireString(
                verification.source,
                `${nodePath}.publicVerification.source`,
                errors
              );
              if (source && !/^https:\/\//.test(source)) {
                errors.push(
                  `${nodePath}.publicVerification.source: expected a public HTTPS URL`
                );
              }
              validateDate(
                verification.verifiedAt,
                `${nodePath}.publicVerification.verifiedAt`,
                errors
              );
              if (verification.version !== undefined)
                requireString(
                  verification.version,
                  `${nodePath}.publicVerification.version`,
                  errors
                );
            }
          }
        });
      }

      if (
        !Array.isArray(record.topology.flows) ||
        record.topology.flows.length < 1
      ) {
        errors.push(`${base}.topology.flows: expected at least one flow`);
      } else {
        const flowIds = new Set<string>();
        record.topology.flows.forEach((unknownFlow, flowIndex) => {
          const flowPath = `${base}.topology.flows[${flowIndex}]`;
          if (!isObject(unknownFlow)) {
            errors.push(`${flowPath}: expected an object`);
            return;
          }
          rejectUnknownKeys(
            unknownFlow,
            new Set([
              'crossesBoundary',
              'dataClassification',
              'from',
              'payload',
              'to',
            ]),
            flowPath,
            errors
          );
          const from = requireString(
            unknownFlow.from,
            `${flowPath}.from`,
            errors
          );
          const to = requireString(unknownFlow.to, `${flowPath}.to`, errors);
          if (from && !nodeIds.has(from))
            errors.push(
              `${flowPath}.from: unknown node ${JSON.stringify(from)}`
            );
          if (to && !nodeIds.has(to))
            errors.push(`${flowPath}.to: unknown node ${JSON.stringify(to)}`);
          if (from && to) {
            const flowId = `${from}->${to}`;
            if (flowIds.has(flowId))
              errors.push(`${flowPath}: duplicate flow ${flowId}`);
            flowIds.add(flowId);
          }
          requireString(unknownFlow.payload, `${flowPath}.payload`, errors);
          requireEnum(
            unknownFlow.dataClassification,
            new Set(['synthetic', 'public', 'operational', 'sensitive']),
            `${flowPath}.dataClassification`,
            errors
          );
          if (typeof unknownFlow.crossesBoundary !== 'boolean') {
            errors.push(`${flowPath}.crossesBoundary: expected a boolean`);
          }
        });
      }

      if (
        Array.isArray(record.topology.nodes) &&
        Array.isArray(record.topology.flows)
      ) {
        const incoming = new Set(
          record.topology.flows.flatMap((flow) =>
            isObject(flow) && typeof flow.to === 'string' ? [flow.to] : []
          )
        );
        const outgoing = new Set(
          record.topology.flows.flatMap((flow) =>
            isObject(flow) && typeof flow.from === 'string' ? [flow.from] : []
          )
        );
        record.topology.nodes.forEach((node, nodeIndex) => {
          if (!isObject(node) || typeof node.id !== 'string') return;
          const isEndpoint =
            (outgoing.has(node.id) && !incoming.has(node.id)) ||
            (incoming.has(node.id) && !outgoing.has(node.id));
          if (isEndpoint && node.componentId === undefined) {
            errors.push(
              `${base}.topology.nodes[${nodeIndex}].componentId: required for a source or destination facet`
            );
          }
        });
      }
    }

    const difficulty = requireEnum(
      record.difficulty,
      new Set(['beginner', 'intermediate', 'advanced']),
      `${base}.difficulty`,
      errors
    );
    if (!isObject(record.expectedTime)) {
      errors.push(`${base}.expectedTime: expected an object`);
    } else {
      rejectUnknownKeys(
        record.expectedTime,
        new Set(['assumptions', 'inspectMinutes', 'runMinutes']),
        `${base}.expectedTime`,
        errors
      );
      requireInteger(
        record.expectedTime.inspectMinutes,
        `${base}.expectedTime.inspectMinutes`,
        errors
      );
      if (record.expectedTime.runMinutes !== undefined) {
        requireInteger(
          record.expectedTime.runMinutes,
          `${base}.expectedTime.runMinutes`,
          errors
        );
      }
      requireString(
        record.expectedTime.assumptions,
        `${base}.expectedTime.assumptions`,
        errors
      );
    }

    const execution = requireEnum(
      record.executionStatus,
      new Set([
        'offline-runnable',
        'requires-integration',
        'architecture-only',
      ]),
      `${base}.executionStatus`,
      errors
    );
    const evidence = requireEnum(
      record.operationalEvidence,
      new Set([
        'not-assessed',
        'component-tested',
        'operating-envelope-tested',
      ]),
      `${base}.operationalEvidence`,
      errors
    );
    const interaction = requireEnum(
      record.interaction,
      new Set(['transform', 'runtime-simulation', 'architecture', 'none']),
      `${base}.interaction`,
      errors
    );

    if (record.explorerEvidence !== undefined) {
      validateExplorerEvidence(
        record.explorerEvidence,
        `${base}.explorerEvidence`,
        id,
        producer,
        execution,
        evidence,
        interaction,
        errors
      );
    }

    if (execution === 'offline-runnable') {
      if (record.fixturePath === undefined) {
        errors.push(
          `${base}.fixturePath: required as deterministic execution evidence for an offline-runnable record`
        );
      }
      if (record.completePipelinePath === undefined) {
        errors.push(
          `${base}.completePipelinePath: required as execution evidence for an offline-runnable record`
        );
      }
      if (record.expectedOutputPath === undefined) {
        errors.push(
          `${base}.expectedOutputPath: required as asserted output evidence for an offline-runnable record`
        );
      }
      if (requiredIntegrationNodes.length > 0) {
        errors.push(
          `${base}.executionStatus: offline-runnable has required integration nodes`
        );
      }
    }
    if (execution === 'requires-integration') {
      errors.push(
        `${base}.executionStatus: requires-integration needs a bound maintained-environment result; no evidence record is joined`
      );
    }
    if (execution === 'architecture-only') {
      if (
        isObject(record.expectedTime) &&
        record.expectedTime.runMinutes !== undefined
      ) {
        errors.push(
          `${base}.expectedTime.runMinutes: architecture-only records cannot advertise a run time`
        );
      }
      if (isObject(record.routes) && record.routes.run !== undefined) {
        errors.push(
          `${base}.routes.run: architecture-only records cannot advertise a run route`
        );
      }
    }
    if (difficulty === 'beginner' && execution !== 'offline-runnable') {
      errors.push(
        `${base}.difficulty: beginner requires a verified offline-runnable core path`
      );
    }

    const claimIds = validateStringArray(
      record.claimIds,
      `${base}.claimIds`,
      errors
    );
    claimIds.forEach((claimId, claimIndex) => {
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(claimId)) {
        errors.push(
          `${base}.claimIds[${claimIndex}]: expected a stable kebab-case id`
        );
      }
    });
    if (
      evidence !== undefined &&
      evidence !== 'not-assessed' &&
      claimIds.length === 0
    ) {
      errors.push(
        `${base}.operationalEvidence: tested evidence requires a governed claim id`
      );
    }
    if (
      evidence === 'operating-envelope-tested' &&
      execution === 'architecture-only'
    ) {
      errors.push(
        `${base}.operationalEvidence: an architecture-only record cannot have operating-envelope evidence`
      );
    }

    if (!isObject(record.routes)) {
      errors.push(`${base}.routes: expected an object`);
    } else {
      rejectUnknownKeys(
        record.routes,
        new Set(['explore', 'overview', 'reference', 'run']),
        `${base}.routes`,
        errors
      );
      for (const key of ['overview', 'explore', 'run', 'reference'] as const) {
        if (key !== 'overview' && record.routes[key] === undefined) continue;
        const route = validateRoute(
          record.routes[key],
          `${base}.routes.${key}`,
          errors
        );
        if (route !== undefined) {
          if (currentRoutes.has(route))
            errors.push(
              `${base}.routes.${key}: duplicate route ${JSON.stringify(route)}`
            );
          currentRoutes.add(route);
        }
      }
      if (
        id &&
        typeof record.routes.overview === 'string' &&
        !record.routes.overview.endsWith(`/${id}/`)
      ) {
        errors.push(
          `${base}.routes.overview: must end in the stable record id`
        );
      }
      if (record.routes.explore !== undefined) {
        if (record.completePipelinePath === undefined) {
          errors.push(
            `${base}.completePipelinePath: required for a published Explorer`
          );
        }
        if (record.explorerEvidence === undefined) {
          errors.push(
            `${base}.explorerEvidence: required for every published Explorer`
          );
        }
        if (interaction === 'none') {
          errors.push(
            `${base}.interaction: an Explorer route requires an interactive presentation`
          );
        }
      } else if (record.explorerEvidence !== undefined) {
        errors.push(
          `${base}.routes.explore: required when Explorer evidence is bound`
        );
      }
    }

    if (!Array.isArray(record.legacyRoutes)) {
      errors.push(`${base}.legacyRoutes: expected an array`);
    } else {
      record.legacyRoutes.forEach((unknownRedirect, redirectIndex) => {
        const redirectPath = `${base}.legacyRoutes[${redirectIndex}]`;
        if (!isObject(unknownRedirect)) {
          errors.push(`${redirectPath}: expected an object`);
          return;
        }
        rejectUnknownKeys(
          unknownRedirect,
          new Set(['from', 'preserveQuery', 'status', 'to']),
          redirectPath,
          errors
        );
        const from = validateRoute(
          unknownRedirect.from,
          `${redirectPath}.from`,
          errors
        );
        validateRoute(unknownRedirect.to, `${redirectPath}.to`, errors);
        if (from) {
          if (legacyRoutes.has(from))
            errors.push(
              `${redirectPath}.from: duplicate legacy route ${JSON.stringify(from)}`
            );
          legacyRoutes.add(from);
        }
        if (unknownRedirect.status !== 301 && unknownRedirect.status !== 308) {
          errors.push(`${redirectPath}.status: expected 301 or 308`);
        }
        if (typeof unknownRedirect.preserveQuery !== 'boolean') {
          errors.push(`${redirectPath}.preserveQuery: expected a boolean`);
        }
      });
    }

    if (record.fixturePath !== undefined)
      validateRepositoryPath(record.fixturePath, `${base}.fixturePath`, errors);
    if (record.completePipelinePath !== undefined) {
      validateRepositoryPath(
        record.completePipelinePath,
        `${base}.completePipelinePath`,
        errors
      );
    }
    if (record.expectedOutputPath !== undefined) {
      validateRepositoryPath(
        record.expectedOutputPath,
        `${base}.expectedOutputPath`,
        errors
      );
    }
    validateDate(
      record.lastTechnicalVerification,
      `${base}.lastTechnicalVerification`,
      errors
    );
    validateDate(
      record.lastEditorialVerification,
      `${base}.lastEditorialVerification`,
      errors
    );

    const status = requireEnum(
      record.status,
      new Set(['published', 'draft', 'deprecated']),
      `${base}.status`,
      errors
    );
    const replacements =
      record.replaces === undefined
        ? []
        : validateStringArray(record.replaces, `${base}.replaces`, errors);
    if (
      status === 'deprecated' &&
      replacements.length === 0 &&
      record.retirementReason === undefined
    ) {
      errors.push(
        `${base}: deprecated records require replaces or retirementReason`
      );
    }
    if (record.retirementReason !== undefined)
      requireString(
        record.retirementReason,
        `${base}.retirementReason`,
        errors
      );
  });

  for (const route of legacyRoutes) {
    if (currentRoutes.has(route))
      errors.push(
        `catalog: route ${JSON.stringify(route)} is both current and legacy`
      );
  }

  return { valid: errors.length === 0, errors };
}

export function assertPublicCatalog(
  input: unknown
): asserts input is PublicCatalog {
  const result = validatePublicCatalog(input);
  if (!result.valid) {
    throw new Error(
      `Public catalog validation failed:\n${result.errors.map((error) => `- ${error}`).join('\n')}`
    );
  }
}
