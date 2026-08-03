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
    useEditorStore.getState().setSelection({ type: 'feature', featureIds: ['feature-1'] });
    expect(useEditorStore.getState().selection).toEqual({ type: 'feature', featureIds: ['feature-1'] });

    useEditorStore.getState().setSelection(null);
    expect(useEditorStore.getState().selection).toBeNull();
  });

  it('toggles features into and out of the selection', () => {
    useEditorStore.getState().toggleFeatureSelection('feature-1');
    expect(useEditorStore.getState().selection).toEqual({ type: 'feature', featureIds: ['feature-1'] });

    useEditorStore.getState().toggleFeatureSelection('feature-2');
    expect(useEditorStore.getState().selection).toEqual({ type: 'feature', featureIds: ['feature-1', 'feature-2'] });

    useEditorStore.getState().toggleFeatureSelection('feature-1');
    expect(useEditorStore.getState().selection).toEqual({ type: 'feature', featureIds: ['feature-2'] });

    useEditorStore.getState().toggleFeatureSelection('feature-2');
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

  it('pops move history entries in LIFO order and returns undefined once empty', () => {
    expect(useEditorStore.getState().moveHistory).toEqual([]);

    const first = {
      featureId: 'feature-1',
      layerId: 'layer-1',
      previousGeometry: { type: 'Point', coordinates: [0, 0] } as GeoJSON.Geometry,
    };
    const second = {
      featureId: 'feature-2',
      layerId: 'layer-1',
      previousGeometry: { type: 'Point', coordinates: [1, 1] } as GeoJSON.Geometry,
    };
    useEditorStore.getState().pushMoveHistory(first);
    useEditorStore.getState().pushMoveHistory(second);
    expect(useEditorStore.getState().moveHistory).toEqual([first, second]);

    expect(useEditorStore.getState().popMoveHistory()).toEqual(second);
    expect(useEditorStore.getState().popMoveHistory()).toEqual(first);
    expect(useEditorStore.getState().popMoveHistory()).toBeUndefined();
  });

  it('caps move history at 50 entries, dropping the oldest', () => {
    for (let i = 0; i < 55; i++) {
      useEditorStore.getState().pushMoveHistory({
        featureId: `feature-${i}`,
        layerId: 'layer-1',
        previousGeometry: { type: 'Point', coordinates: [i, i] },
      });
    }
    const history = useEditorStore.getState().moveHistory;
    expect(history).toHaveLength(50);
    expect(history[0].featureId).toBe('feature-5');
    expect(history[49].featureId).toBe('feature-54');
  });
});
