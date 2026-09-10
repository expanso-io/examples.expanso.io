import React from 'react';
import Link from '@docusaurus/Link';
import OriginalFooter from '@theme-original/DocItem/Footer';
import { useLocation } from '@docusaurus/router';
import { usePluginData } from '@docusaurus/useGlobalData';
import type { FamilyNavigationData } from '../../../../plugins/family-navigation';
import styles from './styles.module.css';

export default function DocItemFooter() {
  const { pathname } = useLocation();
  const pages = usePluginData(
    'examples-family-navigation'
  ) as FamilyNavigationData;
  const route = pathname.endsWith('/') ? pathname : `${pathname}/`;
  const page =
    pages[route] ??
    Object.entries(pages).find(
      ([overview]) => overview !== '/' && route.startsWith(overview)
    )?.[1];
  return (
    <>
      {page && (
        <nav aria-label="Example guides" className="margin-top--lg">
          <h2>{page.title}</h2>
          {page.status && <p>Execution scope: {page.status}.</p>}
          <ul>
            {page.links.map((link) => (
              <li key={link.href}>
                <Link
                  to={link.href}
                  className={styles.guideLink}
                  aria-current={link.href === pathname ? 'page' : undefined}
                >
                  {link.title}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
      <OriginalFooter />
    </>
  );
}
