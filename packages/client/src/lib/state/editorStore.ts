import { create } from 'zustand';

export type DrawMode = 'none' | 'point' | 'line' | 'polygon' | 'route' | 'text';

export interface FeatureSelection {
  type: 'feature';
  // Always non-empty when `selection` itself is non-null — toggling the
  // last remaining id off collapses selection back to null (see
  // toggleFeatureSelection) rather than ever holding an empty array.
  featureIds: string[];
}

export interface MoveHistoryEntry {
  featureId: string;
  layerId: string;
  previousGeometry: GeoJSON.Geometry;
}

// Cap so a long editing session can't grow this unboundedly.
const MAX_MOVE_HISTORY = 50;

interface EditorState {
  activeLayerId: string | null;
  drawMode: DrawMode;
  selection: FeatureSelection | null;
  // Which layer's properties panel is open, if any. Independent of
  // activeLayerId (the draw target, auto-set to the first layer on load) —
  // this stays null until the user deliberately clicks a layer row, and is
  // mutually exclusive with a feature selection (see LayerPanel.tsx and
  // FeatureLayer.tsx, which clear one when the other is set).
  selectedLayerId: string | null;
  hoveredFeatureId: string | null;
  // Icon-by-value URLs that RemoteLayer failed to load onto the map (404,
  // no CORS support, etc). Lives here rather than as local state because
  // RemoteLayer (which does the loading) and LayerPropertiesPanel (which
  // needs to warn the user about it) are unrelated siblings under
  // MapEditorPage — see RemoteLayer.tsx and LayerPropertiesPanel.tsx.
  failedIconUrls: Set<string>;
  // Undo stack for feature drags (pin moves and line/polygon vertex drags) — see
  // pushMoveHistory/popMoveHistory. Read imperatively via getState() from the Ctrl+Z
  // keydown handler rather than subscribed to, so it doesn't need to trigger re-renders.
  moveHistory: MoveHistoryEntry[];
  setActiveLayerId: (layerId: string | null) => void;
  setDrawMode: (mode: DrawMode) => void;
  setSelection: (selection: FeatureSelection | null) => void;
  toggleFeatureSelection: (featureId: string) => void;
  setSelectedLayerId: (layerId: string | null) => void;
  setHoveredFeatureId: (featureId: string | null) => void;
  setFailedIconUrls: (urls: Set<string>) => void;
  pushMoveHistory: (entry: MoveHistoryEntry) => void;
  popMoveHistory: () => MoveHistoryEntry | undefined;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  activeLayerId: null,
  drawMode: 'none',
  selection: null,
  selectedLayerId: null,
  hoveredFeatureId: null,
  failedIconUrls: new Set(),
  moveHistory: [],
  setActiveLayerId: (layerId) => set({ activeLayerId: layerId }),
  setDrawMode: (mode) => set({ drawMode: mode }),
  setSelection: (selection) => set({ selection }),
  toggleFeatureSelection: (featureId) =>
    set((state) => {
      const current = state.selection?.type === 'feature' ? state.selection.featureIds : [];
      const next = current.includes(featureId)
        ? current.filter((id) => id !== featureId)
        : [...current, featureId];
      return { selection: next.length > 0 ? { type: 'feature', featureIds: next } : null };
    }),
  setSelectedLayerId: (layerId) => set({ selectedLayerId: layerId }),
  setHoveredFeatureId: (featureId) => set({ hoveredFeatureId: featureId }),
  setFailedIconUrls: (urls) => set({ failedIconUrls: urls }),
  pushMoveHistory: (entry) =>
    set((state) => ({ moveHistory: [...state.moveHistory, entry].slice(-MAX_MOVE_HISTORY) })),
  popMoveHistory: () => {
    const history = get().moveHistory;
    if (history.length === 0) return undefined;
    const entry = history[history.length - 1];
    set({ moveHistory: history.slice(0, -1) });
    return entry;
  },
}));
