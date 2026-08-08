# AI Crypto Advisor — Assignment Overview

**Live app:** https://moveo-ai-crypto-advisor-indol.vercel.app
**Repository:** https://github.com/ShaniRahamim2/moveo-ai-crypto-advisor
**Demo login:** `demo@cryptoadvisor.app` / `DemoReviewer2026!`

## What it is

A personalized crypto dashboard. A user signs up, answers three short questions
about what they hold and how they invest, and gets a daily briefing built around
those answers. Every section can be rated, and on two of them the rating changes
what the user sees immediately.

**Flow:** sign up → three-question onboarding → dashboard → rate sections → edit
preferences and watch the dashboard change.

## The four sections

- **Coin Prices** — live from CoinGecko in the user's own order, with logo, 24h
  change in green or red, a hand-drawn 7-day sparkline for users who asked for
  charts, and its own refresh control rate-limited to match the server cache.
- **Market News** — live headlines from four RSS feeds, deduplicated, filtered to
  the user's assets, each with a one-line description. Individually rateable.
- **AI Insight of the Day** — generated from the prices and headlines already on
  the page, shown as a one-sentence summary that expands on click, and visually
  separated so generated text is never mistaken for data.
- **Fun Crypto Meme** — curated and self-hosted, browsable, rotating on refresh.

## Personalization

All three answers do observable work, decided in one pure function so no rule is
scattered across components. **Assets** drive which prices are fetched, in which
order, which headlines surface, and what the AI prompt names. **Investor type**
changes only the *framing* of the AI interpretation — never the facts, and never
into buy or sell advice. **Content preferences** change section order and enable
features: Charts adds sparklines, Fun promotes the meme.

All four sections always render, and Coin Prices never falls below second place —
a financial product that reaches prices last does not read as one.

Two seeded accounts make this checkable in a minute: the demo account above
(BTC/ETH, HODLer, News + Charts) and `daytrader@cryptoadvisor.app`, same password
(SOL/DOGE, Day Trader, Social + Fun). Same code, visibly different dashboards.

**A decision worth naming.** The strongest evidence that feedback matters is that
it does something visible. Storing a vote "for future model improvement" is a
promise; hiding a meme the moment it is rated is a demonstration. I made that
split deliberately — the two sections where an immediate action is honest act
immediately, and the two where it would be a lie say only that the vote was
recorded.

## Feedback

Votes are stored with a snapshot of the personalization context they were cast
in, keyed so changing a vote updates the row rather than accumulating duplicates,
and restored after refresh. On memes and articles the vote acts immediately: a
thumbs-down hides that item for that account, with an explicit way to restore it.
Elsewhere the vote is recorded and the interface says only that — a control
claiming to change the screen while doing nothing reads as broken.
`FEEDBACK_MODEL_IMPROVEMENT.md` describes how this data would train a ranking
model. None is trained today.

## Stack and reliability

React + TypeScript throughout, Express and Prisma on Neon Postgres, JWT with
bcrypt, 170 tests. Deployed on Vercel and Render.

Every external integration sits behind an interface with an explicit timeout, 429
handling and a fallback, injectable so failure paths are genuinely testable.
`GET /api/dashboard` returns HTTP 200 with a per-section status of `ok`,
`fallback` or `error`: **a failing provider degrades its own section and never
the request.** Prices fall back to a cached snapshot with its age stated; news
falls back through live RSS to clearly-labelled sample content; the AI insight is
cached daily to stay inside a free tier of roughly 50 requests and degrades to a
summary built from real market data, labelled as written without AI. Fallback
content is never presented as live.

A focused security review before submission produced eight findings — among them
a timing-attack mitigation the code claimed but did not deliver, and
authentication with no rate limiting at all; seven were fixed and the eighth
accepted with its reasoning stated.

All free tiers, so the backend sleeps when idle and the first load can take up to
a minute — the interface says so rather than showing a blank screen. A read-only
database role is available for review.
