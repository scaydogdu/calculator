import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('calculates and chains through the real API', async ({ page }) => {
  const button = (name: string) => page.getByRole('button', { name, exact: true });
  await button('2').click();
  await button('Add').click();
  await button('3').click();
  const addition = page.waitForResponse((response) => response.url().endsWith('/api/v1/calculate') && response.request().method() === 'POST');
  await button('Multiply').click();
  const response = await addition;
  expect(response.status()).toBe(200);
  expect(await response.json()).toMatchObject({ operation: 'add', operands: [2, 3], result: 5 });
  await expect(page.getByLabel('Expression')).toHaveText('5 ×');
  await button('4').click();
  await button('Equals').click();
  await expect(page.getByRole('status', { name: 'Result' })).toHaveText('20');
  await expect(page.getByLabel('Expression')).toHaveText('5 × 4 =');
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
