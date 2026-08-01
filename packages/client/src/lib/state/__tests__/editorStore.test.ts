import { useEditorStore } from '../editorStore';

const initialState = useEditorStore.getState();

afterEach(() => {
  useEditorStore.setState(initialState, true);
});

describe('editorStore', () => {
  it('starts with no active layer, no draw mode, no selection, and the panel open', () => {
    const state = useEditorStore.getState();
    expect(state.activeLayerId).toBeNull();
    expect(state.drawMode).toBe('none');
    expect(state.selection).toBeNull();
    expect(state.isLayerPanelOpen).toBe(true);
  });

  it('sets the active layer id', () => {
    useEditorStore.getState().setActiveLayerId('layer-1');
    expect(useEditorStore.getState().activeLayerId).toBe('layer-1');

    useEditorStore.getState().setActiveLayerId(null);
    expect(useEditorStore.getState().activeLayerId).toBeNull();
  });

  it('sets the draw mode', () => {
    useEditorStore.getState().setDrawMode('polygon');
    expect(useEditorStore.getState().drawMode).toBe('polygon');
  });

  it('sets and clears the feature selection', () => {
    useEditorStore.getState().setSelection({ type: 'feature', featureId: 'feature-1' });
    expect(useEditorStore.getState().selection).toEqual({ type: 'feature', featureId: 'feature-1' });

    useEditorStore.getState().setSelection(null);
    expect(useEditorStore.getState().selection).toBeNull();
  });

  it('sets and clears the selected layer id, independent of selectedLayerId defaulting to null', () => {
    expect(useEditorStore.getState().selectedLayerId).toBeNull();

    useEditorStore.getState().setSelectedLayerId('layer-1');
    expect(useEditorStore.getState().selectedLayerId).toBe('layer-1');

    useEditorStore.getState().setSelectedLayerId(null);
    expect(useEditorStore.getState().selectedLayerId).toBeNull();
  });

  it('toggles the layer panel open state', () => {
    expect(useEditorStore.getState().isLayerPanelOpen).toBe(true);
    useEditorStore.getState().toggleLayerPanel();
    expect(useEditorStore.getState().isLayerPanelOpen).toBe(false);
    useEditorStore.getState().toggleLayerPanel();
    expect(useEditorStore.getState().isLayerPanelOpen).toBe(true);
  });
});
