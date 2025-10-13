import { z } from 'zod';

/**
 * Rick and Morty GraphQL API Schema
 * API: https://rickandmortyapi.com/graphql
 * 
 * Note: For GraphQL, introspection is used for drift detection.
 * These schemas are for contract testing only.
 */

const CharacterSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.string(),
  species: z.string()
});

export const RickMortyResponseSchema = z.object({
  data: z.object({
    characters: z.object({
      results: z.array(CharacterSchema)
    })
  })
});

export type RickMortyResponse = z.infer<typeof RickMortyResponseSchema>;
