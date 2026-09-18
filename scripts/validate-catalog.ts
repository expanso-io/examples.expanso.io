import { createHash } from 'node:crypto';
import {
  existsSync,
  lstatSync,
  readdirSync,
  readFileSync,
  statSync,
} from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PUBLIC_CATALOG } from '../src/catalog/registry';
import { assertPublicCatalog } from '../src/catalog/validate';
import {
  verifyExplorerProvenanceBindings,
  type ExplorerProvenanceVerification,
} from './quality/verify-explorer-provenance';
import { verifyRemovePiiExplorerFidelity } from './quality/remove-pii-fidelity';

const repositoryRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const familyCategories = [
  'data-routing',
  'data-security',
  'data-transformation',
  'enterprise-migration',
  'integrations',
  'log-processing',
] as const;
const expectedCurrentFamilyCount = 26;

function walkFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? walkFiles(path) : [path];
  });
}

function routeToMdx(route: string): string {
  const withoutSlashes = route.replace(/^\//, '').replace(/\/$/, '');
  const candidate = join(repositoryRoot, 'docs', `${withoutSlashes}.mdx`);
  return existsSync(candidate)
    ? candidate
    : join(repositoryRoot, 'docs', withoutSlashes, 'index.mdx');
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function verifyExplorerPageBinding(
  record: (typeof PUBLIC_CATALOG.records)[number],
  mdxPath: string,
  errors: string[]
) {
  const source = readFileSync(mdxPath, 'utf8');
  const relativePath = relative(repositoryRoot, mdxPath);
  const component = source.match(/<DataPipelineExplorer\b([\s\S]*?)\/>/);
  if (!component) {
    errors.push(
      `${relativePath} does not render the canonical DataPipelineExplorer adapter`
    );
    return;
  }
  if (
    !new RegExp(`\\bexampleId=["']${escapeRegExp(record.id)}["']`).test(
      component[1]
    )
  ) {
    errors.push(
      `${relativePath} does not bind canonical Explorer exampleId ${record.id}`
    );
  }

  const pipelinePath = record.completePipelinePath;
  if (!pipelinePath) {
    errors.push(`record ${record.id} Explorer has no completePipelinePath`);
    return;
  }
  const familyTarget = join(
    repositoryRoot,
    'src/catalog/explorerStageFamilies.generated',
    record.id
  );
  const familyRelative = relative(dirname(mdxPath), familyTarget).replaceAll(
    sep,
    '/'
  );
  const familySpecifier = familyRelative.startsWith('.')
    ? familyRelative
    : `./${familyRelative}`;
  const importMatch = source.match(
    new RegExp(
      `import\\s+\\{\\s*GENERATED_EXPLORER_STAGE_FAMILY\\s+as\\s+([A-Za-z_$][\\w$]*)\\s*\\}\\s+from\\s+["']${escapeRegExp(familySpecifier)}["'];?`
    )
  );
  if (!importMatch) {
    errors.push(
      `${relativePath} does not import generated Explorer family ${record.id}`
    );
    return;
  }
  const familyIdentifier = importMatch[1];
  const stagesImportMatch = source.match(
    new RegExp(
      `import\\s+\\{\\s*GENERATED_EXPLORER_STAGES\\s+as\\s+([A-Za-z_$][\\w$]*)\\s*\\}\\s+from\\s+["']${escapeRegExp(familySpecifier)}["'];?`
    )
  );
  if (!stagesImportMatch) {
    errors.push(
      `${relativePath} does not import generated Explorer stages ${record.id}`
    );
    return;
  }
  const stagesIdentifier = stagesImportMatch[1];
  if (
    !new RegExp(
      `\\bgeneratedFamily=\\{${escapeRegExp(familyIdentifier)}\\}`
    ).test(component[1]) ||
    !new RegExp(`\\bstages=\\{${escapeRegExp(stagesIdentifier)}\\}`).test(
      component[1]
    )
  ) {
    errors.push(
      `${relativePath} does not bind the generated family and stages`
    );
  }
  if (
    !new RegExp(
      `\\bfullYaml=\\{${escapeRegExp(familyIdentifier)}\\.fullYaml\\}`
    ).test(component[1]) ||
    !new RegExp(
      `\\bfullYamlFilename=\\{${escapeRegExp(familyIdentifier)}\\.fullYamlFilename\\}`
    ).test(component[1])
  ) {
    errors.push(
      `${relativePath} does not expose the generated canonical pipeline`
    );
  }
}

function verifyOverviewPageBinding(
  record: (typeof PUBLIC_CATALOG.records)[number],
  mdxPath: string,
  errors: string[]
) {
  const source = readFileSync(mdxPath, 'utf8');
  const relativePath = relative(repositoryRoot, mdxPath);
  const headerTags = source.match(/<ExampleHeader\b[\s\S]*?\/>/g) ?? [];

  if (headerTags.length !== 1) {
    errors.push(
      `${relativePath} must render exactly one catalog-bound ExampleHeader; found ${headerTags.length}`
    );
  } else if (
    !new RegExp(`\\bexampleId=["']${escapeRegExp(record.id)}["']`).test(
      headerTags[0]
    )
  ) {
    errors.push(
      `${relativePath} ExampleHeader does not bind catalog id ${record.id}`
    );
  }

  if (/<SystemBoundary\b/.test(source)) {
    errors.push(`${relativePath} must not render the retired SystemBoundary`);
  }
  if (/^## Limitations/m.test(source)) {
    errors.push(`${relativePath} must not render a limitations section`);
  }
}

function fail(errors: string[]): never {
  process.stderr.write(
    `Catalog repository validation failed:\n${errors.map((error) => `- ${error}`).join('\n')}\n`
  );
  process.exit(1);
}

function verifyBoundFile(
  path: string,
  expectedDigest: string,
  label: string,
  errors: string[]
) {
  const absolutePath = resolve(repositoryRoot, path);
  if (!absolutePath.startsWith(`${repositoryRoot}${sep}`)) {
    errors.push(`${label} escapes the repository root: ${path}`);
    return;
  }
  if (!existsSync(absolutePath)) {
    errors.push(`${label} does not exist: ${path}`);
    return;
  }
  const stat = lstatSync(absolutePath);
  if (!stat.isFile() || stat.isSymbolicLink()) {
    errors.push(`${label} must be a regular non-symlink file: ${path}`);
    return;
  }
  const actualDigest = `sha256:${createHash('sha256')
    .update(readFileSync(absolutePath))
    .digest('hex')}`;
  if (actualDigest !== expectedDigest) {
    errors.push(
      `${label} digest mismatch: expected ${expectedDigest}, got ${actualDigest}`
    );
  }
}

const errors: string[] = [];
let removePiiFidelity: ReturnType<
  typeof verifyRemovePiiExplorerFidelity
> | null = null;
let explorerProvenance: ExplorerProvenanceVerification | null = null;

try {
  assertPublicCatalog(PUBLIC_CATALOG);
} catch (error) {
  errors.push(error instanceof Error ? error.message : String(error));
}

const publishedRecords = PUBLIC_CATALOG.records.filter(
  (record) => record.status === 'published'
);
if (publishedRecords.length !== expectedCurrentFamilyCount) {
  errors.push(
    `expected exactly ${expectedCurrentFamilyCount} published current families, found ${publishedRecords.length}`
  );
}

const familyRoots = familyCategories.flatMap((category) => {
  const categoryRoot = join(repositoryRoot, 'docs', category);
  return readdirSync(categoryRoot)
    .map((name) => join(categoryRoot, name))
    .filter(
      (path) =>
        statSync(path).isDirectory() && existsSync(join(path, 'index.mdx'))
    );
});

const recordRootPaths = new Map(
  publishedRecords.map((record) => [
    resolve(
      repositoryRoot,
      'docs',
      record.routes.overview.replace(/^\//, ''),
      'index.mdx'
    ),
    record.id,
  ])
);

for (const familyRoot of familyRoots) {
  const indexPath = join(familyRoot, 'index.mdx');
  if (!recordRootPaths.has(indexPath)) {
    errors.push(
      `family root has no published catalog record: ${relative(repositoryRoot, indexPath)}`
    );
  }
}

for (const [indexPath, recordId] of recordRootPaths) {
  if (!existsSync(indexPath)) {
    errors.push(
      `record ${recordId} overview does not exist: ${relative(repositoryRoot, indexPath)}`
    );
  }
}

if (familyRoots.length !== recordRootPaths.size) {
  errors.push(
    `family root count ${familyRoots.length} does not match published registry count ${recordRootPaths.size}`
  );
}

const routeOwners = publishedRecords.map((record) => ({
  id: record.id,
  prefix: record.routes.overview,
}));

for (const familyRoot of familyRoots) {
  for (const mdxPath of walkFiles(familyRoot).filter((path) =>
    path.endsWith('.mdx')
  )) {
    const relativeMdxPath = relative(join(repositoryRoot, 'docs'), mdxPath)
      .split(sep)
      .join('/');
    const route = relativeMdxPath.endsWith('/index.mdx')
      ? `/${relativeMdxPath.slice(0, -'index.mdx'.length)}`
      : `/${relativeMdxPath.slice(0, -'.mdx'.length)}/`;
    const owners = routeOwners.filter((owner) =>
      route.startsWith(owner.prefix)
    );
    if (owners.length !== 1) {
      errors.push(
        `${relative(repositoryRoot, mdxPath)} maps to ${owners.length} catalog records (expected exactly one)`
      );
    }
    if (/^slug\s*:/m.test(readFileSync(mdxPath, 'utf8'))) {
      errors.push(
        `${relative(repositoryRoot, mdxPath)} declares a custom slug that the route inventory does not model`
      );
    }
  }
}

for (const record of PUBLIC_CATALOG.records) {
  for (const [surface, route] of Object.entries(record.routes)) {
    const mdxPath = routeToMdx(route);
    if (!existsSync(mdxPath)) {
      errors.push(
        `record ${record.id} ${surface} route does not resolve to MDX: ${route}`
      );
    }
    if (surface === 'explore' && existsSync(mdxPath)) {
      verifyExplorerPageBinding(record, mdxPath, errors);
    }
    if (surface === 'overview' && existsSync(mdxPath)) {
      verifyOverviewPageBinding(record, mdxPath, errors);
    }
  }
  for (const field of [
    'fixturePath',
    'completePipelinePath',
    'expectedOutputPath',
  ] as const) {
    const path = record[field];
    if (path !== undefined && !existsSync(join(repositoryRoot, path))) {
      errors.push(`record ${record.id} ${field} does not exist: ${path}`);
    }
  }
  const explorerEvidence = record.explorerEvidence;
  if (explorerEvidence) {
    if (explorerEvidence.exampleId !== record.id) {
      errors.push(`record ${record.id} Explorer evidence id does not match`);
    }
    if (
      explorerEvidence.canonicalPipelinePath !== record.completePipelinePath
    ) {
      errors.push(
        `record ${record.id} Explorer pipeline path does not match completePipelinePath`
      );
    }
    if (
      explorerEvidence.fixturePath !== undefined &&
      explorerEvidence.fixturePath !== record.fixturePath
    ) {
      errors.push(
        `record ${record.id} Explorer fixture path does not match fixturePath`
      );
    }
    if (
      explorerEvidence.expectedOutputPath !== undefined &&
      explorerEvidence.expectedOutputPath !== record.expectedOutputPath
    ) {
      errors.push(
        `record ${record.id} Explorer expected output path does not match expectedOutputPath`
      );
    }
    verifyBoundFile(
      explorerEvidence.canonicalPipelinePath,
      explorerEvidence.pipelineSha256,
      `record ${record.id} Explorer pipeline`,
      errors
    );
    verifyBoundFile(
      explorerEvidence.bindingManifestPath,
      explorerEvidence.bindingManifestSha256,
      `record ${record.id} Explorer binding manifest`,
      errors
    );
    verifyBoundFile(
      explorerEvidence.authoredStageModulePath,
      explorerEvidence.authoredStageModuleSha256,
      `record ${record.id} Explorer authored stage module`,
      errors
    );
    verifyBoundFile(
      explorerEvidence.inputCheckpointPath,
      explorerEvidence.inputCheckpointSha256,
      `record ${record.id} Explorer input checkpoint`,
      errors
    );
    verifyBoundFile(
      explorerEvidence.outputCheckpointPath,
      explorerEvidence.outputCheckpointSha256,
      `record ${record.id} Explorer output checkpoint`,
      errors
    );
    verifyBoundFile(
      explorerEvidence.fidelityOraclePath,
      explorerEvidence.fidelityOracleSha256,
      `record ${record.id} Explorer fidelity oracle`,
      errors
    );
    verifyBoundFile(
      explorerEvidence.semanticsVerifierPath,
      explorerEvidence.semanticsVerifierSha256,
      `record ${record.id} Explorer semantics verifier`,
      errors
    );
    if (explorerEvidence.fixturePath && explorerEvidence.fixtureSha256) {
      verifyBoundFile(
        explorerEvidence.fixturePath,
        explorerEvidence.fixtureSha256,
        `record ${record.id} Explorer fixture`,
        errors
      );
    }
    if (
      explorerEvidence.outputOrCheckpointPath &&
      explorerEvidence.outputOrCheckpointSha256
    ) {
      verifyBoundFile(
        explorerEvidence.outputOrCheckpointPath,
        explorerEvidence.outputOrCheckpointSha256,
        `record ${record.id} Explorer strengthened checkpoint`,
        errors
      );
    }
    if (
      explorerEvidence.fixtureEnvironmentPath &&
      explorerEvidence.fixtureEnvironmentSha256
    ) {
      verifyBoundFile(
        explorerEvidence.fixtureEnvironmentPath,
        explorerEvidence.fixtureEnvironmentSha256,
        `record ${record.id} Explorer fixture environment`,
        errors
      );
    }
    if (
      explorerEvidence.expectedOutputPath &&
      explorerEvidence.expectedOutputSha256
    ) {
      verifyBoundFile(
        explorerEvidence.expectedOutputPath,
        explorerEvidence.expectedOutputSha256,
        `record ${record.id} Explorer expected output`,
        errors
      );
    }
  }
}

try {
  removePiiFidelity = verifyRemovePiiExplorerFidelity({
    canonicalPipelineYaml: readFileSync(
      join(repositoryRoot, 'examples/data-security/remove-pii-complete.yaml'),
      'utf8'
    ),
    fixtureJson: readFileSync(
      join(
        repositoryRoot,
        'examples/data-security/remove-pii/sample-data.json'
      ),
      'utf8'
    ),
    fixtureEnvironmentJson: readFileSync(
      join(
        repositoryRoot,
        'examples/data-security/remove-pii/fixture-environment.json'
      ),
      'utf8'
    ),
    expectedOutputJsonl: readFileSync(
      join(
        repositoryRoot,
        'examples/data-security/remove-pii/expected-output.jsonl'
      ),
      'utf8'
    ),
    stageModuleSource: readFileSync(
      join(repositoryRoot, 'docs/data-security/remove-pii-full.stages.ts'),
      'utf8'
    ),
  });
} catch (error) {
  errors.push(error instanceof Error ? error.message : String(error));
}

try {
  explorerProvenance = verifyExplorerProvenanceBindings();
} catch (error) {
  errors.push(
    `Explorer provenance verification failed: ${
      error instanceof Error ? error.message : String(error)
    }`
  );
}

const removePiiEvidence = PUBLIC_CATALOG.records.find(
  (record) => record.id === 'remove-pii'
)?.explorerEvidence;
if (removePiiFidelity && removePiiEvidence) {
  if (removePiiEvidence.fidelityContractId !== removePiiFidelity.contractId) {
    errors.push('record remove-pii fidelity contract id does not match oracle');
  }
  if (
    removePiiEvidence.processorCount !== removePiiFidelity.processorsVerified
  ) {
    errors.push('record remove-pii processor count does not match oracle');
  }
  if (
    removePiiEvidence.checkpointCount !== removePiiFidelity.checkpointsVerified
  ) {
    errors.push('record remove-pii checkpoint count does not match oracle');
  }
}

const publicProjection = JSON.stringify(PUBLIC_CATALOG);
const forbiddenPublicPatterns = [
  new RegExp('/Us' + 'ers/'),
  new RegExp('second' + '-brain', 'i'),
  /sourcePath/,
  /customer/i,
  /transcript/i,
  /privateDemand/i,
  /internalEvidence/i,
];
for (const pattern of forbiddenPublicPatterns) {
  if (pattern.test(publicProjection)) {
    errors.push(
      `public catalog projection contains forbidden pattern ${pattern}`
    );
  }
}

if (errors.length > 0) fail(errors);

process.stdout.write(
  `${JSON.stringify({
    schemaVersion: PUBLIC_CATALOG.schemaVersion,
    records: PUBLIC_CATALOG.records.length,
    publishedRecords: publishedRecords.length,
    familyRoots: familyRoots.length,
    explorerProvenance,
    removePiiFidelity,
    status: 'PASS',
  })}\n`
);
