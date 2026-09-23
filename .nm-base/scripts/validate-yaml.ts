import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { glob } from 'glob';
import { LineCounter, parseDocument } from 'yaml';

export interface YamlValidationFinding {
  file: string;
  message: string;
}

export interface YamlValidationResult {
  filesChecked: number;
  findings: YamlValidationFinding[];
  status: 'PASS' | 'FAIL';
}

export function validateYamlSource(
  source: string,
  file = 'inline.yaml'
): YamlValidationFinding[] {
  if (source.trim().length === 0) {
    return [{ file, message: 'file is empty' }];
  }

  const lineCounter = new LineCounter();
  const document = parseDocument(source, {
    lineCounter,
    strict: true,
    uniqueKeys: true,
  });
  const findings = [...document.errors, ...document.warnings].map((error) => ({
    file,
    message: error.message,
  }));

  if (document.contents === null && findings.length === 0) {
    findings.push({ file, message: 'document has no YAML content' });
  }

  if (findings.length === 0) {
    try {
      document.toJS({ maxAliasCount: 100 });
    } catch (error) {
      findings.push({
        file,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return findings;
}

export async function validateYamlFiles(
  files: readonly string[]
): Promise<YamlValidationResult> {
  const findings: YamlValidationFinding[] = [];

  if (files.length === 0) {
    findings.push({ file: 'examples', message: 'YAML inventory is empty' });
  }

  for (const file of [...files].sort()) {
    try {
      const source = await readFile(file, 'utf8');
      findings.push(...validateYamlSource(source, file));
    } catch (error) {
      findings.push({
        file,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    filesChecked: files.length,
    findings,
    status: findings.length === 0 ? 'PASS' : 'FAIL',
  };
}

async function main() {
  const files = await glob('examples/**/*.{yaml,yml}', { nodir: true });
  const result = await validateYamlFiles(files);

  for (const finding of result.findings) {
    console.error(`YAML_INVALID ${finding.file}: ${finding.message}`);
  }
  console.log(
    `YAML inventory ${result.status}: ${result.filesChecked} files / ${result.findings.length} findings.`
  );

  if (result.status === 'FAIL') process.exitCode = 1;
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : '';
if (invokedPath === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
