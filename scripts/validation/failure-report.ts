import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderIndex, renderReport, summarize } from './report';

export function writeFailureReport(
  root: string,
  date: string,
  error: Error
): void {
  const failure = error.message;

  const summary = summarize([], {
    date,
    edgeVersion: 'unavailable',
    cliVersion: 'unavailable',
    inventoryDigest: 'unavailable',
    failure,
  });

  const reportRoot = join(root, 'validation-reports');

  for (const name of [date, 'latest']) {
    const directory = join(reportRoot, name);
    mkdirSync(directory, { recursive: true });
    writeFileSync(join(directory, 'README.md'), renderReport([], summary, 2));
    writeFileSync(
      join(directory, 'report.json'),
      JSON.stringify({ summary, pipelines: [] }, null, 2) + '\n'
    );
  }

  const dates = readdirSync(reportRoot).filter((name) =>
    /^\d{4}-\d{2}-\d{2}$/.test(name)
  );

  writeFileSync(join(reportRoot, 'README.md'), renderIndex(dates, summary));
}
