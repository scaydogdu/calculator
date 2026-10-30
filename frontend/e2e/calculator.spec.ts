import { expect, test, type Route } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('serves the frontend under the security policy without browser errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  const response = await page.goto('/');
  expect(response?.headers()['x-content-type-options']).toBe('nosniff');
  expect(response?.headers()['content-security-policy']).toContain("default-src 'self'");
  expect(response?.headers()['referrer-policy']).toBe('strict-origin-when-cross-origin');
  await expect(page.getByRole('button', { name: 'Equals', exact: true })).toBeVisible();
  await expect(page.getByRole('status', { name: 'Result' })).toHaveCSS('display', 'block');
  expect(errors).toEqual([]);
});

test('submits the full expression on Equals and evaluates precedence in Go', async ({ page }) => {
  const requests: unknown[] = [];
  page.on('request', (request) => {
    if (request.url().endsWith('/api/v1/evaluate')) requests.push(request.postDataJSON());
  });
  const button = (name: string) => page.getByRole('button', { name, exact: true });
  for (const name of ['2', 'Add', '3', 'Multiply', '4']) await button(name).click();
  await expect(page.getByLabel('Expression')).toHaveText('2 + 3 × 4');
  expect(requests).toEqual([]);
  const evaluation = page.waitForResponse((response) => response.url().endsWith('/api/v1/evaluate'));
  await button('Equals').click();
  const response = await evaluation;
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ result: 14 });
  expect(requests).toEqual([{ operands: [2, 3, 4], operators: ['add', 'multiply'] }]);
  await expect(page.getByRole('status', { name: 'Result' })).toHaveText('14');
  await expect(page.getByLabel('Expression')).toHaveText('2 + 3 × 4 =');
});

for (const [expression, result] of [
  ['8/2+3=', '7'], ['2*3^2=', '18'], ['2^3^2=', '512'],
  ['100/10/2=', '5'], ['10-3-2=', '5'], ['2+3*4^2-8/2=', '46'],
  ['2+*3=', '6'], ['1+15%200=', '31'],
]) {
  test(`evaluates ${expression} as ${result}`, async ({ page }) => {
    await page.keyboard.type(expression);
    await expect(page.getByRole('status', { name: 'Result' })).toHaveText(result);
  });
}

test('keeps square roots as operands in an expression', async ({ page }) => {
  await page.keyboard.type('9+16r');
  await expect(page.getByRole('status', { name: 'Result' })).toHaveText('4');
  await page.keyboard.type('*2=');
  await expect(page.getByRole('status', { name: 'Result' })).toHaveText('17');
});

test('shows a domain error and recovers on the next calculation', async ({ page }) => {
  await page.keyboard.type('1/0=');
  await expect(page.getByRole('alert')).toHaveText("You can't divide by zero.");
  await page.keyboard.type('2+3=');
  await expect(page.getByRole('status', { name: 'Result' })).toHaveText('5');
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Calculator' })).toHaveAttribute('aria-busy', 'false');
});

test('keeps keyboard focus through a request and clears with Enter', async ({ page }) => {
  await page.keyboard.type('2+3');
  const equals = page.getByRole('button', { name: 'Equals', exact: true });
  await equals.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('status', { name: 'Result' })).toHaveText('5');
  await expect(equals).toBeFocused();
  await page.getByRole('button', { name: 'All clear' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('status', { name: 'Result' })).toHaveText('0');
  await expect(page.getByLabel('Expression')).toBeEmpty();
});

test('sends every submitted calculation to the backend', async ({ page }) => {
  const requests: unknown[] = [];
  page.on('request', (request) => {
    if (request.url().endsWith('/api/v1/evaluate') && request.method() === 'POST') requests.push(request.postDataJSON());
  });
  for (const expression of ['2+3=', '2+3=', '3+2=']) {
    await page.getByRole('button', { name: 'All clear' }).click();
    await page.keyboard.type(expression);
    await expect(page.getByRole('status', { name: 'Result' })).toHaveText('5');
  }
  expect(requests).toEqual([
    { operands: [2, 3], operators: ['add'] },
    { operands: [2, 3], operators: ['add'] },
    { operands: [3, 2], operators: ['add'] },
  ]);
});

