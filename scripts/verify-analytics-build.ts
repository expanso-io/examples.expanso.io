/** Checks that a build carries third-party analytics only when it is the
 * production variant.
 *
 *   tsx scripts/verify-analytics-build.ts --build-dir build --variant none
 *   tsx scripts/verify-analytics-build.ts --build-dir out --variant production
 *
 * `none` fails on the first analytics host or identifier found in any text
 * file of the build. `production` requires every real page to carry each tag
 * and the JavaScript to carry the PostHog and Google adapters, and fails on
 * any tag outside PRODUCTION_ALLOWED_TAGS.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

import {
  ANALYTICS_HOSTS,
  ANALYTICS_MARKERS,
  PRODUCTION_PAGE_TAGS,
  PRODUCTION_SCRIPT_MARKERS,
  unapprovedTags,
} from './analytics-tags';

export type Variant = 'none' | 'production';

export interface Finding {
  file: string;
  needle: string;
}

export interface VerificationReport {
  variant: Variant;
  scannedFiles: number;
  pages: number;
  findings: Finding[];
  missing: Finding[];
  unapproved: Finding[];
}

const TEXT_EXTENSIONS = new Set([
  '.css',
  '.html',
  '.js',
  '.json',
  '.map',
  '.mjs',
  '.svg',
  '.txt',
  '.webmanifest',
  '.xml',
  '.yaml',
  '.yml',
]);

function listTextFiles(root: string): string[] {
  const files: string[] = [];
  const visit = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const absolute = join(directory, entry.name);
      if (entry.isDirectory()) {
        visit(absolute);
        continue;
      }
      if (!entry.isFile()) continue;
      const dot = entry.name.lastIndexOf('.');
      if (dot !== -1 && TEXT_EXTENSIONS.has(entry.name.slice(dot))) {
        files.push(absolute);
      }
    }
  };
  visit(root);
  return files.sort();
}

function isRealPage(html: string): boolean {
  // Client-redirect stubs and the 404 shell carry no Docusaurus root.
  return html.includes('id="__docusaurus"');
}

export function verifyAnalyticsBuild(
  buildDir: string,
  variant: Variant
): VerificationReport {
  if (!statSync(buildDir, { throwIfNoEntry: false })?.isDirectory()) {
    throw new Error(`Build directory not found: ${buildDir}`);
  }
  const files = listTextFiles(buildDir);
  if (files.length === 0) {
    throw new Error(`Build directory has no text files: ${buildDir}`);
  }
  const needles = [...ANALYTICS_HOSTS, ...ANALYTICS_MARKERS];
  const findings: Finding[] = [];
  const missing: Finding[] = [];
  const unapproved: Finding[] = [];
  const scriptHits = new Set<string>();
  let pages = 0;

  for (const absolute of files) {
    const file = relative(buildDir, absolute).split(sep).join('/');
    const text = readFileSync(absolute, 'utf8');
    for (const needle of needles) {
      if (text.includes(needle)) findings.push({ file, needle });
    }
    if (variant !== 'production') continue;
    for (const needle of unapprovedTags(text)) {
      unapproved.push({ file, needle });
    }
    if (file.endsWith('.html') && isRealPage(text)) {
      pages += 1;
      for (const tag of PRODUCTION_PAGE_TAGS) {
        if (!tag.pattern.test(text)) missing.push({ file, needle: tag.id });
      }
    }
    if (file.endsWith('.js')) {
      for (const marker of PRODUCTION_SCRIPT_MARKERS) {
        if (text.includes(marker)) scriptHits.add(marker);
      }
    }
  }

  if (variant === 'production') {
    if (pages === 0) missing.push({ file: '(build)', needle: 'real pages' });
    for (const marker of PRODUCTION_SCRIPT_MARKERS) {
      if (!scriptHits.has(marker)) {
        missing.push({ file: 'assets/js', needle: marker });
      }
    }
  }

  return {
    variant,
    scannedFiles: files.length,
    pages,
    findings,
    missing,
    unapproved,
  };
}

export function reportProblems(report: VerificationReport): string[] {
  if (report.variant === 'none') {
    return report.findings.map(
      ({ file, needle }) => `${file} contains analytics marker ${needle}`
    );
  }
  const problems = [
    ...report.missing.map(
      ({ file, needle }) => `${file} is missing production tag ${needle}`
    ),
    ...report.unapproved.map(
      ({ file, needle }) => `${file} carries unapproved analytics tag ${needle}`
    ),
  ];
  if (report.findings.length === 0) {
    problems.push('production build carries no analytics marker at all');
  }
  return problems;
}

function argumentValue(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  return index === -1 ? undefined : process.argv[index + 1];
}

function main(): void {
  const buildDir = argumentValue('--build-dir') ?? 'build';
  const variant = argumentValue('--variant');
  if (variant !== 'none' && variant !== 'production') {
    throw new Error('--variant must be "none" or "production"');
  }
  const report = verifyAnalyticsBuild(buildDir, variant);
  const problems = reportProblems(report);
  if (problems.length > 0) {
    console.error(
      [
        `Analytics build check failed for variant "${variant}" in ${buildDir}:`,
        ...problems.slice(0, 50).map((problem) => `  ${problem}`),
        ...(problems.length > 50 ? [`  ... ${problems.length - 50} more`] : []),
      ].join('\n')
    );
    process.exit(1);
  }
  console.log(
    variant === 'none'
      ? `Analytics build check passed: ${report.scannedFiles} files carry no analytics host or identifier.`
      : `Analytics build check passed: ${report.pages} pages carry every production tag and the scripts carry the PostHog and Google adapters.`
  );
}

if (process.argv[1]?.endsWith('verify-analytics-build.ts')) main();
