import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';

export const ARTICLE_REF_PREFIX = 'article:';
export const MEME_REF_PREFIX = 'meme:';

export interface HiddenContent {
  memeIds: Set<string>;
  articleUrls: Set<string>;
}

/**
 * A thumbs-down is the hide signal, so no separate table is needed: the existing
 * unique key (userId, sectionType, contentRef) already stores exactly one row per
 * user per item. Article dismissals use their own reference prefix so they cannot
 * collide with the section-level news vote, which is keyed on a hash of the set.
 */
export async function getHiddenContent(userId: string): Promise<HiddenContent> {
  try {
    const rows = await prisma.feedback.findMany({
      where: { userId, vote: 'DOWN' },
      select: { sectionType: true, contentRef: true },
    });

    const memeIds = new Set<string>();
    const articleUrls = new Set<string>();

    for (const row of rows) {
      if (row.sectionType === 'MEME' && row.contentRef.startsWith(MEME_REF_PREFIX)) {
        memeIds.add(row.contentRef.slice(MEME_REF_PREFIX.length));
      }
      if (row.sectionType === 'MARKET_NEWS' && row.contentRef.startsWith(ARTICLE_REF_PREFIX)) {
        articleUrls.add(row.contentRef.slice(ARTICLE_REF_PREFIX.length));
      }
    }

    return { memeIds, articleUrls };
  } catch {
    // Hiding is a preference, not a correctness requirement. If it cannot be
    // read, show everything rather than failing the dashboard.
    logger.warn('hidden_content_read_failed');
    return { memeIds: new Set(), articleUrls: new Set() };
  }
}

export async function resetHidden(userId: string, sectionType: 'MEME' | 'MARKET_NEWS') {
  const prefix = sectionType === 'MEME' ? MEME_REF_PREFIX : ARTICLE_REF_PREFIX;

  const { count } = await prisma.feedback.deleteMany({
    where: { userId, sectionType, vote: 'DOWN', contentRef: { startsWith: prefix } },
  });

  return { restored: count };
}
