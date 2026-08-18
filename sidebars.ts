import type { SidebarsConfig } from '@docusaurus/plugin-content-docs';

import { PUBLIC_CATALOG } from './src/catalog/registry';
import { GOAL_FACETS } from './src/catalog/schema';

function overviewDocumentId(route: string): string {
  const normalized = route.replace(/^\/+|\/+$/g, '');
  return `${normalized}/index`;
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
    .map((record) => ({
      type: 'doc' as const,
      id: overviewDocumentId(record.routes.overview),
      label: record.title,
    })),
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
