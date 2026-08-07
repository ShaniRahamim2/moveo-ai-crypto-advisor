# AI usage

## How this project was built

This project was built with Claude Code as the primary implementer. It wrote the
great majority of the code in this repository.

It worked from a written specification I authored and iterated on before any code
existed — a build plan covering scope priorities, architecture, the data model,
provider constraints, testing requirements, commit discipline and a phase-by-phase
time budget. That specification was itself developed with AI assistance. It lives
in the repository as [`CLAUDE.md`](../CLAUDE.md), unedited except for an
amendments section recording decisions made after the build started.

My role was direction, review, correction and verification: setting the
constraints, deciding the trade-offs, checking claims against evidence, and
overruling the model where I disagreed with it. I did not review every line with
equal attention — the section below is explicit about what I checked closely and
what I accepted on the strength of a passing test or a working deployment.

This document is written as the work happens, one entry per phase. It is a record
of what actually occurred, including the mistakes.

---

## Constraints I set before any code was written

These were decided up front because they are the things that are expensive to
change later.

- **Priority ordering (P0/P1/P2) with an explicit instruction to cut from P2
  first and report every cut.** The failure mode of an AI-assisted build under a
  deadline is a broad, shallow surface where nothing is finished. Naming what may
  be sacrificed in advance removes that judgement call from the moment of time
  pressure.
- **A failing provider degrades one dashboard section, never the request.**
  `GET /api/dashboard` returns 200 with a per-section status. Specified before
  implementation because retrofitting partial failure onto a route that assumes
  success means rewriting it.
- **Every external integration behind an injectable interface.** Not for
  architectural neatness — it is the only way the required 429 and timeout tests
  can exist without calling live APIs.
- **Daily caching of the AI insight, mandatory.** Free-tier limits are roughly 50
  requests/day; a reviewer clicking around could exhaust them.
- **No fabricated status.** Nothing marked complete before the behavior was
  exercised and observed.
- **Verify provider facts with a real call before building on them.** Model IDs
  and endpoint shapes from model memory are unreliable.

---

## Phase 0 — environment, repository, hygiene

**Worked on:** environment checks, GitHub repo creation, `.gitignore`,
`.env.example`, `PROJECT_STATUS.md`, blocker collection, design proposal.

**Where AI assisted:** drafted all scaffolding files, ran the environment audit,
created and verified the remote.

**A gap I asked it to find, and what came back.** Before starting I had it read
the original assignment PDF against my build plan and report anything my plan
handled incompletely. It found three things, and I agreed with all three:

1. My plan reduced content preferences to section ordering only, while the
   assignment names four content types including "Charts" and "Social". Under my
   plan, a user selecting "Charts" would see nothing chart-like.
2. Reviewer database access was the thinnest item in my plan — deferred entirely
   to the submission email with nothing verifiable.
3. The AI usage document needed to be honest about the scale of AI involvement
   rather than reading as incidental assistance.

**Decisions I made in response** (recorded as §17 of `CLAUDE.md`):

- Charts renders a hand-rolled inline SVG sparkline from CoinGecko's
  `sparkline=true` data; Social weights news toward community signal. **I kept the
  no-charting-library ban** — the fix had to stay cheap, and a charting dependency
  for one sparkline is not a good trade.
- Database access moved into Phase 2 with a committed grant script and a
  requirement to connect as the role and prove a write is rejected.
- This document leads with the full-honesty statement.

**Corrections I made to its output:**

- It marked the "public GitHub repo" checklist item `[x]` in `PROJECT_STATUS.md`
  while `gh` was still not installed and no remote existed. It caught this itself
  on re-reading and changed it to `[!]` before committing, but it is exactly the
  failure the no-fabrication rule exists to prevent, and it happened in the first
  hour.

**Verified by hand:** the authenticated GitHub account; that the created repo is
public, not a fork, not a template; that the four intended files and nothing else
were pushed.

**Flagged to me, correctly:** my home directory is itself a git repository with a
remote, and this project folder sat inside it unignored. It initialized a nested
repository so nothing leaked, and told me rather than silently working around it.

---

## Phase 1 — design

Approved with no changes. The design was mine from the build plan; the model's
contribution was restating it concretely and identifying that CryptoPanic's free
tier was the largest unknown in the plan. That turned out to be correct — see
Phase 2.

---

## Phase 2 — scaffold, database, reviewer access

**Worked on:** client and server scaffolds, health endpoint, Prisma schema,
production migration, seed, read-only role, provider verification.

**Decisions I accepted:**

