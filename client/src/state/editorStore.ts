import { create } from 'zustand';

export type DrawMode = 'none' | 'point' | 'line' | 'polygon';

export interface FeatureSelection {
  type: 'feature';
  featureId: string;
}

interface EditorState {
  activeLayerId: string | null;
  drawMode: DrawMode;
  selection: FeatureSelection | null;
  isLayerPanelOpen: boolean;
  setActiveLayerId: (layerId: string | null) => void;
  setDrawMode: (mode: DrawMode) => void;
  setSelection: (selection: FeatureSelection | null) => void;
  toggleLayerPanel: () => void;
}

export const useEditorStore = create<EditorState>((set) => ({
  activeLayerId: null,
  drawMode: 'none',
  selection: null,
  isLayerPanelOpen: true,
  setActiveLayerId: (layerId) => set({ activeLayerId: layerId }),
  setDrawMode: (mode) => set({ drawMode: mode }),
  setSelection: (selection) => set({ selection }),
  toggleLayerPanel: () => set((state) => ({ isLayerPanelOpen: !state.isLayerPanelOpen })),
}));
