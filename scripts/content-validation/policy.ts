import type { ContentPolicy, Finding } from './types';

const ARCHETYPES = [
  'catalog-card',
  'overview',
  'explorer',
  'run',
  'step',
  'troubleshooting',
  'reference',
] as const;

export function validateContentPolicy(
  value: unknown,
  file: string
): { policy?: ContentPolicy; errors: Finding[] } {
  const errors: Finding[] = [];
  if (!isRecord(value)) {
    return {
      errors: [invalid(file, 'Content policy must be an object')],
    };
  }

  const allowedKeys = new Set([
    '$schema',
    'contractVersion',
    'gateId',
    'budgets',
    'structure',
    'actionHeadingPatterns',
    'placeholderPhrases',
    'readinessVocabulary',
    'archetypeRequirements',
    'componentContracts',
    'intrinsicTextProps',
  ]);
  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key)) {
      errors.push(invalid(file, `Unknown content policy field: ${key}`));
    }
  }
  if (value.contractVersion !== '1.0.0') {
    errors.push(invalid(file, 'contractVersion must be 1.0.0'));
  }
  if (value.$schema !== './content-policy-v1.schema.json') {
    errors.push(
      invalid(file, '$schema must be ./content-policy-v1.schema.json')
    );
  }
  if (value.gateId !== 'content-validator-v1') {
    errors.push(invalid(file, 'gateId must be content-validator-v1'));
  }
  if (!isRecord(value.budgets)) {
    errors.push(invalid(file, 'budgets must be an object'));
  } else {
    rejectUnknownKeys(
      value.budgets,
      new Set(ARCHETYPES),
      file,
      'budgets',
      errors
    );
    for (const archetype of ARCHETYPES) {
      const budget = value.budgets[archetype];
      if (!isRecord(budget)) {
        errors.push(invalid(file, `Missing budget for ${archetype}`));
        continue;
      }
      rejectUnknownKeys(
        budget,
        new Set(['targetMin', 'targetMax', 'hardMax']),
        file,
        `budgets.${archetype}`,
        errors
      );
      for (const field of ['targetMin', 'targetMax', 'hardMax']) {
        if (budget[field] !== null && !isNonnegativeInteger(budget[field])) {
          errors.push(
            invalid(
              file,
              `${archetype}.${field} must be a nonnegative integer or null`
            )
          );
        }
      }
      if (
        typeof budget.targetMin === 'number' &&
        typeof budget.targetMax === 'number' &&
        budget.targetMin > budget.targetMax
      ) {
        errors.push(invalid(file, `${archetype} targetMin exceeds targetMax`));
      }
      if (
        typeof budget.targetMax === 'number' &&
        typeof budget.hardMax === 'number' &&
        budget.targetMax > budget.hardMax
      ) {
        errors.push(invalid(file, `${archetype} targetMax exceeds hardMax`));
      }
    }
  }
  if (!isRecord(value.structure)) {
    errors.push(invalid(file, 'structure must be an object'));
  } else {
    const structureFields = [
      'overviewOpeningHardMax',
      'localNavigationAfterWords',
      'localNavigationAfterHeadings',
      'localNavigationAfterNarrativeBlocks',
      'duplicateBlockMinimumWords',
    ];
    rejectUnknownKeys(
      value.structure,
      new Set(structureFields),
      file,
      'structure',
      errors
    );
    for (const field of structureFields) {
      if (!isPositiveInteger(value.structure[field])) {
        errors.push(
          invalid(file, `structure.${field} must be a positive integer`)
        );
      }
    }
  }
  if (!isUniqueStringArray(value.actionHeadingPatterns, true)) {
    errors.push(
      invalid(
        file,
        'actionHeadingPatterns must be a non-empty unique string array'
      )
    );
  }
  if (!isUniqueStringArray(value.placeholderPhrases, true)) {
    errors.push(
      invalid(
        file,
        'placeholderPhrases must be a non-empty unique string array'
      )
    );
  }
  validateReadinessVocabulary(value.readinessVocabulary, file, errors);
  validateArchetypeRequirements(value.archetypeRequirements, file, errors);
  if (!isUniqueStringArray(value.intrinsicTextProps, false)) {
    errors.push(
      invalid(file, 'intrinsicTextProps must be a unique string array')
    );
  }
  if (!isRecord(value.componentContracts)) {
    errors.push(invalid(file, 'componentContracts must be an object'));
  } else {
    for (const [name, contract] of Object.entries(value.componentContracts)) {
      if (!/^[A-Z][A-Za-z0-9.]*$/.test(name) || !isRecord(contract)) {
        errors.push(invalid(file, `Invalid component contract: ${name}`));
        continue;
      }
      rejectUnknownKeys(
        contract,
        new Set(['mode', 'textProps', 'importedTextProps']),
        file,
        `componentContracts.${name}`,
        errors
      );
      if (
        contract.mode !== 'children' &&
        contract.mode !== 'opaque-narrative-free'
      ) {
        errors.push(invalid(file, `${name}.mode is invalid`));
      }
      if (!isUniqueStringArray(contract.textProps, false)) {
        errors.push(
          invalid(file, `${name}.textProps must be a unique string array`)
        );
      }
      if (contract.importedTextProps !== undefined) {
        if (!isRecord(contract.importedTextProps)) {
          errors.push(
            invalid(file, `${name}.importedTextProps must be an object`)
          );
        } else {
          for (const [prop, importedContract] of Object.entries(
            contract.importedTextProps
          )) {
            if (
              !/^[A-Za-z][A-Za-z0-9]*$/.test(prop) ||
              !isRecord(importedContract)
            ) {
              errors.push(
                invalid(file, `${name}.importedTextProps.${prop} is invalid`)
              );
              continue;
            }
            rejectUnknownKeys(
              importedContract,
              new Set(['narrativeKeys', 'visibleTextKeys']),
              file,
              `${name}.importedTextProps.${prop}`,
              errors
            );
            if (
              !isUniqueStringArray(importedContract.narrativeKeys, true) ||
              !isUniqueStringArray(importedContract.visibleTextKeys, true) ||
              !(importedContract.narrativeKeys as string[]).every((key) =>
                (importedContract.visibleTextKeys as string[]).includes(key)
              )
            ) {
              errors.push(
                invalid(
                  file,
                  `${name}.importedTextProps.${prop} requires unique visibleTextKeys and a non-empty narrativeKeys subset`
                )
              );
            }
          }
        }
      }
    }
  }

  return errors.length === 0
    ? { policy: value as unknown as ContentPolicy, errors }
    : { errors };
}

