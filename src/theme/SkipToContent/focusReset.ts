export type NavigationAction = 'PUSH' | 'POP' | 'REPLACE';

export interface NavigationLocation {
  pathname: string;
  hash: string;
}

export interface FocusResetInput {
  action: NavigationAction;
  location: NavigationLocation;
  previousLocation: NavigationLocation | null;
}

/**
 * Docusaurus moves keyboard focus to the skip-to-content region after every
 * PUSH navigation without a hash. Focusing that region, which sits at the top
 * of the document, also scrolls the window to the top. Components that push
 * query-string state (the stage explorer's `?stage=`) stay on the same page,
 * so they must keep both focus and scroll where the reader left them.
 */
export function shouldResetFocusAfterNavigation({
  action,
  location,
  previousLocation,
}: FocusResetInput): boolean {
  if (action !== 'PUSH') return false;
  if (location.hash) return false;
  if (previousLocation === null) return false;
  return location.pathname !== previousLocation.pathname;
}
