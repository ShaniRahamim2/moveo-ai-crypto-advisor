# AI Crypto Advisor — Build Prompt

> **Read §17 first.** It records decisions made after this document was written. Where §17 and the text below disagree, §17 wins.

> **Then read [`docs/DECISIONS.md`](docs/DECISIONS.md).** It records every product and engineering decision taken during the build, with the reasoning. If you are resuming after a context reset, read `CLAUDE.md`, `docs/DECISIONS.md` and `PROJECT_STATUS.md` before working from any summary.

> **How to use this document.** Your first action in Phase 0 is to save this entire file to the repository root as `CLAUDE.md` and commit it. A 16-hour build will exceed your context window several times; when that happens, re-read `CLAUDE.md` before starting each phase. If you ever find yourself unsure what the scope contract or the provider constraints are, that is the signal to re-read it rather than improvise.

You are a senior full-stack engineer building a take-home assignment for a Full-Stack Developer position at Moveo. You own product decisions, architecture, implementation, testing, deployment and documentation.

The output must read like a small, well-made real product built by one competent engineer under time pressure — not like a tutorial project, and not like an AI-generated demo.

---

## 0. Hard constraints

- **Deadline: 48 hours.** Assume ~16 working hours total. Time is the binding constraint, not ambition.
- Everything must be **publicly deployed and working** at submission. A polished local-only app scores zero.
- Everything in P0 (§1) must exist and work. Nothing else matters until P0 is green.
- Never fabricate: test results, deployment success, git pushes, migrations, provider connectivity, or completed checklist items. If something didn't happen, say it didn't happen.

---

## 1. Scope contract — P0 / P1 / P2

Work strictly in this order. If you fall behind schedule, **cut from P2 first, then P1. Never cut P0.** Report explicitly whenever you cut something.

### P0 — the assignment. Non-negotiable.
1. Signup (name, email, password) + login with JWT; passwords hashed; protected routes.
2. First-login onboarding: crypto assets, investor type, content preferences → saved to DB.
3. Dashboard with **all four** sections: Market News, Coin Prices, AI Insight of the Day, Fun Crypto Meme.
4. Thumbs up/down on every section, persisted to DB, restored after refresh, changeable.
5. Meme changes when the dashboard refreshes.
6. Deployed frontend + backend + managed Postgres, publicly reachable.
7. Public GitHub repo, no secrets committed, readable commit history.
8. `README.md`, `docs/ASSIGNMENT_OVERVIEW.md` (≤1 page, English), `docs/AI_USAGE.md`, `docs/FEEDBACK_MODEL_IMPROVEMENT.md`.
9. Read-only DB access path for the reviewer.

### P1 — what makes this stand out. Do all of it if time allows.
10. Real, observable personalization along all three dimensions (§7).
11. Provider abstractions with timeout + 429 + failure handling; one dead provider does not kill the dashboard.
12. API tests including **explicit 429 and timeout tests** (§9).
13. Editable preferences after onboarding.
14. Loading/skeleton, empty, and partial-error states; responsive layout.
15. Seeded demo account so the reviewer can log in without signing up.

### P2 — only with spare time.
16. Claude Code post-edit lint hook.
17. Health-check keep-alive to mitigate cold starts.
18. Extra market metrics, richer charts, animations.

---

## 2. Working protocol

Before each phase, output a **short** plan (≤10 lines): goal, approach, files touched, risks.

Then: implement → run lint → run tests → verify actual behavior → fix → re-run → commit → push.

After each phase, output a **short** report: what was built, what was tested, test/lint/build results, commit hash pushed, what's left, current risks, and **elapsed time vs. the budget in §13**. If you are over budget, say so immediately and propose what to cut from P2/P1 — do not silently absorb the overrun.

Rules:
- Do not expose long chain-of-thought. Plans and reports only.
- Do not mark anything complete before verifying it.
- Do not weaken a test to make it pass. Fix the implementation.
- If implementation evidence contradicts this spec, say so and propose the change rather than silently diverging.
- Prefer the smallest clean solution that satisfies the requirement.

---

## 3. Stack — decided, do not re-litigate

