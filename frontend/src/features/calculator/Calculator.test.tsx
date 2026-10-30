import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ApiError, type CalculateFn } from '../../api/calculator';
import { Calculator } from './Calculator';

function setup(calculate: CalculateFn) {
  const user = userEvent.setup();
  render(<Calculator calculate={calculate} />);
  return user;
}

describe('Calculator', () => {
  it('sends the operands to the API and shows the result', async () => {
    const calculate = vi.fn().mockResolvedValue({ operation: 'add', operands: [2, 3], result: 5 });
    const user = setup(calculate);

    await user.type(screen.getByLabelText('First number'), '2');
    await user.type(screen.getByLabelText('Second number'), '3');
    await user.click(screen.getByRole('button', { name: 'Calculate' }));

    expect(await screen.findByText('2 + 3 = 5')).toBeInTheDocument();
    expect(calculate).toHaveBeenCalledWith('add', [2, 3], expect.any(AbortSignal));
  });

  it('shows field errors and does not call the API for invalid input', async () => {
    const calculate = vi.fn();
    const user = setup(calculate);

    await user.type(screen.getByLabelText('First number'), 'abc');
    await user.click(screen.getByRole('button', { name: 'Calculate' }));

    expect(screen.getByText('Not a valid number.')).toBeInTheDocument();
    expect(screen.getByText('Enter a number.')).toBeInTheDocument();
    expect(screen.getByLabelText('First number')).toHaveAttribute('aria-invalid', 'true');
    expect(calculate).not.toHaveBeenCalled();
  });

  it('shows the API error message', async () => {
    const calculate = vi.fn().mockRejectedValue(new ApiError('division_by_zero', 'division by zero', 422));
    const user = setup(calculate);

    await user.type(screen.getByLabelText('First number'), '1');
    await user.click(screen.getByRole('radio', { name: 'Divide' }));
    await user.type(screen.getByLabelText('Second number'), '0');
    await user.click(screen.getByRole('button', { name: 'Calculate' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('division by zero');
  });

  it('uses a single input for square root', async () => {
    const calculate = vi.fn().mockResolvedValue({ operation: 'sqrt', operands: [16], result: 4 });
    const user = setup(calculate);

    await user.click(screen.getByRole('radio', { name: 'Square root' }));
    expect(screen.queryByLabelText('Second number')).not.toBeInTheDocument();

    await user.type(screen.getByLabelText('Number'), '16');
    await user.click(screen.getByRole('button', { name: 'Calculate' }));

    expect(await screen.findByText('√16 = 4')).toBeInTheDocument();
    expect(calculate).toHaveBeenCalledWith('sqrt', [16], expect.any(AbortSignal));
  });
});


describe('operation changes during a request', () => {
  it('cancels the old calculation and ignores its late result', async () => {
    let finish!: (value: { operation: 'add'; operands: number[]; result: number }) => void;
    const calculate = vi.fn()
      .mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }))
      .mockResolvedValueOnce({ operation: 'sqrt', operands: [16], result: 4 });
    const user = setup(calculate);
    await user.type(screen.getByLabelText('First number'), '16');
    await user.type(screen.getByLabelText('Second number'), '3');
    await user.click(screen.getByRole('button', { name: 'Calculate' }));
    expect(screen.getByRole('button', { name: 'Calculating…' })).toBeDisabled();

    await user.click(screen.getByRole('radio', { name: 'Square root' }));
    await act(async () => finish({ operation: 'add', operands: [16, 3], result: 19 }));
    expect(screen.queryByText('16 + 3 = 19')).not.toBeInTheDocument();
    expect(calculate.mock.calls[0][2].aborted).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Calculate' }));
    expect(await screen.findByText('√16 = 4')).toBeInTheDocument();
  });
});
