import { readFile } from 'node:fs/promises';
import { relative, resolve, sep } from 'node:path';
import { analyzeMdx, normalizeVisibleText } from './ast';
import {
  findContentFiles,
  findFiles,
  readJson,
  repositoryPath,
  sha256,
  sha256File,
} from './io';
import {
  isIsoDate,
  isRecord,
  isSha256,
  isUniqueStringArray,
  validateContentPolicy,
} from './policy';
import type {
  ClaimRecord,
  ClaimRegistry,
  DatasetRecord,
  DatasetRegistry,
  Finding,
  ValidationResult,
} from './types';

interface ClaimsPolicy {
  contractVersion: string;
  gateId: string;
  allowedStatuses: string[];
  privateEvidencePatterns: string[];
  materialClaimPatterns: string[];
  nonAssertionContextPatterns: string[];
  forbiddenWordingPatterns: string[];
  requiredRouteAttestationFields: string[];
}

interface DatasetPolicy {
  contractVersion: string;
  gateId: string;
  policyVersion: string;
  fixtureRoots: string[];
  fixtureFilePatterns: string[];
  allowedRedistributionScopes: string[];
  requiredVerdict: string;
  ambiguousRightsVerdict: string;
  privateEvidencePatterns: string[];
}

export interface ClaimsValidationOptions {
  repositoryRoot: string;
  inputRoot: string;
  contentPolicyPath: string;
  claimsPolicyPath: string;
  datasetPolicyPath: string;
  claimRegistryPath: string;
  datasetRegistryPath: string;
  catalogRecords?: CatalogEvidenceRecord[];
  fixtureScopePrefixes?: string[];
  today?: string;
  now?: Date;
}

export interface CatalogEvidenceRecord {
  id: string;
  claimIds: string[];
  fixturePath?: string;
  expectedOutputPath?: string;
  lastTechnicalVerification?: string;
  lastEditorialVerification?: string;
}

const CLAIM_TYPES = new Set([
  'legal',
  'cost',
  'performance',
  'reliability',
  'compression',
  'bandwidth',
  'security',
  'compliance',
  'market',
  'accuracy',
  'partner',
  'interoperability',
]);
const CLAIM_STATUSES = new Set([
  'measured',
  'modeled',
  'third-party-sourced',
  'illustrative',
  'prohibited',
]);
const CLAIM_KEYS = new Set([
  'id',
  'exactWording',
  'conservativeVariants',
  'type',
  'status',
  'routes',
  'assumptions',
  'environment',
  'producerAgentId',
  'verifierAgentId',
  'verifiedAt',
  'reviewBy',
  'visibleLabel',
  'publicSource',
  'reproduction',
]);
const DATASET_KEYS = new Set([
  'id',
  'kind',
  'fixturePaths',
  'fixtureSha256',
  'deterministic',
  'attribution',
  'transformationRecord',
  'redistributionScope',
  'dataRightsVerdict',
  'piiScan',
  'syntheticDataScan',
  'sourceUrl',
  'sourceSha256',
  'spdxLicenseId',
  'licenseTextPath',
  'generation',
]);
const PUBLIC_SOURCE_KEYS = new Set([
  'url',
  'title',
  'publicationDate',
  'retrievedAt',
]);
const REPRODUCTION_KEYS = new Set([
  'command',
  'fixturePath',
  'fixtureSha256',
  'rawResultPath',
  'rawResultSha256',
  'productVersions',
]);
const SCAN_KEYS = new Set(['tool', 'command', 'result', 'checkedAt']);
const GENERATION_KEYS = new Set([
  'command',
  'generatorPath',
  'generatorSha256',
  'seed',
]);

