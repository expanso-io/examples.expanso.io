import type { Expectation, RecordCheck } from './expectations';

export function rebaseNormalizationFixture(
  source: string,
  expectation: Expectation,
  now: Date = new Date()
): { source: string; expectation: Expectation } {
  if (expectation.kind !== 'records')
    throw new Error('normalization requires record expectations');
  const rows = source
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line) as Record<string, unknown>);
  const first = Date.parse(String(rows[0]?.timestamp));
  if (!Number.isFinite(first))
    throw new Error('normalization fixture lacks a timestamp');
  const anchor = new Date(now);
  anchor.setUTCDate(anchor.getUTCDate() - 1);
  anchor.setUTCHours(12, 0, 0, 0);
  const shift = anchor.getTime() - first;
  const instants = new Map<string, Date>();
  for (const row of rows) {
    const instant = new Date(Date.parse(String(row.timestamp)) + shift);
    instants.set(String(row.event_id), instant);
    row.timestamp = instant.toISOString();
    row.time = instant.toISOString().slice(0, 19).replace('T', ' ');
  }
  const rebased = structuredClone(expectation);
  for (const output of rebased.outputs) {
    for (const record of output.records ?? []) {
      const instant = instants.get(String(record.match?.event_id));
      if (!instant)
        throw new Error('normalization expectation lacks a fixture event');
      updateRecord(record, instant);
    }
  }
  return {
    source: rows.map((row) => JSON.stringify(row)).join('\n') + '\n',
    expectation: rebased,
  };
}

function updateRecord(record: RecordCheck, instant: Date): void {
  const equals = record.equals ?? {};
  const iso = instant.toISOString();
  const day = instant.getUTCDay();
  const weekend = day === 0 || day === 6;
  const month = instant.getUTCMonth() + 1;
  const replacements: Record<string, string | number | boolean> = {
    timestamp: iso.replace('.000Z', 'Z'),
    'time_metadata.year': instant.getUTCFullYear(),
    'time_metadata.month': month,
    'time_metadata.day': instant.getUTCDate(),
    'time_metadata.hour': instant.getUTCHours(),
    'time_metadata.quarter': `Q${Math.ceil(month / 3)}`,
    'time_metadata.is_weekend': weekend,
    'time_metadata.is_business_hours':
      !weekend && instant.getUTCHours() >= 9 && instant.getUTCHours() < 17,
    'time_metadata.day_of_week': instant.toLocaleDateString('en-US', {
      timeZone: 'UTC',
      weekday: 'long',
    }),
  };
  for (const [key, replacement] of Object.entries(replacements)) {
    if (!(key in equals)) continue;
    const previous = equals[key];
    equals[key] =
      typeof previous === 'string' && typeof replacement === 'number'
        ? String(replacement).padStart(
            key === 'time_metadata.year' ? 4 : 2,
            '0'
          )
        : replacement;
  }
}
