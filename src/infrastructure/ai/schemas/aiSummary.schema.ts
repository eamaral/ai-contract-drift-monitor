/**
 * AI Summary Schema (Zod validation)
 */

import { z } from 'zod';

export const AISummarySchema = z.object({
  summary: z.string().min(10).max(1000),
  impact: z.array(z.string()).max(10),
  risks: z.array(z.string()).max(10)
});

export type AISummary = z.infer<typeof AISummarySchema>;

