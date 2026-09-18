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
        'getting-started/jev/index',
      ],
    },
    {
      type: 'category',
      label: '🤖 AI decisions (Jev)',
      collapsible: true,
      collapsed: false,
      items: [
        {
          type: 'category',
          label: 'Data routing',
          collapsible: true,
          collapsed: true,
          items: [
            'data-routing/jev-sensor-triage/index',
            'data-routing/jev-sensor-triage/pipeline',
          ],
        },
        {
          type: 'category',
          label: 'Data security',
          collapsible: true,
          collapsed: true,
          items: [
            'data-security/jev-sensitivity-masking/index',
            'data-security/jev-sensitivity-masking/pipeline',
            'data-security/jev-agent-guardrail/index',
            'data-security/jev-agent-guardrail/pipeline',
            'data-security/jev-soc-prefilter/index',
            'data-security/jev-soc-prefilter/pipeline',
          ],
        },
        {
          type: 'category',
          label: 'Data transformation',
          collapsible: true,
          collapsed: true,
          items: [
            'data-transformation/jev-data-quality/index',
            'data-transformation/jev-data-quality/pipeline',
          ],
        },
        {
          type: 'category',
          label: 'Log processing',
          collapsible: true,
          collapsed: true,
          items: [
            'log-processing/jev-log-triage/index',
            'log-processing/jev-log-triage/pipeline',
            'log-processing/jev-smart-sampling/index',
            'log-processing/jev-smart-sampling/pipeline',
          ],
        },
        {
          type: 'category',
          label: 'Integrations',
          collapsible: true,
          collapsed: true,
          items: [
            'integrations/jev-ticket-router/index',
            'integrations/jev-ticket-router/pipeline',
            'integrations/jev-moderation/index',
            'integrations/jev-moderation/pipeline',
            'integrations/jev-feedback-miner/index',
            'integrations/jev-feedback-miner/pipeline',
          ],
        },
      ],
    },
    ...outcomeGroups,
  ],
};

export default sidebars;
