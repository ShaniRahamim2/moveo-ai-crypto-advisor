# AI Crypto Advisor

A personalized crypto dashboard. Users answer three short questions about what
they hold and how they invest, then get a daily briefing built around those
answers — prices, news, an AI insight and a meme — and can rate every section.
On memes and articles, that rating changes what they see immediately.

| | |
|---|---|
| **Live app** | https://moveo-ai-crypto-advisor-indol.vercel.app |
| **API** | https://moveo-ai-crypto-advisor-asx6.onrender.com/api/health |
| **Repository** | https://github.com/ShaniRahamim2/moveo-ai-crypto-advisor |

## Demo accounts

No signup needed. Both are seeded and onboarded, so they land straight on the
dashboard.

| Account | Password | Profile |
|---|---|---|
| `demo@cryptoadvisor.app` | `DemoReviewer2026!` | BTC, ETH · HODLer · News + Charts |
| `daytrader@cryptoadvisor.app` | `DemoReviewer2026!` | SOL, DOGE · Day Trader · Social + Fun |

> The backend runs on Render's free tier and sleeps after 15 minutes idle. The
> first request can take up to a minute; the app shows an explicit waking-up
> state rather than a blank screen.

## Screenshots

See [`docs/screenshots/`](docs/screenshots/). The live app above is the better
look — it takes one click with the demo login and shows real market data.

## Features

- Email/password signup and login, JWT, bcrypt-hashed passwords, protected routes
- Three-question onboarding with a searchable picker over 50 real coins, plus a
  "Not sure? Start with a popular mix" shortcut
- Four dashboard sections, each with its own status and its own failure state
- Voting on every section, persisted and restored, changeable
- Per-article "Show me more / less like this", with dismissals applied instantly
- Browsable memes; a thumbs-down hides that meme for that account, with a reset
- Editable preferences at any time
- Responsive down to 375px, keyboard accessible, `aria-pressed` on all controls

## Personalization

One pure function, `buildPersonalizationContext(preferences)`, is the single
source of truth. No personalization rule lives in a component.

| Answer | What it actually changes |
|---|---|
| **Assets** | Which prices are fetched and their order; which headlines surface; the assets named in the AI prompt |
| **Investor type** | The *framing* of the AI insight only — never the facts, never buy/sell advice |
| **Content preferences** | Section order; Charts adds sparklines; Social weights news by community signal where available |

All four sections always render. Coin Prices never falls below second place — a
financial product that reaches prices last does not read as one — and a test
asserts this across all 15 preference combinations.

**News is selected for coverage, not volume.** Crypto RSS skews heavily to
Bitcoin, so a straight relevance sort hands a user with five assets five Bitcoin
headlines. Selection is round-robin instead: every selected asset gets one
article before any asset gets a second. An asset with no genuine match is
skipped rather than padded — partial coverage of real matches beats full
coverage of forced ones. Four different coins across six headlines shows the
feature working at a glance.

### The two demo accounts, side by side

| | `demo@` (BTC/ETH · HODLer · News + Charts) | `daytrader@` (SOL/DOGE · Day Trader · Social + Fun) |
|---|---|---|
| Prices | BTC, ETH | SOL, DOGE |
| Sparklines | yes | no |
| Section order | Prices → News → Insight → Meme | Meme → Prices → News → Insight |
| AI framing | multi-week context for a long-term holder | recent volatility and short-term attention |
| News | filtered to BTC/ETH | filtered to SOL/DOGE |

Same code path, different output. Log into both to see it.

## Architecture

```
Routes → Controllers → Services → Providers / Prisma → External APIs / DB
```

No business logic in route handlers. Every external integration sits behind an
interface (`MarketDataProvider`, `NewsProvider`, `AIProvider`, `MemeProvider`),
injectable so the failure paths are genuinely testable. All provider calls happen
server-side; no provider key ever reaches the browser bundle.

```
client/   React + TypeScript + Vite + Tailwind
server/   Node + Express + TypeScript + Prisma
docs/     Overview, AI usage, DB access, feedback design
scripts/  Read-only database role
```

## Database

PostgreSQL on Neon. Five tables.