function validateReadinessVocabulary(
  value: unknown,
  file: string,
  errors: Finding[]
): void {
  if (!isRecord(value)) {
    errors.push(invalid(file, 'readinessVocabulary must be an object'));
    return;
  }
  rejectUnknownKeys(
    value,
    new Set([
      'executionStatuses',
      'operationalEvidenceStatuses',
      'forbiddenPatterns',
    ]),
    file,
    'readinessVocabulary',
    errors
  );
  const requiredExecution = [
    'offline-runnable',
    'requires-integration',
    'architecture-only',
  ];
  const requiredEvidence = [
    'not-assessed',
    'component-tested',
    'operating-envelope-tested',
  ];
  if (!sameStringSet(value.executionStatuses, requiredExecution)) {
    errors.push(
      invalid(
        file,
        `readinessVocabulary.executionStatuses must contain exactly ${requiredExecution.join(', ')}`
      )
    );
  }
  if (!sameStringSet(value.operationalEvidenceStatuses, requiredEvidence)) {
    errors.push(
      invalid(
        file,
        `readinessVocabulary.operationalEvidenceStatuses must contain exactly ${requiredEvidence.join(', ')}`
      )
    );
  }
  if (!isUniqueStringArray(value.forbiddenPatterns, true)) {
    errors.push(
      invalid(
        file,
        'readinessVocabulary.forbiddenPatterns must be a non-empty unique string array'
      )
    );
  }
}

function validateArchetypeRequirements(
  value: unknown,
  file: string,
  errors: Finding[]
): void {
  if (!isRecord(value)) {
    errors.push(invalid(file, 'archetypeRequirements must be an object'));
    return;
  }
  rejectUnknownKeys(
    value,
    new Set(ARCHETYPES),
    file,
    'archetypeRequirements',
    errors
  );
  for (const archetype of ARCHETYPES) {
    const requirement = value[archetype];
    if (!isRecord(requirement)) {
      errors.push(invalid(file, `Missing archetypeRequirements.${archetype}`));
      continue;
    }
    rejectUnknownKeys(
      requirement,
      new Set([
        'requiredFrontmatter',
        'requiredHeadingPatterns',
        'requiredComponentGroups',
      ]),
      file,
      `archetypeRequirements.${archetype}`,
      errors
    );
    if (!isUniqueStringArray(requirement.requiredFrontmatter, false)) {
      errors.push(
        invalid(
          file,
          `archetypeRequirements.${archetype}.requiredFrontmatter must be a unique string array`
        )
      );
    }
    if (!isUniqueStringArray(requirement.requiredHeadingPatterns, false)) {
      errors.push(
        invalid(
          file,
          `archetypeRequirements.${archetype}.requiredHeadingPatterns must be a unique string array`
        )
      );
    }
    if (
      !Array.isArray(requirement.requiredComponentGroups) ||
      !requirement.requiredComponentGroups.every((group) =>
        isUniqueStringArray(group, true)
      )
    ) {
      errors.push(
        invalid(
          file,
          `archetypeRequirements.${archetype}.requiredComponentGroups must be an array of non-empty unique string arrays`
        )
      );
    }
  }
}

function rejectUnknownKeys(
  value: Record<string, unknown>,
  allowed: Set<string>,
  file: string,
  path: string,
  errors: Finding[]
): void {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      errors.push(invalid(file, `Unknown ${path} field: ${key}`));
    }
  }
}

function sameStringSet(value: unknown, expected: string[]): boolean {
  return (
    isUniqueStringArray(value, true) &&
    value.length === expected.length &&
    expected.every((item) => value.includes(item))
  );
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isUniqueStringArray(
  value: unknown,
  requireItems: boolean
): value is string[] {
  if (!Array.isArray(value) || (requireItems && value.length === 0)) {
    return false;
  }
  if (
    !value.every((item) => typeof item === 'string' && item.trim().length > 0)
  ) {
    return false;
  }
  return new Set(value).size === value.length;
}

export function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

export function isSha256(value: unknown): value is string {
  return typeof value === 'string' && /^sha256:[a-f0-9]{64}$/.test(value);
}

function isNonnegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isPositiveInteger(value: unknown): value is number {
  return isNonnegativeInteger(value) && value > 0;
}

function invalid(file: string, message: string): Finding {
  return { code: 'INVALID_CONTRACT', file, message };
}
