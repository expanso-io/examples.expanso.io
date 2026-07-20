import { readFile } from 'node:fs/promises';
import { dirname, extname, relative, resolve, sep } from 'node:path';
import matter from 'gray-matter';
import ts from 'typescript';
import { getCatalogOverviewProjection } from '../../src/catalog/overviewProjection';
import type {
  ContentAnalysis,
  ContentArchetype,
  ContentPolicy,
  Finding,
  NarrativeBlock,
} from './types';

interface AstNode {
  type: string;
  name?: string | null;
  value?: string;
  depth?: number;
  attributes?: AstAttribute[];
  children?: AstNode[];
  position?: { start?: { line?: number } };
}

interface AstAttribute {
  type: string;
  name?: string;
  value?: string | { value?: string } | null;
}

const WORD_PATTERN = /[\p{L}\p{N}]+(?:['’.-][\p{L}\p{N}]+)*/gu;
const ARCHETYPES = new Set<ContentArchetype>([
  'catalog-card',
  'overview',
  'explorer',
  'run',
  'step',
  'troubleshooting',
  'reference',
]);

export function countWords(text: string): number {
  return text.match(WORD_PATTERN)?.length ?? 0;
}

export function normalizeVisibleText(text: string): string {
  return text
    .normalize('NFKC')
    .toLocaleLowerCase('en-US')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

export async function analyzeMdx(
  source: string,
  file: string,
  policy: ContentPolicy,
  options: { absoluteFile?: string; repositoryRoot?: string } = {}
): Promise<ContentAnalysis> {
  const errors: Finding[] = [];
  let parsedMatter: matter.GrayMatterFile<string>;
  try {
    parsedMatter = matter(source);
  } catch (error) {
    return emptyAnalysis(file, {
      code: 'FRONTMATTER_INVALID',
      file,
      message: `Unable to parse frontmatter: ${messageOf(error)}`,
    });
  }

  let tree: AstNode;
  try {
    const [{ createProcessor }, { default: remarkDirective }] =
      await Promise.all([import('@mdx-js/mdx'), import('remark-directive')]);
    tree = createProcessor({ remarkPlugins: [remarkDirective] }).parse(
      parsedMatter.content
    ) as AstNode;
  } catch (error) {
    return {
      ...emptyAnalysis(file, {
        code: 'AST_PARSE_ERROR',
        file,
        message: `Unable to parse MDX AST: ${messageOf(error)}`,
      }),
      frontmatter: parsedMatter.data,
    };
  }

  const archetype = parsedMatter.data.contentArchetype;
  if (
    typeof archetype !== 'string' ||
    !ARCHETYPES.has(archetype as ContentArchetype)
  ) {
    errors.push({
      code: 'FRONTMATTER_INVALID',
      file,
      message:
        'contentArchetype must be one of catalog-card, overview, explorer, run, step, troubleshooting, or reference',
    });
  }

  const blocks: NarrativeBlock[] = [];
  const headings = collectHeadingNodes(tree)
    .map((heading) =>
      collectPlainText(heading, file, policy, errors, true).trim()
    )
    .filter((heading) => countWords(heading) > 0);
  const componentNames = collectComponentNames(tree);
  const headingCount = headings.length;
  let openingWordCount = 0;
  let actionSeen = false;

  for (const child of tree.children ?? []) {
    if (child.type === 'heading') {
      const headingText = collectPlainText(child, file, policy, errors, true);
      const normalizedHeading = normalizeVisibleText(headingText);
      const isActionHeading = policy.actionHeadingPatterns.some((pattern) =>
        normalizedHeading.includes(normalizeVisibleText(pattern))
      );
      if (isActionHeading) {
        actionSeen = true;
      }
      const words = countWords(headingText);
      if (words > 0) {
        blocks.push({
          text: headingText,
          words,
          line: child.position?.start?.line,
          kind: 'heading',
        });
        if (!actionSeen) {
          openingWordCount += words;
        }
      }
      continue;
    }
    const childBlocks = collectBlocks(child, file, policy, errors);
    blocks.push(...childBlocks);
    if (!actionSeen) {
      openingWordCount += childBlocks.reduce(
        (sum, block) => sum + block.words,
        0
      );
    }
  }

  const importedText = await collectImportedComponentText(
    parsedMatter.content,
    tree,
    file,
    policy,
    options,
    errors
  );
  blocks.push(...importedText.narrativeBlocks);

  const wordCount = blocks.reduce((sum, block) => sum + block.words, 0);
  const hasLocalNavigation = parsedMatter.data.localNavigation === true;
  const uniqueTasks = Array.isArray(parsedMatter.data.uniqueTasks)
    ? parsedMatter.data.uniqueTasks.filter(
        (task: unknown): task is string =>
          typeof task === 'string' && task.trim().length > 0
      )
    : [];

  if (ARCHETYPES.has(archetype as ContentArchetype)) {
    validateArchetypeStructure(
      archetype as ContentArchetype,
      parsedMatter.data,
      headings,
      componentNames,
      policy,
      file,
      errors
    );
  }
  validateReadiness(
    parsedMatter.data,
    [...blocks.map((block) => block.text), ...importedText.visibleText].join(
      '\n'
    ),
    policy,
    file,
    errors
  );
  validatePlaceholders(
    parsedMatter.data,
    [...blocks.map((block) => block.text), ...importedText.visibleText].join(
      '\n'
    ),
    policy,
    file,
    errors
  );

  if (ARCHETYPES.has(archetype as ContentArchetype)) {
    const budget = policy.budgets[archetype as ContentArchetype];
    if (budget.hardMax !== null && wordCount > budget.hardMax) {
      errors.push({
        code: 'BUDGET_EXCEEDED',
        file,
        message: `${archetype} prose has ${wordCount} words; hard maximum is ${budget.hardMax}`,
        detail: { archetype, wordCount, hardMax: budget.hardMax },
      });
    }
    if (
      archetype === 'overview' &&
      openingWordCount > policy.structure.overviewOpeningHardMax
    ) {
      errors.push({
        code: 'BUDGET_EXCEEDED',
        file,
        message: `Overview opening has ${openingWordCount} words before the first action; hard maximum is ${policy.structure.overviewOpeningHardMax}`,
        detail: {
          openingWordCount,
          hardMax: policy.structure.overviewOpeningHardMax,
        },
      });
    }
  }

  const needsNavigation =
    wordCount > policy.structure.localNavigationAfterWords ||
    headingCount > policy.structure.localNavigationAfterHeadings ||
    blocks.length > policy.structure.localNavigationAfterNarrativeBlocks;
  if (needsNavigation && (!hasLocalNavigation || uniqueTasks.length === 0)) {
    errors.push({
      code: 'STRUCTURE_INVALID',
      file,
      message:
        'Dense content requires localNavigation: true and a non-empty uniqueTasks inventory',
      detail: { wordCount, headingCount, narrativeBlocks: blocks.length },
    });
  }
  if (uniqueTasks.length > 1) {
    errors.push({
      code: 'STRUCTURE_INVALID',
      file,
      message: `Surface declares ${uniqueTasks.length} user tasks; split it into task-specific surfaces`,
      detail: { uniqueTasks },
    });
  }

  return {
    file,
    frontmatter: parsedMatter.data,
    visibleText: [
      ...blocks.map((block) => block.text),
      ...importedText.visibleText,
    ].join('\n'),
    blocks,
    wordCount,
    openingWordCount,
    headingCount,
    headings,
    componentNames,
    hasLocalNavigation,
    uniqueTasks,
    errors,
  };
}

function collectBlocks(
  node: AstNode,
  file: string,
  policy: ContentPolicy,
  errors: Finding[]
): NarrativeBlock[] {
  if (
    ['code', 'html', 'mdxjsEsm', 'thematicBreak', 'yaml'].includes(node.type)
  ) {
    return [];
  }
  if (node.type === 'heading') {
    const text = collectPlainText(node, file, policy, errors, true).trim();
    const words = countWords(text);
    return words > 0
      ? [{ text, words, line: node.position?.start?.line, kind: 'heading' }]
      : [];
  }
  if (
    [
      'paragraph',
      'tableCell',
      'definition',
      'footnoteDefinition',
      'containerDirective',
      'leafDirective',
      'textDirective',
    ].includes(node.type)
  ) {
    const text = collectPlainText(node, file, policy, errors, false).trim();
    const words = countWords(text);
    return words > 0
      ? [{ text, words, line: node.position?.start?.line, kind: node.type }]
      : [];
  }
  if (node.type === 'mdxJsxFlowElement' || node.type === 'mdxJsxTextElement') {
    return collectComponentBlocks(node, file, policy, errors);
  }
  if (node.type === 'mdxFlowExpression' || node.type === 'mdxTextExpression') {
    const literal = staticExpressionText(node.value ?? '');
    if (literal === null) {
      errors.push({
        code: 'DYNAMIC_VISIBLE_CONTENT',
        file,
        line: node.position?.start?.line,
        message:
          'Dynamic MDX text cannot be measured; resolve it before validation',
      });
      return [];
    }
    const words = countWords(literal);
    return words > 0
      ? [
          {
            text: literal,
            words,
            line: node.position?.start?.line,
            kind: node.type,
          },
        ]
      : [];
  }
  return (node.children ?? []).flatMap((child) =>
    collectBlocks(child, file, policy, errors)
  );
}

function collectComponentBlocks(
  node: AstNode,
  file: string,
  policy: ContentPolicy,
  errors: Finding[]
): NarrativeBlock[] {
  const name = node.name ?? '';
  const isIntrinsic =
    name.length > 0 && name[0] === name[0].toLocaleLowerCase('en-US');
  const contract = isIntrinsic ? undefined : policy.componentContracts[name];
  if (!isIntrinsic && !contract) {
    errors.push({
      code: 'UNKNOWN_CONTENT_COMPONENT',
      file,
      line: node.position?.start?.line,
      message: `Component <${name || 'anonymous'}> has no content-classification contract`,
    });
    return [];
  }

  const textProps = isIntrinsic
    ? policy.intrinsicTextProps
    : (contract?.textProps ?? []);
  const renderedTextProps =
    name === 'ExampleHeader' &&
    (node.attributes ?? []).some((attribute) => attribute.name === 'exampleId')
      ? textProps.filter((prop) => prop !== 'title' && prop !== 'outcome')
      : textProps;
  const propText = collectTextProps(node, renderedTextProps, file, errors);
  const propWords = countWords(propText);
  const blocks: NarrativeBlock[] = propWords
    ? [
        {
          text: propText,
          words: propWords,
          line: node.position?.start?.line,
          kind: `${name}:props`,
        },
      ]
    : [];

  if (contract?.mode === 'opaque-narrative-free') {
    const hiddenText = collectPlainText(
      { type: 'root', children: node.children },
      file,
      policy,
      [],
      false
    ).trim();
    if (countWords(hiddenText) > 0) {
      errors.push({
        code: 'UNKNOWN_CONTENT_COMPONENT',
        file,
        line: node.position?.start?.line,
        message: `Opaque component <${name}> contains unclassifiable narrative children`,
      });
    }
    return blocks;
  }
  return [
    ...blocks,
    ...(node.children ?? []).flatMap((child) =>
      collectBlocks(child, file, policy, errors)
    ),
  ];
}

function collectPlainText(
  node: AstNode,
  file: string,
  policy: ContentPolicy,
  errors: Finding[],
  includeHeading: boolean
): string {
  if (node.type === 'text') {
    return node.value ?? '';
  }
  if (['inlineCode', 'code', 'html', 'mdxjsEsm', 'yaml'].includes(node.type)) {
    return '';
  }
  if (node.type === 'heading' && !includeHeading) {
    return '';
  }
  if (node.type === 'mdxFlowExpression' || node.type === 'mdxTextExpression') {
    const literal = staticExpressionText(node.value ?? '');
    if (literal === null) {
      errors.push({
        code: 'DYNAMIC_VISIBLE_CONTENT',
        file,
        line: node.position?.start?.line,
        message:
          'Dynamic MDX text cannot be measured; resolve it before validation',
      });
      return '';
    }
    return literal;
  }
  if (node.type === 'mdxJsxFlowElement' || node.type === 'mdxJsxTextElement') {
    const name = node.name ?? '';
    const isIntrinsic =
      name.length > 0 && name[0] === name[0].toLocaleLowerCase('en-US');
    const contract = isIntrinsic ? undefined : policy.componentContracts[name];
    if (!isIntrinsic && !contract) {
      errors.push({
        code: 'UNKNOWN_CONTENT_COMPONENT',
        file,
        line: node.position?.start?.line,
        message: `Component <${name || 'anonymous'}> has no content-classification contract`,
      });
      return '';
    }
    const textProps = isIntrinsic
      ? policy.intrinsicTextProps
      : (contract?.textProps ?? []);
    const renderedTextProps =
      name === 'ExampleHeader' &&
      (node.attributes ?? []).some(
        (attribute) => attribute.name === 'exampleId'
      )
        ? textProps.filter((prop) => prop !== 'title' && prop !== 'outcome')
        : textProps;
    const propText = collectTextProps(node, renderedTextProps, file, errors);
    const childText =
      contract?.mode === 'opaque-narrative-free'
        ? ''
        : (node.children ?? [])
            .map((child) =>
              collectPlainText(child, file, policy, errors, includeHeading)
            )
            .join(' ');
    return `${propText} ${childText}`.trim();
  }
  return (node.children ?? [])
    .map((child) =>
      collectPlainText(child, file, policy, errors, includeHeading)
    )
    .join(' ');
}

function collectTextProps(
  node: AstNode,
  textProps: string[],
  file: string,
  errors: Finding[]
): string {
  const values: string[] = [];
  for (const attribute of node.attributes ?? []) {
    if (attribute.type === 'mdxJsxExpressionAttribute') {
      errors.push({
        code: 'DYNAMIC_VISIBLE_CONTENT',
        file,
        line: node.position?.start?.line,
        message:
          'Spread JSX attributes cannot prove which user-visible text is rendered',
      });
      continue;
    }
    if (!attribute.name || !textProps.includes(attribute.name)) {
      continue;
    }
    if (typeof attribute.value === 'string') {
      values.push(attribute.value);
      continue;
    }
    if (attribute.value === null || attribute.value === undefined) {
      continue;
    }
    const literal = staticExpressionText(attribute.value.value ?? '');
    if (literal === null) {
      errors.push({
        code: 'DYNAMIC_VISIBLE_CONTENT',
        file,
        line: node.position?.start?.line,
        message: `Visible text prop ${attribute.name} must be a static string`,
      });
    } else {
      values.push(literal);
    }
  }
  return values.join(' ');
}

function staticExpressionText(expression: string): string | null {
  const trimmed = expression.trim();
  if (trimmed === '') {
    return '';
  }
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'")) ||
    (trimmed.startsWith('`') &&
      trimmed.endsWith('`') &&
      !trimmed.includes('${'))
  ) {
    try {
      if (trimmed.startsWith("'")) {
        return trimmed.slice(1, -1).replaceAll("\\'", "'");
      }
      if (trimmed.startsWith('`')) {
        return trimmed.slice(1, -1);
      }
      return JSON.parse(trimmed) as string;
    } catch {
      return null;
    }
  }
  return null;
}

function collectComponentNames(tree: AstNode): string[] {
  const names = new Set<string>();
  const visit = (node: AstNode): void => {
    if (
      (node.type === 'mdxJsxFlowElement' ||
        node.type === 'mdxJsxTextElement') &&
      node.name
    ) {
      names.add(node.name);
    }
    for (const child of node.children ?? []) visit(child);
  };
  visit(tree);
  return [...names].sort();
}

function collectHeadingNodes(tree: AstNode): AstNode[] {
  const headings: AstNode[] = [];
  const visit = (node: AstNode): void => {
    if (node.type === 'heading') headings.push(node);
    for (const child of node.children ?? []) visit(child);
  };
  visit(tree);
  return headings;
}

function validateArchetypeStructure(
  archetype: ContentArchetype,
  frontmatter: Record<string, unknown>,
  headings: string[],
  componentNames: string[],
  policy: ContentPolicy,
  file: string,
  errors: Finding[]
): void {
  if (
    componentNames.includes('ExampleHeader') &&
    frontmatter.hide_title !== true
  ) {
    errors.push({
      code: 'STRUCTURE_INVALID',
      file,
      message:
        'Pages using ExampleHeader must set hide_title: true so the rendered document has one H1',
    });
  }

  const requirement = policy.archetypeRequirements[archetype];
  for (const field of requirement.requiredFrontmatter) {
    const value = frontmatter[field];
    if (
      value === undefined ||
      value === null ||
      (typeof value === 'string' && value.trim() === '')
    ) {
      errors.push({
        code: 'STRUCTURE_INVALID',
        file,
        message: `${archetype} requires non-empty frontmatter field ${field}`,
      });
    }
  }
  const normalizedHeadings = headings.map(normalizeVisibleText);
  for (const pattern of requirement.requiredHeadingPatterns) {
    const normalizedPattern = normalizeVisibleText(pattern);
    if (
      !normalizedHeadings.some((heading) => heading.includes(normalizedPattern))
    ) {
      errors.push({
        code: 'STRUCTURE_INVALID',
        file,
        message: `${archetype} requires a heading matching ${JSON.stringify(pattern)}`,
      });
    }
  }
  for (const group of requirement.requiredComponentGroups) {
    if (!group.some((component) => componentNames.includes(component))) {
      errors.push({
        code: 'STRUCTURE_INVALID',
        file,
        message: `${archetype} requires one of these components: ${group.join(', ')}`,
      });
    }
  }
}

function validateReadiness(
  frontmatter: Record<string, unknown>,
  visibleText: string,
  policy: ContentPolicy,
  file: string,
  errors: Finding[]
): void {
  if (
    frontmatter.executionStatus !== undefined &&
    !policy.readinessVocabulary.executionStatuses.includes(
      String(frontmatter.executionStatus)
    )
  ) {
    errors.push({
      code: 'READINESS_VOCABULARY_INVALID',
      file,
      message: `executionStatus must be one of ${policy.readinessVocabulary.executionStatuses.join(', ')}`,
    });
  }
  if (
    frontmatter.operationalEvidence !== undefined &&
    !policy.readinessVocabulary.operationalEvidenceStatuses.includes(
      String(frontmatter.operationalEvidence)
    )
  ) {
    errors.push({
      code: 'READINESS_VOCABULARY_INVALID',
      file,
      message: `operationalEvidence must be one of ${policy.readinessVocabulary.operationalEvidenceStatuses.join(', ')}`,
    });
  }
  for (const source of policy.readinessVocabulary.forbiddenPatterns) {
    let pattern: RegExp;
    try {
      pattern = new RegExp(source, 'iu');
    } catch (error) {
      errors.push({
        code: 'INVALID_CONTRACT',
        file,
        message: `Invalid readiness pattern ${source}: ${messageOf(error)}`,
      });
      continue;
    }
    if (pattern.test(visibleText)) {
      errors.push({
        code: 'READINESS_VOCABULARY_INVALID',
        file,
        message: `Visible text uses uncontrolled readiness wording matching ${source}`,
      });
    }
  }
}

function validatePlaceholders(
  frontmatter: Record<string, unknown>,
  visibleText: string,
  policy: ContentPolicy,
  file: string,
  errors: Finding[]
): void {
  const frontmatterText = ['title', 'description', 'sidebar_label']
    .map((key) => frontmatter[key])
    .filter((value): value is string => typeof value === 'string')
    .join('\n');
  const normalized = normalizeVisibleText(`${frontmatterText}\n${visibleText}`);
  for (const phrase of policy.placeholderPhrases) {
    if (normalized.includes(normalizeVisibleText(phrase))) {
      errors.push({
        code: 'PLACEHOLDER_CONTENT',
        file,
        message: `Published content contains placeholder phrase ${JSON.stringify(phrase)}`,
      });
    }
  }
}

interface ImportBinding {
  exportName: string;
  source: string;
}

async function collectImportedComponentText(
  source: string,
  tree: AstNode,
  file: string,
  policy: ContentPolicy,
  options: { absoluteFile?: string; repositoryRoot?: string },
  errors: Finding[]
): Promise<{ narrativeBlocks: NarrativeBlock[]; visibleText: string[] }> {
  const narrativeBlocks: NarrativeBlock[] = [];
  const visibleText: string[] = [];
  const bindings = collectImportBindings(tree);
  const components: AstNode[] = [];
  const visit = (node: AstNode): void => {
    if (
      node.type === 'mdxJsxFlowElement' ||
      node.type === 'mdxJsxTextElement'
    ) {
      components.push(node);
    }
    for (const child of node.children ?? []) visit(child);
  };
  visit(tree);

  for (const component of components) {
    const name = component.name ?? '';
    const exampleIdAttribute = (component.attributes ?? []).find(
      (candidate) => candidate.name === 'exampleId'
    );
    const exampleId =
      typeof exampleIdAttribute?.value === 'string'
        ? exampleIdAttribute.value
        : undefined;
    if (exampleId && (name === 'ExampleHeader' || name === 'SystemBoundary')) {
      try {
        const projection = getCatalogOverviewProjection(exampleId);
        const texts =
          name === 'ExampleHeader'
            ? [projection.header.title, projection.header.outcome]
            : [
                ...projection.boundary.nodes.flatMap((node) => [
                  node.label,
                  node.location,
                ]),
                ...projection.boundary.flows.map((flow) => flow.payload),
              ];
        for (const text of texts) {
          const words = countWords(text);
          if (words > 0) {
            narrativeBlocks.push({
              text,
              words,
              line: component.position?.start?.line,
              kind: `catalog:${name}`,
            });
          }
          visibleText.push(text);
        }
      } catch (error) {
        errors.push({
          code: 'DYNAMIC_VISIBLE_CONTENT',
          file,
          line: component.position?.start?.line,
          message: `<${name}> cannot resolve catalog exampleId ${JSON.stringify(exampleId)}: ${messageOf(error)}`,
        });
      }
      if (name === 'SystemBoundary') continue;
    }
    const importedProps = policy.componentContracts[name]?.importedTextProps;
    if (!importedProps) continue;
    for (const [prop, importedContract] of Object.entries(importedProps)) {
      const attribute = (component.attributes ?? []).find(
        (candidate) => candidate.name === prop
      );
      if (!attribute) {
        errors.push({
          code: 'DYNAMIC_VISIBLE_CONTENT',
          file,
          line: component.position?.start?.line,
          message: `<${name}> must provide resolvable ${prop} content`,
        });
        continue;
      }
      const expression =
        typeof attribute.value === 'object' && attribute.value !== null
          ? attribute.value.value?.trim()
          : undefined;
      if (!expression || !/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(expression)) {
        errors.push({
          code: 'DYNAMIC_VISIBLE_CONTENT',
          file,
          line: component.position?.start?.line,
          message: `<${name}> ${prop} must be a directly imported static manifest identifier`,
        });
        continue;
      }
      const binding = bindings.get(expression);
      if (!binding || !options.absoluteFile || !options.repositoryRoot) {
        errors.push({
          code: 'DYNAMIC_VISIBLE_CONTENT',
          file,
          line: component.position?.start?.line,
          message: `<${name}> ${prop} import ${expression} cannot be resolved safely`,
        });
        continue;
      }
      const importFile = await resolveSafeImport(
        options.absoluteFile,
        options.repositoryRoot,
        binding.source
      );
      if (!importFile) {
        errors.push({
          code: 'DYNAMIC_VISIBLE_CONTENT',
          file,
          line: component.position?.start?.line,
          message: `<${name}> ${prop} import ${binding.source} is missing, non-relative, or outside the repository`,
        });
        continue;
      }
      let importedSource: string;
      try {
        importedSource = await readFile(importFile, 'utf8');
      } catch (error) {
        errors.push({
          code: 'DYNAMIC_VISIBLE_CONTENT',
          file,
          line: component.position?.start?.line,
          message: `Unable to read imported manifest ${binding.source}: ${messageOf(error)}`,
        });
        continue;
      }
      const extracted = extractStaticManifestText(
        importedSource,
        importFile,
        binding.exportName,
        importedContract.narrativeKeys,
        importedContract.visibleTextKeys,
        file,
        component.position?.start?.line,
        errors
      );
      narrativeBlocks.push(...extracted.narrativeBlocks);
      visibleText.push(...extracted.visibleText);
    }
  }
  return { narrativeBlocks, visibleText };
}

function collectImportBindings(tree: AstNode): Map<string, ImportBinding> {
  const bindings = new Map<string, ImportBinding>();
  const visit = (node: AstNode): void => {
    if (node.type === 'mdxjsEsm' && node.value) {
      const parsed = ts.createSourceFile(
        'mdx-import.ts',
        node.value,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TS
      );
      for (const statement of parsed.statements) {
        if (
          !ts.isImportDeclaration(statement) ||
          !ts.isStringLiteral(statement.moduleSpecifier) ||
          !statement.importClause
        ) {
          continue;
        }
        const source = statement.moduleSpecifier.text;
        const clause = statement.importClause;
        if (clause.name) {
          bindings.set(clause.name.text, { exportName: 'default', source });
        }
        if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
          for (const element of clause.namedBindings.elements) {
            bindings.set(element.name.text, {
              exportName: element.propertyName?.text ?? element.name.text,
              source,
            });
          }
        }
      }
    }
    for (const child of node.children ?? []) visit(child);
  };
  visit(tree);
  return bindings;
}

async function resolveSafeImport(
  importer: string,
  repositoryRoot: string,
  specifier: string
): Promise<string | null> {
  if (!specifier.startsWith('.')) return null;
  const root = resolve(repositoryRoot);
  const unresolved = resolve(dirname(importer), specifier);
  const rel = relative(root, unresolved);
  if (rel === '..' || rel.startsWith(`..${sep}`)) return null;
  const candidates = /\.(?:ts|tsx|js|jsx|json)$/.test(extname(unresolved))
    ? [unresolved]
    : ['.ts', '.tsx', '.js', '.jsx', '.json'].map(
        (extension) => `${unresolved}${extension}`
      );
  for (const candidate of candidates) {
    try {
      await readFile(candidate);
      return candidate;
    } catch {
      // Try the next explicit extension.
    }
  }
  return null;
}

function extractStaticManifestText(
  source: string,
  sourcePath: string,
  exportName: string,
  narrativeKeys: string[],
  visibleTextKeys: string[],
  routeFile: string,
  line: number | undefined,
  errors: Finding[]
): { narrativeBlocks: NarrativeBlock[]; visibleText: string[] } {
  const parsed = ts.createSourceFile(
    sourcePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    sourcePath.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );
  let initializer: ts.Expression | undefined;
  const findDeclaration = (node: ts.Node): void => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === exportName
    ) {
      initializer = node.initializer;
    }
    ts.forEachChild(node, findDeclaration);
  };
  findDeclaration(parsed);
  if (!initializer || exportName === 'default') {
    errors.push({
      code: 'DYNAMIC_VISIBLE_CONTENT',
      file: routeFile,
      line,
      message: `Imported manifest ${sourcePath} does not expose a statically analyzable ${exportName} declaration`,
    });
    return { narrativeBlocks: [], visibleText: [] };
  }

  const narrativeBlocks: NarrativeBlock[] = [];
  const visibleText: string[] = [];
  let unsafe = false;
  const walk = (node: ts.Node): void => {
    if (ts.isSpreadElement(node) || ts.isSpreadAssignment(node)) {
      unsafe = true;
      return;
    }
    if (ts.isPropertyAssignment(node)) {
      const key = propertyName(node.name);
      if (!key && ts.isComputedPropertyName(node.name)) {
        unsafe = true;
        return;
      }
      if (key && visibleTextKeys.includes(key)) {
        const text = staticTsString(node.initializer);
        if (text === null) {
          unsafe = true;
          return;
        }
        if (narrativeKeys.includes(key)) {
          const words = countWords(text);
          if (words > 0) {
            narrativeBlocks.push({
              text,
              words,
              line:
                parsed.getLineAndCharacterOfPosition(node.getStart()).line + 1,
              kind: `import:${key}`,
            });
          }
        } else if (countWords(text) > 0) {
          visibleText.push(text);
        }
      }
    }
    ts.forEachChild(node, walk);
  };
  walk(initializer);
  if (unsafe || narrativeBlocks.length === 0) {
    errors.push({
      code: 'DYNAMIC_VISIBLE_CONTENT',
      file: routeFile,
      line,
      message: `Imported manifest ${sourcePath} contains opaque narrative data or no statically analyzable narrative`,
    });
  }
  return unsafe
    ? { narrativeBlocks: [], visibleText: [] }
    : { narrativeBlocks, visibleText };
}

function propertyName(name: ts.PropertyName): string | null {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name)) return name.text;
  return null;
}

function staticTsString(value: ts.Expression): string | null {
  return ts.isStringLiteral(value) || ts.isNoSubstitutionTemplateLiteral(value)
    ? value.text
    : null;
}

function emptyAnalysis(file: string, error: Finding): ContentAnalysis {
  return {
    file,
    frontmatter: {},
    visibleText: '',
    blocks: [],
    wordCount: 0,
    openingWordCount: 0,
    headingCount: 0,
    headings: [],
    componentNames: [],
    hasLocalNavigation: false,
    uniqueTasks: [],
    errors: [error],
  };
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
