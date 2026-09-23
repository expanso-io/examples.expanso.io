import React from 'react';
import Head from '@docusaurus/Head';
import { useLocation } from '@docusaurus/router';
import { usePluginData } from '@docusaurus/useGlobalData';
import {
  SITE_ORIGIN,
  socialBreadcrumbs,
  type SocialPage,
} from '../lib/socialBreadcrumbs';

export default function SocialDiscovery() {
  const { pathname } = useLocation();
  const pages = usePluginData('examples-social-discovery') as Record<
    string,
    SocialPage
  >;
  const path = pathname.endsWith('/') ? pathname : `${pathname}/`;
  const page = pages[path];
  if (!page) return null;
  const image = `${SITE_ORIGIN}${page.image}`;
  const breadcrumbs = socialBreadcrumbs(path, page);
  return (
    <Head>
      <meta property="og:image" content={image} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta
        property="og:image:alt"
        content={`${page.title} — Expanso pipeline examples`}
      />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:image" content={image} />
      <meta
        name="twitter:image:alt"
        content={`${page.title} — Expanso pipeline examples`}
      />
      {breadcrumbs && (
        <script type="application/ld+json">
          {JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: breadcrumbs.map((crumb, index) => ({
              '@type': 'ListItem',
              position: index + 1,
              ...crumb,
            })),
          }).replace(/</g, '\\u003c')}
        </script>
      )}
    </Head>
  );
}
