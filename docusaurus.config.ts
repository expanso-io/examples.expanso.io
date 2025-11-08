import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

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
