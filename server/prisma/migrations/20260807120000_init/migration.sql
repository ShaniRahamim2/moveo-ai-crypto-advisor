-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "SectionType" AS ENUM ('MARKET_NEWS', 'COIN_PRICES', 'AI_INSIGHT', 'MEME');

-- CreateEnum
CREATE TYPE "Vote" AS ENUM ('UP', 'DOWN');

-- CreateEnum
CREATE TYPE "InvestorType" AS ENUM ('HODLER', 'DAY_TRADER', 'NFT_COLLECTOR');

-- CreateEnum
CREATE TYPE "ContentPreference" AS ENUM ('MARKET_NEWS', 'CHARTS', 'SOCIAL', 'FUN');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_preferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "selectedAssets" TEXT[],
    "investorType" "InvestorType" NOT NULL,
    "contentPreferences" "ContentPreference"[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feedback" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sectionType" "SectionType" NOT NULL,
    "contentRef" TEXT NOT NULL,
    "vote" "Vote" NOT NULL,
    "context" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "insight_cache" (
    "id" TEXT NOT NULL,
    "contextHash" TEXT NOT NULL,
    "insightText" TEXT NOT NULL,
    "model" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "insight_cache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "user_preferences_userId_key" ON "user_preferences"("userId");

-- CreateIndex
CREATE INDEX "feedback_userId_idx" ON "feedback"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "feedback_userId_sectionType_contentRef_key" ON "feedback"("userId", "sectionType", "contentRef");

-- CreateIndex
CREATE UNIQUE INDEX "insight_cache_contextHash_key" ON "insight_cache"("contextHash");

-- CreateIndex
CREATE INDEX "insight_cache_generatedAt_idx" ON "insight_cache"("generatedAt");

-- AddForeignKey
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

