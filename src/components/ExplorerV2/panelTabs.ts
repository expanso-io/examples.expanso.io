export type MobilePanelName = 'input' | 'output' | 'yaml';

export const mobilePanelTabs: ReadonlyArray<{
  id: MobilePanelName;
  label: string;
}> = [
  { id: 'input', label: 'Input' },
  { id: 'output', label: 'Output' },
  { id: 'yaml', label: 'Configuration' },
];

export function nextMobilePanel(
  currentPanel: MobilePanelName,
  key: string
): MobilePanelName | null {
  const currentIndex = mobilePanelTabs.findIndex(
    (panel) => panel.id === currentPanel
  );
  if (currentIndex < 0) return null;

  if (key === 'Home') return mobilePanelTabs[0].id;
  if (key === 'End') return mobilePanelTabs.at(-1)!.id;
  if (key === 'ArrowLeft') {
    return mobilePanelTabs[
      (currentIndex - 1 + mobilePanelTabs.length) % mobilePanelTabs.length
    ].id;
  }
  if (key === 'ArrowRight') {
    return mobilePanelTabs[(currentIndex + 1) % mobilePanelTabs.length].id;
  }
  return null;
}
