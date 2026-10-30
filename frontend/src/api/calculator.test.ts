import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, calculate } from './calculator';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('calculate', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('posts the operation and returns the result', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ operation: 'add', operands: [2, 3], result: 5 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(calculate('add', [2, 3])).resolves.toEqual({ operation: 'add', operands: [2, 3], result: 5 });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/calculate',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ operation: 'add', operands: [2, 3] }) }),
    );
  });

  it('throws ApiError carrying the server error code and message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      jsonResponse({ error: { code: 'division_by_zero', message: 'division by zero' } }, 422),
    ));

    const error = await calculate('divide', [1, 0]).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ code: 'division_by_zero', message: 'division by zero', status: 422 });
  });

  it('falls back to a generic error when the body is not JSON', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('Bad Gateway', { status: 502 })));
    await expect(calculate('add', [1, 2])).rejects.toMatchObject({ code: 'unknown_error', status: 502 });
  });

  it('reports network failures as ApiError', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(calculate('add', [1, 2])).rejects.toMatchObject({
      code: 'network_error',
      message: 'Could not reach the calculator service.',
    });
  });

  it('rethrows aborts unchanged', async () => {
    const controller = new AbortController();
    controller.abort();
    const abortError = new DOMException('Aborted', 'AbortError');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(abortError));
    await expect(calculate('add', [1, 2], controller.signal)).rejects.toBe(abortError);
  });
});

describe('success response validation', () => {
  afterEach(() => vi.unstubAllGlobals());
  it.each([
    null, [], {},
    { operation: 'add', operands: [2, 3], result: '5' },
    { operation: 'add', operands: [2, 3], result: null },
  ])('rejects a missing or non-numeric result: %j', async (body) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(body)));
    await expect(calculate('add', [2, 3])).rejects.toMatchObject({ code: 'invalid_response', status: 200 });
  });
  it('rejects successful non-JSON bodies', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>Proxy failure</html>', { status: 200 })));
    await expect(calculate('add', [2, 3])).rejects.toMatchObject({ code: 'invalid_response' });
  });
  it('rejects a JSON number that overflows during parsing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"operation":"add","operands":[2,3],"result":1e400}', { status: 200 })));
    await expect(calculate('add', [2, 3])).rejects.toMatchObject({ code: 'invalid_response' });
  });
});
