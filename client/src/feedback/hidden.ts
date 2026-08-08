import { useMemo } from 'react';
import { useFeedback } from './queries';

export const ARTICLE_REF_PREFIX = 'article:';
export const MEME_REF_PREFIX = 'meme:';

/**
 * Hidden content is derived from the feedback cache rather than from the
 * dashboard payload, because the vote mutation updates the feedback cache
 * optimistically. Filtering here means a hide takes effect on click instead of
 * on the next dashboard load, and the two agree once the server responds.
 */
export function useHiddenContent() {
  const { data } = useFeedback();

  return useMemo(() => {
    const memeIds = new Set<string>();
    const articleUrls = new Set<string>();

    for (const vote of data?.feedback ?? []) {
      if (vote.vote !== 'DOWN') continue;
      if (vote.sectionType === 'MEME' && vote.contentRef.startsWith(MEME_REF_PREFIX)) {
        memeIds.add(vote.contentRef.slice(MEME_REF_PREFIX.length));
      }
      if (vote.sectionType === 'MARKET_NEWS' && vote.contentRef.startsWith(ARTICLE_REF_PREFIX)) {
        articleUrls.add(vote.contentRef.slice(ARTICLE_REF_PREFIX.length));
      }
    }

    return { memeIds, articleUrls };
  }, [data]);
}
