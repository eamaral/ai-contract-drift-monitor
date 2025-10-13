import { z } from 'zod';

/**
 * GitHub Repository Schema
 * API: https://api.github.com/repos/{owner}/{repo}
 */
export const GitHubRepoSchema = z.object({
  full_name: z.string(),
  private: z.boolean(),
  owner: z.object({
    login: z.string(),
    id: z.number()
  }),
  stargazers_count: z.number().min(0),
  forks_count: z.number().min(0)
});

export type GitHubRepo = z.infer<typeof GitHubRepoSchema>;
