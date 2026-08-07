import type { Meme } from '../types.js';

/**
 * Curated, self-contained meme cards rendered as styled text in the client.
 *
 * Reddit scraping needs auth and breaks, and hotlinking third-party meme images
 * means a dead image on someone else's schedule. These ship with the app, so the
 * section cannot fail.
 */
export const MEMES: Meme[] = [
  {
    id: 'meme-001',
    caption: 'Bought the dip',
    subcaption: 'It kept dipping.',
    accent: '#f05252',
    altText: 'Meme card reading: Bought the dip. It kept dipping.',
  },
  {
    id: 'meme-002',
    caption: 'My portfolio is diversified',
    subcaption: 'Down in seven different currencies.',
    accent: '#f59e0b',
    altText: 'Meme card reading: My portfolio is diversified. Down in seven different currencies.',
  },
  {
    id: 'meme-003',
    caption: 'HODL',
    subcaption: 'Originally a typo. Now a personality.',
    accent: '#22c55e',
    altText: 'Meme card reading: HODL. Originally a typo. Now a personality.',
  },
  {
    id: 'meme-004',
    caption: '"I will sell at the top"',
    subcaption: 'The top, four years ago.',
    accent: '#4f8cff',
    altText: 'Meme card reading: I will sell at the top. The top, four years ago.',
  },
  {
    id: 'meme-005',
    caption: 'Checked the charts at 3am',
    subcaption: 'Nothing had changed. Checked again at 3:04.',
    accent: '#a855f7',
    altText: 'Meme card reading: Checked the charts at 3am. Nothing had changed. Checked again at 3:04.',
  },
  {
    id: 'meme-006',
    caption: 'Green candle appears',
    subcaption: 'Suddenly an expert in monetary policy.',
    accent: '#22c55e',
    altText: 'Meme card reading: Green candle appears. Suddenly an expert in monetary policy.',
  },
  {
    id: 'meme-007',
    caption: 'Explaining crypto at dinner',
    subcaption: 'Nobody asked. Everyone is leaving.',
    accent: '#f59e0b',
    altText: 'Meme card reading: Explaining crypto at dinner. Nobody asked. Everyone is leaving.',
  },
  {
    id: 'meme-008',
    caption: 'Wallet seed phrase',
    subcaption: 'Written down somewhere extremely safe. Location unknown.',
    accent: '#f05252',
    altText: 'Meme card reading: Wallet seed phrase. Written down somewhere extremely safe. Location unknown.',
  },
  {
    id: 'meme-009',
    caption: 'Down 60%',
    subcaption: 'Long-term investor, actually.',
    accent: '#4f8cff',
    altText: 'Meme card reading: Down 60 percent. Long-term investor, actually.',
  },
  {
    id: 'meme-010',
    caption: 'Gas fees: $84',
    subcaption: 'Transaction value: $12.',
    accent: '#a855f7',
    altText: 'Meme card reading: Gas fees 84 dollars. Transaction value 12 dollars.',
  },
  {
    id: 'meme-011',
    caption: 'This time it is different',
    subcaption: 'It is never different.',
    accent: '#f59e0b',
    altText: 'Meme card reading: This time it is different. It is never different.',
  },
  {
    id: 'meme-012',
    caption: 'Sold at a loss',
    subcaption: 'It recovered in ninety minutes.',
    accent: '#f05252',
    altText: 'Meme card reading: Sold at a loss. It recovered in ninety minutes.',
  },
  {
    id: 'meme-013',
    caption: 'Read the whitepaper',
    subcaption: 'Understood the cover page.',
    accent: '#4f8cff',
    altText: 'Meme card reading: Read the whitepaper. Understood the cover page.',
  },
  {
    id: 'meme-014',
    caption: 'Sideways for three weeks',
    subcaption: 'Analysts call it "consolidation". I call it a nap.',
    accent: '#22c55e',
    altText: 'Meme card reading: Sideways for three weeks. Analysts call it consolidation. I call it a nap.',
  },
  {
    id: 'meme-015',
    caption: 'Set a price alert',
    subcaption: 'Now checking manually every four minutes anyway.',
    accent: '#a855f7',
    altText: 'Meme card reading: Set a price alert. Now checking manually every four minutes anyway.',
  },
];
