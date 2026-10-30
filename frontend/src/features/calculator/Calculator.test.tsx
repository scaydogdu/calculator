import { StrictMode } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ApiError, type CalculateFn, type CalculateResponse, type Operation } from '../../api/calculator';
import { Calculator } from './Calculator';

const response = (operation: Operation, operands: number[], result: number): CalculateResponse => ({ operation, operands, result });
const sum = response('add', [2, 3], 5);
const result = () => screen.getByRole('status', { name: 'Result' });
const expression = () => screen.getByLabelText('Expression');
function setup(calculate: CalculateFn = vi.fn().mockResolvedValue(sum)) {
  const user = userEvent.setup();
  const view = render(<Calculator calculate={calculate} />);
  return { user, ...view };
}

describe('keypad Calculator', () => {
  it('renders the accessible keypad and starts at zero without a request', () => {
    const calculate = vi.fn();
    setup(calculate);
    expect(result()).toHaveTextContent(/^0$/);
    expect(result()).toHaveAttribute('aria-live', 'polite');
    for (const name of ['All clear', 'Backspace', 'Percent of', 'Divide', 'Square root', 'Power', 'Toggle sign', 'Multiply', 'Subtract', 'Add', 'Decimal point', 'Equals', ...'0123456789']) {
      expect(screen.getByRole('button', { name })).toHaveAttribute('type', 'button');
    }
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    expect(calculate).not.toHaveBeenCalled();
  });
  it('calculates through clicks and separates expression from value', async () => {
    const calculate = vi.fn().mockResolvedValue(sum);
    const { user } = setup(calculate);
    for (const name of ['2', 'Add', '3', 'Equals']) await user.click(screen.getByRole('button', { name }));
    await waitFor(() => expect(result()).toHaveTextContent(/^5$/));
    expect(expression()).toHaveTextContent('2 + 3 =');
    expect(calculate).toHaveBeenCalledExactlyOnceWith('add', [2, 3], expect.any(AbortSignal));
  });
  it('chains requests from the backend result without doing client arithmetic', async () => {
    const calculate = vi.fn().mockResolvedValueOnce(sum).mockResolvedValueOnce(response('multiply', [5, 4], 20));
    const { user } = setup(calculate);
    await user.keyboard('2+3*');
    await waitFor(() => expect(expression()).toHaveTextContent('5 ×'));
    expect(screen.getByRole('button', { name: 'Multiply' })).toHaveAttribute('aria-pressed', 'true');
    await user.keyboard('4=');
    await waitFor(() => expect(result()).toHaveTextContent(/^20$/));
    expect(calculate).toHaveBeenNthCalledWith(2, 'multiply', [5, 4], expect.any(AbortSignal));
    expect(expression()).toHaveTextContent('5 × 4 =');
  });
  it('highlights and replaces the operator, then clears its pressed state on a digit', async () => {
    const calculate = vi.fn();
    const { user } = setup(calculate);
    await user.keyboard('2+*');
    expect(screen.getByRole('button', { name: 'Add' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Multiply' })).toHaveAttribute('aria-pressed', 'true');
    await user.keyboard('4');
    expect(screen.getByRole('button', { name: 'Multiply' })).toHaveAttribute('aria-pressed', 'false');
    expect(calculate).not.toHaveBeenCalled();
  });
  it.each([
    ['+', 'add', 5], ['-', 'subtract', -1], ['*', 'multiply', 6], ['x', 'multiply', 6],
    ['/', 'divide', 2 / 3], ['^', 'power', 8], ['%', 'percentage', 0.06],
  ] as const)('maps keyboard %s to %s', async (key, operation, value) => {
    const calculate = vi.fn().mockResolvedValue(response(operation, [2, 3], value));
    const { user } = setup(calculate);
    await user.keyboard(`2${key}3{Enter}`);
    await waitFor(() => expect(calculate).toHaveBeenCalledExactlyOnceWith(operation, [2, 3], expect.any(AbortSignal)));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Equals' })).not.toHaveAttribute('aria-disabled'));
  });
  it('maps comma to decimal and formats float noise', async () => {
    const calculate = vi.fn().mockResolvedValue(response('add', [0.1, 0.2], 0.30000000000000004));
    const { user } = setup(calculate);
    await user.keyboard('0,1+0.2{Enter}');
    await waitFor(() => expect(result()).toHaveTextContent(/^0.3$/));
    expect(expression()).toHaveTextContent('0.1 + 0.2 =');
  });
  it('supports the sqrt shortcut and sign/backspace buttons', async () => {
    const calculate = vi.fn().mockResolvedValue(response('sqrt', [9], 3));
    const { user } = setup(calculate);
    await user.keyboard('98{Backspace}');
    await user.click(screen.getByRole('button', { name: 'Toggle sign' }));
    expect(result()).toHaveTextContent(/^-9$/);
    await user.click(screen.getByRole('button', { name: 'Toggle sign' }));
    await user.keyboard('r');
    await waitFor(() => expect(result()).toHaveTextContent(/^3$/));
    expect(expression()).toHaveTextContent('√9 =');
    expect(calculate).toHaveBeenCalledExactlyOnceWith('sqrt', [9], expect.any(AbortSignal));
  });
  it('the equals shortcut evaluates without clicking the focused digit again', async () => {
    const calculate = vi.fn().mockResolvedValue(sum);
    const { user } = setup(calculate);
    await user.click(screen.getByRole('button', { name: '2' }));
    await user.keyboard('+3=');
    await waitFor(() => expect(result()).toHaveTextContent(/^5$/));
    expect(calculate).toHaveBeenCalledExactlyOnceWith('add', [2, 3], expect.any(AbortSignal));
  });
  it('ignores Ctrl and Meta shortcuts and unknown keys', async () => {
    const calculate = vi.fn();
    const { user } = setup(calculate);
    await user.keyboard('{Control>}9+{Enter}{/Control}{Meta>}8+{Enter}{/Meta}z');
    expect(result()).toHaveTextContent(/^0$/);
    expect(calculate).not.toHaveBeenCalled();
  });
  it.each(['{Escape}', '{Delete}'])('%s clears the display and expression', async (key) => {
    const { user } = setup();
    await user.keyboard('12+');
    await user.keyboard(key);
    expect(result()).toHaveTextContent(/^0$/);
    expect(expression()).toBeEmptyDOMElement();
  });
  it.each([
    ['division_by_zero', "You can't divide by zero."],
    ['negative_sqrt', 'Square root needs a number of 0 or more.'],
    ['result_out_of_range', 'A server explanation.'],
    ['network_error', "Couldn't reach the calculator service. Try again."],
    ['new_code', 'A server explanation.'],
    ['constructor', 'A server explanation.'],
  ])('maps error code %s to readable copy', async (code, message) => {
    const calculate = vi.fn().mockRejectedValue(new ApiError(code, 'A server explanation.', 422));
    const { user } = setup(calculate);
    await user.keyboard('1/0=');
    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(expression()).toHaveTextContent('1 ÷ 0');
    expect(expression()).not.toHaveTextContent('=');
    await user.keyboard('7');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(expression()).toBeEmptyDOMElement();
    expect(result()).toHaveTextContent(/^7$/);
  });
  it.each([new Error('private implementation detail'), new ApiError('new_code', '', 500)])('uses a generic error for an unexpected or empty message', async (error) => {
    const { user } = setup(vi.fn().mockRejectedValue(error));
    await user.keyboard('2+3=');
    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong. Try again.');
  });
  it('removes a previous result before a new failing calculation', async () => {
    const calculate = vi.fn().mockResolvedValueOnce(sum).mockRejectedValueOnce(new ApiError('division_by_zero', 'division by zero', 422));
    const { user } = setup(calculate);
    await user.keyboard('2+3=');
    await waitFor(() => expect(result()).toHaveTextContent(/^5$/));
    await user.keyboard('1/0=');
    expect(await screen.findByRole('alert')).toHaveTextContent("You can't divide by zero.");
    expect(result()).toHaveTextContent(/^0$/);
    expect(expression()).toHaveTextContent('1 ÷ 0');
    expect(expression()).not.toHaveTextContent('2 + 3');
  });
  it('AC aborts pending work and ignores its late success before accepting a new request', async () => {
    let finish!: (value: CalculateResponse) => void;
    const calculate = vi.fn().mockImplementationOnce(() => new Promise<CalculateResponse>((resolve) => { finish = resolve; })).mockResolvedValueOnce(response('sqrt', [9], 3));
    const { user } = setup(calculate);
    await user.keyboard('2+3=');
    expect(screen.getByRole('region', { name: 'Calculator' })).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('button', { name: '2' })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('button', { name: 'All clear' })).toBeEnabled();
    await user.keyboard('9+');
    expect(result()).toHaveTextContent(/^3$/);
    await user.click(screen.getByRole('button', { name: 'All clear' }));
    expect(calculate.mock.calls[0][2].aborted).toBe(true);
    await user.keyboard('9r');
    await waitFor(() => expect(result()).toHaveTextContent(/^3$/));
    await act(async () => finish(sum));
    expect(expression()).toHaveTextContent('√9 =');
    expect(result()).toHaveTextContent(/^3$/);
  });
  it('ignores a late rejection after clear', async () => {
    let reject!: (error: Error) => void;
    const calculate = vi.fn().mockImplementation(() => new Promise<CalculateResponse>((_, fail) => { reject = fail; }));
    const { user } = setup(calculate);
    await user.keyboard('2+3=');
    await user.keyboard('{Escape}');
    await act(async () => reject(new ApiError('network_error', 'unavailable', 0)));
    expect(result()).toHaveTextContent(/^0$/);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
  it('aborts an in-flight request on unmount', async () => {
    const calculate = vi.fn().mockImplementation(() => new Promise<CalculateResponse>(() => {}));
    const { user, unmount } = setup(calculate);
    await user.keyboard('2+3=');
    unmount();
    expect(calculate.mock.calls[0][2].aborted).toBe(true);
  });
  it('issues one request per calculation under React StrictMode', async () => {
    const calculate = vi.fn().mockResolvedValue(sum);
    const user = userEvent.setup();
    render(<StrictMode><Calculator calculate={calculate} /></StrictMode>);
    await user.keyboard('2+3=');
    await waitFor(() => expect(result()).toHaveTextContent(/^5$/));
    expect(calculate).toHaveBeenCalledTimes(1);
  });
});

describe('keypad continuation', () => {
  it('sends the unrounded backend result after Equals and a new operator', async () => {
    const calculate = vi.fn()
      .mockResolvedValueOnce(response('divide', [1, 3], 0.3333333333333333))
      .mockResolvedValueOnce(response('multiply', [0.3333333333333333, 3], 1));
    const { user } = setup(calculate);
    await user.keyboard('1/3=');
    await waitFor(() => expect(result()).toHaveTextContent(/^0.333333333333$/));
    await user.keyboard('*3=');
    await waitFor(() => expect(result()).toHaveTextContent(/^1$/));
    expect(calculate).toHaveBeenNthCalledWith(2, 'multiply', [0.3333333333333333, 3], expect.any(AbortSignal));
  });
  it('keeps the selected operator operand consistent when toggling its sign', async () => {
    const calculate = vi.fn().mockResolvedValue(response('multiply', [-5, 2], -10));
    const { user } = setup(calculate);
    await user.keyboard('5+');
    await user.click(screen.getByRole('button', { name: 'Toggle sign' }));
    expect(result()).toHaveTextContent(/^-5$/);
    expect(expression()).toHaveTextContent('-5 +');
    await user.keyboard('*2=');
    await waitFor(() => expect(result()).toHaveTextContent(/^-10$/));
    expect(calculate).toHaveBeenCalledExactlyOnceWith('multiply', [-5, 2], expect.any(AbortSignal));
  });
});


describe('round-2 keyboard accessibility', () => {
  it('activates a focused digit with Enter instead of evaluating', async () => {
    const calculate = vi.fn();
    const { user } = setup(calculate);
    const seven = screen.getByRole('button', { name: '7' });
    seven.focus();
    await user.keyboard('{Enter}');
    expect(result()).toHaveTextContent(/^7$/);
    expect(seven).toHaveFocus();
    expect(calculate).not.toHaveBeenCalled();
  });
  it('keeps the focused Equals key focusable during a request and focused after completion', async () => {
    let finish!: (value: CalculateResponse) => void;
    const calculate = vi.fn().mockImplementation(() => new Promise<CalculateResponse>((resolve) => { finish = resolve; }));
    const { user } = setup(calculate);
    await user.keyboard('2+3');
    const equals = screen.getByRole('button', { name: 'Equals' });
    await user.click(equals);
    expect(equals).toBeEnabled();
    expect(equals).toHaveAttribute('aria-disabled', 'true');
    expect(equals).toHaveFocus();
    await act(async () => finish(sum));
    expect(result()).toHaveTextContent(/^5$/);
    expect(equals).toHaveFocus();
    expect(equals).not.toHaveAttribute('aria-disabled');
  });
});

describe('native keypad activation while preserving shortcuts', () => {
  it('supports Enter and Space on operators, Equals and All clear', async () => {
    const calculate = vi.fn().mockResolvedValue(sum);
    const { user } = setup(calculate);
    await user.keyboard('2');
    screen.getByRole('button', { name: 'Add' }).focus();
    await user.keyboard('{Enter}');
    expect(expression()).toHaveTextContent('2 +');
    await user.keyboard('3');
    const equals = screen.getByRole('button', { name: 'Equals' });
    equals.focus();
    await user.keyboard(' ');
    await waitFor(() => expect(result()).toHaveTextContent(/^5$/));
    expect(equals).toHaveFocus();
    expect(calculate).toHaveBeenCalledExactlyOnceWith('add', [2, 3], expect.any(AbortSignal));
    screen.getByRole('button', { name: 'All clear' }).focus();
    await user.keyboard('{Enter}');
    expect(result()).toHaveTextContent(/^0$/);
    screen.getByRole('button', { name: '8' }).focus();
    await user.keyboard(' ');
    expect(result()).toHaveTextContent(/^8$/);
  });
  it('ignores focused key clicks and Enter/Space while busy but lets AC abort with Enter', async () => {
    let finish!: (value: CalculateResponse) => void;
    const calculate = vi.fn().mockImplementation(() => new Promise<CalculateResponse>((resolve) => { finish = resolve; }));
    const { user } = setup(calculate);
    await user.keyboard('2+3=');
    const eight = screen.getByRole('button', { name: '8' });
    await user.click(eight);
    await user.keyboard('{Enter} ');
    expect(result()).toHaveTextContent(/^3$/);
    expect(eight).toHaveFocus();
    expect(calculate).toHaveBeenCalledTimes(1);
    const clear = screen.getByRole('button', { name: 'All clear' });
    expect(clear).not.toHaveAttribute('aria-disabled');
    clear.focus();
    await user.keyboard('{Enter}');
    expect(calculate.mock.calls[0][2].aborted).toBe(true);
    await act(async () => finish(sum));
    expect(result()).toHaveTextContent(/^0$/);
    expect(clear).toHaveFocus();
  });
  it('keeps focus after a request fails as well as after success', async () => {
    const calculate = vi.fn().mockRejectedValue(new ApiError('division_by_zero', 'division by zero', 422));
    const { user } = setup(calculate);
    await user.keyboard('1/0');
    const equals = screen.getByRole('button', { name: 'Equals' });
    equals.focus();
    await user.keyboard('{Enter}');
    expect(await screen.findByRole('alert')).toHaveTextContent("You can't divide by zero.");
    expect(equals).toHaveFocus();
  });
});

describe('review regressions', () => {
  it('keeps the pending sum when applying sqrt to its second operand', async () => {
    const calculate = vi.fn()
      .mockResolvedValueOnce(response('sqrt', [16], 4))
      .mockResolvedValueOnce(response('add', [9, 4], 13));
    const { user } = setup(calculate);
    await user.keyboard('9+16r');
    await waitFor(() => expect(result()).toHaveTextContent(/^4$/));
    await user.keyboard('=');
    await waitFor(() => expect(result()).toHaveTextContent(/^13$/));
    expect(calculate).toHaveBeenNthCalledWith(2, 'add', [9, 4], expect.any(AbortSignal));
  });
  it('preserves a partially typed zero decimal when toggling its sign', async () => {
    const { user } = setup();
    await user.keyboard('0.0');
    await user.click(screen.getByRole('button', { name: 'Toggle sign' }));
    await user.keyboard('5');
    expect(result()).toHaveTextContent(/^-0.05$/);
  });
  it('leaves loading and remains usable after an HTML success response', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('<html>Proxy error</html>', { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(sum), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    try {
      const user = userEvent.setup();
      render(<Calculator />);
      await user.keyboard('2+3=');
      expect(await screen.findByRole('alert')).toHaveTextContent('The calculator service sent an invalid response. Try again.');
      expect(screen.getByRole('region', { name: 'Calculator' })).toHaveAttribute('aria-busy', 'false');
      await user.keyboard('2+3=');
      await waitFor(() => expect(result()).toHaveTextContent(/^5$/));
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('mathematical domain error presentation', () => {
  it('shows the backend non-real explanation instead of claiming overflow', async () => {
    const calculate = vi.fn().mockRejectedValue(new ApiError('result_out_of_range', 'This calculation has no real-number result.', 422));
    const { user } = setup(calculate);
    await user.keyboard('8');
    await user.click(screen.getByRole('button', { name: 'Toggle sign' }));
    await user.keyboard('^0.5=');
    expect(await screen.findByRole('alert')).toHaveTextContent('This calculation has no real-number result.');
    expect(screen.getByRole('alert')).not.toHaveTextContent('too large');
  });
});


describe('request timeout recovery', () => {
  it.each(['success', 'failure'] as const)('recovers from a timeout and ignores late %s', async (lateOutcome) => {
    vi.useFakeTimers();
    try {
      let finish!: (value: CalculateResponse) => void;
      let fail!: (reason: Error) => void;
      const calculate = vi.fn()
        .mockImplementationOnce(() => new Promise<CalculateResponse>((resolve, reject) => { finish = resolve; fail = reject; }))
        .mockResolvedValueOnce(sum);
      render(<Calculator calculate={calculate} />);
      const enter = () => { for (const key of ['2', '+', '3', '=']) fireEvent.keyDown(document, { key }); };
      enter();
      await act(async () => { await vi.advanceTimersByTimeAsync(19_999); });
      expect(screen.getByRole('region', { name: 'Calculator' })).toHaveAttribute('aria-busy', 'true');
      await act(async () => { await vi.advanceTimersByTimeAsync(1); });
      expect(screen.getByRole('alert')).toHaveTextContent('The calculator service took too long. Try again.');
      expect(screen.getByRole('region', { name: 'Calculator' })).toHaveAttribute('aria-busy', 'false');
      expect(calculate.mock.calls[0][2].aborted).toBe(true);
      await act(async () => { enter(); });
      expect(result()).toHaveTextContent(/^5$/);
      await act(async () => {
        if (lateOutcome === 'success') finish(response('add', [2, 3], 999));
        else fail(new Error('late rejection'));
      });
      expect(result()).toHaveTextContent(/^5$/);
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    } finally { vi.useRealTimers(); }
  });

  it('does not show a timeout error after All clear cancels a stalled request', async () => {
    vi.useFakeTimers();
    try {
      render(<Calculator calculate={() => new Promise(() => {})} />);
      for (const key of ['2', '+', '3', '=']) fireEvent.keyDown(document, { key });
      fireEvent.click(screen.getByRole('button', { name: 'All clear' }));
      await act(async () => { await vi.advanceTimersByTimeAsync(20_000); });
      expect(result()).toHaveTextContent(/^0$/);
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(vi.getTimerCount()).toBe(0);
    } finally { vi.useRealTimers(); }
  });
});
