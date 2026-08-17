import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Identifies each independently-collapsible sidebar panel header. 'properties'
// covers FeaturePropertiesPanel/BulkFeaturePropertiesPanel/PropertiesEmptyState
// together — they're mutually-exclusive siblings sharing one logical slot in
// MapEditorPage, so they share one persisted collapsed flag.
export type CollapsiblePanelId = 'baseLayer' | 'layers' | 'layerProperties' | 'properties';

interface PanelState {
  collapsed: Record<CollapsiblePanelId, boolean>;
  setCollapsed: (panel: CollapsiblePanelId, collapsed: boolean) => void;
}

const DEFAULT_COLLAPSED: Record<CollapsiblePanelId, boolean> = {
  baseLayer: false,
  layers: false,
  layerProperties: false,
  properties: false,
};

export const usePanelStore = create<PanelState>()(
  persist(
    (set) => ({
      collapsed: DEFAULT_COLLAPSED,
      setCollapsed: (panel, collapsed) =>
        set((state) => ({ collapsed: { ...state.collapsed, [panel]: collapsed } })),
    }),
    { name: 'mad-maps-panel-collapse' },
  ),
);
