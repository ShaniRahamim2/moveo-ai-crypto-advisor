import 'dotenv/config';
import { PrismaClient, type ContentPreference, type InvestorType } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

interface SeedProfile {
  name: string;
  email: string;
  password: string;
  selectedAssets: string[];
  investorType: InvestorType;
  contentPreferences: ContentPreference[];
}

// Two contrasting profiles. The first is the reviewer's demo login; the second
// exists so the personalization comparison in the README can be reproduced
// without signing up twice.
const profiles: SeedProfile[] = [
  {
    name: 'Demo Reviewer',
    email: process.env.DEMO_USER_EMAIL ?? 'demo@cryptoadvisor.app',
    password: process.env.DEMO_USER_PASSWORD ?? 'DemoReviewer2026!',
    selectedAssets: ['BTC', 'ETH'],
    investorType: 'HODLER',
    contentPreferences: ['MARKET_NEWS', 'CHARTS'],
  },
  {
    name: 'Dana Trader',
    email: 'daytrader@cryptoadvisor.app',
    password: 'DemoReviewer2026!',
    selectedAssets: ['SOL', 'DOGE'],
    investorType: 'DAY_TRADER',
    contentPreferences: ['SOCIAL', 'FUN'],
  },
];

async function seedProfile(profile: SeedProfile) {
  const passwordHash = await bcrypt.hash(profile.password, 10);

  const user = await prisma.user.upsert({
    where: { email: profile.email },
    update: { name: profile.name, passwordHash, onboardingCompleted: true },
    create: {
      name: profile.name,
      email: profile.email,
      passwordHash,
      onboardingCompleted: true,
    },
  });

  await prisma.userPreference.upsert({
    where: { userId: user.id },
    update: {
      selectedAssets: profile.selectedAssets,
      investorType: profile.investorType,
      contentPreferences: profile.contentPreferences,
    },
    create: {
      userId: user.id,
      selectedAssets: profile.selectedAssets,
      investorType: profile.investorType,
      contentPreferences: profile.contentPreferences,
    },
  });

  return user;
}

async function main() {
  const [demoUser, traderUser] = await Promise.all(profiles.map(seedProfile));

  if (!demoUser || !traderUser) {
    throw new Error('Seed profiles were not created');
  }

  // Feedback rows so the reviewer opens the table to data rather than an empty
  // relation. contentRef identifies the exact item voted on.
  const feedbackRows = [
    {
      userId: demoUser.id,
      sectionType: 'COIN_PRICES' as const,
      contentRef: 'prices:BTC,ETH',
      vote: 'UP' as const,
      context: { assets: ['BTC', 'ETH'], investorType: 'HODLER' },
    },
    {
      userId: demoUser.id,
      sectionType: 'MEME' as const,
      contentRef: 'meme:sample-001',
      vote: 'DOWN' as const,
      context: { rotationIndex: 1 },
    },
    {
      userId: traderUser.id,
      sectionType: 'MARKET_NEWS' as const,
      contentRef: 'https://example.com/sample-headline',
      vote: 'UP' as const,
      context: { source: 'seed', assets: ['SOL', 'DOGE'] },
    },
  ];

  for (const row of feedbackRows) {
    await prisma.feedback.upsert({
      where: {
        userId_sectionType_contentRef: {
          userId: row.userId,
          sectionType: row.sectionType,
          contentRef: row.contentRef,
        },
      },
      update: { vote: row.vote, context: row.context },
      create: row,
    });
  }

  await prisma.insightCache.upsert({
    where: { contextHash: 'seed-sample-context' },
    update: {},
    create: {
      contextHash: 'seed-sample-context',
      insightText:
        'Sample cached insight created by the seed script so the cache table is not empty on first inspection. Real entries are written by the AI insight service.',
      model: 'seed',
    },
  });

  const counts = {
    users: await prisma.user.count(),
    userPreferences: await prisma.userPreference.count(),
    feedback: await prisma.feedback.count(),
    insightCache: await prisma.insightCache.count(),
  };

  console.log('Seed complete:', counts);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
