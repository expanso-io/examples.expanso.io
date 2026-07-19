#!/usr/bin/env tsx

import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { globSync } from 'glob';

import { PUBLIC_CATALOG } from '../../src/catalog/registry';
import {
  INDUSTRIAL_VISION_PROTOTYPE_ID,
  runIndustrialVisionPrototype,
  type IndustrialVisionCheckpointArtifact,
  type IndustrialVisionSource,
} from './industrial-vision-prototype';
import { validateJsonSchema } from '../quality/json-schema';

const ZERO_SHA256 = '0'.repeat(64);
const CONTRACT_PATH = 'tests/contracts/portfolio-admission-v1.json';
const DEFAULT_RESULT_PATH =
  'tests/prototypes/industrial-vision/admission-result-v1.json';
const DATASET_POLICY_PATH = 'content/contracts/dataset-policy-v1.json';
const DATASET_SCHEMA_PATH = 'content/contracts/dataset-registry-v1.schema.json';

type RecordValue = Record<string, unknown>;
export type AdmissionDisposition =
  | 'prototype'
  | 'defer'
  | 'reframe-current-example'
  | 'reject';

export interface AdmissionReduction {
  reductionVersion: '1.0.0';
  contractId: string | null;
  contractSha256: string | null;
  admissionResultId: string | null;
  candidateId: string | null;
  declaredDisposition: AdmissionDisposition | null;
  derivedDisposition: AdmissionDisposition | null;
  status: 'PASS' | 'FAIL';
  errors: string[];
}

export interface AdmissionReductionOptions {
  resultPath?: string;
  contractPath?: string;
  now?: Date;
}

function isObject(value: unknown): value is RecordValue {
  return value !== null && !Array.isArray(value) && typeof value === 'object';
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(resolve(path), 'utf8')) as unknown;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (isObject(value)) {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalize(entry)])
    );
  }
  return value;
}

function sha256(value: Buffer | string): string {
  return createHash('sha256').update(value).digest('hex');
}

function fileDigest(path: string): string {
  return `sha256:${sha256(readFileSync(resolve(path)))}`;
}

function selfDigest(value: RecordValue, field: string): string {
  return sha256(
    JSON.stringify(canonicalize({ ...value, [field]: ZERO_SHA256 }))
  );
}

function fixtureSetDigest(paths: string[]): string {
  const frames = [...paths]
    .sort()
    .map((path) => `${path}\0${sha256(readFileSync(resolve(path)))}\n`);
  return `sha256:${sha256(frames.join(''))}`;
}

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : [];
}

function sameStrings(left: string[], right: string[]): boolean {
  return (
    left.length === right.length &&
    [...left].sort().every((entry, index) => entry === [...right].sort()[index])
  );
}

function pushIf(condition: boolean, errors: string[], message: string): void {
  if (condition) errors.push(message);
}

function bindingWithoutVerdict(binding: RecordValue): RecordValue {
  const { rerunVerdict: _rerunVerdict, ...rest } = binding;
  return rest;
}

function deriveDisposition(result: RecordValue): AdmissionDisposition {
  const signals = isObject(result.decisionSignals)
    ? result.decisionSignals
    : {};
  const answers = Array.isArray(result.answers) ? result.answers : [];
  if (strings(signals.rejectReasons).length > 0) return 'reject';
  if (
    typeof signals.reframeCurrentExample === 'string' &&
    signals.reframeCurrentExample.length > 0
  ) {
    return 'reframe-current-example';
  }
  if (
    answers.length !== 12 ||
    answers.some((answer) => !isObject(answer) || answer.outcome !== 'PASS')
  ) {
    return 'defer';
  }
  return 'prototype';
}

