import { readdirSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import matter from 'gray-matter';
import type { SidebarsConfig } from '@docusaurus/plugin-content-docs';

import { PUBLIC_CATALOG } from './src/catalog/registry';
import { GOAL_FACETS } from './src/catalog/schema';

type SidebarDoc = { type: 'doc'; id: string; label: string };

function routeDirectory(route: string): string {
  return route.replace(/^\/+|\/+$/g, '');
}

function overviewDocumentId(route: string): string {
  return `${routeDirectory(route)}/index`;
}

// Family pages keep a fixed reading order regardless of their authored
// sidebar_position values, which collide inside several examples.
function surfaceRank(name: string): number {
  if (name === 'explorer') return 1;
  if (name === 'setup') return 2;
  const step = /^step-(\d+)/.exec(name);
  if (step) return 10 + Number(step[1]);
  if (name.startsWith('complete-')) return 100;
  if (name === 'troubleshooting') return 110;
  return 120;
}

// Every page that belongs to an example, so the sidebar unfolds the full
// walkthrough (explorer, setup, each step, complete pipeline, troubleshooting)
// beside the overview the way the pre-rebuild sidebar did.
function familyPages(route: string): SidebarDoc[] {
  const directory = routeDirectory(route);
  let entries: string[];
  try {
    entries = readdirSync(join('docs', directory));
  } catch {
    return [];
  }
  return entries
    .filter((entry) => entry.endsWith('.mdx') || entry.endsWith('.md'))
    .map((entry) => {
      const name = basename(entry).replace(/\.mdx?$/, '');
      const { data } = matter(readFileSync(join('docs', directory, entry)));
      return { name, data };
    })
    .filter(
      ({ name, data }) =>
        name !== 'index' && data.draft !== true && data.unlisted !== true
    )
    .sort(
      (left, right) =>
        surfaceRank(left.name) - surfaceRank(right.name) ||
        left.name.localeCompare(right.name)
    )
    .map(({ name, data }) => ({
      type: 'doc' as const,
      id: `${directory}/${name}`,
      label: String(data.sidebar_label ?? data.title ?? name),
    }));
}

const publishedRecords = PUBLIC_CATALOG.records.filter(
  (record) => record.status === 'published'
);

const outcomeGroups = GOAL_FACETS.map((goal) => ({
  type: 'category' as const,
  label: goal.label,
  collapsible: true,
  collapsed: true,
  items: publishedRecords
    .filter((record) => record.primaryGoal === goal.id)
    .sort((left, right) => left.title.localeCompare(right.title))
    .map((record) => {
      const overview = overviewDocumentId(record.routes.overview);
      const pages = familyPages(record.routes.overview);
      if (pages.length === 0) {
        return { type: 'doc' as const, id: overview, label: record.title };
      }
      return {
        type: 'category' as const,
        label: record.title,
        collapsible: true,
        collapsed: true,
        link: { type: 'doc' as const, id: overview },
        items: pages,
      };
    }),
})).filter((group) => group.items.length > 0);

const sidebars: SidebarsConfig = {
  examples: [
    {
      type: 'doc',
      id: 'index',
      label: 'All examples',
    },
    {
      type: 'category',
      label: 'Run examples locally',
      collapsible: true,
      collapsed: true,
      items: [
        'getting-started/process-data-locally',
        'getting-started/local-development',
        {
          type: 'category',
          label: 'Service setup',
          collapsible: true,
          collapsed: true,
          items: [
            'getting-started/services/kafka',
            'getting-started/services/postgres',
            'getting-started/services/redis',
          ],
        },
      ],
    },
    ...outcomeGroups,
  ],
};

export default sidebars;
