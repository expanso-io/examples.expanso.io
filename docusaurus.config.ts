import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';
import type {Options as RedirectOptions} from '@docusaurus/plugin-client-redirects';

const config: Config = {
  title: 'Expanso Examples',
  tagline: 'Production-ready pipeline examples for Expanso Edge',
  favicon: 'img/favicon.svg',

  // Future flags
  future: {
    v4: true,
  },

  url: 'https://examples.expanso.io',
  baseUrl: '/',

  // GitHub pages deployment config
  organizationName: 'expanso-io',
  projectName: 'examples.expanso.io',

  onBrokenLinks: 'warn',

  // Ensure sitemap and pages use trailing slashes — matches Cloudflare Pages
  // canonical URL behavior, eliminating 301 redirects that prevent indexing
  trailingSlash: true,

  markdown: {
    mermaid: true,
  },

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          routeBasePath: '/', // Docs-only mode
          sidebarPath: './sidebars.ts',
          editUrl: 'https://github.com/expanso-io/examples.expanso.io/edit/main/',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themes: ['@docusaurus/theme-mermaid'],

  plugins: [
    './plugins/tailwind-config.cjs',
    './plugins/alias-config.cjs',
    [
      '@docusaurus/plugin-google-tag-manager',
      {
        containerId: 'GTM-MPSKFDMF',
      },
    ],
    [
      '@docusaurus/plugin-client-redirects',
      {
        // Redirect old paths that no longer exist to their closest matching pages
        createRedirects(existingPath) {
          // Data Security: delete-payment-pii was renamed to remove-pii
          // Create redirects from old delete-payment-pii paths to remove-pii
          if (existingPath.startsWith('/data-security/remove-pii')) {
            const suffix = existingPath.replace('/data-security/remove-pii', '');
            return [`/data-security/delete-payment-pii${suffix}`];
          }
          return undefined;
        },
        redirects: [
          // =====================================================
          // Data Security: Old paths to current pages
          // =====================================================
          // delete-payment-pii steps → remove-pii setup
          {from: '/data-security/delete-payment-pii/step-1-identify-payment-pii', to: '/data-security/remove-pii/setup'},
          {from: '/data-security/delete-payment-pii/step-2-delete-card-numbers', to: '/data-security/remove-pii/setup'},
          {from: '/data-security/delete-payment-pii/step-3-preserve-analytics-data', to: '/data-security/remove-pii/complete-pipeline'},

          // enforce-schema old nested structure
          {from: '/data-security/enforce-schema/setup/step-1-define-json-schema', to: '/data-security/enforce-schema/setup'},
          {from: '/data-security/enforce-schema/setup/troubleshooting', to: '/data-security/enforce-schema/troubleshooting'},
          {from: '/data-security/enforce-schema/explorer/setup', to: '/data-security/enforce-schema/explorer'},
          {from: '/data-security/enforce-schema/explorer/complete-schema-validation', to: '/data-security/enforce-schema/complete-schema-validation'},

          // encryption-patterns old nested structure
          {from: '/data-security/encryption-patterns/explorer/setup', to: '/data-security/encryption-patterns/explorer'},
          {from: '/data-security/encryption-patterns/explorer/complete-encryption-pipeline', to: '/data-security/encryption-patterns/complete-encryption-pipeline'},

          // remove-pii old nested structure
          {from: '/data-security/remove-pii/setup/step-1-delete-payment-data', to: '/data-security/remove-pii/setup'},
          {from: '/data-security/remove-pii/explorer/setup', to: '/data-security/remove-pii/explorer'},
          {from: '/data-security/remove-pii/explorer/complete-pipeline', to: '/data-security/remove-pii/complete-pipeline'},

          // =====================================================
          // Data Routing: Old paths to current pages
          // =====================================================
          // circuit-breakers old nested structure
          {from: '/data-routing/circuit-breakers/explorer/setup', to: '/data-routing/circuit-breakers/explorer'},
          {from: '/data-routing/circuit-breakers/explorer/complete-circuit-breakers', to: '/data-routing/circuit-breakers/complete-circuit-breakers'},

          // smart-buffering old nested structure (now exists)
          {from: '/data-routing/smart-buffering/explorer/setup', to: '/data-routing/smart-buffering/explorer'},
          {from: '/data-routing/smart-buffering/explorer/complete-smart-buffering', to: '/data-routing/smart-buffering/complete-smart-buffering'},

          // fan-out-pattern old nested structure
          {from: '/data-routing/fan-out-pattern/setup/step-1-configure-broker', to: '/data-routing/fan-out-pattern/setup'},
          {from: '/data-routing/fan-out-pattern/explorer/setup', to: '/data-routing/fan-out-pattern/explorer'},
          {from: '/data-routing/fan-out-pattern/explorer/complete-fan-out-pipeline', to: '/data-routing/fan-out-pattern/complete-fan-out-pipeline'},
          {from: '/data-routing/fan-out-pattern/setup/complete-fan-out-pipeline', to: '/data-routing/fan-out-pattern/complete-fan-out-pipeline'},

          // content-routing old nested structure
          {from: '/data-routing/content-routing/setup/step-1-route-by-severity', to: '/data-routing/content-routing/setup'},
          {from: '/data-routing/content-routing/setup/explorer', to: '/data-routing/content-routing/explorer'},
          {from: '/data-routing/content-routing/explorer/setup', to: '/data-routing/content-routing/explorer'},
          {from: '/data-routing/content-routing/explorer/complete-content-routing', to: '/data-routing/content-routing/complete-content-routing'},

          // priority-queues old nested structure
          {from: '/data-routing/priority-queues/setup/step-1-severity-routing', to: '/data-routing/priority-queues/setup'},

          // =====================================================
          // Data Transformation: Old paths to current pages
          // =====================================================
          // parse-logs old nested structure
          {from: '/data-transformation/parse-logs/setup/step-1-parse-json-logs', to: '/data-transformation/parse-logs/setup'},
          {from: '/data-transformation/parse-logs/setup/troubleshooting', to: '/data-transformation/parse-logs/troubleshooting'},
          {from: '/data-transformation/parse-logs/explorer/setup', to: '/data-transformation/parse-logs/explorer'},
          {from: '/data-transformation/parse-logs/explorer/complete-parser', to: '/data-transformation/parse-logs/complete-parser'},

          // normalize-timestamps old nested structure
          {from: '/data-transformation/normalize-timestamps/setup/step-1-parse-formats', to: '/data-transformation/normalize-timestamps/setup'},
          {from: '/data-transformation/normalize-timestamps/explorer/setup', to: '/data-transformation/normalize-timestamps/explorer'},
          {from: '/data-transformation/normalize-timestamps/explorer/complete-pipeline', to: '/data-transformation/normalize-timestamps/complete-pipeline'},

          // =====================================================
          // Log Processing: Old paths to current pages
          // =====================================================
          // production-pipeline old nested structure
          {from: '/log-processing/production-pipeline/explorer/setup', to: '/log-processing/production-pipeline/explorer'},
          {from: '/log-processing/production-pipeline/explorer/complete-production-pipeline', to: '/log-processing/production-pipeline/'},

          // filter-severity old nested structure
          {from: '/log-processing/filter-severity/explorer/setup', to: '/log-processing/filter-severity/explorer'},
          {from: '/log-processing/filter-severity/explorer/complete-filter-severity', to: '/log-processing/filter-severity/complete-filter-severity'},

          // enrich-export old nested structure
          {from: '/log-processing/enrich-export/setup/step-1-generate-test-data', to: '/log-processing/enrich-export/setup'},
          {from: '/log-processing/enrich-export/setup/complete-log-enrichment', to: '/log-processing/enrich-export/complete-log-enrichment'},
          {from: '/log-processing/enrich-export/explorer/setup', to: '/log-processing/enrich-export/explorer'},
          {from: '/log-processing/enrich-export/explorer/complete-log-enrichment', to: '/log-processing/enrich-export/complete-log-enrichment'},

          // =====================================================
          // /examples/* paths: Redirect to actual example pages
          // =====================================================
          {from: '/examples/data-routing/content-routing', to: '/data-routing/content-routing/'},
          {from: '/examples/data-routing/circuit-breakers', to: '/data-routing/circuit-breakers/'},
          {from: '/examples/data-security/encrypt-data', to: '/data-security/encrypt-data/'},
          {from: '/examples/data-security/enforce-schema', to: '/data-security/enforce-schema/'},
          {from: '/examples/data-security/remove-pii', to: '/data-security/remove-pii/'},
          {from: '/examples/data-transformation/parse-logs', to: '/data-transformation/parse-logs/'},

          // =====================================================
          // YAML file paths: Redirect to example pages with explorer
          // =====================================================
          {from: '/examples/data-security/encryption-patterns-complete.yaml', to: '/data-security/encryption-patterns/explorer'},
          {from: '/examples/data-security/enforce-schema-complete.yaml', to: '/data-security/enforce-schema/explorer'},
          {from: '/examples/data-security/remove-pii-complete.yaml', to: '/data-security/remove-pii/explorer'},
          {from: '/examples/data-routing/content-routing.yaml', to: '/data-routing/content-routing/explorer'},
          {from: '/examples/data-routing/smart-buffering.yaml', to: '/data-routing/smart-buffering/explorer'},
          {from: '/examples/data-routing/fan-out-pattern.yaml', to: '/data-routing/fan-out-pattern/explorer'},
          {from: '/examples/data-routing/step-3-multi-level-fallback.yaml', to: '/data-routing/circuit-breakers/explorer'},
          {from: '/examples/data-transformation/parse-logs-complete.yaml', to: '/data-transformation/parse-logs/explorer'},
          {from: '/examples/data-transformation/transform-formats-complete.yaml', to: '/data-transformation/transform-formats/explorer'},
          {from: '/examples/data-transformation/normalize-timestamps-complete.yaml', to: '/data-transformation/normalize-timestamps/explorer'},
          {from: '/examples/log-processing/enrich-export-complete.yaml', to: '/log-processing/enrich-export/explorer'},
          {from: '/examples/log-processing/production-pipeline-complete.yaml', to: '/log-processing/production-pipeline/explorer'},

          // =====================================================
          // /files/* paths: Redirect to explorer pages (sample data)
          // =====================================================
          {from: '/files/data-security/remove-pii/sample-data.json', to: '/data-security/remove-pii/explorer'},
          {from: '/files/data-security/enforce-schema-complete.yaml', to: '/data-security/enforce-schema/explorer'},
        ],
      } satisfies RedirectOptions,
    ],
  ],

  themeConfig: {
    image: 'img/expanso-social.png',

    colorMode: {
      defaultMode: 'dark',
      disableSwitch: false,
      respectPrefersColorScheme: false,
    },

    navbar: {
      title: '',
      logo: {
        alt: 'Expanso Logo',
        src: 'img/logo.svg',
        srcDark: 'img/logo-dark.svg',
        width: 140,
        height: 32,
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'examples',
          position: 'left',
          label: 'Examples',
        },
        {
          href: 'https://docs.expanso.io',
          label: 'Docs',
          position: 'left',
        },
        {
          href: 'https://cloud.expanso.io',
          label: 'Cloud Console',
          position: 'right',
        },
      ],
    },

    footer: {
      style: 'dark',
      links: [
        {
          title: 'Docs',
          items: [
            {
              label: 'Getting Started',
              href: 'https://docs.expanso.io/getting-started/quick-start',
            },
            {
              label: 'Components',
              href: 'https://docs.expanso.io/components',
            },
            {
              label: 'Use Cases',
              href: 'https://docs.expanso.io/use-cases',
            },
          ],
        },
        {
          title: 'Company',
          items: [
            {
              label: 'About Us',
              href: 'https://expanso.io/about-us',
            },
            {
              label: 'Contact',
              href: 'https://expanso.io/contact',
            },
          ],
        },
        {
          title: 'Resources',
          items: [
            {
              label: 'Support',
              href: 'https://expanso.io/help-center',
            },
            {
              label: 'Security',
              href: 'https://expanso.io/security-and-governance',
            },
            {
              label: 'FAQ',
              href: 'https://expanso.io/faq',
            },
          ],
        },
        {
          title: 'Product',
          items: [
            {
              label: 'Expanso Cloud',
              href: 'https://cloud.expanso.io',
            },
            {
              label: 'Website',
              href: 'https://expanso.io',
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} Expanso.`,
    },

    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.vsDark,
      additionalLanguages: ['yaml', 'bash', 'json', 'typescript', 'javascript', 'docker', 'nginx', 'sql'],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
