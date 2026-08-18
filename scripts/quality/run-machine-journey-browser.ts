import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export type MachineJourneyBrowserReadiness =
  | {
      resultVersion: 'machine-journey-browser-readiness-v1';
      status: 'PASS';
      cells: 5;
      browser: 'pinned-playwright-chromium';
    }
  | {
      resultVersion: 'machine-journey-browser-readiness-v1';
      status: 'UNAVAILABLE';
      reasonCode: 'LOCAL_BROWSER_CAPABILITY_UNAVAILABLE';
      reason: string;
    }
  | {
      resultVersion: 'machine-journey-browser-readiness-v1';
      status: 'FAIL';
      reasonCode: 'BROWSER_JOURNEY_ASSERTION_FAILED';
    };

const LOCAL_CAPABILITY_PATTERN =
  /MachPortRendezvousServer|mach_port_rendezvous|bootstrap_check_in[\s\S]*Permission denied|Executable doesn't exist[\s\S]*(?:ms-playwright|chromium)|browser.*closed before the harness/i;

export function classifyMachineJourneyBrowserRun(input: {
  ci: boolean;
  output: string;
  status: number | null;
}): MachineJourneyBrowserReadiness {
  if (!input.ci && LOCAL_CAPABILITY_PATTERN.test(input.output)) {
    return {
      resultVersion: 'machine-journey-browser-readiness-v1',
      status: 'UNAVAILABLE',
      reasonCode: 'LOCAL_BROWSER_CAPABILITY_UNAVAILABLE',
      reason:
        'The local Chromium process was denied by the host sandbox. No browser assertions were treated as passed; CI installs and runs pinned Chromium separately.',
    };
  }
  if (input.status !== 0) {
    return {
      resultVersion: 'machine-journey-browser-readiness-v1',
      status: 'FAIL',
      reasonCode: 'BROWSER_JOURNEY_ASSERTION_FAILED',
    };
  }
  return {
    resultVersion: 'machine-journey-browser-readiness-v1',
    status: 'PASS',
    cells: 5,
    browser: 'pinned-playwright-chromium',
  };
}

function main(): void {
  const command = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const args = [
    'playwright',
    'test',
    'tests/quality/machine-journey-readiness.spec.ts',
    '--project=chromium-desktop',
    '--reporter=line',
  ];
  const run = spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: process.env,
  });
  const output = `${run.stdout ?? ''}${run.stderr ?? ''}`;
  const result = classifyMachineJourneyBrowserRun({
    ci: Boolean(process.env.CI),
    output,
    status: run.status,
  });

  if (result.status !== 'UNAVAILABLE') process.stdout.write(output);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (result.status === 'UNAVAILABLE') process.exitCode = 2;
  else if (result.status === 'FAIL') process.exitCode = run.status ?? 1;
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : '';
if (fileURLToPath(import.meta.url) === invokedPath) main();
