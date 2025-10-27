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
        'data-routing/circuit-breakers',
      ],
    },
    {
      type: 'category',
      label: 'Data Security',
      collapsible: true,
      collapsed: false,
      items: [
        'data-security/encryption-patterns',
      ],
    },
    {
      type: 'category',
      label: 'Data Transformation',
      collapsible: true,
      collapsed: false,
      items: [
        'data-transformation/aggregate-time-windows',
      ],
    },
    {
      type: 'category',
      label: 'Log Processing',
      collapsible: true,
      collapsed: false,
      items: [
        'log-processing/production-pipeline',
      ],
    },
  ],
};

export default sidebars;