export async function validateClaimsEvidence(
  options: ClaimsValidationOptions
): Promise<ValidationResult> {
  const errors: Finding[] = [];
  const today = options.today ?? new Date().toISOString().slice(0, 10);
  if (!isIsoDate(today)) {
    return baseResult(options, 'sha256:' + '0'.repeat(64), 0, [
      invalid(options.claimsPolicyPath, `Invalid --today date: ${today}`),
    ]);
  }

  const claimsPolicyRaw = await safeRead(options.claimsPolicyPath, errors);
  const datasetPolicyRaw = await safeRead(options.datasetPolicyPath, errors);
  const contentPolicyRaw = await safeRead(options.contentPolicyPath, errors);
  const claimsPolicyDigest = sha256(claimsPolicyRaw ?? '');
  const datasetPolicyDigest = sha256(datasetPolicyRaw ?? '');
  const claimsPolicy = parsePolicy<ClaimsPolicy>(
    claimsPolicyRaw,
    options.claimsPolicyPath,
    errors
  );
  const datasetPolicy = parsePolicy<DatasetPolicy>(
    datasetPolicyRaw,
    options.datasetPolicyPath,
    errors
  );
  const contentPolicyValue = parsePolicy<unknown>(
    contentPolicyRaw,
    options.contentPolicyPath,
    errors
  );
  const contentPolicyCheck = validateContentPolicy(
    contentPolicyValue,
    repositoryPath(options.repositoryRoot, options.contentPolicyPath)
  );
  errors.push(...contentPolicyCheck.errors);
  validateClaimsPolicyShape(claimsPolicy, options.claimsPolicyPath, errors);
  validateDatasetPolicyShape(datasetPolicy, options.datasetPolicyPath, errors);
  if (!validClaimsPolicy(claimsPolicy) || !validDatasetPolicy(datasetPolicy)) {
    errors.push(
      invalid(
        options.claimsPolicyPath,
        'Claims or dataset policy shape is invalid'
      )
    );
  }

  const claimRegistry = await parseRegistry<ClaimRegistry>(
    options.claimRegistryPath,
    errors
  );
  const datasetRegistry = await parseRegistry<DatasetRegistry>(
    options.datasetRegistryPath,
    errors
  );
  if (claimRegistry) {
    await validateClaimRegistry(
      claimRegistry,
      claimsPolicyDigest,
      today,
      options.repositoryRoot,
      options.claimRegistryPath,
      errors
    );
  }
  if (datasetRegistry) {
    await validateDatasetRegistry(
      datasetRegistry,
      datasetPolicyDigest,
      today,
      options.repositoryRoot,
      options.datasetRegistryPath,
      errors
    );
    if (datasetPolicy) {
      await validateFixtureCoverage(
        datasetRegistry,
        datasetPolicy,
        options.repositoryRoot,
        options.datasetPolicyPath,
        errors,
        options.fixtureScopePrefixes
      );
    }
  }
  if (claimRegistry && datasetRegistry) {
    validateRegistryLinks(
      claimRegistry,
      datasetRegistry,
      options.catalogRecords ?? [],
      today,
      errors
    );
  }

  let files: string[] = [];
  try {
    files = await findContentFiles(options.inputRoot);
  } catch (error) {
    errors.push(
      invalid(
        options.inputRoot,
        `Unable to enumerate content: ${messageOf(error)}`
      )
    );
  }
  if (files.length === 0) {
    errors.push(
      invalid(
        options.inputRoot,
        'Claims validator received zero Markdown/MDX files'
      )
    );
  }

  const routeMap = new Map<
    string,
    { file: string; text: string; frontmatter: Record<string, unknown> }[]
  >();
  if (contentPolicyCheck.policy) {
    const privatePatterns = compilePatterns(
      [
        ...new Set([
          ...(claimsPolicy?.privateEvidencePatterns ?? []),
          ...(datasetPolicy?.privateEvidencePatterns ?? []),
        ]),
      ],
      options.claimsPolicyPath,
      errors
    );
    for (const absoluteFile of files) {
      const file = repositoryPath(options.repositoryRoot, absoluteFile);
      const raw = await safeRead(absoluteFile, errors);
      if (raw === undefined) {
        continue;
      }
      scanPrivate(raw, file, privatePatterns, errors);
      const analysis = await analyzeMdx(raw, file, contentPolicyCheck.policy, {
        absoluteFile,
        repositoryRoot: options.repositoryRoot,
      });
      scanPrivate(analysis.visibleText, file, privatePatterns, errors);
      for (const analysisError of analysis.errors) {
        if (
          analysisError.code === 'AST_PARSE_ERROR' ||
          analysisError.code === 'DYNAMIC_VISIBLE_CONTENT' ||
          analysisError.code === 'UNKNOWN_CONTENT_COMPONENT'
        ) {
          errors.push({
            ...analysisError,
            code: 'CLAIM_ATTESTATION_INVALID',
            message: `Claims scan cannot classify route text: ${analysisError.message}`,
          });
        }
      }
      const route = routeFor(file, analysis.frontmatter);
      const routes = routeMap.get(route) ?? [];
      routes.push({
        file,
        text: collectClaimSurfaceText(
          raw,
          analysis.visibleText,
          analysis.frontmatter
        ),
        frontmatter: analysis.frontmatter,
      });
      routeMap.set(route, routes);
    }
  }

  if (claimRegistry && claimsPolicy) {
    validateRouteClaims(
      routeMap,
      claimRegistry,
      claimsPolicy,
      claimsPolicyDigest,
      today,
      errors
    );
  }

  const result = baseResult(options, claimsPolicyDigest, files.length, errors);
  result.metrics = {
    dimensionsChecked: [
      'route-attestation',
      'claim-status-specific-evidence',
      'claim-expiry',
      'independent-verifier',
      'validated-wording-variant',
      'unmapped-material-claim-discovery',
      'qualified-non-assertion-context',
      'dataset-rights-and-fixture-digest',
      'private-public-projection',
    ],
    claims: claimRegistry?.claims.length ?? 0,
    datasets: datasetRegistry?.datasets.length ?? 0,
    routes: routeMap.size,
    datasetPolicyDigest,
  };
  return result;
}

