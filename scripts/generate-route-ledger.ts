#!/usr/bin/env tsx

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { globSync } from 'glob';
import matter from 'gray-matter';
import { format } from 'prettier';

import { PUBLIC_CATALOG } from '../src/catalog/registry';
import { CATALOG_SCHEMA_VERSION } from '../src/catalog/schema';
import { analyzeMdx, normalizeVisibleText } from './content-validation/ast';
import type { ContentPolicy } from './content-validation/types';

const outputPath = resolve('content/routes/route-dispositions-v1.json');
const removedPlaceholdersPath = resolve(
  'content/routes/retired-draft-sources-v1.json'
);
const contentPolicyPath = resolve('content/contracts/content-policy-v1.json');
const contentPolicy = JSON.parse(
  readFileSync(contentPolicyPath, 'utf8')
) as ContentPolicy;

interface RemovedPlaceholderRegistry {
  schemaVersion: '1.1.0';
  baseSha: string;
  policy: string;
  entries: Array<{
    route: string;
    sourcePath: string;
    sourceSha256: `sha256:${string}`;
    familyId: string;
    redirectTarget: string;
    historicallyBuildableSha: string;
  }>;
}

const removedPlaceholderRegistry = JSON.parse(
  readFileSync(removedPlaceholdersPath, 'utf8')
) as RemovedPlaceholderRegistry;

function sha256(bytes: string): `sha256:${string}` {
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
}

function normalizeRoute(value: string): string {
  const normalized = `/${value}`.replace(/\/{2,}/g, '/').replace(/\/$/, '');
  return normalized === '' ? '/' : normalized;
}

function routeForDocument(
  file: string,
  frontmatter: Record<string, unknown>
): string {
  if (typeof frontmatter.slug === 'string') {
    return normalizeRoute(frontmatter.slug);
  }
  const documentPath = relative(resolve('docs'), resolve(file))
    .replace(/\\/g, '/')
    .replace(/\.mdx?$/, '')
    .replace(/(^|\/)index$/, '');
  return normalizeRoute(documentPath);
}

function routeForPage(file: string): string {
  const pagePath = relative(resolve('src/pages'), resolve(file))
    .replace(/\\/g, '/')
    .replace(/\.(?:[jt]sx?|mdx?)$/, '')
    .replace(/(^|\/)index$/, '');
  return normalizeRoute(pagePath);
}

const familyRoots = PUBLIC_CATALOG.records
  .map((record) => ({
    id: record.id,
    route: normalizeRoute(record.routes.overview),
    record,
  }))
  .sort((left, right) => right.route.length - left.route.length);

function familyFor(route: string) {
  return (
    familyRoots.find(
      (family) => route === family.route || route.startsWith(`${family.route}/`)
    ) ?? null
  );
}

function codeInventory(source: string): {
  codeBlocks: number;
  yamlBlocks: number;
} {
  const languages = [...source.matchAll(/^```([^\s`]*)/gm)].map((match) =>
    match[1].toLowerCase()
  );
  const importedYaml = [
    ...source.matchAll(/from\s+['"][^'"]+\.(?:yaml|yml)['"]/g),
  ].length;
  return {
    codeBlocks: languages.length,
    yamlBlocks:
      languages.filter((language) => language === 'yaml' || language === 'yml')
        .length + importedYaml,
  };
}

function claimIds(frontmatter: Record<string, unknown>): string[] {
  return Array.isArray(frontmatter.claimIds)
    ? frontmatter.claimIds.filter(
        (claimId): claimId is string => typeof claimId === 'string'
      )
    : [];
}