function checkDataRights(
  dataRightsPath: string,
  sourcePath: string,
  checkpointPath: string,
  generatorPath: string,
  source: IndustrialVisionSource,
  errors: string[]
): void {
  const raw = readFileSync(resolve(dataRightsPath), 'utf8');
  const value = readJson(dataRightsPath);
  const schema = readJson(DATASET_SCHEMA_PATH);
  errors.push(
    ...validateJsonSchema(value, schema, 'dataRights').map(
      (error) => `Data-rights schema: ${error}`
    )
  );
  if (!isObject(value)) return;

  pushIf(
    value.policyDigest !== fileDigest(DATASET_POLICY_PATH),
    errors,
    'Data-rights policy digest does not match the repository policy'
  );
  const datasets = Array.isArray(value.datasets) ? value.datasets : [];
  pushIf(
    datasets.length !== 1 || !isObject(datasets[0]),
    errors,
    'Data-rights declaration must contain exactly one dataset'
  );
  if (!isObject(datasets[0])) return;
  const dataset = datasets[0];
  const paths = strings(dataset.fixturePaths);
  pushIf(
    !sameStrings(paths, [sourcePath, checkpointPath]),
    errors,
    'Data-rights fixture paths do not bind the exact prototype artifacts'
  );
  if (paths.length > 0 && paths.every((path) => existsSync(resolve(path)))) {
    pushIf(
      dataset.fixtureSha256 !== fixtureSetDigest(paths),
      errors,
      'Data-rights fixture-set digest mismatch'
    );
  }
  pushIf(
    dataset.id !== 'industrial-vision-prototype-synthetic-fixture' ||
      dataset.kind !== 'synthetic' ||
      dataset.deterministic !== true ||
      dataset.dataRightsVerdict !== 'allowed',
    errors,
    'Data-rights declaration does not fail closed to an allowed deterministic synthetic fixture'
  );
  const generation = isObject(dataset.generation) ? dataset.generation : {};
  pushIf(
    generation.generatorPath !== generatorPath ||
      generation.generatorSha256 !== fileDigest(generatorPath) ||
      generation.seed !== source.deterministicSeed,
    errors,
    'Data-rights generation binding does not match the exact generator and seed'
  );
  for (const scanName of ['piiScan', 'syntheticDataScan']) {
    const scan = isObject(dataset[scanName]) ? dataset[scanName] : {};
    pushIf(
      scan.result !== 'PASS',
      errors,
      `Data-rights ${scanName} is not PASS`
    );
  }
  const localUserMarker = ['', 'Us', 'ers', ''].join('/');
  const privateRepositoryMarker = ['second', 'brain'].join('-');
  for (const privatePattern of [
    new RegExp(`(?:^|[\\s\`"'])${localUserMarker}`, 'u'),
    new RegExp(`${privateRepositoryMarker}(?:/|\\b)`, 'iu'),
    /(?:customer|transcript|meeting)(?:Name|Path|Handle|Identity|Volume)/iu,
  ]) {
    pushIf(
      privatePattern.test(raw),
      errors,
      `Data-rights declaration matched private-evidence pattern ${privatePattern.source}`
    );
  }
}

function publicSurfaceContainsPrototype(): boolean {
  if (
    PUBLIC_CATALOG.records.some(
      (record) => record.id === INDUSTRIAL_VISION_PROTOTYPE_ID
    )
  ) {
    return true;
  }
  const publicSources = globSync(
    ['docs/**/*.{md,mdx}', 'src/pages/**/*.{ts,tsx,js,jsx,md,mdx}'],
    { nodir: true }
  );
  return publicSources.some((path) => {
    const raw = readFileSync(resolve(path), 'utf8');
    return (
      raw.includes(INDUSTRIAL_VISION_PROTOTYPE_ID) ||
      raw.includes('Industrial Vision Inspection at the Edge')
    );
  });
}

