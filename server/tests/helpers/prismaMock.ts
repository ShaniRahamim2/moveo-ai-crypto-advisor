import { vi } from 'vitest';

// Every model method used by the app. Tests set return values per case; nothing
// here reaches a real database.
export const prismaMock = {
  $queryRaw: vi.fn(),
  user: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  userPreference: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
  },
  feedback: {
    findMany: vi.fn(),
    upsert: vi.fn(),
  },
  insightCache: {
    findUnique: vi.fn(),
    create: vi.fn(),
  },
};

export function resetPrismaMock() {
  for (const group of Object.values(prismaMock)) {
    if (typeof group === 'function') {
      group.mockReset();
      continue;
    }
    for (const fn of Object.values(group)) {
      fn.mockReset();
    }
  }
}