- Independent `client/` and `server/` packages rather than npm workspaces, on the
  argument that Render and Vercel each install from a subdirectory and workspaces
  would add friction at deploy time. Reasonable, and deployment risk is the thing
  I most wanted to keep low.
- The health endpoint reports database status but never fails on it, so a
  transient database blip does not cause Render to cycle the instance.
- Writing the full schema in Phase 2 rather than a stub, because the reviewer
  access work requires real tables and real rows.

**Problems in its output, and how they were caught:**

- **A broken SQL statement splitter.** Its first script for applying the role
  grants split statements on every semicolon, which tore the `DO $$ ... $$` block
  apart. Every statement failed. Caught because the script printed per-statement
  OK/FAIL rather than a single summary — the failure was visible and specific. It
  fixed the runner rather than simplifying the SQL to suit the bug, which was the
  right call.
- **The client build failed** on TypeScript import extensions (`.tsx` specifiers
  with `allowImportingTsExtensions` off). Caught by running the build. Worth
  noting the server correctly uses `.js` specifiers for NodeNext ESM — the two
  conventions genuinely differ, and it applied one to both before testing.
- **Premature `[x]` in the status checklist**, described under Phase 0.

**Provider verification — the part where reality disagreed with the plan.**

My build plan asserted CryptoPanic's v2 endpoint shape and stated OpenRouter's
free-tier behavior. I required both to be verified with real calls before being
built on. Results:

- **CoinGecko:** confirmed working. `sparkline=true` returns 168 points (7 days,
  hourly) on the free tier with no key. The Charts amendment is feasible as
  specified.
- **CryptoPanic:** could not be reached from this environment. Every plan segment
  on the documented `/api/{plan}/v2/posts/` path returned 404, and the v1 path
  returned a Cloudflare bot-detection challenge. It stopped at the challenge
  rather than attempting to work around it, which is what I wanted. Unresolved at
  the end of Phase 2 and reported to me as a decision rather than papered over.
- **OpenRouter:** the model ID in my plan was not verified, so it fetched the live
  list — 14 `:free` models of 400 — and ran real completions against a realistic
  grounded prompt. Four candidates were rejected on evidence:

  | Model | Result |
  |---|---|
  | `google/gemma-4-31b-it:free` | 429 upstream, repeatedly |
  | `openai/gpt-oss-20b:free` | reasoning model; spent all 300 tokens thinking, returned empty content |
  | `meta-llama/llama-3.3-70b-instruct:free` | request timed out |
  | `google/gemma-4-26b-a4b-it:free` | 19.3s, and opened with a markdown heading |

  Selected `nvidia/nemotron-3-nano-30b-a3b:free`: 1.7s, 73 words, referenced the
  specific ETF figure and both prices from the supplied data. Comfortably inside
  the 12s timeout in the spec, so no timeout change was needed. Two backups
  identified. The ID is in an env var, not the source.

**Verified by hand:**

- `prisma migrate deploy` succeeded against the production direct endpoint, then
  I had it query `information_schema` to confirm the four tables and four enums
  actually exist rather than trusting the CLI's success message.
- The read-only role was exercised, not assumed: connected as `moveo_readonly`,
  confirmed `SELECT` works against all four tables, and confirmed `INSERT`,
  `UPDATE`, `DELETE`, `CREATE TABLE` and `DROP TABLE` are all rejected. The exact
  results are in [`DB_ACCESS.md`](./DB_ACCESS.md).
- Secret scan over staged changes before each commit; credentials exist only in
  gitignored `.env` files.

**Accepted without line-by-line review:** the generated migration SQL (verified by
its effect on the live schema instead), and the Tailwind and Vite configuration
(verified by a successful production build).

**Trade-off made under the deadline:** the Phase 2 frontend is a connectivity
placeholder rather than real UI. It exists to prove the deployed client can reach
the deployed API across origins before any feature is built on top. Deploying
early is deliberate — deployment problems surface at the worst possible time when
they are left to the end.

**My decision on news providers.** It reported CryptoPanic as unreachable and
proposed shipping the static fallback, with live RSS offered only as an
alternative I could take instead. I rejected that framing and required all three
layered behind the one interface, in priority order: CryptoPanic first (it is the
only source carrying the community signal the Social preference needs), RSS
second, static last. A P0 section serving visibly sample data reads as
unfinished even when the assignment permits it, and 30 minutes is a fair price
for genuinely live news. The tier actually serving in production gets reported.

---

## Phase 3 — authentication

**Worked on:** register/login/me endpoints, JWT issuing and verification, bcrypt
hashing, auth middleware, validation, the sign-in and sign-up screens, protected
routing, and the auth test suite.

**Decisions I accepted:**