async function validateClaimRegistry(
  registry: ClaimRegistry,
  policyDigest: string,
  today: string,
  repositoryRoot: string,
  file: string,
  errors: Finding[]
): Promise<void> {
  exactKeys(
    registry as unknown as Record<string, unknown>,
    new Set(['schemaVersion', 'policyVersion', 'policyDigest', 'claims']),
    file,
    errors
  );
  if (
    registry.schemaVersion !== '1.0.0' ||
    registry.policyVersion !== 'claims-evidence-v1' ||
    registry.policyDigest !== policyDigest ||
    !Array.isArray(registry.claims)
  ) {
    errors.push(
      invalid(file, 'Claim registry header or policy digest is invalid')
    );
    return;
  }
  const ids = new Set<string>();
  for (const [index, claim] of registry.claims.entries()) {
    const label = `${file}#claims[${index}]`;
    if (!isRecord(claim)) {
      errors.push(claimError(label, 'Claim must be an object'));
      continue;
    }
    exactKeys(claim, CLAIM_KEYS, label, errors, 'CLAIM_EVIDENCE_INVALID');
    if (isRecord(claim.publicSource)) {
      exactKeys(
        claim.publicSource,
        PUBLIC_SOURCE_KEYS,
        `${label}.publicSource`,
        errors,
        'CLAIM_EVIDENCE_INVALID'
      );
    }
    if (isRecord(claim.reproduction)) {
      exactKeys(
        claim.reproduction,
        REPRODUCTION_KEYS,
        `${label}.reproduction`,
        errors,
        'CLAIM_EVIDENCE_INVALID'
      );
    }
    if (
      claim.visibleLabel !== undefined &&
      (typeof claim.visibleLabel !== 'string' ||
        claim.visibleLabel.trim() === '')
    ) {
      errors.push(claimError(label, 'visibleLabel must be a non-empty string'));
    }
    if (
      claim.status !== 'third-party-sourced' &&
      claim.publicSource !== undefined &&
      !validPublicSource(claim.publicSource, today)
    ) {
      errors.push(claimError(label, 'Optional publicSource shape is invalid'));
    }
    if (claim.status !== 'measured' && claim.reproduction !== undefined) {
      await validateReproduction(claim, repositoryRoot, label, errors);
    }
    const idValid =
      typeof claim.id === 'string' &&
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(claim.id);
    if (!idValid || ids.has(String(claim.id))) {
      errors.push(claimError(label, 'Claim id is invalid or duplicated'));
    } else {
      ids.add(claim.id as string);
    }
    if (
      typeof claim.exactWording !== 'string' ||
      claim.exactWording.trim() === '' ||
      !isUniqueStringArray(claim.conservativeVariants, true) ||
      !CLAIM_TYPES.has(String(claim.type)) ||
      !CLAIM_STATUSES.has(String(claim.status)) ||
      !isUniqueStringArray(claim.routes, true) ||
      !(claim.routes as string[]).every((route) => route.startsWith('/')) ||
      !isUniqueStringArray(claim.assumptions, true) ||
      !nonemptyStringRecord(claim.environment) ||
      !validAgentId(claim.producerAgentId) ||
      !validAgentId(claim.verifierAgentId) ||
      claim.producerAgentId === claim.verifierAgentId ||
      !isIsoDate(claim.verifiedAt) ||
      !isIsoDate(claim.reviewBy) ||
      (isIsoDate(claim.verifiedAt) &&
        isIsoDate(claim.reviewBy) &&
        claim.reviewBy < claim.verifiedAt) ||
      (isIsoDate(claim.verifiedAt) && claim.verifiedAt > today)
    ) {
      errors.push(
        claimError(label, 'Claim base evidence is incomplete or invalid')
      );
    }
    if (isIsoDate(claim.reviewBy) && claim.reviewBy < today) {
      errors.push({
        code: 'CLAIM_EXPIRED',
        file: label,
        message: `Claim expired on ${claim.reviewBy}`,
      });
    }
    if (claim.status === 'prohibited') {
      errors.push({
        code: 'PROHIBITED_CLAIM',
        file: label,
        message: 'Prohibited claim is not publishable',
      });
    } else if (claim.status === 'measured') {
      await validateReproduction(claim, repositoryRoot, label, errors);
    } else if (claim.status === 'third-party-sourced') {
      const source = claim.publicSource;
      if (
        !isRecord(source) ||
        typeof source.url !== 'string' ||
        !source.url.startsWith('https://') ||
        typeof source.title !== 'string' ||
        source.title.trim() === '' ||
        !isIsoDate(source.publicationDate) ||
        !isIsoDate(source.retrievedAt) ||
        (isIsoDate(source.publicationDate) && source.publicationDate > today) ||
        (isIsoDate(source.retrievedAt) && source.retrievedAt > today) ||
        (isIsoDate(source.publicationDate) &&
          isIsoDate(source.retrievedAt) &&
          source.publicationDate > source.retrievedAt)
      ) {
        errors.push(
          claimError(
            label,
            'Third-party claim lacks a dated HTTPS public source'
          )
        );
      }
    } else if (claim.status === 'modeled' || claim.status === 'illustrative') {
      if (
        typeof claim.visibleLabel !== 'string' ||
        claim.visibleLabel.trim() === ''
      ) {
        errors.push(
          claimError(label, `${claim.status} claim lacks a visible label`)
        );
      }
    }
  }
}

function validPublicSource(value: unknown, today: string): boolean {
  return (
    isRecord(value) &&
    typeof value.url === 'string' &&
    value.url.startsWith('https://') &&
    typeof value.title === 'string' &&
    value.title.trim() !== '' &&
    isIsoDate(value.publicationDate) &&
    isIsoDate(value.retrievedAt) &&
    value.publicationDate <= today &&
    value.retrievedAt <= today &&
    value.publicationDate <= value.retrievedAt
  );
}

async function validateReproduction(
  claim: Record<string, unknown>,
  repositoryRoot: string,
  label: string,
  errors: Finding[]
): Promise<void> {
  const reproduction = claim.reproduction;
  if (
    !isRecord(reproduction) ||
    typeof reproduction.command !== 'string' ||
    reproduction.command.trim() === '' ||
    typeof reproduction.fixturePath !== 'string' ||
    typeof reproduction.rawResultPath !== 'string' ||
    !isSha256(reproduction.fixtureSha256) ||
    !isSha256(reproduction.rawResultSha256) ||
    !nonemptyStringRecord(reproduction.productVersions)
  ) {
    errors.push(
      claimError(label, 'Measured claim lacks pinned reproduction evidence')
    );
    return;
  }
  await verifyRepositoryFile(
    repositoryRoot,
    reproduction.fixturePath,
    reproduction.fixtureSha256,
    label,
    errors
  );
  await verifyRepositoryFile(
    repositoryRoot,
    reproduction.rawResultPath,
    reproduction.rawResultSha256,
    label,
    errors
  );
}

