import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ApiError, type CalculateResponse } from '../../api/calculator';
import { useCalculation } from './useCalculation';

const sum: CalculateResponse = { operation: 'add', operands: [2, 3], result: 5 };

describe('useCalculation request lifetime', () => {
  it('returns results without maintaining a duplicate UI state or rerendering', async () => {
    let renders = 0;
    const calculate = vi.fn().mockResolvedValue(sum);
    const { result } = renderHook(() => { renders += 1; return useCalculation(calculate); });
    let outcome: unknown;
    await act(async () => { outcome = await result.current.run('add', [2, 3]); });
    expect(outcome).toEqual({ status: 'success', result: sum });
    expect(renders).toBe(1);
  });
  it('returns errors for the component to present', async () => {
    const error = new ApiError('division_by_zero', 'division by zero', 422);
    const calculate = vi.fn().mockRejectedValue(error);
    const { result } = renderHook(() => useCalculation(calculate));
    expect(await result.current.run('divide', [1, 0])).toEqual({ status: 'error', error });
  });
  it('suppresses the outcome of a superseded request', async () => {
    let finish!: (value: CalculateResponse) => void;
    const calculate = vi.fn().mockImplementationOnce(() => new Promise<CalculateResponse>((resolve) => { finish = resolve; })).mockResolvedValueOnce(sum);
    const { result } = renderHook(() => useCalculation(calculate));
    const first = result.current.run('multiply', [9, 9]);
    expect(await result.current.run('add', [2, 3])).toEqual({ status: 'success', result: sum });
    finish({ operation: 'multiply', operands: [9, 9], result: 81 });
    expect(await first).toBeUndefined();
    expect(calculate.mock.calls[0][2].aborted).toBe(true);
  });
  it('reset aborts pending work and suppresses a late failure', async () => {
    let fail!: (reason: Error) => void;
    const calculate = vi.fn().mockImplementation(() => new Promise<CalculateResponse>((_, reject) => { fail = reject; }));
    const { result } = renderHook(() => useCalculation(calculate));
    const pending = result.current.run('add', [2, 3]);
    act(() => result.current.reset());
    fail(new Error('late failure'));
    expect(await pending).toBeUndefined();
    expect(calculate.mock.calls[0][2].aborted).toBe(true);
  });
});


describe('request deadline cleanup', () => {
  it.each(['success', 'failure'] as const)('clears the deadline after %s', async (outcome) => {
    vi.useFakeTimers();
    try {
      const calculate = outcome === 'success' ? vi.fn().mockResolvedValue(sum) : vi.fn().mockRejectedValue(new Error('offline'));
      const { result } = renderHook(() => useCalculation(calculate));
      await result.current.run('add', [2, 3]);
      expect(vi.getTimerCount()).toBe(0);
      await vi.advanceTimersByTimeAsync(20_000);
      expect(calculate.mock.calls[0][2].aborted).toBe(false);
    } finally { vi.useRealTimers(); }
  });

  it('settles an abandoned request and clears its deadline on unmount', async () => {
    vi.useFakeTimers();
    try {
      const calculate = vi.fn(() => new Promise<CalculateResponse>(() => {}));
      const { result, unmount } = renderHook(() => useCalculation(calculate));
      const pending = result.current.run('add', [2, 3]);
      unmount();
      let settled = false;
      void pending.then(() => { settled = true; });
      await vi.advanceTimersByTimeAsync(20_000);
      expect(settled).toBe(true);
      expect(await pending).toBeUndefined();
      expect(vi.getTimerCount()).toBe(0);
    } finally { vi.useRealTimers(); }
  });
});
