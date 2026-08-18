export type GateStatus = 'PASS' | 'FAIL';

export type FindingCode =
  | 'AST_PARSE_ERROR'
  | 'BUDGET_EXCEEDED'
  | 'CLAIM_ATTESTATION_INVALID'
  | 'CLAIM_EVIDENCE_INVALID'
  | 'CLAIM_EXPIRED'
  | 'CLAIM_UNMAPPED'
  | 'DATASET_EVIDENCE_INVALID'
  | 'DUPLICATE_CONTENT'
  | 'DYNAMIC_VISIBLE_CONTENT'
  | 'FRONTMATTER_INVALID'
  | 'INVALID_CONTRACT'
  | 'PRIVATE_EVIDENCE_LEAK'
  | 'PLACEHOLDER_CONTENT'
  | 'PROHIBITED_CLAIM'
  | 'READINESS_VOCABULARY_INVALID'
  | 'STRUCTURE_INVALID'
  | 'UNKNOWN_CONTENT_COMPONENT';

export interface Finding {
  code: FindingCode;
  file: string;
  message: string;
  line?: number;
  detail?: Record<string, unknown>;
}

export interface ValidationResult {
  contractVersion: '1.0.0';
  gateId: 'content-validator-v1' | 'claims-evidence-v1';
  status: GateStatus;
  checkedAt: string;
  policyDigest: string;
  filesChecked: number;
  errors: Finding[];
  warnings: Finding[];
  metrics: Record<string, unknown>;
}

export type ContentArchetype =
  | 'catalog-card'
  | 'overview'
  | 'explorer'
  | 'run'
  | 'step'
  | 'troubleshooting'
  | 'reference';

export interface SurfaceBudget {
  targetMin: number | null;
  targetMax: number | null;
  hardMax: number | null;
}

export interface ComponentContract {
  mode: 'children' | 'opaque-narrative-free';
  textProps: string[];
  importedTextProps?: Record<
    string,
    {
      narrativeKeys: string[];
      visibleTextKeys: string[];
    }
  >;
}

export interface ArchetypeRequirement {
  requiredFrontmatter: string[];
  requiredHeadingPatterns: string[];
  requiredComponentGroups: string[][];
}

export interface ContentPolicy {
  contractVersion: '1.0.0';
  gateId: 'content-validator-v1';
  budgets: Record<ContentArchetype, SurfaceBudget>;
  structure: {
    overviewOpeningHardMax: number;
    localNavigationAfterWords: number;
    localNavigationAfterHeadings: number;
    localNavigationAfterNarrativeBlocks: number;
    duplicateBlockMinimumWords: number;
  };
  actionHeadingPatterns: string[];
  placeholderPhrases: string[];
  readinessVocabulary: {
    executionStatuses: string[];
    operationalEvidenceStatuses: string[];
    forbiddenPatterns: string[];
  };
  archetypeRequirements: Record<ContentArchetype, ArchetypeRequirement>;
  componentContracts: Record<string, ComponentContract>;
  intrinsicTextProps: string[];
}

export interface NarrativeBlock {
  text: string;
  words: number;
  line?: number;
  kind: string;
}

export interface ContentAnalysis {
  file: string;
  frontmatter: Record<string, unknown>;
  visibleText: string;
  blocks: NarrativeBlock[];
  wordCount: number;
  openingWordCount: number;
  headingCount: number;
  headings: string[];
  componentNames: string[];
  hasLocalNavigation: boolean;
  uniqueTasks: string[];
  errors: Finding[];
}

export type ClaimStatus =
  | 'measured'
  | 'modeled'
  | 'third-party-sourced'
  | 'illustrative'
  | 'prohibited';

export interface ClaimRecord {
  id: string;
  exactWording: string;
  conservativeVariants: string[];
  type:
    | 'legal'
    | 'cost'
    | 'performance'
    | 'reliability'
    | 'compression'
    | 'bandwidth'
    | 'security'
    | 'compliance'
    | 'market'
    | 'accuracy'
    | 'partner'
    | 'interoperability';
  status: ClaimStatus;
  routes: string[];
  assumptions: string[];
  environment: Record<string, string>;
  producerAgentId: string;
  verifierAgentId: string;
  verifiedAt: string;
  reviewBy: string;
  visibleLabel?: string;
  publicSource?: {
    url: string;
    title: string;
    publicationDate: string;
    retrievedAt: string;
  };
  reproduction?: {
    command: string;
    fixturePath: string;
    fixtureSha256: string;
    rawResultPath: string;
    rawResultSha256: string;
    productVersions: Record<string, string>;
  };
}

export interface ClaimRegistry {
  schemaVersion: '1.0.0';
  policyVersion: 'claims-evidence-v1';
  policyDigest: string;
  claims: ClaimRecord[];
}

export interface DatasetRecord {
  id: string;
  kind: 'synthetic' | 'public-derived';
  fixturePaths: string[];
  fixtureSha256: string;
  deterministic: true;
  attribution: string;
  transformationRecord: string;
  redistributionScope: 'repository-and-public-build';
  dataRightsVerdict: 'allowed';
  piiScan: {
    tool: string;
    command: string;
    result: 'PASS';
    checkedAt: string;
  };
  syntheticDataScan: {
    tool: string;
    command: string;
    result: 'PASS';
    checkedAt: string;
  };
  sourceUrl?: string;
  sourceSha256?: string;
  spdxLicenseId?: string;
  licenseTextPath?: string;
  generation?: {
    command: string;
    generatorPath: string;
    generatorSha256: string;
    seed: string;
  };
}

export interface DatasetRegistry {
  schemaVersion: '1.0.0';
  policyVersion: 'dataset-evidence-v1';
  policyDigest: string;
  datasets: DatasetRecord[];
}
