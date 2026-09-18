import React from 'react';
import Head from '@docusaurus/Head';
import { useLocation } from '@docusaurus/router';
import { usePluginData } from '@docusaurus/useGlobalData';

type Metadata = {
  title: string;
  image: string;
  breadcrumbs?: { name: string; item: string }[];
};
export default function SocialDiscovery() {
  const { pathname } = useLocation();
  const pages = usePluginData('examples-social-discovery') as Record<
    string,
    Metadata
  >;
  const page = pages[pathname.endsWith('/') ? pathname : `${pathname}/`];
  if (!page) return null;
  const image = `https://examples.expanso.io${page.image}`;
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
      {page.breadcrumbs && (
        <script type="application/ld+json">
          {JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: page.breadcrumbs.map((crumb, index) => ({
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
