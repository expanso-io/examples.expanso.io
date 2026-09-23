import { readFileSync, writeFileSync } from 'node:fs';

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return value !== null && !Array.isArray(value) && typeof value === 'object';
}

function argumentsByName(argv: string[]): Map<string, string> {
  if (argv.length % 2 !== 0)
    throw new Error('arguments must be key/value pairs');
  const values = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith('--') || !value || values.has(key)) {
      throw new Error(`invalid or duplicate argument: ${key ?? '<missing>'}`);
    }
    values.set(key, value);
  }
  return values;
}

function required(values: Map<string, string>, key: string): string {
  const value = values.get(key);
  if (!value) throw new Error(`${key} is required`);
  return value;
}

const args = argumentsByName(process.argv.slice(2));
const checksPath = required(args, '--checks');
const checkName = required(args, '--check-name');
const appId = required(args, '--app-id');
const subjectSha = required(args, '--subject-sha');
const externalId = required(args, '--external-id');
const outputPath = required(args, '--output');
if (!/^\d+$/.test(appId)) throw new Error('--app-id must be numeric');
if (!/^[a-f0-9]{40}$/.test(subjectSha) || /^0+$/.test(subjectSha)) {
  throw new Error('--subject-sha is invalid');
}

const document = JSON.parse(readFileSync(checksPath, 'utf8')) as unknown;
if (!isObject(document) || !Array.isArray(document.check_runs)) {
  throw new Error('check-runs response is invalid');
}
const matches = document.check_runs
  .filter((entry): entry is JsonObject => {
    if (!isObject(entry) || !isObject(entry.app)) return false;
    return (
      entry.name === checkName &&
      String(entry.app.id ?? '') === appId &&
      entry.head_sha === subjectSha &&
      entry.external_id === externalId &&
      entry.status === 'completed' &&
      entry.conclusion === 'success'
    );
  })
  .sort((left, right) => Number(right.id) - Number(left.id));

const selected = matches[0];
if (!selected || !isObject(selected.output)) process.exit(2);
const text = selected.output.text;
if (typeof text !== 'string' || text.trim() === '') process.exit(2);
writeFileSync(outputPath, text, { flag: 'wx' });
process.stdout.write(
  `${JSON.stringify({ status: 'PASS', checkRunId: selected.id, checkName, appId, subjectSha })}\n`
);