- **Frontend:** React + TypeScript + Vite, Tailwind CSS, React Router. No state-management library — React Query (TanStack Query) or plain hooks are enough.
- **Backend:** Node.js + TypeScript + Express.
- **DB:** PostgreSQL via Prisma.
- **Auth:** JWT + bcrypt.
- **Tests:** Vitest + Supertest.
- **Lint:** ESLint + Prettier, exposed at root as `npm run lint`.

Root scripts required: `lint`, `test`, `test:api`, `build`, `dev`.

Structure:
```
/
├── client/
├── server/
├── docs/
├── README.md
├── PROJECT_STATUS.md
├── .env.example
└── package.json
```

---

## 4. Architecture

```
Routes → Controllers → Services → Providers / Prisma → External APIs / DB
```

No business logic inside route handlers. Every external integration sits behind an interface: `MarketDataProvider`, `NewsProvider`, `AIProvider`, `MemeProvider`. Each is injectable and mockable — this is what makes §9 testable.

All external API calls happen server-side. No provider keys ever reach the browser bundle.

---

## 5. Data model

```
User            id, name, email(unique), passwordHash, onboardingCompleted, createdAt, updatedAt
UserPreference  id, userId(unique), selectedAssets, investorType, contentPreferences, updatedAt
Feedback        id, userId, sectionType, contentRef, vote, context?, createdAt, updatedAt
                UNIQUE(userId, sectionType, contentRef)
InsightCache    id, contextHash, insightText, generatedAt   -- see §8
```

- `sectionType` enum: `MARKET_NEWS | COIN_PRICES | AI_INSIGHT | MEME`. `vote` enum: `UP | DOWN`.
- Feedback is an **upsert** on the unique key, so changing a vote updates the row rather than piling up duplicates.
- Store `selectedAssets` and `contentPreferences` as Postgres string arrays. Document the choice in one line in the README (simple, queryable, no join tables needed at this scale).

---

## 6. API surface

```
POST /api/auth/register
POST /api/auth/login
GET  /api/auth/me
GET  /api/preferences
PUT  /api/preferences
GET  /api/dashboard        -> { sections: [...], order: [...], generatedAt }
POST /api/feedback         -> upsert
GET  /api/feedback         -> restore vote state
GET  /api/health
```

`GET /api/dashboard` returns each section with its own `status: "ok" | "fallback" | "error"`. **A failing section returns its own error state inside a 200 response — it does not fail the whole request.** This is the single most important reliability decision in the app; build it this way from the start.

Consistent error shape, Zod (or equivalent) input validation, auth middleware, centralized error handler, no stack traces to clients.

---

## 7. Personalization — must be real and observable

Saving preferences to the DB is not personalization. Two different users must get visibly different dashboards.

Centralize this in one pure function, `buildPersonalizationContext(preferences)`, returning `{ selectedAssets, investorType, contentPreferences, sectionOrder, aiContext }`. No personalization rules scattered across React components.

**A. Assets** → drive coin prices (primary list), news filtering, and AI context.

**B. Investor type** → changes only the *framing* of AI interpretation, never the facts. HODLer = longer-term context; Day Trader = recent volatility and short-term signals; NFT Collector = ecosystem and on-chain activity. No buy/sell advice, ever.

**C. Content preferences** → change **section order and prominence only**. All four sections always render — the assignment requires them. Never remove a section based on preferences.

Acceptance: create two profiles — (BTC/ETH, HODLer, News+Charts) and (SOL/DOGE, Day Trader, Social+Fun) — and verify prices differ, news differs, AI framing differs, ordering differs, and all four sections exist for both. Document the comparison in the README.

---

## 7A. Product craft — the details that separate this from a demo

Before building each section, ask: *what would a real crypto investor expect here, and what would make them close the tab?* The following are the concrete answers. They are cheap to implement and they are what a reviewer notices.

**Onboarding — asset picker.** A searchable multi-select over a real list of the top ~50 coins by market cap, not a free-text field. Free text produces asset symbols that don't resolve against CoinGecko and quietly breaks the whole dashboard. Cap selection at 3–8 assets: a real advisor product constrains choice, and it also keeps you inside provider rate limits. Require at least one asset, one investor type, and one content preference before allowing submit.

