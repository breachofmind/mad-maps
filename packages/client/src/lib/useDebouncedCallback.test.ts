import { renderHook } from '@testing-library/react';
import { useDebouncedCallback } from './useDebouncedCallback';

describe('useDebouncedCallback', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('only invokes the callback once after the delay, using the latest args', () => {
    const callback = jest.fn();
    const { result } = renderHook(() => useDebouncedCallback(callback, 300));

    result.current('first');
    result.current('second');
    result.current('third');

    expect(callback).not.toHaveBeenCalled();

    jest.advanceTimersByTime(300);

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith('third');
  });

  it('uses the latest version of the callback even if it changes between calls', () => {
    const first = jest.fn();
    const second = jest.fn();
    const { result, rerender } = renderHook(({ cb }) => useDebouncedCallback(cb, 300), {
      initialProps: { cb: first },
    });

    result.current('x');
    rerender({ cb: second });
    jest.advanceTimersByTime(300);

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith('x');
  });
});
