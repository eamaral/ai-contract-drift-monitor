import { test, expect, request as pwRequest } from '@playwright/test';
import { GitHubRepoSchema } from '../schemas/github.schema.js';

test('GitHub repo microsoft/TypeScript contract', async () => {
  const req = await pwRequest.newContext({
    extraHTTPHeaders: {
      'User-Agent': 'contract-poc'
    }
  });
  const res = await req.get('https://api.github.com/repos/microsoft/TypeScript');

  expect(res.ok(), 'status should be OK').toBe(true);
  const json = await res.json();

  const parsed = GitHubRepoSchema.safeParse(json);
  expect(parsed.success, parsed.success ? 'schema ok' : `schema error: ${parsed.error.message}`).toBe(true);

  if (parsed.success) {
    const data = parsed.data;
    expect(data.full_name).toBe('microsoft/TypeScript');
  }
});