async function validateDatasetRegistry(
  registry: DatasetRegistry,
  policyDigest: string,
  today: string,
  repositoryRoot: string,
  file: string,
  errors: Finding[]
): Promise<void> {
  exactKeys(
    registry as unknown as Record<string, unknown>,
    new Set(['schemaVersion', 'policyVersion', 'policyDigest', 'datasets']),
    file,
    errors
  );
  if (
    registry.schemaVersion !== '1.0.0' ||
    registry.policyVersion !== 'dataset-evidence-v1' ||
    registry.policyDigest !== policyDigest ||
    !Array.isArray(registry.datasets)
  ) {
    errors.push(
      datasetError(file, 'Dataset registry header or policy digest is invalid')
    );
    return;
  }
  const ids = new Set<string>();
  for (const [index, dataset] of registry.datasets.entries()) {
    const label = `${file}#datasets[${index}]`;
    if (!isRecord(dataset)) {
      errors.push(datasetError(label, 'Dataset must be an object'));
      continue;
    }
    exactKeys(dataset, DATASET_KEYS, label, errors, 'DATASET_EVIDENCE_INVALID');
    if (isRecord(dataset.piiScan)) {
      exactKeys(
        dataset.piiScan,
        SCAN_KEYS,
        `${label}.piiScan`,
        errors,
        'DATASET_EVIDENCE_INVALID'
      );
    }
    if (isRecord(dataset.syntheticDataScan)) {
      exactKeys(
        dataset.syntheticDataScan,
        SCAN_KEYS,
        `${label}.syntheticDataScan`,
        errors,
        'DATASET_EVIDENCE_INVALID'
      );
    }
    if (isRecord(dataset.generation)) {
      exactKeys(
        dataset.generation,
        GENERATION_KEYS,
        `${label}.generation`,
        errors,
        'DATASET_EVIDENCE_INVALID'
      );
    }
    const optionalShapeInvalid =
      (dataset.sourceUrl !== undefined &&
        (typeof dataset.sourceUrl !== 'string' ||
          !dataset.sourceUrl.startsWith('https://'))) ||
      (dataset.sourceSha256 !== undefined && !isSha256(dataset.sourceSha256)) ||
      (dataset.spdxLicenseId !== undefined &&
        (typeof dataset.spdxLicenseId !== 'string' ||
          dataset.spdxLicenseId.trim() === '')) ||
      (dataset.licenseTextPath !== undefined &&
        (typeof dataset.licenseTextPath !== 'string' ||
          dataset.licenseTextPath.trim() === '')) ||
      (dataset.generation !== undefined &&
        !validGeneration(dataset.generation));
    if (
      typeof dataset.id !== 'string' ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(dataset.id) ||
      ids.has(dataset.id) ||
      (dataset.kind !== 'synthetic' && dataset.kind !== 'public-derived') ||
      !isUniqueStringArray(dataset.fixturePaths, true) ||
      !isSha256(dataset.fixtureSha256) ||
      dataset.deterministic !== true ||
      typeof dataset.attribution !== 'string' ||
      dataset.attribution.trim() === '' ||
      typeof dataset.transformationRecord !== 'string' ||
      dataset.transformationRecord.trim() === '' ||
      dataset.redistributionScope !== 'repository-and-public-build' ||
      dataset.dataRightsVerdict !== 'allowed' ||
      !validScan(dataset.piiScan) ||
      !validScan(dataset.syntheticDataScan) ||
      optionalShapeInvalid ||
      (isRecord(dataset.piiScan) &&
        isIsoDate(dataset.piiScan.checkedAt) &&
        dataset.piiScan.checkedAt > today) ||
      (isRecord(dataset.syntheticDataScan) &&
        isIsoDate(dataset.syntheticDataScan.checkedAt) &&
        dataset.syntheticDataScan.checkedAt > today)
    ) {
      errors.push(
        datasetError(label, 'Dataset base evidence is incomplete or invalid')
      );
      continue;
    }
    ids.add(dataset.id);
    if (dataset.kind === 'synthetic') {
      if (!validGeneration(dataset.generation)) {
        errors.push(
          datasetError(
            label,
            'Synthetic fixture lacks pinned generator and seed'
          )
        );
      } else {
        await verifyRepositoryFile(
          repositoryRoot,
          dataset.generation.generatorPath,
          dataset.generation.generatorSha256,
          label,
          errors
        );
      }
    } else if (
      typeof dataset.sourceUrl !== 'string' ||
      !dataset.sourceUrl.startsWith('https://') ||
      !isSha256(dataset.sourceSha256) ||
      typeof dataset.spdxLicenseId !== 'string' ||
      dataset.spdxLicenseId.trim() === '' ||
      typeof dataset.licenseTextPath !== 'string'
    ) {
      errors.push(
        datasetError(
          label,
          'Public-derived fixture lacks source, digest, SPDX, or license evidence'
        )
      );
    } else {
      await verifyRepositoryPath(
        repositoryRoot,
        dataset.licenseTextPath,
        label,
        errors
      );
    }
    const actualDigest = await digestFixtureSet(
      repositoryRoot,
      dataset.fixturePaths,
      label,
      errors
    );
    if (actualDigest && actualDigest !== dataset.fixtureSha256) {
      errors.push(
        datasetError(
          label,
          `Fixture digest mismatch: expected ${dataset.fixtureSha256}, got ${actualDigest}`
        )
      );
    }
  }
}

