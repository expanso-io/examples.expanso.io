import type { PluginModule } from '@docusaurus/types';
import { EXAMPLE_RECORDS } from '../src/catalog/registry';

export type NavigationLink = { href: string; title: string };
export type FamilyNavigationData = Record<
  string,
  {
    title: string;
    status?: string;
    links: NavigationLink[];
  }
>;

const familyNavigation: PluginModule = () => ({
  name: 'examples-family-navigation',
  allContentLoaded({ allContent, actions }) {
    const versions =
      (
        allContent['docusaurus-plugin-content-docs']?.default as {
          loadedVersions?: {
            docs: {
              permalink: string;
              title: string;
              draft?: boolean;
              unlisted?: boolean;
            }[];
          }[];
        }
      )?.loadedVersions ?? [];
    const docs = versions
      .flatMap((version) => version.docs)
      .filter((doc) => !doc.draft && !doc.unlisted);
    const data: FamilyNavigationData = {};
    const rootLinks: NavigationLink[] = [];
    const assigned = new Set<string>();
    for (const record of EXAMPLE_RECORDS) {
      const family = docs.filter((doc) =>
        doc.permalink.startsWith(record.routes.overview)
      );
      if (!family.length) continue;
      rootLinks.push({ href: record.routes.overview, title: record.title });
      const links = family.map((doc) => ({
        href: doc.permalink,
        title: doc.title,
      }));
      for (const doc of family) assigned.add(doc.permalink);
      data[record.routes.overview] = {
        title: record.title,
        status: record.executionStatus.replaceAll('-', ' '),
        links,
      };
    }
    for (const doc of docs) {
      if (doc.permalink !== '/' && !assigned.has(doc.permalink))
        rootLinks.push({ href: doc.permalink, title: doc.title });
    }
    rootLinks.push({ href: '/tags/', title: 'Browse all topics' });
    data['/'] = { title: 'Example guides and resources', links: rootLinks };
    actions.setGlobalData(data);
  },
});
export default familyNavigation;
