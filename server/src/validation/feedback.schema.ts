import { z } from 'zod';

export const feedbackSchema = z.object({
  sectionType: z.enum(['MARKET_NEWS', 'COIN_PRICES', 'AI_INSIGHT', 'MEME']),
  contentRef: z.string().trim().min(1).max(200),
  vote: z.enum(['UP', 'DOWN']),
});

export type FeedbackInput = z.infer<typeof feedbackSchema>;
