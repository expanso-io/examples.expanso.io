import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { themes as prismThemes } from 'prism-react-renderer';
import type { Config, PluginModule } from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';
import type { Options as RedirectOptions } from '@docusaurus/plugin-client-redirects';

const runtimeProofHarnessEnabled = process.env.EXPLORER_RUNTIME_HARNESS === '1';

const runtimeProofHarnessPlugin: PluginModule = () => ({
  name: 'runtime-proof-test-harness',
  contentLoaded({ actions }) {
    actions.addRoute({
      path: '/__explorer-runtime-proof/',
      component: '@site/tests/quality/explorer/RuntimeProofHarnessPage.tsx',
      exact: true,
    });
  },
});

const productionRouteGuardPlugin: PluginModule = () => ({
  name: 'production-route-guard',
  postBuild({ outDir }) {
    if (
      !runtimeProofHarnessEnabled &&
      existsSync(join(outDir, '__explorer-runtime-proof', 'index.html'))
    ) {
      throw new Error(
        'Production build emitted the test-only Explorer runtime proof route'
      );
    }
  },
});

const config: Config = {
  title: 'Expanso Examples',
  tagline: 'Pipeline patterns and examples for Expanso Edge',
  favicon: 'img/favicon.svg',

  // Future flags
  future: {
    v4: true,
  },

  headTags: [
    {
      tagName: 'link',
      attributes: {
        rel: 'preload',
        href: '/fonts/figtree-latin-400-700.woff2',
        as: 'font',
        type: 'font/woff2',
        crossorigin: 'anonymous',
        fetchpriority: 'high',
      },
    },
    {
      tagName: 'style',
      attributes: {},
      innerHTML: `
        @font-face {
          font-family: 'Figtree';
          font-style: normal;
          font-weight: 400 700;
          font-display: swap;
          src: url('/fonts/figtree-latin-400-700.woff2') format('woff2');
        }
      `,
    },
    {
      tagName: 'script',
      attributes: {},
      innerHTML: `
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('consent', 'default', {
          'ad_storage': 'denied',
          'analytics_storage': 'denied',
          'ad_user_data': 'denied',
          'ad_personalization': 'denied',
          'personalization_storage': 'denied',
          'functionality_storage': 'denied',
          'security_storage': 'granted'
        });
      `,
    },
  ],

  url: 'https://examples.expanso.io',
  baseUrl: '/',

  // GitHub pages deployment config
  organizationName: 'expanso-io',
  projectName: 'examples.expanso.io',

  onBrokenLinks: 'throw',

  // Emit directory-style routes that work with the repository's static
  // GitHub Pages deployment and its index.html files.
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
          editUrl:
            'https://github.com/expanso-io/examples.expanso.io/edit/main/',
          // Maintainer reports are repository artifacts, not public content.
          exclude: ['internal/**'],
        },
        pages: {
          // Private directories and component tests are not public pages.
          exclude: ['**/_*/**', '**/*.test.{js,jsx,ts,tsx}', '**/__tests__/**'],
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
    runtimeProofHarnessEnabled && runtimeProofHarnessPlugin,
    productionRouteGuardPlugin,
    './plugins/tailwind-config.cjs',
    './plugins/alias-config.cjs',
    './plugins/posthog-analytics.cjs',
    [
      '@docusaurus/plugin-google-tag-manager',
      {
        containerId: 'GTM-MPSKFDMF',
      },
    ],
    [
      '@docusaurus/plugin-client-redirects',
      {
        // The plugin emits static redirect pages into the build artifact. This
        // is executable on GitHub Pages and does not depend on host rules.
        createRedirects(existingPath) {
          // Data Security: delete-payment-pii was renamed to remove-pii
          // Create redirects from old delete-payment-pii paths to remove-pii
          if (existingPath.startsWith('/data-security/remove-pii')) {
            const suffix = existingPath.replace(
              '/data-security/remove-pii',
              ''
            );
            return [`/data-security/delete-payment-pii${suffix}`];
          }
          return undefined;
        },
        redirects: [
          // =====================================================
          // Data Security: Old paths to current pages
          // =====================================================
          // delete-payment-pii steps → remove-pii setup
          {
            from: '/data-security/delete-payment-pii/step-1-identify-payment-pii',
            to: '/data-security/remove-pii/setup',
          },
          {
            from: '/data-security/delete-payment-pii/step-2-delete-card-numbers',
            to: '/data-security/remove-pii/setup',
          },
          {
            from: '/data-security/delete-payment-pii/step-3-preserve-analytics-data',
            to: '/data-security/remove-pii/complete-pipeline',
          },

          // enforce-schema old nested structure
          {
            from: '/data-security/enforce-schema/setup/step-1-define-json-schema',
            to: '/data-security/enforce-schema/setup',
          },
          {
            from: '/data-security/enforce-schema/setup/troubleshooting',
            to: '/data-security/enforce-schema/troubleshooting',
          },
          {
            from: '/data-security/enforce-schema/explorer/setup',
            to: '/data-security/enforce-schema/explorer',
          },
          {
            from: '/data-security/enforce-schema/explorer/complete-schema-validation',
            to: '/data-security/enforce-schema/complete-schema-validation',
          },
          {
            from: '/data-security/enforce-schema/step-2-configure-validation',
            to: '/data-security/enforce-schema/setup',
          },
          {
            from: '/data-security/enforce-schema/step-3-route-failures-dlq',
            to: '/data-security/enforce-schema/step-2-route-failures-dlq',
          },
          {
            from: '/data-security/enforce-schema/step-4-monitor-quality-metrics',
            to: '/data-security/enforce-schema/step-3-advanced-patterns',
          },

          // encryption-patterns old nested structure
          {
            from: '/data-security/encryption-patterns/explorer/setup',
            to: '/data-security/encryption-patterns/explorer',
          },
          {
            from: '/data-security/encryption-patterns/explorer/complete-encryption-pipeline',
            to: '/data-security/encryption-patterns/complete-encryption-pipeline',
          },
          {
            from: '/data-security/encryption-patterns/step-5-multi-key-strategy',
            to: '/data-security/encryption-patterns/step-5-advanced-patterns',
          },
          {
            from: '/data-security/encryption-patterns/step-6-key-rotation-audit',
            to: '/data-security/encryption-patterns/step-5-advanced-patterns',
          },

          // encrypt-data placeholders were historically buildable pages.
          {
            from: '/data-security/encrypt-data/step-4-manage-encryption-keys',
            to: '/data-security/encrypt-data/step-4-advanced-patterns',
          },
          {
            from: '/data-security/encrypt-data/step-5-selective-decryption',
            to: '/data-security/encrypt-data/step-4-advanced-patterns',
          },
          {
            from: '/data-security/encrypt-data/step-6-compliance-monitoring',
            to: '/data-security/encrypt-data/step-4-advanced-patterns',
          },

          // remove-pii old nested structure
          {
            from: '/data-security/remove-pii/setup/step-1-delete-payment-data',
            to: '/data-security/remove-pii/setup',
          },
          {
            from: '/data-security/remove-pii/explorer/setup',
            to: '/data-security/remove-pii/explorer',
          },
          {
            from: '/data-security/remove-pii/explorer/complete-pipeline',
            to: '/data-security/remove-pii/complete-pipeline',
          },

          // =====================================================
          // Data Routing: Old paths to current pages
          // =====================================================
          // circuit-breakers old nested structure
          {
            from: '/data-routing/circuit-breakers/explorer/setup',
            to: '/data-routing/circuit-breakers/explorer',
          },
          {
            from: '/data-routing/circuit-breakers/explorer/complete-circuit-breakers',
            to: '/data-routing/circuit-breakers/complete-circuit-breakers',
          },
          {
            from: '/data-routing/circuit-breakers/step-4-production-monitoring',
            to: '/data-routing/circuit-breakers/step-4-advanced-patterns',
          },

          // smart-buffering old nested structure (now exists)
          {
            from: '/data-routing/smart-buffering/explorer/setup',
            to: '/data-routing/smart-buffering/explorer',
          },
          {
            from: '/data-routing/smart-buffering/explorer/complete-smart-buffering',
            to: '/data-routing/smart-buffering/complete-smart-buffering',
          },

          // fan-out-pattern old nested structure
          {
            from: '/data-routing/fan-out-pattern/setup/step-1-configure-broker',
            to: '/data-routing/fan-out-pattern/setup',
          },
          {
            from: '/data-routing/fan-out-pattern/explorer/setup',
            to: '/data-routing/fan-out-pattern/explorer',
          },
          {
            from: '/data-routing/fan-out-pattern/explorer/complete-fan-out-pipeline',
            to: '/data-routing/fan-out-pattern/complete-fan-out-pipeline',
          },
          {
            from: '/data-routing/fan-out-pattern/setup/complete-fan-out-pipeline',
            to: '/data-routing/fan-out-pattern/complete-fan-out-pipeline',
          },
          {
            from: '/data-routing/fan-out-pattern/step-5-implement-fallbacks',
            to: '/data-routing/fan-out-pattern/step-5-advanced-patterns',
          },

          // content-routing old nested structure
          {
            from: '/data-routing/content-routing/setup/step-1-route-by-severity',
            to: '/data-routing/content-routing/setup',
          },
          {
            from: '/data-routing/content-routing/setup/explorer',
            to: '/data-routing/content-routing/explorer',
          },
          {
            from: '/data-routing/content-routing/explorer/setup',
            to: '/data-routing/content-routing/explorer',
          },
          {
            from: '/data-routing/content-routing/explorer/complete-content-routing',
            to: '/data-routing/content-routing/complete-content-routing',
          },
          {
            from: '/data-routing/content-routing/step-4-create-priority-queues',
            to: '/data-routing/content-routing/step-4-advanced-patterns',
          },

          // content-splitting placeholder was historically buildable.
          {
            from: '/data-routing/content-splitting/step-5-production-considerations',
            to: '/data-routing/content-splitting/step-4-advanced-patterns',
          },

          // priority-queues old nested structure
          {
            from: '/data-routing/priority-queues/setup/step-1-severity-routing',
            to: '/data-routing/priority-queues/setup',
          },

          // =====================================================
          // Data Transformation: Old paths to current pages
          // =====================================================
          // parse-logs old nested structure
          {
            from: '/data-transformation/parse-logs/setup/step-1-parse-json-logs',
            to: '/data-transformation/parse-logs/setup',
          },
          {
            from: '/data-transformation/parse-logs/setup/troubleshooting',
            to: '/data-transformation/parse-logs/troubleshooting',
          },
          {
            from: '/data-transformation/parse-logs/explorer/setup',
            to: '/data-transformation/parse-logs/explorer',
          },
          {
            from: '/data-transformation/parse-logs/explorer/complete-parser',
            to: '/data-transformation/parse-logs/complete-parser',
          },

          // normalize-timestamps old nested structure
          {
            from: '/data-transformation/normalize-timestamps/setup/step-1-parse-formats',
            to: '/data-transformation/normalize-timestamps/setup',
          },
          {
            from: '/data-transformation/normalize-timestamps/explorer/setup',
            to: '/data-transformation/normalize-timestamps/explorer',
          },
          {
            from: '/data-transformation/normalize-timestamps/explorer/complete-pipeline',
            to: '/data-transformation/normalize-timestamps/complete-pipeline',
          },

          // =====================================================
          // Log Processing: Old paths to current pages
          // =====================================================
          // production-pipeline old nested structure
          {
            from: '/log-processing/production-pipeline/explorer/setup',
            to: '/log-processing/production-pipeline/explorer',
          },
          {
            from: '/log-processing/production-pipeline/explorer/complete-production-pipeline',
            to: '/log-processing/production-pipeline/',
          },

          // filter-severity old nested structure
          {
            from: '/log-processing/filter-severity/explorer/setup',
            to: '/log-processing/filter-severity/explorer',
          },
          {
            from: '/log-processing/filter-severity/explorer/complete-filter-severity',
            to: '/log-processing/filter-severity/complete-filter-severity',
          },

          // enrich-export old nested structure
          {
            from: '/log-processing/enrich-export/setup/step-1-generate-test-data',
            to: '/log-processing/enrich-export/setup',
          },
          {
            from: '/log-processing/enrich-export/setup/complete-log-enrichment',
            to: '/log-processing/enrich-export/complete-log-enrichment',
          },
          {
            from: '/log-processing/enrich-export/explorer/setup',
            to: '/log-processing/enrich-export/explorer',
          },
          {
            from: '/log-processing/enrich-export/explorer/complete-log-enrichment',
            to: '/log-processing/enrich-export/complete-log-enrichment',
          },

          // integrations/splunk-edge-processing missing troubleshooting page
          {
            from: '/integrations/splunk-edge-processing/troubleshooting',
            to: '/integrations/splunk-edge-processing/',
          },

          // =====================================================
          // /examples/* paths: Redirect to actual example pages
          // =====================================================
          {
            from: '/examples/data-routing/content-routing',
            to: '/data-routing/content-routing/',
          },
          {
            from: '/examples/data-routing/circuit-breakers',
            to: '/data-routing/circuit-breakers/',
          },
          {
            from: '/examples/data-security/encrypt-data',
            to: '/data-security/encrypt-data/',
          },
          {
            from: '/examples/data-security/enforce-schema',
            to: '/data-security/enforce-schema/',
          },
          {
            from: '/examples/data-security/remove-pii',
            to: '/data-security/remove-pii/',
          },
          {
            from: '/examples/data-transformation/parse-logs',
            to: '/data-transformation/parse-logs/',
          },

          // =====================================================
          // YAML file paths: Redirect to example pages with explorer
          // =====================================================
          {
            from: '/examples/data-security/encryption-patterns-complete.yaml',
            to: '/data-security/encryption-patterns/explorer',
          },
          {
            from: '/examples/data-security/enforce-schema-complete.yaml',
            to: '/data-security/enforce-schema/explorer',
          },
          {
            from: '/examples/data-security/remove-pii-complete.yaml',
            to: '/data-security/remove-pii/explorer',
          },
          {
            from: '/examples/data-routing/content-routing.yaml',
            to: '/data-routing/content-routing/explorer',
          },
          {
            from: '/examples/data-routing/smart-buffering.yaml',
            to: '/data-routing/smart-buffering/explorer',
          },
          {
            from: '/examples/data-routing/fan-out-pattern.yaml',
            to: '/data-routing/fan-out-pattern/explorer',
          },
          {
            from: '/examples/data-routing/step-3-multi-level-fallback.yaml',
            to: '/data-routing/circuit-breakers/explorer',
          },
          {
            from: '/examples/data-transformation/parse-logs-complete.yaml',
            to: '/data-transformation/parse-logs/explorer',
          },
          {
            from: '/examples/data-transformation/transform-formats-complete.yaml',
            to: '/data-transformation/transform-formats/explorer',
          },
          {
            from: '/examples/data-transformation/normalize-timestamps-complete.yaml',
            to: '/data-transformation/normalize-timestamps/explorer',
          },
          {
            from: '/examples/log-processing/enrich-export-complete.yaml',
            to: '/log-processing/enrich-export/explorer',
          },
          {
            from: '/examples/log-processing/production-pipeline-complete.yaml',
            to: '/log-processing/production-pipeline/explorer',
          },

          // =====================================================
          // /files/* paths: Redirect to explorer pages (sample data)
          // =====================================================
          {
            from: '/files/data-security/remove-pii/sample-data.json',
            to: '/data-security/remove-pii/explorer',
          },
          {
            from: '/files/data-security/enforce-schema-complete.yaml',
            to: '/data-security/enforce-schema/explorer',
          },
        ],
      } satisfies RedirectOptions,
    ],
  ],

  themeConfig: {
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
      additionalLanguages: [
        'yaml',
        'bash',
        'json',
        'typescript',
        'javascript',
        'docker',
        'nginx',
        'sql',
      ],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
