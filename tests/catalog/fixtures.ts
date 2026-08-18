import { PUBLIC_CATALOG } from '../../src/catalog/registry';

export function catalogFixture(): unknown {
  return structuredClone(PUBLIC_CATALOG);
}

export function withFirstRecord(
  mutate: (record: Record<string, unknown>) => void
): unknown {
  const fixture = catalogFixture() as { records: Record<string, unknown>[] };
  mutate(fixture.records[0]);
  return fixture;
}

export function withRecord(
  recordId: string,
  mutate: (record: Record<string, unknown>) => void
): unknown {
  const fixture = catalogFixture() as { records: Record<string, unknown>[] };
  const record = fixture.records.find((entry) => entry.id === recordId);
  if (record === undefined)
    throw new Error(`unknown catalog fixture ${recordId}`);
  mutate(record);
  return fixture;
}

export function withFirstNode(
  mutate: (node: Record<string, unknown>) => void
): unknown {
  return withFirstRecord((record) => {
    const topology = record.topology as { nodes: Record<string, unknown>[] };
    mutate(topology.nodes[0]);
  });
}

export function withFirstFlow(
  mutate: (flow: Record<string, unknown>) => void
): unknown {
  return withFirstRecord((record) => {
    const topology = record.topology as { flows: Record<string, unknown>[] };
    mutate(topology.flows[0]);
  });
}
