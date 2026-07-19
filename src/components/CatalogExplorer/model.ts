import { PUBLIC_CATALOG } from '../../catalog/registry';
import {
  COMPONENTS,
  DIFFICULTY_FACETS,
  EXECUTION_STATUS_FACETS,
  GOAL_FACETS,
  INDUSTRY_FACETS,
  INSPECT_TIME_FACETS,
  INTERACTION_FACETS,
  LOCATION_FACETS,
  OPERATIONAL_EVIDENCE_FACETS,
  PORTFOLIO_FACETS,
  type ComponentId,
  type ExampleRecord,
} from '../../catalog/schema';

export const FILTER_KEYS = [
  'goal',
  'type',
  'boundary',
  'industry',
  'source',
  'destination',
  'difficulty',
  'status',
  'evidence',
  'interaction',
  'time',
] as const;

export const PRIMARY_FILTER_KEYS = ['goal', 'boundary', 'status'] as const;
export const MORE_FILTER_KEYS = [
  'time',
  'industry',
  'source',
  'destination',
  'difficulty',
  'evidence',
  'interaction',
] as const;

export type FilterKey = (typeof FILTER_KEYS)[number];
export type CatalogSelections = Record<FilterKey, readonly string[]>;
export type PortfolioType = 'recipe' | 'scenario';

interface FilterOption {
  definition: string;
  id: string;
  label: string;
}

export const EMPTY_SELECTIONS: CatalogSelections = {
  goal: [],
  type: [],
  boundary: [],
  industry: [],
  source: [],
  destination: [],
  difficulty: [],
  status: [],
  evidence: [],
  interaction: [],
  time: [],
};

const componentById = new Map(
  COMPONENTS.map((component) => [component.id, component])
);

/**
 * Endpoint facets are a projection of the verified topology. A source has an
 * outgoing flow and no incoming flow; a destination has an incoming flow and
 * no outgoing flow. The catalog never keeps a second authored endpoint list.
 */
export function topologyComponentIds(
  record: ExampleRecord,
  endpoint: 'source' | 'destination'
): ComponentId[] {
  const incoming = new Set(record.topology.flows.map((flow) => flow.to));
  const outgoing = new Set(record.topology.flows.map((flow) => flow.from));

  return [
    ...new Set(
      record.topology.nodes.flatMap((node) => {
        const isEndpoint =
          endpoint === 'source'
            ? outgoing.has(node.id) && !incoming.has(node.id)
            : incoming.has(node.id) && !outgoing.has(node.id);
        return isEndpoint && node.componentId !== undefined
          ? [node.componentId]
          : [];
      })
    ),
  ].sort();
}

function endpointOptions(endpoint: 'source' | 'destination'): FilterOption[] {
  const ids = new Set(
    PUBLIC_CATALOG.records.flatMap((record) =>
      topologyComponentIds(record, endpoint)
    )
  );

  return [...ids]
    .flatMap((id) => {
      const component = componentById.get(id);
      return component === undefined
        ? []
        : [
            {
              id: component.id,
              label: component.label,
              definition: component.definition,
            },
          ];
    })
    .sort((a, b) => a.label.localeCompare(b.label));
}

function facetOptions(
  facets: readonly {
    definition: string;
    id: string;
    label: string;
  }[]
): FilterOption[] {
  return facets.map(({ definition, id, label }) => ({
    definition,
    id,
    label,
  }));
}

export const FILTER_OPTIONS: Record<FilterKey, readonly FilterOption[]> = {
  goal: facetOptions(GOAL_FACETS),
  type: facetOptions(PORTFOLIO_FACETS),
  boundary: facetOptions(LOCATION_FACETS),
  industry: facetOptions(INDUSTRY_FACETS),
  source: endpointOptions('source'),
  destination: endpointOptions('destination'),
  difficulty: facetOptions(DIFFICULTY_FACETS),
  status: facetOptions(EXECUTION_STATUS_FACETS),
  evidence: facetOptions(OPERATIONAL_EVIDENCE_FACETS),
  interaction: facetOptions(INTERACTION_FACETS),
  time: facetOptions(INSPECT_TIME_FACETS),
};

const facetSearchTerms: ReadonlyMap<string, readonly string[]> = new Map(
  [
    ...GOAL_FACETS,
    ...INDUSTRY_FACETS,
    ...LOCATION_FACETS,
    ...PORTFOLIO_FACETS,
    ...DIFFICULTY_FACETS,
    ...EXECUTION_STATUS_FACETS,
    ...OPERATIONAL_EVIDENCE_FACETS,
    ...INTERACTION_FACETS,
    ...INSPECT_TIME_FACETS,
  ].map((facet) => [facet.id, [facet.label, ...facet.aliases]])
);