function validateRouteClaims(
  routeMap: Map<
    string,
    { file: string; text: string; frontmatter: Record<string, unknown> }[]
  >,
  registry: ClaimRegistry,
  policy: ClaimsPolicy,
  policyDigest: string,
  today: string,
  errors: Finding[]
): void {
  const claimsById = new Map(registry.claims.map((claim) => [claim.id, claim]));
  const materialPatterns = compilePatterns(
    policy.materialClaimPatterns,
    'claims-policy',
    errors
  );
  const nonAssertionPatterns = compilePatterns(
    policy.nonAssertionContextPatterns,
    'claims-policy',
    errors
  );
  const forbiddenPatterns = compilePatterns(
    policy.forbiddenWordingPatterns,
    'claims-policy',
    errors
  );
  for (const [route, documents] of routeMap) {
    for (const document of documents) {
      const claimIds = document.frontmatter.claimIds;
      const verifier = document.frontmatter.claimsVerifiedBy;
      const verifiedAt = document.frontmatter.claimsVerifiedAt;
      const digest = document.frontmatter.claimsPolicyDigest;
      const attestationInvalid =
        !isUniqueStringArray(claimIds, false) ||
        !validAgentId(verifier) ||
        !isIsoDate(verifiedAt) ||
        (isIsoDate(verifiedAt) && verifiedAt > today) ||
        digest !== policyDigest;
      if (attestationInvalid) {
        errors.push({
          code: 'CLAIM_ATTESTATION_INVALID',
          file: document.file,
          message:
            'Route must declare claimIds (including []), claimsVerifiedBy, claimsVerifiedAt, and the current claimsPolicyDigest',
        });
      }
      const declaredClaimIds = isUniqueStringArray(claimIds, false)
        ? claimIds
        : [];
      const normalizedText = normalizeVisibleText(document.text);
      const mappedVariants: string[] = [];
      for (const claimId of declaredClaimIds) {
        const claim = claimsById.get(claimId);
        if (!claim) {
          errors.push(
            claimError(document.file, `Unknown claim id: ${claimId}`)
          );
          continue;
        }
        if (!claim.routes.includes(route)) {
          errors.push(
            claimError(
              document.file,
              `Claim ${claimId} does not authorize route ${route}`
            )
          );
        }
        if (
          claim.verifierAgentId !== verifier ||
          !isIsoDate(verifiedAt) ||
          verifiedAt < claim.verifiedAt
        ) {
          errors.push(
            claimError(
              document.file,
              `Route attestation does not match claim ${claimId} verifier/date`
            )
          );
        }
        const variants = [claim.exactWording, ...claim.conservativeVariants];
        const matched = variants.find((variant) =>
          normalizedText.includes(normalizeVisibleText(variant))
        );
        if (!matched) {
          errors.push(
            claimError(
              document.file,
              `No validated wording variant for claim ${claimId} appears on the route`
            )
          );
        } else {
          mappedVariants.push(matched);
        }
        if (claim.status === 'modeled' || claim.status === 'illustrative') {
          for (const visible of [
            claim.visibleLabel ?? '',
            ...claim.assumptions,
          ]) {
            if (!normalizedText.includes(normalizeVisibleText(visible))) {
              errors.push(
                claimError(
                  document.file,
                  `${claimId} does not visibly disclose label/assumption: ${visible}`
                )
              );
            }
          }
        }
      }
      for (const pattern of forbiddenPatterns) {
        pattern.lastIndex = 0;
        if (pattern.test(document.text)) {
          errors.push({
            code: 'PROHIBITED_CLAIM',
            file: document.file,
            message: `Forbidden claim wording matched ${pattern.source}`,
          });
        }
      }
      for (const pattern of materialPatterns) {
        for (const sentence of matchingClaimSentences(
          document.text,
          pattern,
          nonAssertionPatterns
        )) {
          const normalizedSentence = normalizeVisibleText(sentence);
          const mapped = mappedVariants.some((variant) => {
            const normalizedVariant = normalizeVisibleText(variant);
            return (
              normalizedSentence.includes(normalizedVariant) ||
              normalizedVariant.includes(normalizedSentence)
            );
          });
          if (!mapped) {
            errors.push({
              code: 'CLAIM_UNMAPPED',
              file: document.file,
              message: `Potential material claim is not mapped to validated evidence: ${sentence.trim().slice(0, 180)}`,
              detail: { pattern: pattern.source },
            });
          }
        }
      }
    }
  }
  for (const claim of registry.claims) {
    for (const route of claim.routes) {
      if (!routeMap.has(route)) {
        errors.push(
          claimError(
            'content/claims/claims-v1.json',
            `Claim ${claim.id} references missing scanned route ${route}`
          )
        );
      }
    }
  }
}

export async function digestFixtureSet(
  repositoryRoot: string,
  paths: string[],
  label = 'dataset',
  errors: Finding[] = []
): Promise<string | null> {
  const frames: string[] = [];
  for (const path of [...paths].sort()) {
    const absolute = safeRepositoryPath(repositoryRoot, path);
    if (!absolute) {
      errors.push(datasetError(label, `Unsafe fixture path: ${path}`));
      return null;
    }
    try {
      frames.push(`${path}\0${await sha256File(absolute)}\n`);
    } catch (error) {
      errors.push(
        datasetError(
          label,
          `Unable to read fixture ${path}: ${messageOf(error)}`
        )
      );
      return null;
    }
  }
  return sha256(frames.join(''));
}

