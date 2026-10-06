import { spawnSync } from 'node:child_process';
import { accessSync, constants } from 'node:fs';
import { delimiter, join } from 'node:path';

export type ExpansoComponent = 'cli' | 'edge';

export interface ExpansoBinary {
  path: string;
  version: string;
}

export interface ResolveExpansoBinaryOptions {
  env?: NodeJS.ProcessEnv;
  log?: (line: string) => void;
}

function installedBinary(name: string, env: NodeJS.ProcessEnv): string | null {
  for (const directory of (env.PATH ?? '').split(delimiter)) {
    if (!directory) continue;
    const candidate = join(directory, name);
    try {
      accessSync(candidate, constants.X_OK);
      return candidate;
    } catch {
      // Continue to the next PATH entry.
    }
  }
  return null;
}

/** Use the operator-managed latest binary already installed on PATH. */
export function resolveInstalledExpansoBinary(
  component: ExpansoComponent,
  options: ResolveExpansoBinaryOptions = {}
): ExpansoBinary {
  const env = options.env ?? process.env;
  const name = `expanso-${component}`;
  const path = installedBinary(name, env);
  if (!path)
    throw new Error(
      `${name} is not installed on PATH; install the latest release from https://get.expanso.io/${component}/install.sh`
    );

  const result = spawnSync(path, ['version'], { encoding: 'utf8', env });
  if (result.status !== 0)
    throw new Error(
      `${name} at ${path} could not report its version: ${result.stderr.trim() || `exit ${result.status ?? 'unknown'}`}`
    );
  const match = /v\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?/.exec(
    `${result.stdout}\n${result.stderr}`
  );
  if (!match)
    throw new Error(`${name} at ${path} did not report a semantic version`);
  options.log?.(`using ${name} ${match[0]} from PATH (${path})`);
  return { path, version: match[0] };
}
