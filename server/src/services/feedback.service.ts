import type { Prisma, SectionType, Vote } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import type { FeedbackInput } from '../validation/feedback.schema.js';

export interface StoredVote {
  sectionType: SectionType;
  contentRef: string;
  vote: Vote;
  updatedAt: Date;
}

/**
 * Upsert on (userId, sectionType, contentRef): changing a vote updates the
 * existing row rather than accumulating duplicates, so the table stays a record
 * of current opinion per item rather than a click log.
 *
 * `context` snapshots the personalization state at vote time. It is what makes
 * the stored feedback useful for the ranking work described in
 * docs/FEEDBACK_MODEL_IMPROVEMENT.md — a vote without the context it was cast in
 * cannot train anything.
 */
export async function submitVote(
  userId: string,
  input: FeedbackInput,
  context?: Prisma.InputJsonValue,
): Promise<StoredVote> {
  return prisma.feedback.upsert({
    where: {
      userId_sectionType_contentRef: {
        userId,
        sectionType: input.sectionType,
        contentRef: input.contentRef,
      },
    },
    update: { vote: input.vote, ...(context ? { context } : {}) },
    create: {
      userId,
      sectionType: input.sectionType,
      contentRef: input.contentRef,
      vote: input.vote,
      ...(context ? { context } : {}),
    },
    select: { sectionType: true, contentRef: true, vote: true, updatedAt: true },
  });
}

export async function getVotes(userId: string): Promise<StoredVote[]> {
  return prisma.feedback.findMany({
    where: { userId },
    select: { sectionType: true, contentRef: true, vote: true, updatedAt: true },
    orderBy: { updatedAt: 'desc' },
  });
}