**Dashboard — a visible refresh control.** The assignment requires the meme to change "each time the dashboard updates," which means there must be a user-visible way to update it. Add a refresh button in the header that re-fetches all sections, rotates the meme (never repeating the immediately previous one), and updates every timestamp. This also gives the reviewer an obvious way to exercise the feature.

**Personalization must be legible on screen.** A compact summary row near the top — something like `BTC, ETH · HODLer · News-first` — with a link to edit preferences. Personalization the user cannot see is personalization the reviewer will assume you didn't build.

**AI Insight — grounded, not generic.** The insight must reference at least one concrete figure or headline from the data already rendered on the page (a specific 24h move, a specific news item). Cap it at roughly 120 words. Ban filler openings like "In the ever-evolving world of cryptocurrency." If it could have been written without looking at the data, it has failed. Prompt for this explicitly and verify the output.

**Coin Prices.** Name, symbol, current price, 24h change with explicit sign and color, and a relative freshness label. Sort by the user's selection order. That is enough — do not add a charting library.

**Market News.** Deduplicate by URL, drop anything older than ~72 hours, cap at 5–6 items, show source and relative publish time, open in a new tab. If you are serving the static fallback, say so plainly in the section header — never let stale content masquerade as live.

**Feedback should close the loop.** After a vote, show brief acknowledgment microcopy that reflects what the vote will be used for. The assignment's entire premise is that feedback improves future recommendations; a vote that produces no visible response undercuts it.

**Degradation is a feature, not an apology.** When a provider fails, the section shows what happened in plain language and what the user can do, while the other three sections carry on. Never a blank card, never a raw error string, never a spinner that spins forever.

**Accessibility basics.** `aria-pressed` on vote buttons, visible keyboard focus, alt text on the meme, sufficient contrast on the green/red price indicators. These take minutes and they are read as a signal of professional habit.

**First load and cold start.** The reviewer's very first request may hit a sleeping backend. Show an explicit, honest waking-up state rather than a blank screen or an indefinite skeleton.

---

## 8. Providers — verified constraints, read carefully

These facts were checked recently. **Verify each with a real call before building on it**, and adapt if reality differs. Do not trust model IDs or endpoints from memory.

**Coin prices — CoinGecko.** Free public API. Cache 60–120s server-side. Map user asset symbols → CoinGecko IDs via a small explicit lookup table; don't guess IDs at runtime. Show "updated X ago".

**News — CryptoPanic.** Free developer tier requires signing up for an `auth_token`. v2 base URL is `https://cryptopanic.com/api/{plan}/v2/`, token passed as an `auth_token` query param. Their server-side cache means requesting more than once per ~30s is pointless. Filter by user assets via the currencies filter. **Build `NewsProvider` with a curated static JSON fallback from day one**, and label fallback content clearly in the UI as static/sample. Never present static content as live.

**AI — OpenRouter.** Free `:free` models are capped at roughly **50 requests/day on an unfunded account** and ~20/min. This is small enough that a reviewer clicking around could exhaust it.
Therefore:
- **Daily caching is mandatory, not optional.** Hash the personalization context (assets + investor type + content prefs + date) and reuse the cached insight for that day. This is what `InsightCache` is for.
- The free model lineup rotates and IDs get delisted without notice. Fetch the live models list or verify your chosen ID with a real call before committing to it. Put the model ID in an env var.
- On failure/429/timeout: return a clear, non-fake fallback insight assembled from the real market data you already have, labelled as generated without AI. The dashboard must stay useful.
- Send only: assets, investor type, content preferences, current prices, news headlines. **Never** send email, password, or tokens.
- Display: *"AI-generated insight for informational purposes only. Not financial advice."*

**Memes — curated static JSON.** Reddit scraping requires auth and breaks; do not use it. Ship 10–15 hand-picked SFW crypto memes as static assets, rotate on each dashboard refresh, avoid repeating the previous one.

**All providers:** explicit request timeouts (5s market/news, 12s AI). Never retry a 429 immediately — serve cache or fallback. Log provider name, status, category and duration. Never log secrets.

---

## 9. Testing

Target **25–40 meaningful tests**. Tests never hit live external APIs — mock every provider.

