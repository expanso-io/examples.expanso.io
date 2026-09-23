export const SITE_ORIGIN = 'https://examples.expanso.io';

export type SocialPage = {
  title: string;
  image: string;
  /** Crumbs between the site root and the page; absent means no breadcrumbs. */
  trail?: { name: string; path: string }[];
  /** The page's own crumb name, when it differs from the title. */
  crumb?: string;
};

/** Global data ships in the shared bundle for every page, so it omits the
 * constant root crumb and the page's own crumb and they are rebuilt here.
 */
export function socialBreadcrumbs(
  pathname: string,
  page: SocialPage
): { name: string; item: string }[] | undefined {
  if (!page.trail) return undefined;
  return [
    { name: 'Examples', path: '/' },
    ...page.trail,
    ...(pathname === '/'
      ? []
      : [{ name: page.crumb ?? page.title, path: pathname }]),
  ].map(({ name, path }) => ({ name, item: `${SITE_ORIGIN}${path}` }));
}
