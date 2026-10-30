import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, type CalculateFn, type CalculateResponse } from '../../api/calculator';
import { useCalculator } from './useCalculator';

const sum: CalculateResponse = { result: 5 };
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
    expect(calculate).toHaveBeenLastCalledWith({ operands: [2, 3], operators: ['add'] }, expect.any(AbortSignal));
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
    expect(calculate.mock.calls[0][1].aborted).toBe(true);
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
    expect(calculate.mock.calls[0][1].aborted).toBe(true);
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
    expect(calculate.mock.calls[0][1]?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(['success', 'failure'] as const)('clears the deadline after %s', async (outcome) => {
    vi.useFakeTimers();
    const calculate = outcome === 'success' ? vi.fn().mockResolvedValue(sum) : vi.fn().mockRejectedValue(new Error('offline'));
    const { enterSum } = setup(calculate);
    await act(async () => enterSum());
    expect(vi.getTimerCount()).toBe(0);
    expect(calculate.mock.calls[0][1].aborted).toBe(false);
  });
});

describe('queued input', () => {
  function continuation(send: (action: import('./keypadReducer').InputAction) => void) {
    send({ type: 'operator', op: 'multiply' });
    send({ type: 'digit', digit: '2' });
    send({ type: 'equals' });
  }
  it('replays multiple continuations in order across successive requests', async () => {
    const finishes: ((value: CalculateResponse) => void)[] = [];
    const calculate = vi.fn(() => new Promise<CalculateResponse>(resolve => finishes.push(resolve)));
    const { result, enterSum } = setup(calculate);
    act(() => { enterSum(); continuation(result.current.send); continuation(result.current.send); });
    expect(calculate).toHaveBeenCalledOnce();
    await act(async () => finishes[0]({ result: 5 }));
    expect(calculate).toHaveBeenNthCalledWith(2, { operands: [5, 2], operators: ['multiply'] }, expect.any(AbortSignal));
    await act(async () => finishes[1]({ result: 10 }));
    expect(calculate).toHaveBeenNthCalledWith(3, { operands: [10, 2], operators: ['multiply'] }, expect.any(AbortSignal));
    await act(async () => finishes[2]({ result: 20 }));
    expect(result.current.state.entry).toBe('20');
  });
  it('replays input after a unary request without dropping its expression', async () => {
    let finish!: (value: CalculateResponse) => void;
    const calculate = vi.fn().mockImplementationOnce(() => new Promise<CalculateResponse>(resolve => { finish = resolve; })).mockResolvedValueOnce({ result: 7 });
    const { result } = setup(calculate);
    act(() => {
      result.current.send({ type: 'digit', digit: '9' });
      result.current.send({ type: 'operator', op: 'add' });
      result.current.send({ type: 'sqrt' });
      result.current.send({ type: 'digit', digit: '4' });
      result.current.send({ type: 'equals' });
    });
    await act(async () => finish({ result: 3 }));
    expect(calculate).toHaveBeenLastCalledWith({ operands: [3, 4], operators: ['add'] }, expect.any(AbortSignal));
    expect(result.current.state.entry).toBe('7');
  });
  it.each(['clear', 'failure', 'timeout', 'unmount'] as const)('discards queued input on %s', async outcome => {
    vi.useFakeTimers();
    let finish!: (value: CalculateResponse) => void;
    let fail!: (error: Error) => void;
    const calculate = vi.fn(() => new Promise<CalculateResponse>((resolve, reject) => { finish = resolve; fail = reject; }));
    const { result, enterSum, unmount } = setup(calculate);
    act(() => { enterSum(); continuation(result.current.send); });
    await act(async () => {
      if (outcome === 'clear') result.current.send({ type: 'clear' });
      if (outcome === 'failure') fail(new Error('offline'));
      if (outcome === 'timeout') await vi.advanceTimersByTimeAsync(20_000);
      if (outcome === 'unmount') unmount();
    });
    await act(async () => finish(sum));
    expect(calculate).toHaveBeenCalledOnce();
    if (outcome !== 'unmount') {
      expect(result.current.state.pending).toBeNull();
      if (outcome === 'clear') expect(result.current.state.entry).toBe('0');
      else expect(result.current.state.error).toContain('Queued input was discarded.');
      // A later valid request must not replay the discarded continuation.
      await act(async () => enterSum());
      await act(async () => finish(sum));
      expect(calculate).toHaveBeenCalledTimes(2);
      expect(result.current.state.entry).toBe('5');
    }
    expect(vi.getTimerCount()).toBe(0);
  });
});