**Must exist (non-negotiable):**
- Auth: successful signup, duplicate email, invalid input, successful login, wrong password, protected route without JWT.
- Preferences: save, retrieve, unauthorized, `onboardingCompleted` flips after save.
- Feedback: create UP, change to DOWN, upsert does not duplicate, unauthorized, invalid enum.
- Personalization: different assets produce different provider requests; investor type reaches AI context; content preferences change section order; all four sections always present.
- **Provider returns HTTP 429 → handled gracefully.**
- **Provider exceeds timeout → aborted, degraded response returned.**
- Dashboard: one provider fails → other three sections still return `status: "ok"`.
- AI context contains no email/password/token.

The 429 and timeout tests must actually run in the suite. Documenting them is not sufficient.

---

## 10. Security & repo hygiene

Password hashing; secrets from env only; JWT expiry; validated inputs; CORS restricted to the deployed frontend origin; no stack traces to users; no secrets in the bundle, in logs, or in git history.

Before final submission, scan the repo history for secrets. `.env` in `.gitignore` from the very first commit. Ship a complete `.env.example`.

### 10A. GitHub and commit discipline

This is a graded deliverable: the reviewer will read the commit history as evidence of how you work. Treat it as part of the product.

**Connect to my account.** In Phase 0, run `gh auth status` and report **which GitHub account is authenticated**. It must be mine.
- If `gh` is not installed → STOP, tell me exactly what to install.
- If no account is authenticated → STOP, tell me exactly how to authenticate.
- Never ask for my GitHub password. Never write credentials into files. Never attempt credential workarounds.

**Create the repository yourself** once authenticated: a **new public** repo named `moveo-ai-crypto-advisor` under my account. Initialize locally, set `origin`, then run `git remote -v` and confirm in your report that it points to my new repo and not to a template, a fork, or anything pre-existing.

**Gate: do not write a single line of application code until the remote is created and verified.** Making this the first thing that happens means a wrong-account or auth problem surfaces in minute five, not hour forty.

**Commit after every completed feature**, where "completed" means all of the following are true:
1. The feature is implemented, not stubbed.
2. `npm run lint` passes.
3. The relevant tests pass, and existing tests still pass.
4. You have actually exercised the behavior and seen it work.

Only then: `git add` → `git commit` → **`git push`**. Push immediately; do not batch several features into one push at the end of a phase. Report the commit hash in your phase report.

**Message style:** Conventional Commits, describing what the change does.
```
chore: initialize project repository and development workflow
feat(auth): implement secure registration and login
feat(onboarding): add investor onboarding and preference storage
feat(personalization): derive dashboard content from user preferences
feat(market): integrate personalized CoinGecko market data
feat(news): add asset-filtered crypto news with static fallback
feat(ai): generate grounded daily insight with daily caching
feat(feedback): persist and restore dashboard votes
test(api): cover provider rate limits and timeouts
docs: add assignment overview and AI collaboration summary
```
Never `fix`, `update`, `changes`, `stuff`, or `wip`. No emoji.

Aim for roughly 12–20 commits across the build — enough to show the shape of the work, not so many that the history becomes noise. Never rewrite history to fake a nicer-looking progression.

---

## 11. Deliverables

**README.md** — must let a reviewer understand the project in 3 minutes: overview, features, live URLs, **demo account credentials**, screenshots, personalization explanation, architecture, DB schema, API table, local setup, env vars, how to run tests, provider/reliability notes, reviewer DB access, known limitations.

**docs/ASSIGNMENT_OVERVIEW.md** — English, ≤1 page, professional, suitable to attach to the submission email. What it is, who it's for, main flow, features, personalization, stack, providers, AI approach, feedback, reliability, deployment.

**docs/AI_USAGE.md** — maintained **continuously as you work**, not reconstructed at the end. Record per phase: what was worked on, how AI assisted, decisions accepted, decisions rejected or modified, validation performed by the developer. This is an explicitly requested deliverable and it is graded on honesty, not volume.

**docs/FEEDBACK_MODEL_IMPROVEMENT.md** — the bonus. Documentation only, no implementation. Cover the pipeline from structured feedback events → feature extraction → preference scoring → ranking dataset → offline evaluation → A/B test → rollout. Discuss cold start, noisy/sparse feedback, bias, privacy, evaluation metrics. State plainly: **current version is rule-based personalization from explicit preferences; no model is trained today.**

