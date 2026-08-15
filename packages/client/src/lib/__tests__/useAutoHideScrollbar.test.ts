import { act, renderHook } from '@testing-library/react';
import { useAutoHideScrollbar } from '../useAutoHideScrollbar';

describe('useAutoHideScrollbar', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('starts not scrolling', () => {
    const { result } = renderHook(() => useAutoHideScrollbar());
    expect(result.current.isScrolling).toBe(false);
  });

  it('sets isScrolling true on scroll and false again after the hide delay', () => {
    const { result } = renderHook(() => useAutoHideScrollbar());

    act(() => result.current.onScroll());
    expect(result.current.isScrolling).toBe(true);

    act(() => jest.advanceTimersByTime(799));
    expect(result.current.isScrolling).toBe(true);

    act(() => jest.advanceTimersByTime(1));
    expect(result.current.isScrolling).toBe(false);
  });

  it('resets the hide timer on each new scroll event instead of stacking them', () => {
    const { result } = renderHook(() => useAutoHideScrollbar());

    act(() => result.current.onScroll());
    act(() => jest.advanceTimersByTime(500));
    act(() => result.current.onScroll());
    act(() => jest.advanceTimersByTime(500));

    // 1000ms since the first scroll, but only 500ms since the second — still scrolling.
    expect(result.current.isScrolling).toBe(true);

    act(() => jest.advanceTimersByTime(300));
    expect(result.current.isScrolling).toBe(false);
  });
});