async function documentRoutes() {
  const files = globSync('docs/**/*.mdx', {
    ignore: ['docs/internal/**'],
    nodir: true,
  }).sort();

  return Promise.all(
    files.map(async (file) => {
      const source = readFileSync(resolve(file), 'utf8');
      const parsed = matter(source);
      const route = routeForDocument(file, parsed.data);
      const family = familyFor(route);
      const draft = parsed.data.draft === true;
      const analysis = await analyzeMdx(source, file, contentPolicy, {
        absoluteFile: resolve(file),
        repositoryRoot: process.cwd(),
      });
      if (analysis.errors.length > 0) {
        throw new Error(
          `Route ledger cannot attest invalid content ${file}: ${analysis.errors
            .map((finding) => finding.message)
            .join('; ')}`
        );
      }
      const inventory = codeInventory(parsed.content);
      const placeholders = contentPolicy.placeholderPhrases.filter((phrase) =>
        normalizeVisibleText(analysis.visibleText).includes(
          normalizeVisibleText(phrase)
        )
      );
      const ids = claimIds(parsed.data);
      const claimsAttested =
        Array.isArray(parsed.data.claimIds) &&
        typeof parsed.data.claimsVerifiedBy === 'string' &&
        typeof parsed.data.claimsVerifiedAt === 'string' &&
        typeof parsed.data.claimsPolicyDigest === 'string';

      return {
        route,
        sourcePath: file.replace(/\\/g, '/'),
        sourceSha256: sha256(source),
        sourceState: 'present',
        classification: family ? 'family' : 'shared',
        familyId: family?.id ?? null,
        surfaceType: analysis.frontmatter.contentArchetype,
        publicationState: draft ? 'draft' : 'published',
        indexedState: draft
          ? 'excluded-from-build'
          : parsed.data.unlisted === true
            ? 'unlisted'
            : 'indexed',
        frontmatterState: {
          status: 'complete',
          executionStatus: parsed.data.executionStatus ?? null,
          operationalEvidence: parsed.data.operationalEvidence ?? null,
          localNavigation: analysis.hasLocalNavigation,
          uniqueTasks: analysis.uniqueTasks,
        },
        renderedInventory: {
          proseWords: analysis.wordCount,
          headings: analysis.headingCount,
          narrativeBlocks: analysis.blocks.length,
          codeBlocks: inventory.codeBlocks,
          yamlBlocks: inventory.yamlBlocks,
        },
        placeholderState: {
          status: placeholders.length === 0 ? 'clear' : 'blocked',
          matches: placeholders,
        },
        claimAttestation: {
          status: claimsAttested ? 'complete' : 'missing',
          claimIds: ids,
          verifier: parsed.data.claimsVerifiedBy ?? null,
          verifiedAt: parsed.data.claimsVerifiedAt ?? null,
          policyDigest: parsed.data.claimsPolicyDigest ?? null,
        },
        inboundSearchEvidence: {
          status: 'unknown',
          dispositionPolicy: 'preserve-route',
        },
        currentDefectIds: [],
        canonicalRoute: route,
        disposition: draft ? null : 'keep-and-tighten',
        redirect: {
          required: false,
          target: null,
          httpStatus: null,
        },
        producerAgentId: family?.record.producerLane ?? 'engineering',
        independentVerifierAgentId:
          family?.record.verifierLane ?? 'adversarial-verifier',
        verification: {
          status: 'source-pass',
          evidence: ['content-validator-v1', 'claims-evidence-v1'],
          releaseGatesPending: [
            'exact-sha-route-link-validation',
            'browser-accessibility',
            'production-canary',
          ],
        },
        reasonCode: draft
          ? 'DRAFT_EXCLUDED_FROM_PUBLIC_BUILD'
          : family
            ? 'RETAINED_PENDING_INBOUND_AND_TASK_EVIDENCE'
            : 'RETAINED_SHARED_SURFACE',
      };
    })
  );
}

function pageRoutes() {
  return globSync('src/pages/**/*.{js,jsx,ts,tsx,md,mdx}', { nodir: true })
    .sort()
    .map((file) => {
      const source = readFileSync(resolve(file), 'utf8');
      const route = routeForPage(file);
      const noindex = /noindex/i.test(source);
      return {
        route,
        sourcePath: file.replace(/\\/g, '/'),
        sourceSha256: sha256(source),
        sourceState: 'present',
        classification: 'shared',
        familyId: null,
        surfaceType: route.startsWith('/__') ? 'test-harness' : 'page',
        publicationState: 'published',
        indexedState: noindex ? 'noindex' : 'indexed',
        frontmatterState: {
          status: 'not-applicable',
          executionStatus: null,
          operationalEvidence: null,
          localNavigation: false,
          uniqueTasks: [],
        },
        renderedInventory: {
          proseWords: null,
          headings: null,
          narrativeBlocks: null,
          codeBlocks: null,
          yamlBlocks: null,
        },
        placeholderState: { status: 'clear', matches: [] },
        claimAttestation: {
          status: 'not-applicable-test-harness',
          claimIds: [],
          verifier: null,
          verifiedAt: null,
          policyDigest: null,
        },
        inboundSearchEvidence: {
          status: 'not-indexed',
          dispositionPolicy: 'preserve-route',
        },
        currentDefectIds: [],
        canonicalRoute: route,
        disposition: 'reference-only',
        redirect: { required: false, target: null, httpStatus: null },
        producerAgentId: 'engineering',
        independentVerifierAgentId: 'accessibility',
        verification: {
          status: 'source-pass',
          evidence: ['runtime-proof-unit-contract'],
          releaseGatesPending: [
            'exact-sha-route-link-validation',
            'browser-accessibility',
            'production-canary',
          ],
        },
        reasonCode: noindex
          ? 'UNLISTED_NOINDEX_TEST_HARNESS'
          : 'RETAINED_SHARED_SURFACE',
      };
    });
}

