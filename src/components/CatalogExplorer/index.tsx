import Link from '@docusaurus/Link';
import { useHistory, useLocation } from '@docusaurus/router';
import { ArrowRight, Search, Share2, SlidersHorizontal, X } from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';

import {
  createExampleFilterChangeEvent,
  createExampleSearchEvent,
  recordAnalyticsEvent,
} from '../../analytics/events';
import { PUBLIC_CATALOG } from '../../catalog/registry';
import {
  GOAL_FACETS,
  LOCATION_FACETS,
  type ExampleRecord,
} from '../../catalog/schema';
import {
  EMPTY_SELECTIONS,
  FILTER_KEYS,
  FILTER_OPTIONS,
  MORE_FILTER_KEYS,
  PRIMARY_FILTER_KEYS,
  catalogShareUrl,
  filterCatalog,
  parseCatalogQuery,
  portfolioType,
  serializeCatalogQuery,
  type CatalogSelections,
  type FilterKey,
  type PortfolioType,
} from './model';
import styles from './styles.module.css';

const FEATURED_IDS = [
  'remove-pii',
  'scada-energy-edge',
  'db2-to-bigquery',
] as const;

const executionLabels = {
  'offline-runnable': 'Runs offline',
  'requires-integration': 'Needs integration',
  'architecture-only': 'Architecture only',
} as const;

const evidenceLabels = {
  'not-assessed': 'Ops not assessed',
  'component-tested': 'Components tested',
  'operating-envelope-tested': 'Envelope tested',
} as const;

const interactionLabels = {
  transform: 'Transformation',
  'runtime-simulation': 'Runtime simulation',
  architecture: 'Architecture',
  none: 'Reference',
} as const;

const difficultyLabels = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
} as const;

const filterLabels: Record<FilterKey, string> = {
  goal: 'Goal',
  type: 'Portfolio',
  boundary: 'Boundary',
  industry: 'Industry',
  source: 'Source',
  destination: 'Destination',
  difficulty: 'Difficulty',
  status: 'Execution',
  evidence: 'Operational evidence',
  interaction: 'Interaction',
  time: 'Inspect time',
};

const goalsById = new Map(GOAL_FACETS.map((facet) => [facet.id, facet.label]));
const locationsById = new Map(
  LOCATION_FACETS.map((facet) => [facet.id, facet.label])
);

function BoundaryRail({
  record,
}: {
  record: ExampleRecord;
}): React.JSX.Element {
  const locations = [
    ...new Set(record.topology.nodes.map((node) => node.location)),
  ];

  return (
    <div className={styles.boundaryRail} aria-label="System boundary">
      {locations.map((location, index) => (
        <React.Fragment key={location}>
          {index > 0 ? (
            <span className={styles.railLine} aria-hidden="true" />
          ) : null}
          <span className={styles.railLocation}>
            <span className={styles.railDot} aria-hidden="true" />
            {locationsById.get(location) ?? location}
          </span>
        </React.Fragment>
      ))}
    </div>
  );
}

function FeaturedLink({
  record,
}: {
  record: ExampleRecord;
}): React.JSX.Element {
  return (
    <Link className={styles.featuredLink} to={record.routes.overview}>
      <span className={styles.featuredGoal}>
        {goalsById.get(record.primaryGoal)}
      </span>
      <strong>{record.title}</strong>
      <span className={styles.featuredOutcome}>{record.oneLineOutcome}</span>
      <ArrowRight aria-hidden="true" size={18} />
    </Link>
  );
}

function Result({ record }: { record: ExampleRecord }): React.JSX.Element {
  return (
    <li className={styles.result} data-portfolio-type={portfolioType(record)}>
      <div className={styles.resultMain}>
        <div className={styles.resultHeading}>
          <span className={styles.resultGoal}>
            {goalsById.get(record.primaryGoal)}
          </span>
          <h3>
            <Link to={record.routes.overview}>{record.title}</Link>
          </h3>
        </div>
        <p>{record.oneLineOutcome}</p>
        <BoundaryRail record={record} />
      </div>
      <dl className={styles.resultMeta}>
        <div>
          <dt>Execution</dt>
          <dd>{executionLabels[record.executionStatus]}</dd>
        </div>
        <div>
          <dt>Evidence</dt>
          <dd>{evidenceLabels[record.operationalEvidence]}</dd>
        </div>
        <div>
          <dt>Difficulty</dt>
          <dd>{difficultyLabels[record.difficulty]}</dd>
        </div>
        <div>
          <dt>Interaction</dt>
          <dd>{interactionLabels[record.interaction]}</dd>
        </div>
      </dl>
      <Link className={styles.resultAction} to={record.routes.overview}>
        Open example
        <ArrowRight aria-hidden="true" size={17} />
      </Link>
    </li>
  );
}

function nextSelections(
  current: CatalogSelections,
  key: FilterKey,
  value: string
): CatalogSelections {
  const selected = new Set(current[key]);
  if (selected.has(value)) selected.delete(value);
  else selected.add(value);
  return { ...current, [key]: [...selected].sort() };
}

