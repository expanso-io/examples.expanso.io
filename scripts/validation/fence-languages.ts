import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import {
  extractCodeBlocks,
  isPipelineCodeLanguage,
} from '../../src/lib/pipelineCode';

export interface FenceLanguageChange {
  path: string;
  line: number;
  snippet: string;
  replacement?: string;
  from: string;
  to: string;
  reason?: string;
}

export function snippetDigest(source: string): string {
  const normalized = source
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .trim();
  return createHash('sha256').update(normalized).digest('hex');
}

function approvedChange(
  change: FenceLanguageChange,
  approved: readonly FenceLanguageChange[]
): boolean {
  return approved.some(
    (entry) =>
      entry.path === change.path &&
      entry.line === change.line &&
      entry.snippet === change.snippet &&
      entry.from === change.from &&
      entry.to === change.to
  );
}

export function changedFenceLanguages(
  path: string,
  before: string,
  after: string,
  approved: readonly FenceLanguageChange[] = []
): FenceLanguageChange[] {
  const oldFences = extractCodeBlocks(before, false).filter((fence) =>
    isPipelineCodeLanguage(fence.language)
  );
  const available = extractCodeBlocks(after, false).map((fence) => ({
    ...fence,
    snippet: snippetDigest(fence.source),
  }));
  const retainsSource = (original: string, replacement: string): boolean => {
    const lines = replacement
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    let cursor = 0;
    for (const line of original
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)) {
      const next = lines.indexOf(line, cursor);
      if (next < 0) return false;
      cursor = next + 1;
    }
    return true;
  };
  const changes: FenceLanguageChange[] = [];
  const pending: FenceLanguageChange[] = [];
  for (const fence of oldFences) {
    const snippet = snippetDigest(fence.source);
    const index = available.findIndex(
      (next) => next.snippet === snippet && next.language === fence.language
    );
    if (index >= 0) available.splice(index, 1);
    else
      pending.push({
        path,
        line: fence.line - 1,
        snippet,
        from: fence.language,
        to: 'deleted',
      });
  }
  for (const change of pending) {
    const index = available.findIndex(
      (next) => next.snippet === change.snippet
    );
    if (index >= 0) {
      const [next] = available.splice(index, 1);
      changes.push({ ...change, to: next.language });
      continue;
    }
    const listed = approved.find(
      (entry) =>
        entry.path === change.path &&
        entry.line === change.line &&
        entry.snippet === change.snippet &&
        entry.from === change.from
    );
    const replacement = listed?.replacement
      ? available.findIndex(
          (next) =>
            next.snippet === listed.replacement && next.language === listed.to
        )
      : -1;
    if (listed && replacement >= 0) {
      available.splice(replacement, 1);
      changes.push({ ...change, to: listed.to });
    } else if (approvedChange(change, approved)) changes.push(change);
    else {
      const original = oldFences.find(
        (fence) => fence.line - 1 === change.line
      );
      const retained = available.findIndex(
        (next) =>
          next.language === change.from &&
          original !== undefined &&
          retainsSource(original.source, next.source)
      );
      if (retained >= 0) available.splice(retained, 1);
      else changes.push(change);
    }
  }
  return changes;
}

export function unapprovedFenceLanguageChanges(
  root: string,
  base: string,
  approved: readonly FenceLanguageChange[]
): FenceLanguageChange[] {
  const git = (args: string[]) =>
    execFileSync('git', args, { cwd: root, encoding: 'utf8' });
  const status = git([
    'diff',
    '--name-status',
    '-z',
    '--find-renames',
    base,
    '--',
    'docs/**/*.mdx',
  ]).split('\0');
  const paths: Array<{ before: string; after?: string }> = [];
  for (let index = 0; index < status.length - 1; ) {
    const kind = status[index++];
    const before = status[index++];
    const after =
      kind.startsWith('R') || kind.startsWith('C') ? status[index++] : before;
    if (kind === 'M' || kind.startsWith('R')) paths.push({ before, after });
    else if (kind === 'D') paths.push({ before });
  }
  return paths
    .flatMap((path) =>
      changedFenceLanguages(
        path.after ?? path.before,
        git(['show', `${base}:${path.before}`]),
        path.after ? readFileSync(`${root}/${path.after}`, 'utf8') : '',
        approved
      )
    )
    .filter((change) => !approvedChange(change, approved));
}