function gitSourceAt(commit: string, sourcePath: string): string {
  return execFileSync('git', ['show', `${commit}:${sourcePath}`], {
    encoding: 'utf8',
  });
}

function removedPlaceholderRoutes() {
  if (
    removedPlaceholderRegistry.schemaVersion !== '1.1.0' ||
    !/^[a-f0-9]{40}$/.test(removedPlaceholderRegistry.baseSha) ||
    removedPlaceholderRegistry.entries.length === 0
  ) {
    throw new Error('Removed placeholder source registry is invalid');
  }

  const redirectConfig = readFileSync(resolve('docusaurus.config.ts'), 'utf8');

  return removedPlaceholderRegistry.entries.map((entry) => {
    if (
      !entry.sourcePath.startsWith('docs/') ||
      !entry.sourcePath.endsWith('.mdx') ||
      !/^sha256:[a-f0-9]{64}$/.test(entry.sourceSha256) ||
      !entry.redirectTarget.startsWith('/') ||
      !/^[a-f0-9]{40}$/.test(entry.historicallyBuildableSha) ||
      existsSync(resolve(entry.sourcePath))
    ) {
      throw new Error(
        `Invalid removed placeholder source: ${entry.sourcePath}`
      );
    }
    const family = PUBLIC_CATALOG.records.find(
      (record) => record.id === entry.familyId
    );
    if (!family) {
      throw new Error(`Unknown removed placeholder family: ${entry.familyId}`);
    }
    try {
      execFileSync(
        'git',
        [
          'merge-base',
          '--is-ancestor',
          entry.historicallyBuildableSha,
          removedPlaceholderRegistry.baseSha,
        ],
        { stdio: 'ignore' }
      );
    } catch {
      throw new Error(
        `Historical evidence is not an ancestor of the removal base: ${entry.sourcePath}`
      );
    }

    const baseSource = gitSourceAt(
      removedPlaceholderRegistry.baseSha,
      entry.sourcePath
    );
    if (
      sha256(baseSource) !== entry.sourceSha256 ||
      matter(baseSource).data.draft !== true
    ) {
      throw new Error(
        `Removed placeholder base evidence failed: ${entry.sourcePath}`
      );
    }
    const historicalSource = gitSourceAt(
      entry.historicallyBuildableSha,
      entry.sourcePath
    );
    if (matter(historicalSource).data.draft === true) {
      throw new Error(
        `Historical source was draft-excluded: ${entry.sourcePath}`
      );
    }
    const configuredRedirect = new RegExp(
      `from:\\s*['"]${entry.route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]\\s*,\\s*to:\\s*['"]${entry.redirectTarget.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`
    );
    if (!configuredRedirect.test(redirectConfig)) {
      throw new Error(
        `Removed placeholder redirect is not configured: ${entry.route}`
      );
    }

    return {
      route: normalizeRoute(entry.route),
      sourcePath: entry.sourcePath,
      sourceSha256: entry.sourceSha256,
      sourceState: 'removed',
      classification: 'family',
      familyId: entry.familyId,
      surfaceType: 'placeholder-draft',
      publicationState: 'historically-buildable-placeholder',
      indexedState: 'historical-index-status-unknown',
      frontmatterState: {
        status: 'removed-draft',
        executionStatus: null,
        operationalEvidence: null,
        localNavigation: false,
        uniqueTasks: [],
      },
      renderedInventory: {
        proseWords: null,
        headings: null,
        narrativeBlocks: null,
        codeBlocks: null,
        yamlBlocks: null,
      },
      placeholderState: { status: 'removed', matches: ['coming soon'] },
      claimAttestation: {
        status: 'not-applicable-removed-placeholder',
        claimIds: [],
        verifier: null,
        verifiedAt: null,
        policyDigest: null,
      },
      inboundSearchEvidence: {
        status: 'unknown',
        dispositionPolicy: 'preserve-route',
      },
      currentDefectIds: [],
      canonicalRoute: normalizeRoute(entry.redirectTarget),
      disposition: 'redirect',
      redirect: {
        required: true,
        target: normalizeRoute(entry.redirectTarget),
        mechanism: 'docusaurus-client-page',
        hostPermanentRedirectVerified: false,
        // Docusaurus emits a client redirect page. Do not claim an HTTP
        // status until the production host supplies and proves one.
        httpStatus: null,
      },
      producerAgentId: family.producerLane,
      independentVerifierAgentId: family.verifierLane,
      verification: {
        status: 'source-pass',
        evidence: [
          'base-source-sha256',
          'draft-at-removal-base-sha',
          `historically-buildable-source:${entry.historicallyBuildableSha}`,
          'docusaurus-client-redirect-config',
        ],
        releaseGatesPending: [
          'host-permanent-redirect',
          'exact-sha-route-link-validation',
          'production-canary',
        ],
      },
      reasonCode:
        'HISTORICALLY_BUILDABLE_PLACEHOLDER_PRESERVED_BY_CLIENT_REDIRECT',
    };
  });
}