function routeFor(file: string, frontmatter: Record<string, unknown>): string {
  if (
    typeof frontmatter.slug === 'string' &&
    frontmatter.slug.startsWith('/')
  ) {
    return normalizeRoute(frontmatter.slug);
  }
  const withoutDocs = file.replace(/^docs\//, '').replace(/\.mdx?$/, '');
  return normalizeRoute(`/${withoutDocs.replace(/\/?index$/, '')}`);
}

function normalizeRoute(route: string): string {
  const compact = route.replace(/\/{2,}/g, '/');
  return compact === '/' ? '/' : compact.replace(/\/$/, '');
}

async function verifyRepositoryFile(
  root: string,
  path: unknown,
  expected: unknown,
  label: string,
  errors: Finding[]
): Promise<void> {
  if (typeof path !== 'string' || !isSha256(expected)) {
    errors.push(claimError(label, 'Evidence path or digest is invalid'));
    return;
  }
  const absolute = await verifyRepositoryPath(root, path, label, errors);
  if (!absolute) return;
  try {
    const actual = await sha256File(absolute);
    if (actual !== expected)
      errors.push(claimError(label, `Digest mismatch for ${path}`));
  } catch (error) {
    errors.push(
      claimError(label, `Unable to hash ${path}: ${messageOf(error)}`)
    );
  }
}

async function verifyRepositoryPath(
  root: string,
  path: unknown,
  label: string,
  errors: Finding[]
): Promise<string | null> {
  if (typeof path !== 'string') {
    errors.push(
      datasetError(label, 'Evidence path must be a repository-relative string')
    );
    return null;
  }
  const absolute = safeRepositoryPath(root, path);
  if (!absolute) {
    errors.push(
      datasetError(label, `Evidence path escapes repository: ${path}`)
    );
    return null;
  }
  try {
    await readFile(absolute);
    return absolute;
  } catch (error) {
    errors.push(
      datasetError(
        label,
        `Evidence path is unreadable: ${path}: ${messageOf(error)}`
      )
    );
    return null;
  }
}

function safeRepositoryPath(root: string, path: string): string | null {
  if (path.startsWith('/') || path.includes('\0')) return null;
  const absoluteRoot = resolve(root);
  const absolute = resolve(absoluteRoot, path);
  const rel = relative(absoluteRoot, absolute);
  return rel === '' || (!rel.startsWith(`..${sep}`) && rel !== '..')
    ? absolute
    : null;
}

function scanPrivate(
  raw: string,
  file: string,
  patterns: RegExp[],
  errors: Finding[]
): void {
  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    if (pattern.test(raw)) {
      errors.push({
        code: 'PRIVATE_EVIDENCE_LEAK',
        file,
        message: `Private evidence pattern matched ${pattern.source}`,
      });
    }
  }
}

function compilePatterns(
  patterns: string[],
  file: string,
  errors: Finding[]
): RegExp[] {
  const compiled: RegExp[] = [];
  for (const source of patterns) {
    try {
      compiled.push(new RegExp(source, 'giu'));
    } catch (error) {
      errors.push(
        invalid(file, `Invalid policy regex ${source}: ${messageOf(error)}`)
      );
    }
  }
  return compiled;
}

function matchingSentences(text: string, pattern: RegExp): string[] {
  return [
    ...new Set(
      text.split(/(?<=[.!?])\s+|\n+/).filter((sentence) => {
        pattern.lastIndex = 0;
        return pattern.test(sentence);
      })
    ),
  ];
}

function matchingClaimSentences(
  text: string,
  pattern: RegExp,
  nonAssertionPatterns: RegExp[]
): string[] {
  const matches = text.split(/(?<=[.!?])\s+|\n+/).filter((sentence) => {
    pattern.lastIndex = 0;
    const materialMatches = [...sentence.matchAll(pattern)];
    if (materialMatches.length === 0) return false;
    const excludedRanges = nonAssertionPatterns.flatMap((exclusion) => {
      exclusion.lastIndex = 0;
      return [...sentence.matchAll(exclusion)].map((match) => ({
        start: match.index,
        end: match.index + match[0].length,
      }));
    });
    return materialMatches.some((match) => {
      const start = match.index;
      const end = start + match[0].length;
      return !excludedRanges.some(
        (excluded) => start < excluded.end && excluded.start < end
      );
    });
  });
  return [...new Set(matches)];
}

/**
 * Claims can affect a visitor before they reach body prose. Scan the rendered
 * narrative plus public metadata, Markdown tables with their headers intact,
 * and comments shown inside fenced examples. Keywords are deliberately
 * excluded: a taxonomy label such as `pci-dss` is not itself an assertion.
 */
function collectClaimSurfaceText(
  raw: string,
  visibleText: string,
  frontmatter: Record<string, unknown>
): string {
  const publicMetadata = ['title', 'sidebar_label', 'description']
    .map((field) => frontmatter[field])
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.trim())
    .filter(Boolean);
  return [
    ...publicMetadata,
    visibleText,
    ...extractMarkdownTableText(raw),
    ...extractFencedCodeComments(raw),
  ]
    .filter(Boolean)
    .join('\n');
}

function extractMarkdownTableText(raw: string): string[] {
  const tables: string[] = [];
  let rows: string[] = [];
  const flush = (): void => {
    if (rows.length >= 2 && isMarkdownTableSeparator(rows[1])) {
      const cells = rows
        .filter((_, index) => index !== 1)
        .flatMap(markdownTableCells);
      if (cells.length > 0) tables.push(cells.join(' '));
    }
    rows = [];
  };
  for (const line of raw.split(/\r?\n/)) {
    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      rows.push(line);
    } else {
      flush();
    }
  }
  flush();
  return tables;
}

function isMarkdownTableSeparator(row: string): boolean {
  const cells = markdownTableCells(row);
  return (
    cells.length > 0 &&
    cells.every((cell) => /^:?-{3,}:?$/.test(cell.replaceAll(' ', '')))
  );
}

function markdownTableCells(row: string): string[] {
  return row
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split(/(?<!\\)\|/)
    .map((cell) => cell.replaceAll('\\|', '|').trim())
    .filter(Boolean);
}

