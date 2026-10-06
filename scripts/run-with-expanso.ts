import { spawn } from 'node:child_process';

import { resolveInstalledExpansoBinary } from './validation/expanso-binary';

const args = process.argv.slice(2);

const command = args.shift();

if (!command) {
  process.stderr.write(
    'Usage: tsx scripts/run-with-expanso.ts <command> [args...]\n'
  );
  process.exit(1);
}

for (const component of ['edge', 'cli'] as const) {
  const binary = resolveInstalledExpansoBinary(component);
  process.stderr.write(
    `using expanso-${component} ${binary.version} from ${binary.path}\n`
  );
}

const child = spawn(command, args, {
  env: process.env,
  stdio: 'inherit',
});

child.on('error', (error) => {
  process.stderr.write(`could not start ${command}: ${error.message}\n`);
  process.exit(1);
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);

    return;
  }

  process.exit(code ?? 1);
});
