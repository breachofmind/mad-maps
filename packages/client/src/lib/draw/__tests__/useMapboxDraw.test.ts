import { act, renderHook } from '@testing-library/react';

type Handler = (e: unknown) => void;

// Minimal stand-in for MapboxDraw itself — this test exercises useMapboxDraw's
// own mode-tracking/animation-gating wiring, not the real library's internal
// hot/cold layer-splitting behavior (verified separately against the real
// package).
class FakeMapboxDraw {
  changeMode = jest.fn();
  deleteAll = jest.fn();
  getMode = jest.fn(() => 'simple_select');
  getAll = jest.fn(() => ({ features: [] }));
  add = jest.fn();
  delete = jest.fn();
}

jest.mock('@mapbox/mapbox-gl-draw', () => ({ __esModule: true, default: FakeMapboxDraw }));
jest.mock('@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css', () => ({}), { virtual: true });
jest.mock('../../../components/draw/mapboxDrawOverrides.css', () => ({}), { virtual: true });

import { useMapboxDraw } from '../useMapboxDraw';
import { GL_DRAW_LINES_COLD_LAYER_ID, GL_DRAW_LINES_HOT_LAYER_ID } from '../drawTheme';

function createFakeMap() {
  const handlers: Record<string, Handler[]> = {};

  const map = {
    getContainer: jest.fn(() => document.createElement('div')),
    on: jest.fn((event: string, cb: Handler) => {
      (handlers[event] ??= []).push(cb);
    }),
    off: jest.fn((event: string, cb: Handler) => {
      handlers[event] = (handlers[event] ?? []).filter((h) => h !== cb);
    }),
    addControl: jest.fn(),
    removeControl: jest.fn(),
    getLayer: jest.fn(() => ({})),
    setPaintProperty: jest.fn(),
    dragPan: { enable: jest.fn(), disable: jest.fn(), isEnabled: jest.fn(() => true) },
  };

  function fire(event: string, payload: unknown) {
    (handlers[event] ?? []).forEach((h) => h(payload));
  }

  return { map, fire };
}

function opacityCallsFor(map: ReturnType<typeof createFakeMap>['map'], layerId: string) {
  return map.setPaintProperty.mock.calls.filter((call) => call[0] === layerId && call[1] === 'line-opacity');
}

describe('useMapboxDraw pulse-opacity gating', () => {
  // Regression test: mapbox-gl-draw's public changeMode() is silent by
  // default (suppressAPIEvents defaults to true internally), so it never
  // fires 'draw.modechange' for calls this hook makes itself via setMode().
  // FakeMapboxDraw's changeMode is a plain no-op mock, matching that —
  // it doesn't fire any event, so this test only passes if setMode()
  // updates the animation-gating state directly rather than waiting on an
  // event that mapbox-gl-draw would never actually send for this call.
  it('setMode() activates the pulse itself, without depending on a draw.modechange event', () => {
    jest.useFakeTimers();
    try {
      const { map } = createFakeMap();
      const { result } = renderHook(() => useMapboxDraw({ map: map as never, onCreate: jest.fn() }));

      act(() => {
        result.current.setMode('draw_line_string');
      });
      act(() => {
        jest.advanceTimersByTime(2000);
      });

      // Both the "hot" and "cold" runtime layers are pulsed together (see
      // drawTheme.ts's GL_DRAW_LINES_HOT/COLD_LAYER_ID comment) — mapbox-gl-
      // draw can bucket the same in-progress feature into either one from
      // one render tick to the next, so pulsing just one would leave the
      // other showing a second, static copy.
      expect(opacityCallsFor(map, GL_DRAW_LINES_HOT_LAYER_ID).length).toBeGreaterThanOrEqual(2);
      expect(opacityCallsFor(map, GL_DRAW_LINES_COLD_LAYER_ID).length).toBeGreaterThanOrEqual(2);
    } finally {
      jest.useRealTimers();
    }
  });

  it('setMode() back to simple_select stops the pulse and restores full opacity on both layers', () => {
    jest.useFakeTimers();
    try {
      const { map } = createFakeMap();
      const { result } = renderHook(() => useMapboxDraw({ map: map as never, onCreate: jest.fn() }));

      act(() => {
        result.current.setMode('draw_polygon');
        jest.advanceTimersByTime(2000);
      });
      map.setPaintProperty.mockClear();

      act(() => {
        result.current.setMode('simple_select');
      });

      expect(map.setPaintProperty).toHaveBeenCalledWith(GL_DRAW_LINES_HOT_LAYER_ID, 'line-opacity', 1);
      expect(map.setPaintProperty).toHaveBeenCalledWith(GL_DRAW_LINES_COLD_LAYER_ID, 'line-opacity', 1);

      map.setPaintProperty.mockClear();
      act(() => {
        jest.advanceTimersByTime(2000);
      });
      expect(map.setPaintProperty).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it('pulses both gl-draw-lines hot and cold layers while in draw_line_string mode', () => {
    jest.useFakeTimers();
    try {
      const { map, fire } = createFakeMap();
      renderHook(() => useMapboxDraw({ map: map as never, onCreate: jest.fn() }));

      act(() => {
        fire('draw.modechange', { mode: 'draw_line_string' });
      });
      act(() => {
        jest.advanceTimersByTime(2000);
      });

      expect(opacityCallsFor(map, GL_DRAW_LINES_HOT_LAYER_ID).length).toBeGreaterThanOrEqual(2);
      expect(opacityCallsFor(map, GL_DRAW_LINES_COLD_LAYER_ID).length).toBeGreaterThanOrEqual(2);
    } finally {
      jest.useRealTimers();
    }
  });

  it('pulses while in draw_polygon mode too', () => {
    jest.useFakeTimers();
    try {
      const { map, fire } = createFakeMap();
      renderHook(() => useMapboxDraw({ map: map as never, onCreate: jest.fn() }));

      act(() => {
        fire('draw.modechange', { mode: 'draw_polygon' });
      });
      act(() => {
        jest.advanceTimersByTime(2000);
      });

      expect(map.setPaintProperty).toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it('does not pulse in simple_select or direct_select', () => {
    jest.useFakeTimers();
    try {
      const { map, fire } = createFakeMap();
      renderHook(() => useMapboxDraw({ map: map as never, onCreate: jest.fn() }));

      act(() => {
        fire('draw.modechange', { mode: 'direct_select' });
        jest.advanceTimersByTime(2000);
      });
      expect(map.setPaintProperty).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it('restores full opacity on both layers once drawing stops', () => {
    jest.useFakeTimers();
    try {
      const { map, fire } = createFakeMap();
      renderHook(() => useMapboxDraw({ map: map as never, onCreate: jest.fn() }));

      act(() => {
        fire('draw.modechange', { mode: 'draw_line_string' });
        jest.advanceTimersByTime(2000);
      });
      map.setPaintProperty.mockClear();

      act(() => {
        fire('draw.modechange', { mode: 'simple_select' });
      });

      expect(map.setPaintProperty).toHaveBeenCalledWith(GL_DRAW_LINES_HOT_LAYER_ID, 'line-opacity', 1);
      expect(map.setPaintProperty).toHaveBeenCalledWith(GL_DRAW_LINES_COLD_LAYER_ID, 'line-opacity', 1);
    } finally {
      jest.useRealTimers();
    }
  });
});
