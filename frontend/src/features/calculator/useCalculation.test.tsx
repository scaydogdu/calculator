import { act, renderHook as rtlRenderHook } from '@testing-library/react';
import { createQueryWrapper } from '../../test/query';
import { createQueryClient } from '../../queryClient';
import { onlineManager } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { ApiError, type CalculateResponse } from '../../api/calculator';
import { useCalculation } from './useCalculation';

const sum: CalculateResponse = { operation: 'add', operands: [2, 3], result: 5 };
const renderHook = <T,>(hook: () => T) => rtlRenderHook(hook, { wrapper: createQueryWrapper() });

describe('useCalculation request lifetime', () => {
  it('returns results through a Query mutation', async () => {
    const calculate = vi.fn().mockResolvedValue(sum);
    const { result } = renderHook(() => useCalculation(calculate));
    let outcome: unknown;
    await act(async () => { outcome = await result.current.run('add', [2, 3]); });
    expect(outcome).toEqual({ status: 'success', result: sum });
    expect(calculate).toHaveBeenCalledOnce();
  });
  it('returns errors for the component to present', async () => {
    const error = new ApiError('division_by_zero', 'division by zero', 422);
    const calculate = vi.fn().mockRejectedValue(error);
    const { result } = renderHook(() => useCalculation(calculate));
    await act(async () => {
      expect(await result.current.run('divide', [1, 0])).toEqual({ status: 'error', error });
    });
  });
  it('suppresses the outcome of a superseded request', async () => {
    let finish!: (value: CalculateResponse) => void;
    const calculate = vi.fn().mockImplementationOnce(() => new Promise<CalculateResponse>((resolve) => { finish = resolve; })).mockResolvedValueOnce(sum);
    const { result } = renderHook(() => useCalculation(calculate));
    await act(async () => {
      const first = result.current.run('multiply', [9, 9]);
      // Mutations start asynchronously; let the first transport begin.
      await Promise.resolve();
      expect(await result.current.run('add', [2, 3])).toEqual({ status: 'success', result: sum });
      finish({ operation: 'multiply', operands: [9, 9], result: 81 });
      expect(await first).toBeUndefined();
    });
    expect(calculate.mock.calls[0][2].aborted).toBe(true);
  });
  it('reset aborts pending work and suppresses a late failure', async () => {
    let fail!: (reason: Error) => void;
    const calculate = vi.fn().mockImplementation(() => new Promise<CalculateResponse>((_, reject) => { fail = reject; }));
    const { result } = renderHook(() => useCalculation(calculate));
    const pending = result.current.run('add', [2, 3]);
    await act(async () => { await Promise.resolve(); });
    act(() => result.current.reset());
    fail(new Error('late failure'));
    expect(await pending).toBeUndefined();
    expect(calculate.mock.calls[0][2].aborted).toBe(true);
  });
});

describe('Query mutation integration', () => {
  it('records an in-flight cancellation as AbortError, not a timeout', async () => {
    const client = createQueryClient();
    const calculate = vi.fn(() => new Promise<CalculateResponse>(() => {}));
    const { result } = rtlRenderHook(() => useCalculation(calculate), { wrapper: createQueryWrapper(client) });
    await act(async () => {
      const pending = result.current.run('add', [2, 3]);
      await Promise.resolve();
      const mutation = client.getMutationCache().getAll()[0];
      result.current.reset();
      expect(await pending).toBeUndefined();
      expect(mutation.state.error).toMatchObject({ name: 'AbortError' });
    });
    client.clear();
  });

  it('records success and errors in Query without retrying failed calculations', async () => {
    const client = createQueryClient();
    const error = new ApiError('division_by_zero', 'division by zero', 422);
    const calculate = vi.fn().mockResolvedValueOnce(sum).mockRejectedValueOnce(error);
    const { result, unmount } = rtlRenderHook(() => useCalculation(calculate), { wrapper: createQueryWrapper(client) });
    await act(async () => { await result.current.run('add', [2, 3]); });
    expect(client.getMutationCache().getAll().at(-1)?.state).toMatchObject({ status: 'success', data: sum });
    await act(async () => { await result.current.run('divide', [1, 0]); });
    expect(client.getMutationCache().getAll().at(-1)?.state).toMatchObject({ status: 'error', error });
    expect(calculate).toHaveBeenCalledTimes(2);
    act(() => result.current.reset());
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
    expect(client.getMutationCache().getAll()).toHaveLength(0);
    unmount();
    client.clear();
  });

  it('attempts requests while offline instead of leaving the keypad paused', async () => {
    onlineManager.setOnline(false);
    try {
      const error = new ApiError('network_error', 'offline', 0);
      const calculate = vi.fn().mockRejectedValue(error);
      const { result } = renderHook(() => useCalculation(calculate));
      await act(async () => {
        expect(await result.current.run('add', [2, 3])).toEqual({ status: 'error', error });
      });
      expect(calculate).toHaveBeenCalledOnce();
    } finally {
      onlineManager.setOnline(true);
    }
  });

  it('can clear a mutation before its transport starts', async () => {
    const calculate = vi.fn().mockResolvedValue(sum);
    const { result } = renderHook(() => useCalculation(calculate));
    await act(async () => {
      const pending = result.current.run('add', [2, 3]);
      result.current.reset();
      expect(await pending).toBeUndefined();
    });
    expect(calculate).not.toHaveBeenCalled();
  });
});


describe('request deadline cleanup', () => {
  it.each(['success', 'failure'] as const)('clears the deadline after %s', async (outcome) => {
    vi.useFakeTimers();
    try {
      const calculate = outcome === 'success' ? vi.fn().mockResolvedValue(sum) : vi.fn().mockRejectedValue(new Error('offline'));
      const { result } = renderHook(() => useCalculation(calculate));
      await act(async () => {
        await result.current.run('add', [2, 3]);
        // Flush Query observer notifications and immediate cache collection.
        await vi.advanceTimersByTimeAsync(0);
      });
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
