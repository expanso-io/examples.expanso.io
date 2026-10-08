import { resolveInstalledExpansoBinary } from './validation/expanso-binary';

for (const component of ['edge', 'cli'] as const) {
  const binary = resolveInstalledExpansoBinary(component);
  process.stdout.write(
    `using expanso-${component} ${binary.version} from ${binary.path}\n`
  );
}