- Identical error text for an unknown email and a wrong password, with a bcrypt
  comparison against a dummy hash on the unknown-email path so response timing
  does not reveal which addresses are registered. It raised this unprompted; the
  spec only asked for a 401.
- Registration returns a token and signs the user straight in, rather than
  bouncing them to a login form they just filled in.
- `getUserId(req)` as a single guarded accessor instead of a non-null assertion
  at every controller that sits behind the auth middleware.

**Decisions I corrected:**

- It first wrote the onboarding placeholder with a "Skip for now" link to the
  dashboard. The protected route sends un-onboarded users back to onboarding, so
  that link was an infinite redirect. It caught this before committing and
  removed the link rather than loosening the route guard — the right way round.

**A lint failure worth recording.** `react-hooks/set-state-in-effect` rejected
the auth provider for calling `setStatus('anonymous')` inside an effect when no
token exists. The tempting fix is to disable the rule. Instead the initial state
is now derived — `useState(() => getToken() ? 'loading' : 'anonymous')` — and the
effect only runs when there is something to verify. The rule was right and the
code is simpler for it. Our standing instruction is to fix the implementation
rather than weaken the check, and this is a case where that paid off.

**Verified by hand, against the live database rather than mocks:**

- Register returned 201 with a token; a second attempt with the same address
  returned 409; invalid input returned 400 naming all three offending fields.
- Login with the correct password returned 200; the wrong password returned 401
  with the same message an unknown address produces.
- `/api/auth/me` returned 401 with no token and 401 with a malformed token, and
  the correct user with a valid one.
- I queried the row directly: the stored value is a 60-character `$2b$10$` bcrypt
  hash, not the plaintext. The test account was deleted afterwards.
- In a browser: signed in as the seeded demo account, confirmed the redirect to
  the dashboard, confirmed the session survives a hard refresh, and confirmed
  that clearing the token bounces a direct visit to `/dashboard` back to login.

**A false alarm worth recording, because it nearly became a wrong bug report.**
Driving the login form through browser automation appeared to show the form not
submitting — no network request, no error. The app was fine. Setting an input's
`value` programmatically does not fire the events React listens for, so the
component's state never updated, and the synthetic click did not reach React's
handler. Confirmed the app worked by dispatching a real `input` event and calling
`form.requestSubmit()`, which logged in correctly. Worth noting because the
instinct on seeing "form does not submit" is to start changing the form.

**Accepted without close review:** the Tailwind utility classes on the auth
screens, verified visually instead.

---

## Phase 4 — onboarding, preferences, personalization

**Worked on:** the supported coin list, the onboarding quiz, preference storage,
the editable preferences screen, and `buildPersonalizationContext`.

**A constraint I set, and why it mattered.** I required the asset picker to be a
searchable multi-select over a real coin list rather than free text. A free-text
symbol that does not resolve to a CoinGecko id empties the prices section with no
visible error — the worst kind of bug, because nothing looks broken. This is
enforced in three places: the picker only offers real coins, the Zod schema
rejects any symbol outside the list, and the CoinGecko id is stored explicitly in
the checked-in list rather than guessed at runtime.

It went one better than I asked and generated the list from a live CoinGecko
call, then verified all 50 ids resolve by requesting them back in a single
request: 50 requested, 50 resolved. Generating rather than hand-writing removes
the transcription errors that make this failure mode common.

**Decisions I accepted:**

- Saving preferences and flipping `onboardingCompleted` happen in one
  transaction. Its reasoning: a saved preference with the flag still false traps
  the user on the onboarding screen forever. Correct, and I would not have
  thought of it before it happened in production.
- One `PreferencesForm` shared by onboarding and the edit screen, pre-filled from
  stored values in the second case. Avoids two forms drifting apart.
- Content preference weights, rather than hardcoded orderings per combination.
  Four preferences give sixteen combinations; a weight table handles all of them
  in a few lines and is far easier to test.

**A judgement call I want on record.** The spec says "cap selection at 3–8
assets" in one sentence and "require at least one asset" in the next. These
disagree about the minimum. It implemented a maximum of 8 and a minimum of 1,
with "three to five works well" as on-screen guidance rather than a hard gate. I
am comfortable with that reading — rejecting a user who genuinely only holds
Bitcoin would be worse than the alternative — but it is an interpretation and it
was flagged rather than silently chosen.

**Verified by hand:**

- The full onboarding flow in a browser on a newly created account: searched the
  picker, selected SOL and DOGE, chose Day Trader and Social + Fun, submitted,
  and landed on a dashboard reading `SOL, DOGE · Day Trader · Social + Fun`.