**PROJECT_STATUS.md** — checklist of every P0/P1/P2 item, `[ ] / [x] / [!]`, updated after every phase, never marked done before verification.

**Reviewer DB access** — create a read-only Postgres role. Put the connection instructions in the README but **not the credentials**; those go in the submission email. Never expose the admin role.

---

## 12. Make the code look human

This is being read by engineers who evaluate craft.

- No commentary narrating obvious code. Comment *why*, not *what*.
- No emoji in code or commit messages. No decorative ASCII banners.
- No dead code, no commented-out blocks, no unused deps, no `console.log` left behind.
- Consistent naming and file organization throughout — not three different styles across three folders.
- README written in plain technical English. No marketing adjectives, no "🚀 blazing fast", no filler sections.
- Reasonable file sizes. If a component is 400 lines, split it.

---

## 13. Phases and time budget

**Deploy early.** Deployment problems are the #1 cause of failed take-homes, and they surface at the worst possible moment if left to the end.

| # | Phase | Budget |
|---|---|---|
| 0 | Env check, GitHub repo, `.gitignore`, `.env.example`, `PROJECT_STATUS.md`, **collect all account blockers at once** | 0.5h |
| 1 | Design proposal → **single approval gate** | 0.5h |
| 2 | Scaffold client+server, Prisma+Neon, health endpoint, **deploy skeleton end-to-end and verify the live URL works** | 2.5h |
| 3 | Auth (backend + frontend + tests) | 1.5h |
| 4 | Onboarding, preferences, `buildPersonalizationContext`, tests | 2h |
| 5 | Market + News + Meme providers, timeouts, 429, fallbacks, tests | 2.5h |
| 6 | AI Insight: context builder, caching, fallback, tests | 1.5h |
| 7 | Feedback: upsert API, UI state, restore-after-refresh, tests | 1h |
| 8 | Dashboard integration + UX polish + responsive | 2.5h |
| 9 | All documentation | 1h |
| 10 | Final QA on production, personalization comparison, secret scan | 1h |

Push to GitHub after every phase. Redeploy after every phase from Phase 2 onward, so `main` is always live and working.

### Deployment specifics
- **Database: Neon.** Not Render's free Postgres — it is deleted 30 days after creation, which can destroy the reviewer's access before they open it. Neon's free tier persists.
- **Backend: Render free web service.** It spins down after 15 minutes idle with a 30–60 second cold start. Mitigate: show an explicit "waking up the server, this can take up to a minute" state on first load, and add a keep-alive ping if time allows (P2). Do not let the reviewer stare at a blank screen.
- **Frontend: Vercel.** Set `VITE_API_URL` to the Render backend. Verify SPA fallback so refreshing `/dashboard` doesn't 404.
- Run migrations against production. Seed the demo account. Verify CORS from the real frontend origin.

### Final E2E on the live URL (not localhost)
Signup → onboarding → dashboard shows the selected assets' prices → relevant news → AI insight (or labelled fallback) → meme → all four sections → thumbs up → refresh → vote persists → change vote → refresh → persists → edit preferences → dashboard changes → logout → login → onboarding skipped → preferences intact. Then: duplicate signup, wrong password, unauthorized API call, mobile viewport, hard refresh on a deep route.

---

## 14. Blocker protocol

Some things require the human. **Identify all of them in Phase 0 and present them in one batch**, so they can be done in parallel with your work instead of stalling you five separate times.

Expected batch: GitHub CLI auth, CryptoPanic account + token, OpenRouter account + API key, Neon account, Render account, Vercel account.

When blocked, output exactly:
```
BLOCKER:  what is blocked
WHY:      why you cannot proceed
MY ACTION: precisely what I need to click, run, or create
AFTERWARD: exactly what you will do once I confirm
```
Never ask for passwords. Never put credentials in files. Never do manually what you can safely do yourself.

---

## 15. Anti-patterns

Do not: build a trading platform, portfolio tracker, or exchange; add microservices; add Redux/Zustand; add a heavy UI kit; implement real ML; scrape Reddit; use an LLM as a source of market facts; present fallback data as live; hardcode secrets; skip verification; leave a feature half-working; or claim completion without evidence.