| Table | Purpose |
|---|---|
| `users` | Account, bcrypt hash, `onboardingCompleted` |
| `user_preferences` | One row per user: assets, investor type, content preferences |
| `feedback` | One row per (user, section, item) with the vote and a context snapshot |
| `insight_cache` | Generated insight keyed by a hash of the personalization context |
| `price_snapshots` | Last known good prices, so a cold start degrades instead of emptying |

`selectedAssets` and `contentPreferences` are Postgres arrays rather than join
tables: both are small, fixed-vocabulary lists, and inlining them avoids two join
tables that would earn nothing at this scale.

Feedback is keyed `UNIQUE (userId, sectionType, contentRef)` and written as an
upsert, so changing a vote updates the row instead of accumulating duplicates.
`contentRef` is namespaced — `article:<url>`, `meme:<id>`, `insight:<hash>`,
`prices:<assets>` — which is what lets per-article feedback share the table with
section-level votes.

## API

All routes are under `/api`. Everything except `/health`, `/auth/register` and
`/auth/login` requires a bearer token.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/health` | Service and database status |
| `POST` | `/auth/register` | Create an account, returns a token |
| `POST` | `/auth/login` | Sign in |
| `GET` | `/auth/me` | Current user |
| `GET` | `/preferences` | Stored preferences |
| `PUT` | `/preferences` | Save preferences, completes onboarding |
| `GET` | `/preferences/options` | Coin list, investor types, content types, starter mix |
| `GET` | `/dashboard` | All four sections, ordered, each with its own status |
| `GET` | `/dashboard/prices` | Prices only, for the section refresh control |
| `GET` | `/feedback` | Stored votes, for restoring state |
| `POST` | `/feedback` | Upsert a vote |
| `POST` | `/feedback/reset-hidden` | Restore hidden memes or articles |

`GET /api/dashboard` returns **HTTP 200 even when a section fails**, with a
per-section `status` of `ok`, `fallback` or `error`. A failing provider degrades
its own section and never the request.

## Reliability

Every provider has an explicit timeout (5s market and news, 12s AI), handles 429
without retrying, and degrades rather than throwing.

**Prices** — live → in-process cache → persisted snapshot, with its age stated
plainly → error. Only the last shows an empty card.

**News** — CryptoPanic → live RSS (Cointelegraph, Decrypt, CoinDesk,
CryptoSlate) → curated sample content, always labelled as such. CryptoPanic is
unreachable from both a residential IP and the deployed backend: every documented
v2 plan path returns 404 and v1 returns a Cloudflare bot challenge. The provider
is kept and tested; RSS serves in production.

**AI insight** — generated once per personalization context per day, because the
free tier allows roughly 50 requests. On failure it falls back to a summary
assembled from real market data and labelled as written without AI. Output is
capped in code at 120 words, because asking the model for a length is a request
and not a constraint — one live reply came back at 174.

**Fallback content is never presented as live.**

## Providers

| Provider | Used for | Notes |
|---|---|---|
| CoinGecko | Prices, logos, 7-day sparklines | Demo API key required in any deployed environment — keyless requests are rate limited per IP and that quota is *shared with every other caller on that IP*, which fails on shared hosting |
| RSS feeds | Market news | No key, four sources |
| OpenRouter | AI insight | Model `nvidia/nemotron-3-nano-30b-a3b:free`, verified with a live call and set via `OPENROUTER_MODEL` |
| Self-hosted | Memes | 14 images in `client/public/memes/`, listed in `server/src/data/memes.json`. Mixed formats (`.avif`, `.jpeg`, `.jpg`, `.png`, `.webp`) |

## Local setup

```bash
git clone https://github.com/ShaniRahamim2/moveo-ai-crypto-advisor.git
cd moveo-ai-crypto-advisor
npm run install:all
cp .env.example server/.env      # fill in DATABASE_URL, DIRECT_URL, JWT_SECRET, COINGECKO_API_KEY
echo "VITE_API_URL=http://localhost:4000" > client/.env
npm --prefix server run migrate:deploy
npm --prefix server run seed
npm run dev
```

Frontend on `http://localhost:5173`, API on `http://localhost:4000`.

### Environment variables

