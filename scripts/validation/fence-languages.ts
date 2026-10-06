import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { extractCodeBlocks } from '../../src/lib/pipelineCode';

export interface FenceLanguageChange {
  path: string;
  line: number;
  from: string;
  to: string;
  reason?: string;
}

export function changedFenceLanguages(
  path: string,
  before: string,
  after: string,
  diff: string
): FenceLanguageChange[] {
  const oldFences = extractCodeBlocks(before, false);
  const newFences = extractCodeBlocks(after, false);
  const changes: FenceLanguageChange[] = [];
  for (const hunk of diff.matchAll(
    /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/gm
  )) {
    const oldStart = Number(hunk[1]);
    const oldCount = Number(hunk[2] ?? 1);
    const newStart = Number(hunk[3]);
    const newCount = Number(hunk[4] ?? 1);
    const removed = oldFences.filter(
      (fence) =>
        fence.line - 1 >= oldStart && fence.line - 1 < oldStart + oldCount
    );
    const added = newFences.filter(
      (fence) =>
        fence.line - 1 >= newStart && fence.line - 1 < newStart + newCount
    );
    if (!removed.length || !added.length) continue;
    if (removed.length !== added.length) {
      changes.push({
        path,
        line: removed[0].line - 1,
        from: removed.map((fence) => fence.language).join(','),
        to: added.map((fence) => fence.language).join(','),
      });
      continue;
    }
    for (const [index, fence] of removed.entries()) {
      if (fence.language !== added[index].language)
        changes.push({
          path,
          line: fence.line - 1,
          from: fence.language,
          to: added[index].language,
        });
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
  const paths: Array<{ before: string; after: string }> = [];
  for (let index = 0; index < status.length - 1; ) {
    const kind = status[index++];
    const before = status[index++];
    const after =
      kind.startsWith('R') || kind.startsWith('C') ? status[index++] : before;
    if (kind === 'M' || kind.startsWith('R')) paths.push({ before, after });
  }
  return paths
    .flatMap((path) => {
      const before = git(['show', `${base}:${path.before}`]);
      const after = readFileSync(`${root}/${path.after}`, 'utf8');
      const diff = git([
        'diff',
        '--no-ext-diff',
        '--find-renames',
        '--unified=0',
        base,
        '--',
        path.before,
        path.after,
      ]);
      return changedFenceLanguages(path.after, before, after, diff);
    })
    .filter(
      (change) =>
        !approved.some(
          (entry) =>
            entry.path === change.path &&
            entry.line === change.line &&
            entry.from === change.from &&
            entry.to === change.to
        )
    );
}
