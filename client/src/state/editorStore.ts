import { create } from 'zustand';

export type DrawMode = 'none' | 'point' | 'line' | 'polygon' | 'route';

export interface FeatureSelection {
  type: 'feature';
  featureId: string;
}

interface EditorState {
  activeLayerId: string | null;
  drawMode: DrawMode;
  selection: FeatureSelection | null;
  isLayerPanelOpen: boolean;
  hoveredFeatureId: string | null;
  setActiveLayerId: (layerId: string | null) => void;
  setDrawMode: (mode: DrawMode) => void;
  setSelection: (selection: FeatureSelection | null) => void;
  toggleLayerPanel: () => void;
  setHoveredFeatureId: (featureId: string | null) => void;
}

export const useEditorStore = create<EditorState>((set) => ({
  activeLayerId: null,
  drawMode: 'none',
  selection: null,
  isLayerPanelOpen: true,
  hoveredFeatureId: null,
  setActiveLayerId: (layerId) => set({ activeLayerId: layerId }),
  setDrawMode: (mode) => set({ drawMode: mode }),
  setSelection: (selection) => set({ selection }),
  toggleLayerPanel: () => set((state) => ({ isLayerPanelOpen: !state.isLayerPanelOpen })),
  setHoveredFeatureId: (featureId) => set({ hoveredFeatureId: featureId }),
}));
