import { z } from 'zod';

/**
 * Frankfurter Currency API Schema
 * API: https://api.frankfurter.app/latest
 */
export const FrankfurterSchema = z.object({
  amount: z.number().optional(),
  base: z.string(),
  date: z.string(),
  rates: z.record(z.number())
});

export type FrankfurterResponse = z.infer<typeof FrankfurterSchema>;