function extractFencedCodeComments(raw: string): string[] {
  const comments: string[] = [];
  const fences = /^(`{3,}|~{3,})[^\n]*\n([\s\S]*?)^\1\s*$/gmu;
  for (const match of raw.matchAll(fences)) {
    const code = match[2] ?? '';
    for (const block of code.matchAll(/\/\*([\s\S]*?)\*\//gu)) {
      const text = (block[1] ?? '')
        .split(/\r?\n/)
        .map((line) => line.replace(/^\s*\*?\s?/, '').trim())
        .filter(Boolean)
        .join(' ');
      if (text) comments.push(text);
    }
    for (const line of code.split(/\r?\n/)) {
      const standalone = line.match(/^\s*(?:#(?![!])|\/\/|--)\s+(.+)$/u);
      if (standalone?.[1]) {
        comments.push(standalone[1].trim());
        continue;
      }
      const inline = line.match(/\s(?:#|\/\/|--)\s+(.+)$/u);
      if (inline?.[1]) comments.push(inline[1].trim());
    }
  }
  return comments;
}

function exactKeys(
  value: Record<string, unknown>,
  allowed: Set<string>,
  file: string,
  errors: Finding[],
  code: Finding['code'] = 'INVALID_CONTRACT'
): void {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key))
      errors.push({ code, file, message: `Unknown field: ${key}` });
  }
}

function validClaimsPolicy(
  value: ClaimsPolicy | undefined
): value is ClaimsPolicy {
  const requiredRouteFields = [
    'claimIds',
    'claimsVerifiedBy',
    'claimsVerifiedAt',
    'claimsPolicyDigest',
  ];
  return Boolean(
    value &&
      value.contractVersion === '1.0.0' &&
      value.gateId === 'claims-evidence-v1' &&
      sameStringSet(value.allowedStatuses, CLAIM_STATUSES) &&
      isUniqueStringArray(value.privateEvidencePatterns, true) &&
      isUniqueStringArray(value.materialClaimPatterns, true) &&
      isUniqueStringArray(value.nonAssertionContextPatterns, true) &&
      isUniqueStringArray(value.forbiddenWordingPatterns, true) &&
      sameStringSet(
        value.requiredRouteAttestationFields,
        new Set(requiredRouteFields)
      )
  );
}

function validDatasetPolicy(
  value: DatasetPolicy | undefined
): value is DatasetPolicy {
  return Boolean(
    value &&
      value.contractVersion === '1.0.0' &&
      value.gateId === 'claims-evidence-v1' &&
      value.policyVersion === 'dataset-evidence-v1' &&
      isUniqueStringArray(value.fixtureRoots, true) &&
      isUniqueStringArray(value.fixtureFilePatterns, true) &&
      sameStringSet(
        value.allowedRedistributionScopes,
        new Set(['repository-and-public-build'])
      ) &&
      value.requiredVerdict === 'allowed' &&
      typeof value.ambiguousRightsVerdict === 'string' &&
      isUniqueStringArray(value.privateEvidencePatterns, true)
  );
}

function validateClaimsPolicyShape(
  value: ClaimsPolicy | undefined,
  file: string,
  errors: Finding[]
): void {
  if (!value || !isRecord(value)) return;
  exactKeys(
    value as unknown as Record<string, unknown>,
    new Set([
      'contractVersion',
      'gateId',
      'allowedStatuses',
      'privateEvidencePatterns',
      'materialClaimPatterns',
      'nonAssertionContextPatterns',
      'forbiddenWordingPatterns',
      'requiredRouteAttestationFields',
    ]),
    file,
    errors
  );
}

function validateDatasetPolicyShape(
  value: DatasetPolicy | undefined,
  file: string,
  errors: Finding[]
): void {
  if (!value || !isRecord(value)) return;
  exactKeys(
    value as unknown as Record<string, unknown>,
    new Set([
      'contractVersion',
      'gateId',
      'policyVersion',
      'fixtureRoots',
      'fixtureFilePatterns',
      'allowedRedistributionScopes',
      'requiredVerdict',
      'ambiguousRightsVerdict',
      'privateEvidencePatterns',
    ]),
    file,
    errors
  );
}

function sameStringSet(value: unknown, expected: Set<string>): boolean {
  return (
    isUniqueStringArray(value, true) &&
    value.length === expected.size &&
    value.every((item) => expected.has(item))
  );
}

function validateRegistryLinks(
  claims: ClaimRegistry,
  datasets: DatasetRegistry,
  catalogRecords: CatalogEvidenceRecord[],
  today: string,
  errors: Finding[]
): void {
  if (!Array.isArray(claims.claims) || !Array.isArray(datasets.datasets)) {
    return;
  }
  const claimIds = new Set(
    claims.claims
      .filter((claim) => isRecord(claim) && typeof claim.id === 'string')
      .map((claim) => claim.id)
  );
  const fixtureOwners = new Map<string, string>();
  for (const dataset of datasets.datasets) {
    if (!isRecord(dataset) || !Array.isArray(dataset.fixturePaths)) continue;
    for (const path of dataset.fixturePaths) {
      if (typeof path !== 'string') continue;
      const earlier = fixtureOwners.get(path);
      if (earlier) {
        errors.push(
          datasetError(
            'content/datasets/datasets-v1.json',
            `Fixture ${path} is registered by both ${earlier} and ${String(dataset.id)}`
          )
        );
      } else {
        fixtureOwners.set(path, String(dataset.id));
      }
    }
  }
  for (const claim of claims.claims) {
    if (
      isRecord(claim) &&
      claim.status === 'measured' &&
      isRecord(claim.reproduction) &&
      typeof claim.reproduction.fixturePath === 'string' &&
      !fixtureOwners.has(claim.reproduction.fixturePath)
    ) {
      errors.push(
        claimError(
          `content/claims/claims-v1.json#${String(claim.id)}`,
          `Measured reproduction fixture ${claim.reproduction.fixturePath} is absent from the dataset registry`
        )
      );
    }
  }
  for (const record of catalogRecords) {
    if (!isUniqueStringArray(record.claimIds, false)) {
      errors.push(
        claimError(`catalog:${record.id}`, 'Catalog claimIds must be an array')
      );
    } else {
      for (const claimId of record.claimIds) {
        if (!claimIds.has(claimId)) {
          errors.push(
            claimError(
              `catalog:${record.id}`,
              `Catalog claim id ${claimId} is absent from the claim registry`
            )
          );
        }
      }
    }
    for (const [field, path] of [
      ['fixturePath', record.fixturePath],
      ['expectedOutputPath', record.expectedOutputPath],
    ] as const) {
      if (path && !fixtureOwners.has(path)) {
        errors.push(
          datasetError(
            `catalog:${record.id}`,
            `Catalog ${field} ${path} is absent from the dataset registry`
          )
        );
      }
    }
    for (const [field, date] of [
      ['lastTechnicalVerification', record.lastTechnicalVerification],
      ['lastEditorialVerification', record.lastEditorialVerification],
    ] as const) {
      if (date && (!isIsoDate(date) || date > today)) {
        errors.push(
          claimError(
            `catalog:${record.id}`,
            `Catalog ${field} must be a non-future ISO date`
          )
        );
      }
    }
  }
}

