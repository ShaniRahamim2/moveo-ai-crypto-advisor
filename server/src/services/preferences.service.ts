import { prisma } from '../lib/prisma.js';
import { ApiError } from '../lib/apiError.js';
import type { PreferencesInput } from '../validation/preferences.schema.js';
import { buildPersonalizationContext, type PersonalizationContext } from './personalization.js';

export interface StoredPreferences {
  selectedAssets: string[];
  investorType: PreferencesInput['investorType'];
  contentPreferences: PreferencesInput['contentPreferences'];
  updatedAt: Date;
}

export async function getPreferences(userId: string): Promise<StoredPreferences | null> {
  return prisma.userPreference.findUnique({
    where: { userId },
    select: {
      selectedAssets: true,
      investorType: true,
      contentPreferences: true,
      updatedAt: true,
    },
  });
}

// Saving preferences is what completes onboarding, so both happen in one
// transaction: a saved preference with onboardingCompleted still false would
// trap the user on the onboarding screen.
export async function savePreferences(
  userId: string,
  input: PreferencesInput,
): Promise<StoredPreferences> {
  const [preference] = await prisma.$transaction([
    prisma.userPreference.upsert({
      where: { userId },
      update: {
        selectedAssets: input.selectedAssets,
        investorType: input.investorType,
        contentPreferences: input.contentPreferences,
      },
      create: {
        userId,
        selectedAssets: input.selectedAssets,
        investorType: input.investorType,
        contentPreferences: input.contentPreferences,
      },
      select: {
        selectedAssets: true,
        investorType: true,
        contentPreferences: true,
        updatedAt: true,
      },
    }),
    prisma.user.update({
      where: { id: userId },
      data: { onboardingCompleted: true },
      select: { id: true },
    }),
  ]);

  return preference;
}

export async function getPersonalizationContext(userId: string): Promise<PersonalizationContext> {
  const preferences = await getPreferences(userId);

  if (!preferences) {
    throw ApiError.badRequest('Complete onboarding before loading the dashboard');
  }

  return buildPersonalizationContext(preferences);
}