See `.env.example` for the full list with comments. The ones without defaults:
`DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `COINGECKO_API_KEY`,
`CRYPTOPANIC_AUTH_TOKEN`, `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`.

`DIRECT_URL` is separate because Prisma migrations fail against Neon's pooled
endpoint.

## Tests

```bash
npm test          # 170 tests
npm run lint
npm run build
```

Tests never call live external APIs; every provider is mocked. Coverage includes
the required auth, preference and feedback cases, plus:

- A provider returning **HTTP 429** — degrades, and asserts exactly one fetch
- A provider **exceeding its timeout** — genuinely aborts at 5001ms
- One provider fails → the other three still return `ok`
- A provider that *throws* rather than degrading
- All four providers failing at once
- The AI prompt contains no email, password, token or user id
- Coin Prices never falls below second across all 15 preference combinations
- Every meme in the manifest resolves to a file that exists on disk
- The rate limiter admits traffic to its limit and rejects the next request
- A `javascript:` link from a hostile feed never reaches the dashboard payload
- Malformed JSON and an oversize body answer 400 and 413, not 500

## Security

A review was run against the deployed application before submission, scoped to
what could plausibly be wrong in a project of this shape rather than as a general
audit: secrets in git history and in the bundle, authorization on every
authenticated endpoint, JWT handling, input validation, CORS, error responses,
the reviewer database role, and dependencies.

### Found and fixed

**Login leaked whether an account existed, through response time.** The uniform
"Incorrect email or password" was in place, and so was a bcrypt comparison
against a dummy hash meant to equalise timing — but the dummy was a hand-written
constant one character short of a valid bcrypt hash. bcrypt rejected it outright
in well under a millisecond instead of doing the work. Measured against
production, an unregistered address answered in ~0.12s and a registered one in
~0.65s, which is trivially separable over a network. The hash is now generated at
startup, and the two paths measure ~0.64s and ~0.60s — indistinguishable. A test
asserts the constant is a hash bcrypt actually evaluates.

**No rate limiting anywhere.** Login accepted unlimited password attempts, and
every dashboard build can reach CoinGecko and OpenRouter, whose free tiers one
client in a loop can exhaust for every user. Three limiters now: 10 per 15
minutes on authentication, 30 per minute on the dashboard, 120 per minute across
the API. Keyed on the caller's address, which required `trust proxy` — see below.

**Client faults were reported as server faults.** Malformed JSON and an oversize
body both returned 500. No information leaked, but a bad request blamed the
server and made the logs misleading. They now return 400 and 413.

**News links were rendered as `href` without scheme validation.** A hostile or
compromised RSS feed could have supplied a `javascript:` URL, which would run in
the app's origin where the token is. Links are now constrained to `http` and
`https` at the point the tiers converge, so a future source cannot forget it.

**The frontend sent no security headers.** The API was fully covered by helmet;
Vercel was serving only HSTS. The SPA holds the token, so it is the side that
most wants a CSP. It now sends CSP, `X-Content-Type-Options`, `X-Frame-Options`,
`Referrer-Policy` and `Permissions-Policy`.

**The JWT secret floor was 16 characters**, raised to 32. Production was already
a 64-character value from `openssl rand -hex 32`; the schema now says so.

**The database host was published in a public repository.** `DB_ACCESS.md` gave
the exact Neon endpoint and role name. Redacted — the host now travels with the
password in the submission email.

### The trust-proxy trap, since it nearly shipped wrong

Rate limiting keys on `req.ip`, which behind a proxy is only the real caller if
Express is told how many hops to trust. `trust proxy: 1` looked right and was
verified against production rather than assumed — it resolved to Render's
internal `10.199.154.211`, meaning **every user in the world would have shared a
single rate-limit bucket**. The real chain is three hops (Cloudflare's edge, then
two inside Render). At `trust proxy: 3`, requests from two different networks
resolved to two different addresses, and a deliberately forged
`X-Forwarded-For` was ignored because a forged entry is prepended and counting
from the right steps past it.

### Verified clean

`.env` was never committed; a scan of the full history for provider-key, database-URL,
JWT and token shapes found nothing. The client bundle contains no secret and
reads one variable, `VITE_API_URL`. No endpoint accepts a user identifier from
the body, params or query — every user-scoped call derives it from the verified
token, so there is nothing to manipulate. The JWT payload is `{iat, exp, sub}`
with an opaque id: no email, no name, no role. Tampered, `alg:none` and missing
tokens all give the same opaque 401. Every mutating route validates with Zod and
unknown keys are stripped; Prisma throughout, with the only raw SQL a constant
`SELECT 1`. CORS is exact-match — a foreign origin, a suffix lookalike, a preview
URL, `localhost` and `null` all get no `Access-Control-Allow-Origin`, on
preflight too. No stack trace or database error reaches a client. `npm audit`
reports zero vulnerabilities in all three packages.

### Accepted, with reasoning

**The reviewer's read-only role can read `users.passwordHash`.** That is inherent
to granting database access, not an oversight. The column holds bcrypt hashes at
cost 10, and the demo passwords are used nowhere else. Narrowing it would mean a
column-level grant that hides part of the schema from someone invited to inspect
it.

**The token is in `localStorage`**, so an XSS would expose it. This is the usual
trade-off for a bearer-token SPA; the alternative is an httpOnly cookie, which
brings CSRF handling and a cross-site cookie setup that the deployment
constraints here do not justify. The CSP added above is the mitigation that fits.

**No account lockout or MFA**, and no password-reset flow — reset needs a
transactional email provider with domain verification, which is outside this
assignment's free-tier constraint.

## Reviewer database access

A read-only Postgres role is available. Connection instructions are in
[`docs/DB_ACCESS.md`](docs/DB_ACCESS.md); **credentials are in the submission
email, not in this repository.** The role was created, connected to and
exercised: reads succeed on all tables, and `INSERT`, `UPDATE`, `DELETE`,
`CREATE TABLE` and `DROP TABLE` are all rejected.

## Documentation

- [`docs/ASSIGNMENT_OVERVIEW.md`](docs/ASSIGNMENT_OVERVIEW.md) — one-page summary
- [`docs/AI_USAGE.md`](docs/AI_USAGE.md) — how AI tools were used, per phase
- [`docs/FEEDBACK_MODEL_IMPROVEMENT.md`](docs/FEEDBACK_MODEL_IMPROVEMENT.md) — how feedback would train a model (bonus, documentation only)
- [`docs/DB_ACCESS.md`](docs/DB_ACCESS.md) — reviewer database access
- [`docs/DECISIONS.md`](docs/DECISIONS.md) — product and engineering decisions, with reasoning
- [`PROJECT_STATUS.md`](PROJECT_STATUS.md) — build checklist
- [`CLAUDE.md`](CLAUDE.md) — the build specification this was written against

## Known limitations

Stated in full, because a limitation found rather than disclosed makes the rest
of the document less trustworthy.

- **Authentication is rate limited to 10 attempts per 15 minutes per IP.** That
  is deliberate, but reviewers behind a shared address should know it exists
  before reading a 429 as a broken login.
- **No frontend tests.** All 170 tests are server-side. The interface has been
  verified by hand, including at a 375px viewport, but nothing guards a React
  regression.
- **CryptoPanic is unreachable**, so the Social preference is reduced to section
  reordering. The ranking code that would apply a community signal exists and is
  tested, but no live source supplies one, and inventing a score would be
  fabricating a signal.
- **Meme votes do not persist across a refresh** in the way the other sections
  do. Votes attach to the specific content voted on, and the meme is required to
  change on every refresh, so the new meme has no vote yet. A hide *does*
  persist.
- **Market News has no section-level vote.** Every article has its own up/down
  pair, which would make a section-level control redundant. Voting on the other
  three sections is section-level.
- **Render's free tier sleeps** after 15 minutes idle; the first request can take
  up to a minute.
- **The AI insight is cached for a full day** per personalization context. That
  is deliberate — the free tier allows roughly 50 requests a day — but it means
  the insight does not update as prices move. The prices beside it do.
- **No password reset.** A reset flow needs a transactional email provider with
  domain verification, which sits outside this assignment's free-tier
  constraint. In a production build it would be the next authentication feature
  after this one.
- **News asset tagging is inferred from headlines**, since RSS carries no
  instrument metadata. Symbols are matched case-sensitively because several
  ticker symbols are also ordinary English words.
