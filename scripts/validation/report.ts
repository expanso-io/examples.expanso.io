/**
 * Render validation results as GitHub-browsable Markdown.
 *
 * The report is deterministic for identical repository content: it carries the
 * inventory digest and the pinned expanso-edge version, never a wall-clock
 * timestamp or commit SHA, so a CI run that commits the report does not create
 * a new report on the next run.
 */

import type {
  PipelineReport,
  ReportSummary,
  RunResult,
  ValidateResult,
} from './types';

function escapeCell(text: string): string {
  return text.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

function sourceLink(path: string, depth: number): string {
  const prefix = '../'.repeat(depth);

  return `[${path}](${prefix}${path})`;
}

function validateCell(result: ValidateResult): string {
  const suffix = result.mode === 'wrapped' ? ' (wrapped)' : '';

  return `${result.status}${suffix}`;
}

function runCell(result: RunResult | undefined): string {
  if (!result) return 'not attempted';

  if (result.status === 'SKIP') return `SKIP: ${escapeCell(result.reason)}`;

  if (result.status === 'PASS') {
    const mode = result.mode === 'native' ? 'native' : 'fixture harness';

    return `PASS (${mode})`;
  }

  return `FAIL: ${escapeCell(result.reason)}`;
}

function formatErrors(result: ValidateResult): string {
  if (result.errors.length === 0) return result.raw ?? '';

  return result.errors
    .map((error) => {
      const where =
        error.line !== undefined
          ? `line ${error.line}${error.column !== undefined ? `, col ${error.column}` : ''}`
          : '';

      const path = error.path ? `[${error.path}]` : '';
      const lead = [where, path].filter(Boolean).join(' ');

      return `${lead ? `${lead}: ` : ''}${error.message}${error.suggestion ? ` (${error.suggestion})` : ''}`;
    })
    .join('\n');
}

export function summarize(
  reports: readonly PipelineReport[],
  options: {
    date: string;
    edgeVersion: string;
    pinnedEdgeVersion: string;
    inventoryDigest: string;
  }
): ReportSummary {
  const complete = reports.filter((report) =>
    report.file.kind.startsWith('complete')
  );

  const fragments = reports.filter((report) => report.file.kind === 'fragment');

  return {
    ...options,
    complete: {
      total: complete.length,
      validatePass: complete.filter(
        (report) => report.validate.status === 'PASS'
      ).length,
      validateFail: complete.filter(
        (report) => report.validate.status === 'FAIL'
      ).length,
      runPass: complete.filter((report) => report.run?.status === 'PASS')
        .length,
      runFail: complete.filter((report) => report.run?.status === 'FAIL')
        .length,
      runSkip: complete.filter((report) => report.run?.status === 'SKIP')
        .length,
      runNotAttempted: complete.filter((report) => report.run === undefined)
        .length,
    },
    fragments: {
      total: fragments.length,
      validatePass: fragments.filter(
        (report) => report.validate.status === 'PASS'
      ).length,
      validateFail: fragments.filter(
        (report) => report.validate.status === 'FAIL'
      ).length,
    },
    invalidYaml: reports.filter((report) => report.file.kind === 'invalid-yaml')
      .length,
  };
}

export function renderReport(
  reports: readonly PipelineReport[],
  summary: ReportSummary,
  depth: number
): string {
  const lines: string[] = [];

  const complete = reports.filter((report) =>
    report.file.kind.startsWith('complete')
  );

  const fragments = reports.filter(
    (report) =>
      report.file.kind === 'fragment' || report.file.kind === 'invalid-yaml'
  );

  const blocking = complete.filter(
    (report) =>
      report.validate.status === 'FAIL' || report.run?.status === 'FAIL'
  );

  const overall =
    blocking.length === 0 && summary.invalidYaml === 0 ? 'PASS' : 'FAIL';

  lines.push(`# Example pipeline validation: ${summary.date}`);
  lines.push('');
  lines.push(`Overall: **${overall}**`);
  lines.push('');
  lines.push(
    `- expanso-edge: \`${summary.edgeVersion}\` (pinned: \`${summary.pinnedEdgeVersion}\`)`
  );
  lines.push(`- Inventory digest: \`${summary.inventoryDigest}\``);
  lines.push(
    `- Complete pipelines: ${summary.complete.total}. Validate: ${summary.complete.validatePass} pass, ${summary.complete.validateFail} fail. Run: ${summary.complete.runPass} pass, ${summary.complete.runFail} fail, ${summary.complete.runSkip} skipped${summary.complete.runNotAttempted ? `, ${summary.complete.runNotAttempted} not attempted` : ''}.`
  );
  lines.push(
    `- Fragments (partial snippets, validated inside a synthetic pipeline, never run): ${summary.fragments.total}. ${summary.fragments.validatePass} pass, ${summary.fragments.validateFail} fail.`
  );

  if (summary.invalidYaml > 0)
    lines.push(`- Files that are not valid YAML: ${summary.invalidYaml}.`);
  lines.push('');
  lines.push('How to read this report:');
  lines.push('');
  lines.push(
    '- **Validate** runs `expanso-edge validate` on the file as committed. Fragments are wrapped in a generate-to-drop pipeline first.'
  );
  lines.push(
    '- Validation-only environment values in the fixture manifest satisfy non-metered local salts where the validator requires a concrete string.'
  );
  lines.push(
    '- **Run** deploys the pipeline to a local-mode expanso-edge agent and requires the expected output to be written. `native` means the file ran as written. `fixture harness` means the input was replaced by a checked-in fixture file and every leaf output by a local file; processors and routing logic ran unchanged.'
  );
  lines.push(
    '- **SKIP** names the external service or missing fixture that prevents a local run. Skipped pipelines are still validated.'
  );
  lines.push('- Regenerate locally with `npm run validate-examples`.');
  lines.push('');

  lines.push('## Complete pipelines');
  lines.push('');

  const categories = [
    ...new Set(complete.map((report) => report.file.category)),
  ].sort();

  for (const category of categories) {
    lines.push(`### ${category}`);
    lines.push('');
    lines.push('| Pipeline | Source | Validate | Run | expanso-edge |');
    lines.push('|---|---|---|---|---|');

    for (const report of complete.filter(
      (entry) => entry.file.category === category
    )) {
      lines.push(
        `| ${escapeCell(report.file.family)} | ${sourceLink(report.file.path, depth)} | ${validateCell(report.validate)} | ${runCell(report.run)} | ${summary.edgeVersion} |`
      );
    }

    lines.push('');
  }

  if (blocking.length > 0) {
    lines.push('## Failure details');
    lines.push('');

    for (const report of blocking) {
      lines.push(`### ${report.file.path}`);
      lines.push('');

      if (report.validate.status === 'FAIL') {
        lines.push('Validate output:');
        lines.push('');
        lines.push('```text');
        lines.push(formatErrors(report.validate));
        lines.push('```');
        lines.push('');
      }

      if (report.run?.status === 'FAIL') {
        lines.push(`Run failure: ${report.run.reason}`);
        lines.push('');

        if (report.run.detail) {
          lines.push('```text');
          lines.push(report.run.detail.trimEnd());
          lines.push('```');
          lines.push('');
        }
      }
    }
  }

  const runDetails = complete.filter(
    (report) =>
      report.run &&
      report.run.status !== 'SKIP' &&
      (report.run.substitutions?.length ?? 0) > 0
  );

  if (runDetails.length > 0) {
    lines.push('## Run substitutions');
    lines.push('');
    lines.push(
      'Edges swapped by the fixture harness. Everything between input and output ran as committed.'
    );
    lines.push('');
    lines.push('<details><summary>Show per-pipeline substitutions</summary>');
    lines.push('');

    for (const report of runDetails) {
      lines.push(
        `- \`${report.file.path}\` (fixture: \`${report.run?.fixture ?? 'none'}\`)`
      );

      for (const substitution of report.run?.substitutions ?? []) {
        lines.push(
          `  - ${substitution.role} \`${substitution.at}\`: ${escapeCell(substitution.from)} to ${escapeCell(substitution.to)}`
        );
      }
    }

    lines.push('');
    lines.push('</details>');
    lines.push('');
  }

  lines.push('## Fragments and partial snippets');
  lines.push('');
  lines.push(
    'These files are tutorial steps or component snippets, not complete pipelines. They are validated but never run.'
  );
  lines.push('');
  lines.push('| File | Kind | Validate | Detail |');
  lines.push('|---|---|---|---|');

  for (const report of fragments) {
    const detail =
      report.file.kind === 'invalid-yaml'
        ? (report.file.parseError ?? 'YAML parse error')
        : report.validate.status === 'FAIL'
          ? (report.validate.errors[0]?.message ?? 'validation failed')
          : '';

    lines.push(
      `| ${sourceLink(report.file.path, depth)} | ${report.file.kind} | ${report.file.kind === 'invalid-yaml' ? 'FAIL' : validateCell(report.validate)} | ${escapeCell(detail)} |`
    );
  }

  return `${lines.join('\n')}\n`;
}

export function renderIndex(
  dates: readonly string[],
  latest: ReportSummary | null
): string {
  const lines: string[] = [];
  lines.push('# Example pipeline validation reports');
  lines.push('');
  lines.push(
    'Every change to the example pipelines regenerates these reports with the pinned expanso-edge release. `latest/` always mirrors the newest dated folder.'
  );
  lines.push('');

  if (latest) {
    lines.push(
      `Latest: [${latest.date}](latest/README.md). Complete pipelines ${latest.complete.validatePass}/${latest.complete.total} validate, ${latest.complete.runPass} run, ${latest.complete.runSkip} skipped. expanso-edge \`${latest.edgeVersion}\`.`
    );
    lines.push('');
  }

  lines.push('| Date | Report |');
  lines.push('|---|---|');

  for (const date of [...dates].sort().reverse()) {
    lines.push(`| ${date} | [${date}/README.md](${date}/README.md) |`);
  }

  return `${lines.join('\n')}\n`;
}