- Against the live API: an unsupported symbol is rejected with 400 and never
  reaches the database; lowercase input is stored uppercased;
  `onboardingCompleted` flips to true; the edit screen pre-fills; a hard refresh
  on `/dashboard` no longer bounces to onboarding.
- 44 tests, including one asserting each of the four content preferences produces
  an observable difference, one that all four sections are always present across
  seven preference combinations, and one that the AI context contains no email,
  password, token or user id.

**Spec ambiguity I surfaced and resolved.** The build plan said "cap selection at
3–8 assets" in one sentence and "require at least one asset" in the next. Those
disagree about the minimum. It implemented max 8 / min 1 and flagged the conflict
rather than picking silently. I confirmed that reading: a holder with only
Bitcoin is a real user, and rejecting them would be worse than allowing a
single-asset dashboard. The 3–5 suggestion stays as on-screen guidance.

**A near miss during cleanup.** The cleanup step for test accounts was about to
be run broadly against the users table. Listing the rows first showed a third
account that was not a test fixture — a real signup made while verifying the
deployment. Checking before deleting is the only reason it survived. Nothing
should delete from a shared database without looking at what it is about to
remove first.

---

## Phase 5 — market, news and meme providers

**Worked on:** the HTTP client with enforced timeouts and error classification,
the TTL cache, CoinGecko prices, the three-tier news provider, the meme provider,
and the 429 and timeout tests.

**A decision I made against its recommendation.** After CryptoPanic failed, it
proposed shipping the curated static fallback and offered live RSS only as an
alternative I might take instead. I rejected that and required all three layered
behind one interface, CryptoPanic first because it is the only tier carrying the
community signal that the Social preference needs. A P0 section serving visibly
sample data reads as unfinished even where the assignment permits it. This turned
out to matter: CryptoPanic is dead, and without the RSS tier the news section
would have shipped as static sample content.

**Verify before building, applied twice, and it paid for itself both times.**

- I required the CryptoPanic retry to run from the deployed backend rather than
  from a laptop, on the theory that the origin might matter. It did not: from
  Render the v1 path returns the same Cloudflare challenge and every documented
  v2 plan segment returns 404. I cannot distinguish "wrong plan segment" from
  "Cloudflare blocks datacenter IPs", but from where the app actually runs it
  does not work, and that is the operative fact.
- Before building on RSS I had it probe the four candidate feeds from Render as
  well. All four returned real RSS in 97–483ms. Had they been blocked the same
  way, two hours of provider work would have been wasted.

**A real bug that only a live call would have found.** Running the finished
providers against the real APIs produced a headline tagged with both BTC and
NEAR: *"Why Bitcoin's BIP-110 refuses to die despite near-zero miner support."*
The asset detector was matching symbols case-insensitively, so `near-zero`
matched the NEAR token. Several symbols are ordinary English words — ONE, SUI,
TON have the same failure. Fixed by matching symbols case-sensitively (tickers
appear in caps in headlines) while keeping coin names case-insensitive, with four
regression tests. Every mock-based test passed both before and after the fix;
only real data exposed it.

**Decisions I accepted:**

- 429 is classified separately from other HTTP errors in the shared client, so
  "never retry a 429" is enforced in one place instead of remembered at each call
  site. The test asserts exactly one fetch call.
- Stale cache is served, labelled, in preference to an empty section when a
  provider is rate limited.
- The layered news provider reports which tier served, and that string is carried
  through to the UI rather than being logged and discarded.

**Cut, and recorded as cut.** The Social preference now only reorders sections.
The ranking code that applies a community signal exists and is tested, but no
reachable tier supplies one, and inventing a score from RSS data would be
fabricating a signal. Per your instruction, not forced. This is a genuine
reduction against amendment 17.1 and `PROJECT_STATUS.md` marks it `[!]`, not
done.

**A self-inflicted error worth recording.** A stray `SAMPLE` constant with a
nonsense type annotation was written into the static news module and then removed
before commit — dead code that would have shipped had it not been re-read. A
separate mistake put an `await import` inside a non-async `describe` block, which
failed the whole test file to load; the suite caught it immediately.

**Verified by hand against live APIs:** two contrasting profiles returned
different coins in the user's own selection order, with 168-point sparklines
present for the Charts profile and absent for the other; news returned six live
items from four feeds with correct asset tagging; the meme rotated without
repeating.

**Temporary code removed as promised.** The `/api/_diag` probe added at `bdce63d`
was deleted at `a8ffbc4` before the phase closed, with a checklist line in
`PROJECT_STATUS.md` so it could not quietly survive to submission.
