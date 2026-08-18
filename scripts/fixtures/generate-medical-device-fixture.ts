#!/usr/bin/env tsx

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = 'examples/integrations/medical-device-intelligence';
const maintenance = `device_id,timestamp,technician_alias,site_zone,description
VENT-TEST-01,2026-02-10T08:15:00Z,TECH-01,LAB-A,"Synthetic inspection record; adapter status S2 was reviewed and the unit was held for follow-up."
PUMP-TEST-02,2026-02-10T09:32:00Z,TECH-02,LAB-B,"Synthetic inspection record; repeated status S1 events were attached to a fleet review."
MON-TEST-03,2026-02-10T11:20:00Z,TECH-03,LAB-C,"Synthetic inspection record; connector telemetry was marked for bench testing."
`;
const events = `${JSON.stringify(
  [
    {
      device_id: 'VENT-TEST-01',
      timestamp: '2026-02-10T07:58:22Z',
      event_code: 'SENSOR-STATUS-S2',
      adapter_status: 2,
      message: 'Synthetic sensor-status event for architecture testing.',
    },
    {
      device_id: 'PUMP-TEST-02',
      timestamp: '2026-02-10T09:12:45Z',
      event_code: 'FLOW-STATUS-S1',
      adapter_status: 1,
      message: 'Synthetic flow-status event for architecture testing.',
    },
    {
      device_id: 'MON-TEST-03',
      timestamp: '2026-02-10T11:05:33Z',
      event_code: 'CONNECTOR-STATUS-S1',
      adapter_status: 1,
      message: 'Synthetic connector-status event for architecture testing.',
    },
  ],
  null,
  2
)}\n`;
const notes = `Synthetic fixture notes — not customer, patient, or service data.

TECH-01: VENT-TEST-01 produced status S2 twice during a bench replay. Hold for a human fleet review.
TECH-02: PUMP-TEST-02 produced repeated status S1 events after a fixture configuration change.
TECH-03: MON-TEST-03 produced status S1. Attach the synthetic connector trace to the review packet.
`;

const generated = new Map<string, string>([
  [`${root}/maintenance-logs.csv`, maintenance],
  [`${root}/error-events.json`, events],
  [`${root}/technician-notes.txt`, notes],
]);

if (process.argv.slice(2).includes('--write')) {
  for (const [path, bytes] of generated) writeFileSync(resolve(path), bytes);
  process.stdout.write(
    `Wrote ${generated.size} medical-device fixture files.\n`
  );
} else {
  const drift = [...generated].filter(
    ([path, bytes]) => readFileSync(resolve(path), 'utf8') !== bytes
  );
  if (drift.length > 0) {
    throw new Error(
      `Medical-device fixture drift: ${drift.map(([path]) => path).join(', ')}`
    );
  }
  process.stdout.write('Medical-device synthetic fixture is deterministic.\n');
}
