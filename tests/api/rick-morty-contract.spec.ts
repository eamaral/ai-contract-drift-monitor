import { test, expect, request as pwRequest } from '@playwright/test';
import { z } from 'zod';

const CharacterSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.string(),
  species: z.string()
});

const RickMortyResponseSchema = z.object({
  data: z.object({
    characters: z.object({
      results: z.array(CharacterSchema)
    })
  })
});

test('Rick and Morty GraphQL characters contract', async () => {
  const req = await pwRequest.newContext();
  const res = await req.post('https://rickandmortyapi.com/graphql', {
    data: {
      query: 'query { characters(page: 1) { results { id name status species } } }'
    },
    headers: {
      'Content-Type': 'application/json'
    }
  });

  expect(res.status()).toBe(200);
  const json = await res.json();
  
  const parsed = RickMortyResponseSchema.safeParse(json);
  expect(parsed.success, parsed.success ? 'schema ok' : `schema error: ${parsed.error.message}`).toBe(true);

  if (parsed.success) {
    const data = parsed.data;
    expect(data.data.characters.results.length).toBeGreaterThan(0);
    expect(data.data.characters.results[0].name).toBeDefined();
    expect(data.data.characters.results[0].status).toBeDefined();
  }
});