test('AC cancels a request and ignores a late reply', async ({ page }) => {
  let delayedRoute: Route | undefined;
  let requests = 0;
  await page.route('**/api/v1/evaluate', async (route) => {
    requests += 1;
    if (requests === 1) {
      delayedRoute = route;
      return;
    }
    await route.continue();
  });
  await page.keyboard.type('2+3=');
  await expect.poll(() => delayedRoute !== undefined).toBe(true);
  const cancelled = page.waitForEvent('requestfailed', {
    predicate: (request) => request.url().endsWith('/api/v1/evaluate'),
  });
  await page.getByRole('button', { name: 'All clear' }).click();
  await cancelled;
  await expect(page.getByRole('status', { name: 'Result' })).toHaveText('0');
  // Fulfilment may reject because AC already aborted the browser request.
  await delayedRoute!.fulfill({ json: { operation: 'add', operands: [2, 3], result: 999 } }).catch(() => {});
  for (let attempt = 0; attempt < 2; attempt += 1) {
    await page.getByRole('button', { name: 'All clear' }).click();
    await page.keyboard.type('2+3=');
    await expect(page.getByRole('status', { name: 'Result' })).toHaveText('5');
  }
  expect(requests).toBe(3);
});

for (const width of [320, 375]) {
  test(`fits long negative numbers without clipping at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 812 });
    const result = page.getByRole('status', { name: 'Result' });
    await page.keyboard.type('12345678901234');
    await page.getByRole('button', { name: 'Toggle sign' }).click();
    await page.keyboard.type('5');
    await expect(result).toHaveText('-123456789012345');
    const fits = () => result.evaluate((element) => {
      const range = element.ownerDocument.createRange();
      range.selectNodeContents(element);
      const text = range.getBoundingClientRect();
      const box = element.getBoundingClientRect();
      return element.scrollWidth <= element.clientWidth && text.left >= box.left - 1 && text.right <= box.right + 1;
    });
    expect(await fits()).toBe(true);
    await page.getByRole('button', { name: 'All clear' }).click();
    await page.keyboard.type('0.12345678901234');
    await page.getByRole('button', { name: 'Toggle sign' }).click();
    await expect(result).toHaveText('-0.12345678901234');
    expect(await fits()).toBe(true);
    await page.setViewportSize({ width: 768, height: 812 });
    expect(await fits()).toBe(true);
  });
}


test('shows rounded large results in scientific notation and retains raw precision', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.keyboard.type('123456789012345');
  await page.getByRole('button', { name: 'Toggle sign' }).click();
  await page.keyboard.type('/7=');
  const result = page.getByRole('status', { name: 'Result' });
  await expect(result).toHaveText('-1.76366841446e+13');
  expect(await result.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await page.keyboard.type('*7=');
  await expect(result).toHaveText('-123456789012345');
});

test('fails promptly offline and recovers on a new submission', async ({ page, context }) => {
  await context.setOffline(true);
  await page.keyboard.type('2+3=');
  await expect(page.getByRole('alert')).toHaveText("Couldn't reach the calculator service. Try again.");
  await expect(page.getByRole('region', { name: 'Calculator' })).toHaveAttribute('aria-busy', 'false');
  await context.setOffline(false);
  await page.keyboard.type('2+3=');
  await expect(page.getByRole('status', { name: 'Result' })).toHaveText('5');
});

test('distinguishes non-real, overflowing and zero-power domain errors', async ({ page }) => {
  const alert = page.getByRole('alert');
  await page.keyboard.type('8');
  await page.getByRole('button', { name: 'Toggle sign' }).click();
  await page.keyboard.type('^0.5=');
  await expect(alert).toHaveText('This calculation has no real-number result.');
  await page.keyboard.type('2^1024=');
  await expect(alert).toHaveText('That result is too large to show.');
  await page.keyboard.type('0^1');
  await page.getByRole('button', { name: 'Toggle sign' }).click();
  await page.keyboard.type('=');
  await expect(alert).toHaveText("You can't divide by zero.");
});
