import { test, expect, request as pwRequest } from '@playwright/test';
import { FrankfurterSchema } from '../schemas/frankfurter.schema.js';

test('Frankfurter latest USD->EUR contract', async () => {
  const req = await pwRequest.newContext();
  const res = await req.get('https://api.frankfurter.app/latest?from=USD&to=EUR');

  expect(res.status(), 'status should be 200').toBe(200);
  const contentType = res.headers()['content-type'] || '';
  expect(contentType).toContain('application/json');

  const json = await res.json();
  const parsed = FrankfurterSchema.safeParse(json);
  expect(parsed.success, parsed.success ? 'schema ok' : `schema error: ${parsed.error.message}`).toBe(true);

  if (parsed.success) {
    const data = parsed.data;
    expect(data.base, 'base should be USD').toBe('USD');
    expect(typeof data.rates.EUR, 'EUR rate should exist').toBe('number');
    expect(data.rates.EUR).toBeGreaterThan(0);
  }
});






