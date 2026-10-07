import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function normalizeReport(path, content) {
  if (/\/(?:latest|\d{4}-\d{2}-\d{2})\/report\.json$/.test(path)) {
    const report = JSON.parse(content);
    delete report.summary.date;
    delete report.summary.edgeVersion;
    delete report.summary.cliVersion;
    return JSON.stringify(report);
  }

  if (
    path !== 'validation-reports/README.md' &&
    !/\/(?:latest|\d{4}-\d{2}-\d{2})\/README\.md$/.test(path)
  )
    return content;

  let versionColumn = -1;
  return content
    .split('\n')
    .map((line) => {
      if (line.startsWith('# Example pipeline validation: '))
        return '# Example pipeline validation: <date>';
      if (/^- expanso-(edge|cli): `[^`]*`/.test(line))
        return line.replace(/`[^`]*`/, '`<version>`');
      if (
        path === 'validation-reports/README.md' &&
        line.startsWith('Latest: ')
      )
        return line
          .replace(/\[\d{4}-\d{2}-\d{2}\]/, '[<date>]')
          .replace(/(expanso-(?:edge|cli) )`[^`]*`/g, '$1`<version>`');
      if (!line.startsWith('|')) {
        versionColumn = -1;
        return line;
      }
      const cells = line
        .split('|')
        .slice(1, -1)
        .map((cell) => cell.trim());
      if (cells.every((cell) => /^:?-{3,}:?$/.test(cell)))
        return cells.map(() => '---').join('|');
      const headerColumn = cells.indexOf('expanso-edge');
      if (headerColumn >= 0) versionColumn = headerColumn;
      else if (versionColumn >= 0) cells[versionColumn] = '<version>';
      return cells.join('|');
    })
    .join('\n');
}

export function checkReportDrift(root = process.cwd()) {
  const git = (...args) =>
    execFileSync('git', args, { cwd: root, encoding: 'utf8' });
  const paths = git(
    'diff',
    'HEAD',
    '--name-only',
    '-z',
    '--',
    'validation-reports'
  )
    .split('\0')
    .filter(Boolean);
  return paths.filter((path) => {
    if (!existsSync(resolve(root, path))) return true;
    let committed;
    try {
      committed = git('show', `HEAD:${path}`);
    } catch {
      return true;
    }
    return (
      normalizeReport(path, committed) !==
      normalizeReport(path, readFileSync(resolve(root, path), 'utf8'))
    );
  });
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const drift = checkReportDrift();
  if (drift.length > 0) {
    console.error(`Validation report drift:\n${drift.join('\n')}`);
    process.exitCode = 1;
  }
}