const componentSearchTerms = new Map(
  COMPONENTS.map((component) => [
    component.id,
    [component.label, ...component.aliases],
  ])
);

function normalizeSearch(value: string): string {
  return value.trim().toLocaleLowerCase();
}

export function timeBucket(inspectMinutes: number): string {
  if (inspectMinutes <= 3) return 'quick';
  if (inspectMinutes <= 5) return 'standard';
  return 'deep';
}

export function portfolioType(record: ExampleRecord): PortfolioType {
  // Keep the secondary view derived: architecture interactions are complete
  // scenarios, while transform/simulation/reference interactions are recipes.
  return record.interaction === 'architecture' ? 'scenario' : 'recipe';
}

export function searchTextFor(record: ExampleRecord): string {
  const facetIds = [
    ...record.goals,
    ...record.industries,
    ...record.topology.nodes.map((node) => node.location),
    portfolioType(record),
    record.difficulty,
    record.executionStatus,
    record.operationalEvidence,
    record.interaction,
    timeBucket(record.expectedTime.inspectMinutes),
  ];
  const facetTerms = facetIds.flatMap((id) => facetSearchTerms.get(id) ?? []);
  const componentTerms = record.topology.nodes.flatMap((node) =>
    node.componentId === undefined
      ? []
      : (componentSearchTerms.get(node.componentId) ?? [])
  );

  return normalizeSearch(
    [
      record.title,
      record.oneLineOutcome,
      ...facetTerms,
      ...componentTerms,
      ...record.topology.nodes.map((node) => node.label),
    ].join(' ')
  );
}

function recordValue(record: ExampleRecord, key: FilterKey): readonly string[] {
  switch (key) {
    case 'goal':
      return record.goals;
    case 'type':
      return [portfolioType(record)];
    case 'boundary':
      return [...new Set(record.topology.nodes.map((node) => node.location))];
    case 'industry':
      return record.industries;
    case 'source':
      return topologyComponentIds(record, 'source');
    case 'destination':
      return topologyComponentIds(record, 'destination');
    case 'difficulty':
      return [record.difficulty];
    case 'status':
      return [record.executionStatus];
    case 'evidence':
      return [record.operationalEvidence];
    case 'interaction':
      return [record.interaction];
    case 'time':
      return [timeBucket(record.expectedTime.inspectMinutes)];
  }
}

export function filterCatalog(
  records: readonly ExampleRecord[],
  selections: CatalogSelections,
  search: string
): ExampleRecord[] {
  const query = normalizeSearch(search);

  return records.filter((record) => {
    if (query !== '' && !searchTextFor(record).includes(query)) return false;

    return FILTER_KEYS.every((key) => {
      const selected = selections[key];
      if (selected.length === 0) return true;
      const values = recordValue(record, key);
      return selected.some((value) => values.includes(value));
    });
  });
}

export function parseCatalogQuery(search: string): {
  selections: CatalogSelections;
  unknownValues: string[];
} {
  const params = new URLSearchParams(search);
  const unknownValues: string[] = [];

  function valuesFor(key: FilterKey): string[] {
    const allowed = new Set(FILTER_OPTIONS[key].map(({ id }) => id));
    const requested = params
      .getAll(key)
      .flatMap((value) => value.split(','))
      .filter(Boolean);
    const valid = [
      ...new Set(requested.filter((value) => allowed.has(value))),
    ].sort();

    for (const value of requested) {
      if (!allowed.has(value)) unknownValues.push(`${key}=${value}`);
    }

    return valid;
  }

  const selections: CatalogSelections = {
    goal: valuesFor('goal'),
    type: valuesFor('type'),
    boundary: valuesFor('boundary'),
    industry: valuesFor('industry'),
    source: valuesFor('source'),
    destination: valuesFor('destination'),
    difficulty: valuesFor('difficulty'),
    status: valuesFor('status'),
    evidence: valuesFor('evidence'),
    interaction: valuesFor('interaction'),
    time: valuesFor('time'),
  };

  return { selections, unknownValues };
}

export function serializeCatalogQuery(selections: CatalogSelections): string {
  const params = new URLSearchParams();

  for (const key of FILTER_KEYS) {
    const values = [...selections[key]].sort();
    if (values.length > 0) params.set(key, values.join(','));
  }

  const query = params.toString();
  return query === '' ? '' : `?${query}`;
}

export function catalogShareUrl(
  origin: string,
  pathname: string,
  selections: CatalogSelections
): string {
  const url = new URL(pathname, origin);
  url.search = serializeCatalogQuery(selections);
  url.hash = '';
  return url.toString();
}
