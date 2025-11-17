import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  examples: [
    {
      type: 'doc',
      id: 'index',
      label: '🏠 Home',
    },
    {
      type: 'category',
      label: 'Data Routing',
      collapsible: true,
      collapsed: false,
      items: [
        'data-routing/content-routing',
        'data-routing/circuit-breakers',
        'data-routing/priority-queues',
        'data-routing/fan-out-pattern',
        'data-routing/content-splitting',
      ],
    },
    {
      type: 'category',
      label: 'Data Security',
      collapsible: true,
      collapsed: false,
      items: [
        'data-security/encryption-patterns',
        'data-security/encrypt-data',
        'data-security/remove-pii',
        {
          type: 'category',
          label: 'Enforce Data Schema Validation',
          collapsible: true,
          collapsed: true,
          items: [
            'data-security/enforce-schema/index',
            'data-security/enforce-schema/explorer',
          ],
        },
      ],
    },
    {
      type: 'category',
      label: 'Data Transformation',
      collapsible: true,
      collapsed: false,
      items: [
        'data-transformation/aggregate-time-windows',
        'data-transformation/deduplicate-events',
        'data-transformation/normalize-timestamps',
        'data-transformation/parse-logs',
        'data-transformation/transform-formats',
      ],
    },
    {
      type: 'category',
      label: 'Log Processing',
      collapsible: true,
      collapsed: false,
      items: [
        'log-processing/filter-severity',
        'log-processing/enrich-export',
        'log-processing/production-pipeline',
      ],
    },
  ],
};

export default sidebars;
