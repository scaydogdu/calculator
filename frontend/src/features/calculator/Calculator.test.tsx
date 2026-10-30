import { StrictMode } from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { type CalculateFn, type CalculateResponse } from '../../api/calculator';
import { Calculator } from './Calculator';

const sum: CalculateResponse = { operation: 'add', operands: [2, 3], result: 5 };
const result = () => screen.getByRole('status', { name: 'Result' });
function setup(calculate: CalculateFn = vi.fn().mockResolvedValue(sum)) {
  return { user: userEvent.setup(), ...render(<Calculator calculate={calculate} />) };
}

describe('calculator integration and accessibility', () => {
  it('renders a labelled keypad, live result and visible evaluation semantics', () => {
    const calculate = vi.fn();
    setup(calculate);
    expect(result()).toHaveTextContent(/^0$/);
    expect(result()).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByText('Evaluates left to right · 2 + 3 × 4 = 20')).toBeVisible();
    for (const name of ['All clear', 'Backspace', 'Percent of', 'Divide', 'Square root', 'Power', 'Toggle sign', 'Multiply', 'Subtract', 'Add', 'Decimal point', 'Equals', ...'0123456789']) {
      expect(screen.getByRole('button', { name })).toHaveAttribute('type', 'button');
    }
    expect(calculate).not.toHaveBeenCalled();
  });

  it('calculates via clicks and preserves the focused Equals key while busy', async () => {
    let finish!: (value: CalculateResponse) => void;
    const calculate = vi.fn(() => new Promise<CalculateResponse>((resolve) => { finish = resolve; }));
    const { user } = setup(calculate);
    for (const name of ['2', 'Add', '3', 'Equals']) await user.click(screen.getByRole('button', { name }));
    const equals = screen.getByRole('button', { name: 'Equals' });
    expect(equals).toHaveFocus();
    expect(equals).toBeEnabled();
    expect(equals).toHaveAttribute('aria-disabled', 'true');
    await user.keyboard('99+');
    expect(result()).toHaveTextContent(/^3$/);
    await act(async () => finish(sum));
    expect(result()).toHaveTextContent(/^5$/);
    expect(screen.getByLabelText('Expression')).toHaveTextContent('2 + 3 =');
    expect(equals).toHaveFocus();
    expect(equals).not.toHaveAttribute('aria-disabled');
    expect(calculate).toHaveBeenCalledExactlyOnceWith('add', [2, 3], expect.any(AbortSignal));
  });

  it('chains using the raw backend result and preserves unary operations inside an expression', async () => {
    const calculate = vi.fn().mockResolvedValueOnce({ operation: 'sqrt', operands: [16], result: 4 })
      .mockResolvedValueOnce({ operation: 'add', operands: [9, 4], result: 13 });
    const { user } = setup(calculate);
    await user.keyboard('9+16r');
    await waitFor(() => expect(result()).toHaveTextContent(/^4$/));
    await user.keyboard('=');
    await waitFor(() => expect(result()).toHaveTextContent(/^13$/));
    expect(calculate).toHaveBeenNthCalledWith(2, 'add', [9, 4], expect.any(AbortSignal));
  });

  it('keeps raw precision when continuing from a rounded scientific display', async () => {
    const raw = -123456789012345 / 7;
    const calculate = vi.fn().mockResolvedValueOnce({ operation: 'divide', operands: [-123456789012345, 7], result: raw })
      .mockResolvedValueOnce({ operation: 'multiply', operands: [raw, 7], result: -123456789012345 });
    const { user } = setup(calculate);
    await user.keyboard('123456789012345');
    await user.click(screen.getByRole('button', { name: 'Toggle sign' }));
    await user.keyboard('/7=');
    await waitFor(() => expect(result()).toHaveTextContent(/^-1\.76366841446e\+13$/));
    await user.keyboard('*7=');
    await waitFor(() => expect(result()).toHaveTextContent(/^-123456789012345$/));
    expect(calculate).toHaveBeenNthCalledWith(2, 'multiply', [raw, 7], expect.any(AbortSignal));
  });

  it('AC remains keyboard-accessible while busy and ignores a late response', async () => {
    let finish!: (value: CalculateResponse) => void;
    const calculate = vi.fn(() => new Promise<CalculateResponse>((resolve) => { finish = resolve; }));
    const { user } = setup(calculate);
    await user.keyboard('2+3=');
    const clear = screen.getByRole('button', { name: 'All clear' });
    clear.focus();
    await user.keyboard('{Enter}');
    await act(async () => finish(sum));
    expect(result()).toHaveTextContent(/^0$/);
    expect(clear).toHaveFocus();
    expect(screen.getByRole('region', { name: 'Calculator' })).toHaveAttribute('aria-busy', 'false');
  });

  it('lets Enter and Space activate focused keys without also evaluating', async () => {
    const calculate = vi.fn().mockResolvedValue(sum);
    const { user } = setup(calculate);
    screen.getByRole('button', { name: '2' }).focus();
    await user.keyboard('{Enter}');
    expect(result()).toHaveTextContent(/^2$/);
    await user.keyboard('+3');
    const equals = screen.getByRole('button', { name: 'Equals' });
    equals.focus();
    await user.keyboard(' ');
    await waitFor(() => expect(result()).toHaveTextContent(/^5$/));
    expect(equals).toHaveFocus();
    expect(calculate).toHaveBeenCalledOnce();
  });

  it('ignores Ctrl/Meta shortcuts and unknown keys', async () => {
    const calculate = vi.fn();
    const { user } = setup(calculate);
    await user.keyboard('{Control>}9+{Enter}{/Control}{Meta>}8+{Enter}{/Meta}z');
    expect(result()).toHaveTextContent(/^0$/);
    expect(calculate).not.toHaveBeenCalled();
  });

  it.each([
    ['-', 'subtract', -1], ['x', 'multiply', 6], ['^', 'power', 8], ['%', 'percentage', 0.06],
  ] as const)('routes the %s shortcut through the API', async (key, operation, value) => {
    const calculate = vi.fn().mockResolvedValue({ operation, operands: [2, 3], result: value });
    const { user } = setup(calculate);
    await user.keyboard(`2${key}3{Enter}`);
    await waitFor(() => expect(result()).toHaveTextContent(String(value)));
    expect(calculate).toHaveBeenCalledExactlyOnceWith(operation, [2, 3], expect.any(AbortSignal));
  });

  it('supports comma decimals, backspace and both clear shortcuts', async () => {
    const calculate = vi.fn();
    const { user } = setup(calculate);
    await user.keyboard('12,3{Backspace}4');
    expect(result()).toHaveTextContent(/^12.4$/);
    await user.keyboard('{Escape}7{Delete}');
    expect(result()).toHaveTextContent(/^0$/);
    expect(calculate).not.toHaveBeenCalled();
  });

  it('recovers from an HTML success reply by sending the next submission again', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response('<html>Proxy error</html>', { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(sum), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    try {
      const user = userEvent.setup();
      render(<Calculator />);
      await user.keyboard('2+3=');
      expect(await screen.findByRole('alert')).toHaveTextContent('The calculator service sent an invalid response. Try again.');
      await user.keyboard('2+3=');
      await waitFor(() => expect(result()).toHaveTextContent(/^5$/));
      expect(fetchMock).toHaveBeenCalledTimes(2);
    } finally { vi.unstubAllGlobals(); }
  });

  it('issues one request under StrictMode', async () => {
    const calculate = vi.fn().mockResolvedValue(sum);
    const user = userEvent.setup();
    render(<StrictMode><Calculator calculate={calculate} /></StrictMode>);
    await user.keyboard('2+3=');
    await waitFor(() => expect(result()).toHaveTextContent(/^5$/));
    expect(calculate).toHaveBeenCalledOnce();
  });
});