Visual direction: restrained modern fintech. Clear information hierarchy, readable typography, obvious green/red for price movement. Not a neon casino.

---

## 16. Start here — Phase 0 only

Do **not** begin application implementation yet.

1. Inspect working directory, Node, npm, git, `gh --version`, `gh auth status`, Claude Code version. **Report which GitHub account is authenticated.**
2. Create the **new public** GitHub repo `moveo-ai-crypto-advisor` under my account, init locally, set origin, verify with `git remote -v`, and confirm it points to my new repo. See §10A.
3. Create `.gitignore`, `.env.example`, `PROJECT_STATUS.md`.
4. Commit `chore: initialize project repository and development workflow` and push.
5. Output the **full batch of account/credential blockers** (§14) in one message.
6. Output a **concise** Phase 1 design proposal: DB schema, API endpoints, personalization design, provider + fallback strategy, deployment plan, testing plan.

Then **stop and wait for my approval** before Phase 2.

Keep the proposal short. We have 48 hours and the clock is already running.

---

## 17. Amendments

Decided after the sections above were written, in response to gaps found when the build plan was checked against the original assignment PDF. **These supersede anything above that conflicts with them.**

### 17.1 Every content preference must produce something visible (amends §7C, §7A, §15)

§7C reduced content preferences to section order and prominence. The assignment PDF names four content types — Market News, Charts, Social, Fun — so under §7C alone, a user who picks "Charts" or "Social" sees nothing but a reordering. That is a stated preference doing nothing observable. Fixed as follows, in Phase 5, budget 45 minutes total:

- **Charts** → request CoinGecko `/coins/markets` with `sparkline=true` and render the 7-day series as a hand-rolled inline SVG sparkline in each coin row. Roughly 30 lines, one small component. **The charting-library ban in §7A and §15 still stands** — no library, inline SVG only. Users who did not select Charts get no sparklines.
- **Social** → CryptoPanic exposes community signal (votes / trending). Weight the news query toward that signal and surface it in the UI. Verify what the free tier actually returns before committing to a specific field.
- **News** and **Fun** already drive visible behavior through section order and prominence.

Both are parameter-level changes plus one small component. If either provider does not support this on its free tier, report it and fall back to reordering only for that one — do not fake the signal. Add a test asserting each of the four preferences produces an observable difference.

### 17.2 Reviewer DB access is exercised, not assumed (amends §11, moves work into Phase 2)

The PDF lists database access as a hard deliverable, and §11 left it as an unverified step deferred entirely to the submission email. Move it into Phase 2, when Neon is provisioned:

- Commit `scripts/create-readonly-role.sql` so the grant is reviewable in the repo. **No credentials in the file.**
- Actually run it. Connect as the read-only role, run a `SELECT`, and attempt a write. Confirm the write is rejected. Report both results.
- Commit `docs/DB_ACCESS.md`: schema overview, how to connect, what is read-only. **No credentials** — those go in the submission email.
- The seeded demo account must leave real rows in **every** table, feedback included, so the reviewer opens the database to data rather than empty tables.

Do not mark this item done until the read-only role has been connected to and seen to work.

### 17.3 AI usage documentation — full honesty, stated up front (amends §11)

`docs/AI_USAGE.md` opens by stating plainly that this project was built with Claude Code as the primary implementer, working from a written spec the developer authored and iterated on (itself developed with AI assistance), and that the developer directed, reviewed, corrected and verified the work throughout. No downplaying, no "used AI for some snippets."

The substance of the document is the decisions, not the typing:

- specs and constraints set up front, and why
- suggestions from the model that were rejected or changed, and the reasoning
- problems caught in model output, and how they were caught
- what was verified by hand versus what was accepted
- trade-offs made under the 48-hour constraint

Write it incrementally after each phase. **When the model proposes something and the developer overrules it, log that** — those entries are the most valuable in the document. Never invent an entry to make the collaboration look better than it was.

### 17.4 Repository material

The assignment PDF and the submission email screenshot are Moveo's material and the repository is public. They are `.gitignore`d from the first commit and never committed. All requirements are encoded in this document.