async function validateFixtureCoverage(
  registry: DatasetRegistry,
  policy: DatasetPolicy,
  repositoryRoot: string,
  file: string,
  errors: Finding[],
  scopePrefixes?: string[]
): Promise<void> {
  const normalizedScopes = scopePrefixes?.map((prefix) => {
    if (
      prefix.startsWith('/') ||
      prefix.includes('\\') ||
      prefix !== prefix.replace(/\/$/, '') ||
      !safeRepositoryPath(repositoryRoot, prefix)
    ) {
      errors.push(datasetError(file, `Unsafe fixture scope prefix: ${prefix}`));
      return null;
    }
    return prefix;
  });
  if (normalizedScopes?.some((scope) => scope === null)) return;
  const patterns = compilePatterns(policy.fixtureFilePatterns, file, errors);
  const registered = new Set(
    registry.datasets.flatMap((dataset) => dataset.fixturePaths)
  );
  for (const fixtureRoot of policy.fixtureRoots) {
    const safeRoot = safeRepositoryPath(repositoryRoot, fixtureRoot);
    if (!safeRoot) {
      errors.push(datasetError(file, `Unsafe fixture root: ${fixtureRoot}`));
      continue;
    }
    let candidates: string[];
    try {
      candidates = await findFiles(safeRoot, (_name, absolutePath) => {
        const path = repositoryPath(repositoryRoot, absolutePath);
        return patterns.some((pattern) => {
          pattern.lastIndex = 0;
          return pattern.test(path);
        });
      });
    } catch (error) {
      errors.push(
        datasetError(
          file,
          `Unable to scan fixture root ${fixtureRoot}: ${messageOf(error)}`
        )
      );
      continue;
    }
    for (const candidate of candidates) {
      const path = repositoryPath(repositoryRoot, candidate);
      if (
        normalizedScopes &&
        !normalizedScopes.some(
          (prefix) =>
            prefix !== null &&
            (path === prefix ||
              path.startsWith(`${prefix}/`) ||
              path.startsWith(`${prefix}-`))
        )
      ) {
        continue;
      }
      if (!registered.has(path)) {
        errors.push(
          datasetError(
            path,
            'Public fixture candidate has no data-rights registry record'
          )
        );
      }
    }
  }
}

function validAgentId(value: unknown): value is string {
  return (
    typeof value === 'string' && /^[a-z0-9][a-z0-9._/-]{2,127}$/.test(value)
  );
}

function nonemptyStringRecord(value: unknown): value is Record<string, string> {
  return (
    isRecord(value) &&
    Object.keys(value).length > 0 &&
    Object.values(value).every(
      (item) => typeof item === 'string' && item.trim() !== ''
    )
  );
}

function validScan(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.tool === 'string' &&
    value.tool.trim() !== '' &&
    typeof value.command === 'string' &&
    value.command.trim() !== '' &&
    value.result === 'PASS' &&
    isIsoDate(value.checkedAt)
  );
}

function validGeneration(value: unknown): value is {
  command: string;
  generatorPath: string;
  generatorSha256: string;
  seed: string;
} {
  return (
    isRecord(value) &&
    typeof value.command === 'string' &&
    value.command.trim() !== '' &&
    typeof value.generatorPath === 'string' &&
    isSha256(value.generatorSha256) &&
    typeof value.seed === 'string' &&
    value.seed.trim() !== ''
  );
}

async function safeRead(
  path: string,
  errors: Finding[]
): Promise<string | undefined> {
  try {
    return await readFile(path, 'utf8');
  } catch (error) {
    errors.push(invalid(path, `Unable to read file: ${messageOf(error)}`));
    return undefined;
  }
}

function parsePolicy<T>(
  raw: string | undefined,
  file: string,
  errors: Finding[]
): T | undefined {
  if (raw === undefined) return undefined;
  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    errors.push(invalid(file, `Invalid JSON: ${messageOf(error)}`));
    return undefined;
  }
}

async function parseRegistry<T>(
  path: string,
  errors: Finding[]
): Promise<T | undefined> {
  try {
    return await readJson<T>(path);
  } catch (error) {
    errors.push(
      invalid(path, `Invalid or unreadable registry: ${messageOf(error)}`)
    );
    return undefined;
  }
}

function invalid(file: string, message: string): Finding {
  return { code: 'INVALID_CONTRACT', file, message };
}
function claimError(file: string, message: string): Finding {
  return { code: 'CLAIM_EVIDENCE_INVALID', file, message };
}
function datasetError(file: string, message: string): Finding {
  return { code: 'DATASET_EVIDENCE_INVALID', file, message };
}
function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function baseResult(
  options: ClaimsValidationOptions,
  policyDigest: string,
  filesChecked: number,
  errors: Finding[]
): ValidationResult {
  return {
    contractVersion: '1.0.0',
    gateId: 'claims-evidence-v1',
    status: errors.length === 0 ? 'PASS' : 'FAIL',
    checkedAt: (options.now ?? new Date()).toISOString(),
    policyDigest,
    filesChecked,
    errors,
    warnings: [],
    metrics: {},
  };
}
