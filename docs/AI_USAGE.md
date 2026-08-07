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