function FilterGroup({
  filterKey,
  onChange,
  selections,
}: {
  filterKey: FilterKey;
  onChange: (next: CatalogSelections, changedKey: FilterKey) => void;
  selections: CatalogSelections;
}): React.JSX.Element {
  return (
    <fieldset className={styles.filterGroup}>
      <legend>{filterLabels[filterKey]}</legend>
      <div className={styles.filterOptions}>
        {FILTER_OPTIONS[filterKey].map((option) => {
          const active = selections[filterKey].includes(option.id);
          return (
            <button
              key={option.id}
              type="button"
              title={option.definition}
              aria-pressed={active}
              onClick={() =>
                onChange(
                  nextSelections(selections, filterKey, option.id),
                  filterKey
                )
              }
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

interface CatalogExplorerProps {
  description: string;
  title: string;
}

export default function CatalogExplorer({
  description,
  title,
}: CatalogExplorerProps): React.JSX.Element {
  const history = useHistory();
  const location = useLocation();
  const [search, setSearch] = useState('');
  const [selections, setSelections] =
    useState<CatalogSelections>(EMPTY_SELECTIONS);
  const [urlNotice, setUrlNotice] = useState('');
  const [shareNotice, setShareNotice] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(true);
  const preserveNormalizedNotice = useRef(false);
  const lastTrackedSearch = useRef('');

  const publishedRecords = useMemo(
    () =>
      PUBLIC_CATALOG.records
        .filter((record) => record.status === 'published')
        .slice()
        .sort((a, b) => a.title.localeCompare(b.title)),
    []
  );
  const featured = FEATURED_IDS.flatMap((id) => {
    const record = publishedRecords.find((candidate) => candidate.id === id);
    return record === undefined ? [] : [record];
  });
  const results = useMemo(
    () => filterCatalog(publishedRecords, selections, search),
    [publishedRecords, search, selections]
  );
  const hasFilters =
    search.trim() !== '' ||
    FILTER_KEYS.some((key) => selections[key].length > 0);
  const activeFilterCount = FILTER_KEYS.filter(
    (key) => key !== 'type' && selections[key].length > 0
  ).length;
  const activeMoreFilterCount = MORE_FILTER_KEYS.filter(
    (key) => selections[key].length > 0
  ).length;

  useEffect(() => {
    const parsed = parseCatalogQuery(location.search);
    setSelections(parsed.selections);
    const canonicalSearch = serializeCatalogQuery(parsed.selections);
    if (parsed.unknownValues.length > 0) {
      setUrlNotice(
        `Ignored unknown catalog filter${parsed.unknownValues.length === 1 ? '' : 's'}: ${parsed.unknownValues.join(', ')}.`
      );
      preserveNormalizedNotice.current = true;
    } else if (preserveNormalizedNotice.current) {
      preserveNormalizedNotice.current = false;
    } else {
      setUrlNotice('');
    }
    if (canonicalSearch !== location.search) {
      history.replace({ ...location, search: canonicalSearch });
    }
  }, [history, location.hash, location.pathname, location.search]);

  useEffect(() => {
    const query = search.trim();
    if (query === '') {
      lastTrackedSearch.current = '';
      return;
    }
    if (query === lastTrackedSearch.current) return;

    const timer = window.setTimeout(() => {
      lastTrackedSearch.current = query;
      recordAnalyticsEvent(
        createExampleSearchEvent(query.length, results.length)
      );
    }, 400);
    return () => window.clearTimeout(timer);
  }, [results.length, search]);

  useEffect(() => {
    const mobile = window.matchMedia('(max-width: 720px)');
    const synchronizeDisclosure = (): void => {
      setFiltersOpen(!mobile.matches);
    };
    synchronizeDisclosure();
    mobile.addEventListener('change', synchronizeDisclosure);
    return () => mobile.removeEventListener('change', synchronizeDisclosure);
  }, []);

  function applySelections(
    next: CatalogSelections,
    changedKey?: FilterKey
  ): void {
    setSelections(next);
    setShareNotice('');
    history.replace({
      ...location,
      search: serializeCatalogQuery(next),
    });

    if (changedKey !== undefined) {
      recordAnalyticsEvent(
        createExampleFilterChangeEvent(
          changedKey,
          next[changedKey],
          filterCatalog(publishedRecords, next, search).length
        )
      );
    }
  }

  function selectPortfolio(nextType?: PortfolioType): void {
    applySelections(
      { ...selections, type: nextType === undefined ? [] : [nextType] },
      'type'
    );
  }

  function clearFilters(): void {
    const activeKeys = FILTER_KEYS.filter((key) => selections[key].length > 0);
    setSearch('');
    setShareNotice('');
    applySelections(EMPTY_SELECTIONS);
    for (const key of activeKeys) {
      recordAnalyticsEvent(
        createExampleFilterChangeEvent(key, [], publishedRecords.length)
      );
    }
  }

  async function shareResults(): Promise<void> {
    const url = catalogShareUrl(
      window.location.origin,
      location.pathname,
      selections
    );
    try {
      await navigator.clipboard.writeText(url);
      setShareNotice(
        search.trim() === ''
          ? 'Canonical results link copied.'
          : 'Canonical results link copied. Search text was omitted.'
      );
    } catch {
      setShareNotice('Could not copy the results link.');
    }
  }

  return (
    <div className={styles.catalog}>
      <header className={styles.hero}>
        <p className={styles.eyebrow}>Expanso example library</p>
        <h1>{title}</h1>
        <p className={styles.heroCopy}>{description}</p>
        <a className={styles.heroAction} href="#catalog-results">
          Find a pattern
          <ArrowRight aria-hidden="true" size={18} />
        </a>
      </header>

      <section className={styles.featured} aria-labelledby="start-here-title">
        <div className={styles.sectionHeading}>
          <p>Start here</p>
          <h2 id="start-here-title">Three useful entry points</h2>
        </div>
        <div className={styles.featuredList}>
          {featured.map((record) => (
            <FeaturedLink key={record.id} record={record} />
          ))}
        </div>
      </section>

      <section className={styles.explorer} aria-labelledby="catalog-title">
        <div className={styles.explorerIntro}>
          <div>
            <p className={styles.sectionKicker}>All examples</p>
            <h2 id="catalog-title">Choose by constraint</h2>
          </div>
          <label className={styles.search}>
            <span>Search examples</span>
            <span className={styles.searchControl}>
              <Search aria-hidden="true" size={19} />
              <input
                type="search"
                aria-label="Search examples"
                aria-describedby="catalog-search-privacy"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setShareNotice('');
                }}
                placeholder="Search outcomes or systems"
                autoComplete="off"
              />
            </span>
            <small id="catalog-search-privacy">
              Search stays private; shared links include filters only.
            </small>
          </label>
        </div>

        <div className={styles.portfolioView}>
          <div>
            <p>Portfolio view</p>
            <span>Switch between focused recipes and complete scenarios.</span>
          </div>
          <div
            className={styles.portfolioOptions}
            role="group"
            aria-label="Portfolio view"
          >
            <button
              type="button"
              aria-pressed={selections.type.length === 0}
              onClick={() => selectPortfolio()}
            >
              All
            </button>
            <button
              type="button"
              aria-pressed={
                selections.type.length === 1 && selections.type[0] === 'recipe'
              }
              onClick={() => selectPortfolio('recipe')}
            >
              Recipes
            </button>
            <button
              type="button"
              aria-pressed={
                selections.type.length === 1 &&
                selections.type[0] === 'scenario'
              }
              onClick={() => selectPortfolio('scenario')}
            >
              Scenario architectures
            </button>
          </div>
        </div>

        <details
          className={styles.filterDisclosure}
          open={filtersOpen}
          onToggle={(event) => setFiltersOpen(event.currentTarget.open)}
        >
          <summary>
            <SlidersHorizontal aria-hidden="true" size={18} />
            Filters
            {activeFilterCount > 0 ? (
              <span>{activeFilterCount} active</span>
            ) : null}
          </summary>
          <div className={styles.filterBody}>
            <div className={styles.filterBar} aria-label="Catalog filters">
              {PRIMARY_FILTER_KEYS.map((key) => (
                <FilterGroup
                  filterKey={key}
                  key={key}
                  onChange={applySelections}
                  selections={selections}
                />
              ))}
            </div>

            <details className={styles.moreFilters}>
              <summary>
                More filters
                {activeMoreFilterCount > 0 ? (
                  <span>{activeMoreFilterCount} active</span>
                ) : null}
              </summary>
              <div className={styles.moreFilterGrid}>
                {MORE_FILTER_KEYS.map((key) => (
                  <FilterGroup
                    filterKey={key}
                    key={key}
                    onChange={applySelections}
                    selections={selections}
                  />
                ))}
              </div>
            </details>
          </div>
        </details>

        <div className={styles.resultsHeader} id="catalog-results">
          <p aria-live="polite" aria-atomic="true">
            <strong>{results.length}</strong>{' '}
            {results.length === 1 ? 'example' : 'examples'}
          </p>
          <div className={styles.resultControls}>
            <button type="button" onClick={shareResults}>
              <Share2 aria-hidden="true" size={16} />
              Share results
            </button>
            <button type="button" onClick={clearFilters} disabled={!hasFilters}>
              <X aria-hidden="true" size={16} />
              Clear filters
            </button>
          </div>
        </div>

        <p className={styles.shareNotice} role="status" aria-live="polite">
          {shareNotice}
        </p>
        <p className={styles.srNotice} role="status">
          {urlNotice}
        </p>

        {results.length > 0 ? (
          <ul className={styles.results}>
            {results.map((record) => (
              <Result key={record.id} record={record} />
            ))}
          </ul>
        ) : (
          <div className={styles.emptyState}>
            <span aria-hidden="true">0</span>
            <div>
              <h3>No examples match every constraint.</h3>
              <p>Remove a filter or try a broader search.</p>
            </div>
            <button type="button" onClick={clearFilters}>
              Show all examples
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