export function reducePortfolioAdmission(
  options: AdmissionReductionOptions = {}
): AdmissionReduction {
  const contractPath = options.contractPath ?? CONTRACT_PATH;
  const resultPath = options.resultPath ?? DEFAULT_RESULT_PATH;
  const now = options.now ?? new Date();
  const errors: string[] = [];
  let contract: RecordValue | null = null;
  let result: RecordValue | null = null;
  let derivedDisposition: AdmissionDisposition | null = null;

  try {
    if (!existsSync(resolve(contractPath))) {
      throw new Error(`Missing admission contract: ${contractPath}`);
    }
    contract = readJson(contractPath) as RecordValue;
    if (!isObject(contract))
      throw new Error('Admission contract is not an object');
    pushIf(
      contract.contractSha256 !== selfDigest(contract, 'contractSha256'),
      errors,
      'Admission contract self-digest mismatch'
    );
    pushIf(
      contract.contractId !== 'portfolio-admission-v1' ||
        contract.contractVersion !== '1.0.0',
      errors,
      'Admission contract header is invalid'
    );

    if (!existsSync(resolve(resultPath))) {
      throw new Error(`Missing admission result: ${resultPath}`);
    }
    result = readJson(resultPath) as RecordValue;
    if (!isObject(result)) throw new Error('Admission result is not an object');

    const resultSchemaPath = String(contract.resultSchema ?? '');
    if (!existsSync(resolve(resultSchemaPath))) {
      errors.push(`Missing admission result schema: ${resultSchemaPath}`);
    } else {
      errors.push(
        ...validateJsonSchema(
          result,
          readJson(resultSchemaPath),
          'admissionResult'
        ).map((error) => `Result schema: ${error}`)
      );
    }
    pushIf(
      result.resultSha256 !== selfDigest(result, 'resultSha256'),
      errors,
      'Admission result self-digest mismatch'
    );
    pushIf(
      result.contractId !== contract.contractId ||
        result.contractSha256 !== contract.contractSha256 ||
        result.candidateId !== contract.candidateId,
      errors,
      'Admission result is not bound to the exact contract and candidate'
    );

    const artifactPaths = isObject(contract.artifacts)
      ? contract.artifacts
      : {};
    const artifactBindings = isObject(result.artifactBindings)
      ? result.artifactBindings
      : {};
    for (const artifactId of [
      'source',
      'checkpoints',
      'dataRights',
      'generator',
    ]) {
      const path = artifactPaths[artifactId];
      const binding = isObject(artifactBindings[artifactId])
        ? artifactBindings[artifactId]
        : {};
      if (typeof path !== 'string' || !existsSync(resolve(path))) {
        errors.push(`Missing required artifact: ${artifactId}`);
        continue;
      }
      pushIf(
        binding.path !== path || binding.sha256 !== fileDigest(path),
        errors,
        `Artifact binding mismatch: ${artifactId}`
      );
    }

    const sourcePath = String(artifactPaths.source ?? '');
    const checkpointPath = String(artifactPaths.checkpoints ?? '');
    const dataRightsPath = String(artifactPaths.dataRights ?? '');
    const generatorPath = String(artifactPaths.generator ?? '');
    if (
      [sourcePath, checkpointPath, dataRightsPath, generatorPath].every(
        (path) => path.length > 0 && existsSync(resolve(path))
      )
    ) {
      const source = readJson(sourcePath) as IndustrialVisionSource;
      const checkpoints = readJson(
        checkpointPath
      ) as IndustrialVisionCheckpointArtifact;
      let replay: IndustrialVisionCheckpointArtifact | null = null;
      try {
        replay = runIndustrialVisionPrototype(source);
      } catch (error) {
        errors.push(
          `Prototype replay failed: ${error instanceof Error ? error.message : String(error)}`
        );
      }
      if (replay) {
        pushIf(
          JSON.stringify(replay) !== JSON.stringify(checkpoints),
          errors,
          'Prototype replay does not match the checked-in checkpoints'
        );
      }
      const requirements = isObject(contract.prototypeRequirements)
        ? contract.prototypeRequirements
        : {};
      pushIf(
        source.scenarios.length < Number(requirements.minimumScenarioCount),
        errors,
        'Prototype has too few scenario packs'
      );
      pushIf(
        requirements.requiresReuseScenario === true &&
          !source.scenarios.some((scenario) => scenario.reuseDemonstrationOnly),
        errors,
        'Prototype lacks a bounded reuse scenario'
      );
      pushIf(
        requirements.requiresRawMediaEgressDisabled === true &&
          source.policy.rawMediaEgressAllowed !== false,
        errors,
        'Prototype permits raw-media egress'
      );
      pushIf(
        requirements.requiresFailureBoundaryCheckpoint === true &&
          !checkpoints.scenarios.some((scenario) =>
            scenario.checkpoints.some(
              (checkpoint) => checkpoint.kind === 'failure-boundary'
            )
          ),
        errors,
        'Prototype lacks a visible failure-boundary checkpoint'
      );
      pushIf(
        source.boundary.expansoCentral.length === 0 ||
          source.boundary.customModel.length === 0 ||
          source.executionLabels.customModelOutput !==
            'curated-synthetic-envelope',
        errors,
        'Prototype does not declare the Expanso/custom-model boundary'
      );
      checkDataRights(
        dataRightsPath,
        sourcePath,
        checkpointPath,
        generatorPath,
        source,
        errors
      );
    }

    const questionIds = strings(contract.questionIds);
    const answers = Array.isArray(result.answers) ? result.answers : [];
    const answerIds = answers.map((answer) =>
      isObject(answer) && typeof answer.questionId === 'string'
        ? answer.questionId
        : ''
    );
    pushIf(
      !sameStrings(answerIds, questionIds) ||
        new Set(answerIds).size !== answerIds.length,
      errors,
      'Admission result must answer each of the 12 questions exactly once'
    );
    const requiredRefs = isObject(contract.requiredEvidenceRefsByQuestion)
      ? contract.requiredEvidenceRefsByQuestion
      : {};
    for (const answer of answers) {
      if (!isObject(answer) || typeof answer.questionId !== 'string') continue;
      const expectedRefs = strings(requiredRefs[answer.questionId]);
      const actualRefs = strings(answer.evidenceRefs);
      pushIf(
        !expectedRefs.every((reference) => actualRefs.includes(reference)),
        errors,
        `Question ${answer.questionId} is missing required evidence references`
      );
    }
    for (const blockingId of strings(contract.blockingQuestionIds)) {
      const answer = answers.find(
        (entry) => isObject(entry) && entry.questionId === blockingId
      );
      pushIf(
        !isObject(answer) || answer.outcome !== 'PASS',
        errors,
        `Blocking admission question is not PASS: ${blockingId}`
      );
    }

    const marketBinding = isObject(result.publicMarketEvidence)
      ? result.publicMarketEvidence
      : {};
    const expectedMarketBinding = isObject(contract.publicMarketEvidence)
      ? contract.publicMarketEvidence
      : {};
    pushIf(
      JSON.stringify(canonicalize(bindingWithoutVerdict(marketBinding))) !==
        JSON.stringify(canonicalize(expectedMarketBinding)) ||
        marketBinding.rerunVerdict !== 'PASS',
      errors,
      'Public-market binding does not match the verified hypothesis packet'
    );
    const validUntil = new Date(String(marketBinding.validUntil ?? ''));
    pushIf(
      !Number.isFinite(validUntil.valueOf()) || validUntil < now,
      errors,
      'Public-market hypothesis evidence is invalid or expired'
    );
    pushIf(
      marketBinding.admissionScope !== 'hypothesis-only',
      errors,
      'Public-market evidence was promoted beyond hypothesis scope'
    );

    const valueOracle = isObject(result.valueOracle) ? result.valueOracle : {};
    const requirements = isObject(contract.prototypeRequirements)
      ? contract.prototypeRequirements
      : {};
    pushIf(
      !Number.isInteger(valueOracle.maxSeconds) ||
        Number(valueOracle.maxSeconds) >
          Number(requirements.maximumValueComprehensionSeconds),
      errors,
      'Value-comprehension oracle exceeds the contract limit'
    );
    const reproduction = isObject(result.offlineReproduction)
      ? result.offlineReproduction
      : {};
    const commands = isObject(contract.commands) ? contract.commands : {};
    pushIf(
      reproduction.command !== commands.fixture ||
        reproduction.credentialsRequired !== false ||
        reproduction.networkRequired !== false,
      errors,
      'Offline reproduction is not pinned or requires external access'
    );

    const lanes = isObject(result.configuredReviewLanes)
      ? result.configuredReviewLanes
      : {};
    const producer = isObject(lanes.producer) ? lanes.producer : {};
    const verifier = isObject(lanes.verifier) ? lanes.verifier : {};
    pushIf(
      typeof producer.id !== 'string' ||
        typeof verifier.id !== 'string' ||
        producer.id === verifier.id ||
        !sameStrings(strings(producer.evidenceScopes), [
          'technical',
          'editorial',
        ]) ||
        !sameStrings(strings(verifier.evidenceScopes), [
          'technical',
          'editorial',
        ]),
      errors,
      'Configured producer and verifier review lanes are missing, colliding, or incomplete'
    );

    const publicationGuard = isObject(result.publicationGuard)
      ? result.publicationGuard
      : {};
    pushIf(
      publicationGuard.publicRoute !== requirements.publicRouteAllowed ||
        publicationGuard.catalogRecord !== requirements.catalogRecordAllowed ||
        publicationGuard.marketPriorityClaim !==
          requirements.marketPriorityClaimAllowed ||
        publicationGuard.state !== 'test-only' ||
        publicSurfaceContainsPrototype(),
      errors,
      'Publication guard mismatch or prototype leaked into a public route/catalog surface'
    );

    const signals = isObject(result.decisionSignals)
      ? result.decisionSignals
      : {};
    pushIf(
      !Array.isArray(signals.rejectReasons) ||
        !(
          signals.reframeCurrentExample === null ||
          (typeof signals.reframeCurrentExample === 'string' &&
            signals.reframeCurrentExample.length > 0)
        ),
      errors,
      'Decision signals are malformed'
    );
    derivedDisposition = deriveDisposition(result);
    pushIf(
      result.disposition !== derivedDisposition ||
        !strings(contract.allowedDispositions).includes(
          String(result.disposition)
        ),
      errors,
      `Declared disposition does not match the evidence-derived disposition ${derivedDisposition}`
    );
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }

  const disposition =
    result &&
    ['prototype', 'defer', 'reframe-current-example', 'reject'].includes(
      String(result.disposition)
    )
      ? (result.disposition as AdmissionDisposition)
      : null;
  return {
    reductionVersion: '1.0.0',
    contractId:
      contract && typeof contract.contractId === 'string'
        ? contract.contractId
        : null,
    contractSha256:
      contract && typeof contract.contractSha256 === 'string'
        ? contract.contractSha256
        : null,
    admissionResultId:
      result && typeof result.admissionResultId === 'string'
        ? result.admissionResultId
        : null,
    candidateId:
      result && typeof result.candidateId === 'string'
        ? result.candidateId
        : null,
    declaredDisposition: disposition,
    derivedDisposition,
    status: errors.length === 0 ? 'PASS' : 'FAIL',
    errors,
  };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const reduction = reducePortfolioAdmission({
    resultPath: process.argv[2] ?? DEFAULT_RESULT_PATH,
  });
  process.stdout.write(`${JSON.stringify(reduction, null, 2)}\n`);
  process.exitCode = reduction.status === 'PASS' ? 0 : 1;
}
