import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, type CalculateResponse } from './calculator';
import { calculateWithDeadline } from './calculateWithDeadline';

afterEach(() => vi.useRealTimers());

describe('calculation deadline transport', () => {
  it('preserves AbortError when cancelling a transport that ignores abort', async () => {
    const controller = new AbortController();
    const calculate = vi.fn(() => new Promise<CalculateResponse>(() => {}));
    const pending = calculateWithDeadline(calculate, 'add', [2, 3], controller.signal);
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  });

  it.each([true, false])('reports a timeout when transport observes abort: %s', async (observesAbort) => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const calculate = vi.fn((_operation, _operands, signal?: AbortSignal) => new Promise<CalculateResponse>((_, reject) => {
      if (observesAbort) signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
    }));
    const pending = calculateWithDeadline(calculate, 'add', [2, 3], controller.signal);
    const assertion = expect(pending).rejects.toMatchObject({ code: 'request_timeout' });
    await vi.advanceTimersByTimeAsync(20_000);
    await assertion;
    expect(controller.signal.aborted).toBe(false);
    expect(calculate.mock.calls[0][2]?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not start an already cancelled request', async () => {
    const controller = new AbortController();
    controller.abort();
    const calculate = vi.fn();
    await expect(calculateWithDeadline(calculate, 'add', [2, 3], controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
    expect(calculate).not.toHaveBeenCalled();
  });

  it('preserves transport errors and clears the deadline', async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const error = new ApiError('network_error', 'offline', 0);
    await expect(calculateWithDeadline(vi.fn().mockRejectedValue(error), 'add', [2, 3], controller.signal)).rejects.toBe(error);
    expect(vi.getTimerCount()).toBe(0);
    expect(controller.signal.aborted).toBe(false);
  });
});
