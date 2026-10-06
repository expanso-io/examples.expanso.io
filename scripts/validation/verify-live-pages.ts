import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { discoverPipelineFiles } from './inventory';

const repositoryRoot = resolve(
  fileURLToPath(new URL('../..', import.meta.url))
);

async function main(): Promise<void> {
  const files = discoverPipelineFiles(repositoryRoot).filter(
    (file) => file.kind !== 'manifest'
  );
  const missing = files
    .filter((file) => !file.liveRoute)
    .map((file) => file.path);
  if (missing.length)
    throw new Error(`live page mapping missing:\n${missing.join('\n')}`);
  const routes = [
    ...new Set(files.map((file) => file.liveRoute as string)),
  ].sort();
  const failures: string[] = [];
  await Promise.all(
    routes.map(async (route) => {
      const url = new URL(route, 'https://examples.expanso.io');
      try {
        const response = await fetch(url, {
          redirect: 'follow',
          signal: AbortSignal.timeout(15_000),
        });
        if (response.status !== 200)
          failures.push(`${url} returned HTTP ${response.status}`);
        await response.body?.cancel();
      } catch (error) {
        failures.push(
          `${url} failed: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    })
  );
  if (failures.length) throw new Error(failures.sort().join('\n'));
  process.stdout.write(
    `verified ${routes.length} live pipeline pages return HTTP 200\n`
  );
}

main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`
  );
  process.exitCode = 1;
});
