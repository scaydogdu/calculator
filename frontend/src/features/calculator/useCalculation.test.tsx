import { act, renderHook, waitFor } from '@testing-library/react';
import { onlineManager } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, type CalculateFn, type CalculateResponse } from '../../api/calculator';
import { createQueryClient } from '../../queryClient';
import { createQueryWrapper } from '../../test/query';
import type { KeypadState } from './keypadReducer';
import { useCalculation } from './useCalculation';

const sum: CalculateResponse = { operation: 'add', operands: [2, 3], result: 5 };
const request: NonNullable<KeypadState['pending']> = { operation: 'add', operands: [2, 3], label: '2 + 3', then: null };
function setup(calculate: CalculateFn, pending: KeypadState['pending'] = request, client = createQueryClient()) {
  return {
    client,
    ...renderHook(({ pending }: { pending: KeypadState['pending'] }) => useCalculation(pending, calculate), {
      initialProps: { pending }, wrapper: createQueryWrapper(client),
    }),
  };
}

afterEach(() => {
  onlineManager.setOnline(true);
  vi.useRealTimers();
});

describe('calculation queries', () => {
  it('does not calculate before an operation is submitted', () => {
    const calculate = vi.fn();
    const { result } = setup(calculate, null);
    expect(result.current.fetchStatus).toBe('idle');
    expect(calculate).not.toHaveBeenCalled();
  });

  it('caches by operation and operands and reuses equivalent requests', async () => {
    const calculate = vi.fn().mockResolvedValueOnce(sum)
      .mockResolvedValueOnce({ operation: 'multiply', operands: [2, 3], result: 6 })
      .mockResolvedValueOnce({ operation: 'add', operands: [3, 2], result: 5 });
    const { result, rerender, client } = setup(calculate);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.getQueryData(['calculator', 'add', [2, 3]])).toEqual(sum);
    rerender({ pending: null });
    rerender({ pending: { ...request, operands: [2, 3] } });
    expect(result.current.data).toEqual(sum);
    expect(calculate).toHaveBeenCalledTimes(1);
    rerender({ pending: { ...request, operation: 'multiply' } });
    await waitFor(() => expect(result.current.data?.result).toBe(6));
    rerender({ pending: { ...request, operands: [3, 2] } });
    await waitFor(() => expect(result.current.data?.operands).toEqual([3, 2]));
    expect(calculate).toHaveBeenCalledTimes(3);
  });

  it('shares an in-flight query and cancels only after the last observer leaves', () => {
    const calculate = vi.fn<CalculateFn>(() => new Promise<CalculateResponse>(() => {}));
    const client = createQueryClient();
    const first = setup(calculate, request, client);
    const second = setup(calculate, request, client);
    expect(calculate).toHaveBeenCalledOnce();
    first.unmount();
    expect(calculate.mock.calls[0]).toBeDefined();
    const signal = calculate.mock.calls[0][2]!;
    expect(signal.aborted).toBe(false);
    second.unmount();
    expect(signal.aborted).toBe(true);
    client.clear();
  });

  it('does not retry domain errors and allows resubmitting a failed key', async () => {
    const error = new ApiError('division_by_zero', 'division by zero', 422);
    const calculate = vi.fn().mockRejectedValueOnce(error).mockResolvedValueOnce(sum);
    const { result, rerender } = setup(calculate);
    await waitFor(() => expect(result.current.error).toBe(error));
    expect(calculate).toHaveBeenCalledOnce();
    rerender({ pending: null });
    rerender({ pending: request });
    await waitFor(() => expect(result.current.data).toEqual(sum));
    expect(calculate).toHaveBeenCalledTimes(2);
  });

  it.each([
    new ApiError('network_error', 'offline', 0),
    new ApiError('internal_error', 'unavailable', 503),
  ])('retries a transient failure once: %s', async (error) => {
    const calculate = vi.fn().mockRejectedValueOnce(error).mockResolvedValueOnce(sum);
    const { result } = setup(calculate);
    await waitFor(() => expect(result.current.data).toEqual(sum));
    expect(calculate).toHaveBeenCalledTimes(2);
  });

  it('cancels on clear and prevents late results from entering the cache', async () => {
    let finish!: (value: CalculateResponse) => void;
    const calculate = vi.fn<CalculateFn>(() => new Promise<CalculateResponse>((resolve) => { finish = resolve; }));
    const { result, rerender, client } = setup(calculate);
    rerender({ pending: null });
    expect(calculate.mock.calls[0][2]?.aborted).toBe(true);
    await act(async () => finish(sum));
    expect(result.current.data).toBeUndefined();
    expect(result.current.error).toBeNull();
    expect(client.getQueryData(['calculator', 'add', [2, 3]])).toBeUndefined();
  });

  it('automatically cancels a superseded query', async () => {
    let finish!: (value: CalculateResponse) => void;
    const calculate = vi.fn().mockImplementationOnce(() => new Promise<CalculateResponse>((resolve) => { finish = resolve; }))
      .mockResolvedValueOnce({ operation: 'sqrt', operands: [9], result: 3 });
    const { result, rerender } = setup(calculate);
    rerender({ pending: { ...request, operation: 'sqrt', operands: [9] } });
    expect(calculate.mock.calls[0][2].aborted).toBe(true);
    await waitFor(() => expect(result.current.data?.result).toBe(3));
    await act(async () => finish(sum));
    expect(result.current.data?.result).toBe(3);
  });

  it('pauses offline and resumes the request when connectivity returns', async () => {
    onlineManager.setOnline(false);
    const calculate = vi.fn().mockResolvedValue(sum);
    const { result } = setup(calculate);
    expect(result.current.fetchStatus).toBe('paused');
    expect(calculate).not.toHaveBeenCalled();
    act(() => onlineManager.setOnline(true));
    await waitFor(() => expect(result.current.data).toEqual(sum));
    expect(calculate).toHaveBeenCalledOnce();
  });

  it('surfaces the deadline without retrying or accepting a late result', async () => {
    vi.useFakeTimers();
    let finish!: (value: CalculateResponse) => void;
    const calculate = vi.fn().mockImplementation(() => new Promise<CalculateResponse>((resolve) => { finish = resolve; }));
    const { result, client } = setup(calculate);
    await act(async () => { await vi.advanceTimersByTimeAsync(20_001); });
    expect(result.current.error).toMatchObject({ code: 'request_timeout' });
    expect(calculate.mock.calls[0][2].aborted).toBe(true);
    await act(async () => finish(sum));
    expect(result.current.data).toBeUndefined();
    expect(calculate).toHaveBeenCalledOnce();
    client.clear();
  });
});