async function main(): Promise<void> {
  const routes = [
    ...(await documentRoutes()),
    ...pageRoutes(),
    ...removedPlaceholderRoutes(),
  ].sort((left, right) => left.route.localeCompare(right.route));
  const duplicateRoutes = routes
    .filter(
      (entry, index) =>
        routes.findIndex((candidate) => candidate.route === entry.route) !==
        index
    )
    .map((entry) => entry.route);
  if (duplicateRoutes.length > 0) {
    throw new Error(
      `Duplicate routes: ${[...new Set(duplicateRoutes)].join(', ')}`
    );
  }
  const presentRoutes = new Set(
    routes
      .filter((entry) => entry.sourceState === 'present')
      .map((entry) => entry.route)
  );
  const missingRedirectTargets = routes
    .filter(
      (entry) =>
        entry.disposition === 'redirect' &&
        !presentRoutes.has(entry.canonicalRoute ?? '')
    )
    .map((entry) => entry.canonicalRoute);
  if (missingRedirectTargets.length > 0) {
    throw new Error(
      `Missing redirect targets: ${missingRedirectTargets.join(', ')}`
    );
  }

  const ledger = {
    schemaVersion: '1.2.0',
    catalogSchemaVersion: CATALOG_SCHEMA_VERSION,
    policy: {
      unknownInboundEvidence: 'preserve-route',
      clientRedirectIsPermanentRedirectEvidence: false,
      hostRedirectRequiredBeforeRetirement: true,
      sourcePassIsReleaseAcceptance: false,
    },
    metrics: {
      routes: routes.length,
      published: routes.filter(
        (entry) => entry.publicationState === 'published'
      ).length,
      sourceBackedPublished: routes.filter(
        (entry) =>
          entry.sourceState === 'present' &&
          entry.publicationState === 'published'
      ).length,
      drafts: routes.filter((entry) => entry.publicationState === 'draft')
        .length,
      removedPlaceholderSources: routes.filter(
        (entry) => entry.sourceState === 'removed'
      ).length,
      historicallyBuildableRemovedSources: routes.filter(
        (entry) =>
          entry.publicationState === 'historically-buildable-placeholder'
      ).length,
      indexed: routes.filter((entry) => entry.indexedState === 'indexed')
        .length,
      noindex: routes.filter((entry) => entry.indexedState === 'noindex')
        .length,
      unlisted: routes.filter((entry) => entry.indexedState === 'unlisted')
        .length,
      historicalIndexStatusUnknown: routes.filter(
        (entry) => entry.indexedState === 'historical-index-status-unknown'
      ).length,
      retained: routes.filter(
        (entry) => entry.disposition !== null && entry.disposition !== 'retire'
      ).length,
      redirected: routes.filter((entry) => entry.disposition === 'redirect')
        .length,
      retired: routes.filter((entry) => entry.disposition === 'retire').length,
      sourceVerified: routes.filter(
        (entry) => entry.verification.status === 'source-pass'
      ).length,
      releaseAccepted: 0,
    },
    routes,
  };
  const bytes = await format(JSON.stringify(ledger), { parser: 'json' });

  if (process.argv.slice(2).includes('--write')) {
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, bytes);
    process.stdout.write(`Wrote ${routes.length} route dispositions.\n`);
  } else {
    let current = '';
    try {
      current = readFileSync(outputPath, 'utf8');
    } catch {
      throw new Error('Route ledger is missing; run with --write');
    }
    if (current !== bytes) {
      throw new Error('Route ledger drift; regenerate with --write');
    }
    process.stdout.write(`Route ledger PASS: ${routes.length} dispositions.\n`);
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
