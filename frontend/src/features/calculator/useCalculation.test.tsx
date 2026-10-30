import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ApiError, type CalculateResponse } from '../../api/calculator';
import { useCalculation } from './useCalculation';

const sum: CalculateResponse = { operation: 'add', operands: [2, 3], result: 5 };

describe('useCalculation', () => {
  it('goes from loading to success', async () => {
    const calculate = vi.fn().mockResolvedValue(sum);
    const { result } = renderHook(() => useCalculation(calculate));

    act(() => void result.current.run('add', [2, 3]));
    expect(result.current.state).toEqual({ status: 'loading' });
    await waitFor(() => expect(result.current.state).toEqual({ status: 'success', result: sum }));
  });

  it('exposes ApiError messages and hides unexpected ones', async () => {
    const calculate = vi.fn()
      .mockRejectedValueOnce(new ApiError('division_by_zero', 'division by zero', 422))
      .mockRejectedValueOnce(new Error('kaboom'));
    const { result } = renderHook(() => useCalculation(calculate));

    await act(() => result.current.run('divide', [1, 0]));
    expect(result.current.state).toEqual({ status: 'error', message: 'division by zero' });

    await act(() => result.current.run('divide', [1, 0]));
    expect(result.current.state).toEqual({ status: 'error', message: 'Something went wrong. Please try again.' });
  });

  it('ignores a slow earlier response once a newer request was made', async () => {
    let resolveFirst!: (r: CalculateResponse) => void;
    const calculate = vi.fn()
      .mockImplementationOnce(() => new Promise<CalculateResponse>((resolve) => { resolveFirst = resolve; }))
      .mockResolvedValueOnce(sum);
    const { result } = renderHook(() => useCalculation(calculate));

    act(() => void result.current.run('multiply', [9, 9]));
    await act(() => result.current.run('add', [2, 3]));
    await act(async () => resolveFirst({ operation: 'multiply', operands: [9, 9], result: 81 }));

    expect(result.current.state).toEqual({ status: 'success', result: sum });
    expect(calculate.mock.calls[0][2].aborted).toBe(true);
  });
});
