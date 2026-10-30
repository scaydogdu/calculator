import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, type CalculateFn, type CalculateResponse } from '../../api/calculator';
import { useCalculator } from './useCalculator';

const sum: CalculateResponse = { operation: 'add', operands: [2, 3], result: 5 };
const never = () => new Promise<CalculateResponse>(() => {});
function setup(calculate: CalculateFn) {
  const hook = renderHook(() => useCalculator(calculate));
  const enterSum = () => {
    hook.result.current.send({ type: 'digit', digit: '2' });
    hook.result.current.send({ type: 'operator', op: 'add' });
    hook.result.current.send({ type: 'digit', digit: '3' });
    hook.result.current.send({ type: 'equals' });
  };
  return { ...hook, enterSum };
}
afterEach(() => vi.useRealTimers());

describe('event-driven calculator requests', () => {
  it('starts only on submission and sends repeated calculations to the backend', async () => {
    const calculate = vi.fn().mockResolvedValue(sum);
    const { result, enterSum } = setup(calculate);
    expect(calculate).not.toHaveBeenCalled();
    await act(async () => enterSum());
    expect(result.current.state.entry).toBe('5');
    act(() => result.current.send({ type: 'clear' }));
    await act(async () => enterSum());
    expect(calculate).toHaveBeenCalledTimes(2);
    expect(calculate).toHaveBeenLastCalledWith('add', [2, 3], expect.any(AbortSignal));
  });

  it('shows network errors immediately without retries or offline queuing', async () => {
    const calculate = vi.fn().mockRejectedValue(new ApiError('network_error', 'offline', 0));
    const { result, enterSum } = setup(calculate);
    await act(async () => enterSum());
    expect(result.current.state.error).toBe("Couldn't reach the calculator service. Try again.");
    expect(result.current.state.pending).toBeNull();
    expect(calculate).toHaveBeenCalledOnce();
  });

  it.each(['success', 'failure'] as const)('ignores a cancelled request\'s late %s after a new request', async (outcome) => {
    let finish!: (value: CalculateResponse) => void;
    let fail!: (reason: Error) => void;
    const calculate = vi.fn().mockImplementationOnce(() => new Promise<CalculateResponse>((resolve, reject) => { finish = resolve; fail = reject; }))
      .mockResolvedValueOnce({ operation: 'sqrt', operands: [9], result: 3 });
    const { result, enterSum } = setup(calculate);
    act(enterSum);
    act(() => result.current.send({ type: 'clear' }));
    expect(calculate.mock.calls[0][2].aborted).toBe(true);
    await act(async () => {
      result.current.send({ type: 'digit', digit: '9' });
      result.current.send({ type: 'sqrt' });
    });
    await act(async () => {
      if (outcome === 'success') finish(sum);
      else fail(new Error('late error'));
    });
    expect(result.current.state.entry).toBe('3');
    expect(result.current.state.error).toBeNull();
  });

  it('releases a stalled transport at the deadline and ignores its late result', async () => {
    vi.useFakeTimers();
    let finish!: (value: CalculateResponse) => void;
    const calculate = vi.fn().mockImplementationOnce(() => new Promise<CalculateResponse>((resolve) => { finish = resolve; })).mockResolvedValueOnce(sum);
    const { result, enterSum } = setup(calculate);
    act(enterSum);
    await act(async () => { await vi.advanceTimersByTimeAsync(19_999); });
    expect(result.current.state.pending).not.toBeNull();
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(calculate.mock.calls[0][2].aborted).toBe(true);
    expect(result.current.state.pending).toBeNull();
    expect(result.current.state.error).toContain('took too long');
    await act(async () => enterSum());
    await act(async () => finish({ ...sum, result: 999 }));
    expect(result.current.state.entry).toBe('5');
    expect(result.current.state.error).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('clears the deadline and aborts on unmount', async () => {
    vi.useFakeTimers();
    const calculate = vi.fn<CalculateFn>(never);
    const { unmount, enterSum } = setup(calculate);
    act(enterSum);
    unmount();
    expect(calculate.mock.calls[0][2]?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(['success', 'failure'] as const)('clears the deadline after %s', async (outcome) => {
    vi.useFakeTimers();
    const calculate = outcome === 'success' ? vi.fn().mockResolvedValue(sum) : vi.fn().mockRejectedValue(new Error('offline'));
    const { enterSum } = setup(calculate);
    await act(async () => enterSum());
    expect(vi.getTimerCount()).toBe(0);
    expect(calculate.mock.calls[0][2].aborted).toBe(false);
  });
});
