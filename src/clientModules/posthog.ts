import { captureExampleEvent, capturePageView } from '@site/src/lib/analytics';

interface RouteUpdate {
  location: { pathname: string };
  previousLocation?: { pathname: string };
}

export function onRouteDidUpdate({
  location,
  previousLocation,
}: RouteUpdate): void {
  if (previousLocation?.pathname === location.pathname) return;
  void capturePageView(location.pathname);
}

export function onRouteUpdate(): void {
  // Docusaurus calls this before the DOM update. Page views are intentionally
  // captured in onRouteDidUpdate so the final document title is available.
}

if (typeof document !== 'undefined') {
  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const link = target.closest<HTMLAnchorElement>('a[href]');
    if (!link) return;

    const url = new URL(link.href, window.location.origin);
    if (!url.pathname.endsWith('.yaml') && !link.hasAttribute('download')) {
      return;
    }

    captureExampleEvent('example_yaml_opened', {
      asset_path: url.pathname,
    });
  });
}
