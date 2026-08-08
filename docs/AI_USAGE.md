# AI usage

## Summary

Claude Code wrote the great majority of the code in this repository. I set the
constraints, made the trade-offs, checked claims against evidence, and overruled
it where I disagreed. The detail below is long because it is a working record;
this section is the short version.

Four constraints were fixed before any code existed, because they are the
expensive things to change later: a strict P0/P1/P2 priority order with an
instruction to cut from the bottom and report every cut; a failing provider
degrades its own dashboard section and never the request; every external
integration behind an injectable interface, because that is the only way the
required 429 and timeout tests can exist without live calls; and daily caching
of the AI insight as a hard requirement rather than an optimisation.

The decisions where I overruled the model matter more than the ones I accepted.
It proposed shipping curated static news after CryptoPanic proved unreachable —
I required all three tiers layered behind one interface, and that is the only
reason the news section serves live data today. It proposed text cards in place
of meme images, arguing that hotlinked images can 404 — I rejected the premise,
because self-hosting gets robustness and an actual image at the same time. It
recommended weighing rate limiting against its cost late in the build — I took
it anyway, and the verification I demanded alongside it caught a proxy setting
that would have throttled every user in the world as a single client.

Two failures are worth more than any of the successes. A commit with a
TypeScript error passed lint and 100 tests, failed its deploy silently, and left
production serving a stale build behind a green health check. And the Coin
Prices section broke in production because the fallback protecting it, while
correctly written, could never run — it read an in-process cache that only fills
after a success that never happened. The first taught that a green suite is not
a green build and a push is not a release; the second, that unreachable code is
worse than absent code, because it reads as protection.

The phase-by-phase record follows, including the mistakes.

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

## Two agents, in separate roles

I ran two agents on different models, in parallel, doing different jobs.

Claude Code implemented. It had the repository, wrote the code, ran the tests and
made the commits. A second agent on a different model acted as reviewer and
researcher: it never wrote a line of code and never read the codebase. Its job
was to pressure-test my decisions, draft the specification and the phase
instructions, and verify external facts before anything was built on them.

I am not claiming this arrangement produces better software in general — I ran
one project this way and have no basis for that. What I can point to is what the
reviewing agent caught before it cost anything:

- Render's free Postgres is deleted 30 days after creation. Caught before Phase
  2, which is why the database is on Neon. Had it surfaced later, the reviewer's
  access could have expired before they opened it.
- OpenRouter's free tier allows roughly 50 requests a day. That single fact
  turned daily caching of the AI insight from an optimisation into a hard
  requirement written into the spec.
- Prisma migrations fail against a connection pooler. This is why `DATABASE_URL`
  and `DIRECT_URL` were both specified up front rather than debugged at the
  first migration.
- Committing recognisable meme formats to a public repository is a rights
  problem. Raised before any image file went in.

The useful framing is separation of concerns rather than anything about model
quality. One agent executes with full context; the other reviews without it. The
reviewer had no stake in defending decisions it had not implemented, and the
implementer was not grading its own work. Every item above is a fact about the
world rather than about the code, which is exactly the category an implementer
deep in a file is least likely to stop and check.

---

## The judgement behind the direction

This document records what I checked. Knowing where to check is the part that
does not show up in a diff, so these are the calls that shaped the build.

I fixed the per-section status contract before implementation rather than after.
`GET /api/dashboard` returns 200 with a status on every section. Retrofitting
partial failure onto a route that assumes success is a rewrite, not a change, and
by the time anyone wants it they are usually already in production.

Injectable provider interfaces were required for one stated reason: they are the
only way the mandated 429 and timeout tests can exist without calling live APIs.
Not architectural taste. Naming the reason mattered — a constraint with a purpose
survives a deadline, and a stylistic preference does not.

I found the empty Coin Prices section by opening production myself, and I read it
as a bug rather than a limitation of the free tier. That reading was the whole
diagnosis. "CoinGecko rate-limits, nothing to be done" would have shipped a
dashboard whose most important section was blank.

I rejected a 30-second cooldown on the prices refresh. It sits inside a 90-second
server cache, so three presses would return byte-identical data and the button
would read as broken. The cooldown matches the cache.

I overruled per-article thumbs in favour of a single dismiss control. Thumbs on
every article means a `contentRef` per item, a schema change, and nine sets of
controls on one screen. Same power for the user, a fraction of the cost.

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

  | Model                                    | Result                                                                 |
  | ---------------------------------------- | ---------------------------------------------------------------------- |
  | `google/gemma-4-31b-it:free`             | 429 upstream, repeatedly                                               |
  | `openai/gpt-oss-20b:free`                | reasoning model; spent all 300 tokens thinking, returned empty content |
  | `meta-llama/llama-3.3-70b-instruct:free` | request timed out                                                      |
  | `google/gemma-4-26b-a4b-it:free`         | 19.3s, and opened with a markdown heading                              |

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

`react-hooks/set-state-in-effect` rejected
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

One false alarm nearly became a wrong bug report.
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

My own spec contradicted itself here: "cap selection at 3–8 assets" in one
sentence, "require at least one asset" in the next. It implemented a maximum of 8
and a minimum of 1, with "three to five works well" as on-screen guidance rather
than a hard gate, and flagged the conflict instead of picking silently.

I took that reading. A holder with only Bitcoin is a real user, and turning them
away to satisfy a guideline is worse than a single-asset dashboard.

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

Cleanup nearly went wrong. The step for removing test accounts was about to run
broadly against the users table. Listing the rows first showed a third account
that was not a test fixture — a real signup made while verifying the deployment.

Checking before deleting is the only reason it survived.

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

One bug could only ever have been found by a live call. Running the finished
providers against the real APIs produced a headline tagged with both BTC and
NEAR: _"Why Bitcoin's BIP-110 refuses to die despite near-zero miner support."_
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
reachable tier supplies one. I ruled out synthesising a score from RSS data: an
invented signal is worse than an absent one, because it looks like the feature
works. This is a genuine reduction against amendment 17.1 and `PROJECT_STATUS.md`
marks it `[!]`, not done.

Two self-inflicted errors, both caught before they mattered. A stray `SAMPLE`
constant with a nonsense type annotation went into the static news module and was
removed before commit — dead code that would have shipped had it not been
re-read. And an `await import` inside a non-async `describe` block failed the
whole test file to load; the suite caught that immediately.

**Verified by hand against live APIs:** two contrasting profiles returned
different coins in the user's own selection order, with 168-point sparklines
present for the Charts profile and absent for the other; news returned six live
items from four feeds with correct asset tagging; the meme rotated without
repeating.

The `/api/_diag` probe added at `bdce63d` was deleted at `a8ffbc4` before the
phase closed, with a checklist line in `PROJECT_STATUS.md` so it could not quietly
survive to submission.

---

## Phase 6 — AI insight, and the meme images

**Worked on:** the OpenRouter provider, the grounded prompt, the daily insight
cache, the non-AI fallback, and the meme image pipeline.

**Constraints I set for the AI section, before any of it was written:**

- The insight must reference a concrete figure or headline already rendered on
  the page. If it could have been written without looking at the data, it has
  failed.
- Never buy, sell or hold advice. Never a predicted price. Never an invented
  number.
- Daily caching is mandatory, not an optimisation. Free-tier OpenRouter allows
  roughly 50 requests a day and a reviewer clicking around could exhaust it.

**Decisions I accepted:**

- **Prices are deliberately excluded from the cache key.** The obvious key is
  "everything the insight was based on", which would include the prices — and
  that cache would be useless within a minute, because prices move constantly.
  Every dashboard load would miss, and the free tier's ~50 requests a day would
  be gone in an afternoon. The key is assets + investor type + content
  preferences + date, so the insight is stable for the day and the section still
  reads as current because the prices beside it are live. Non-obvious, and the
  whole caching strategy depends on getting it right.
- **The fallback is never written to the cache.** If a model timeout wrote its
  degraded summary into the cache, that row would occupy the day's slot and every
  later refresh would serve the non-AI text — the model would not be retried
  until tomorrow. One transient failure would silently downgrade the section for
  a full day. That is a production bug that would not surface for days, and it is
  invisible in testing because everything still returns 200 with content. A test
  now asserts `insightCache.create` is not called on the fallback path.
- `reasoning: { enabled: false }` is sent explicitly, carried over from the
  Phase 2 finding that a reasoning model spends its whole token budget thinking
  and returns empty content.

**Verified by hand, with real model calls — and the verification method is the
point.** Two profiles produced visibly different insights from the same code
path. The HODLer briefing opened on Bitcoin at $65,111 (+1.00%) and Ethereum at
$1,922.33 (+1.30%) and framed them for a long-term holder; the day trader
briefing led with SOL +1.40% and DOGE +1.80% and short-term attention.

I did not read those and judge them plausible. The test harness printed the
exact data handed to the model next to the text it returned, and I checked every
figure in both insights against that input, one at a time — each price, each
percentage, each headline attribution. That is the only way to tell the
difference between "the model wrote something that sounds right" and "the model
is actually grounded in this user's data", and grounding is the entire premise
of the section. A plausible-sounding insight containing one hallucinated number
is worse than no insight at all, because a reader has no way to spot it. Nothing
was invented, no advice appeared, and the banned filler opening did not occur.

The daily cache was then exercised against the live database: first call 3856ms
hitting the model, second call 76ms from cache, identical text, exactly one row
written.

**The meme images — a decision I reversed the model on.** It proposed, and
initially shipped, self-contained text cards rather than images, arguing that
hotlinked meme images can 404 during review. I rejected that: "Fun Crypto Meme"
is a named requirement, in crypto the word means an image, and a reviewer seeing
text reads the section as unfinished no matter what the README says. The
robustness argument also disappears once the files are ours. Self-hosting gets
both properties at once.

It then flagged, correctly, that it could not source recognisable meme formats
itself — a copyright problem in a public repo — and that it could not extract
image bytes from files I attached in chat. Both are real limits and it said so
rather than producing something approximate. It built 12 original illustrations
and the full self-hosted pipeline, and I supplied two classics myself.

**I dropped three images I had intended to include:** one carried another
company's logo and watermark, one was assembled from stock photography including
a car manufacturer's branding, and one used a recognisable format built around a
real person. None are worth the exposure in a public repository. That screening
was mine to do, and it is the reason the count is 14 rather than 17.

After generating the illustrations it measured the lowest drawn element in each
file rather than eyeballing them, and found two where the artwork ran into the
caption — one by 60 pixels. Both fixed, re-measured, then confirmed visually.

It also corrected itself in my favour. It reported that the JSON meme manifest
was not reaching the build output and would break in production. That was wrong;
its directory listing had been truncated. It said so plainly once it ran the
built module and saw all entries load. I would rather have the retraction than a
build step that was never needed.

The manifest is hand-edited, so it has three guards: a malformed row is skipped
with a logged warning instead of crashing the section, a test asserts every entry
resolves to a file that exists on disk, and a test asserts ids and image paths
are unique. Adding or removing a meme touches only `memes.json` and the folder —
never code.

---

## Phase 7 — feedback

**Worked on:** the vote upsert API, vote restoration, content references, and the
vote UI component.

**Decisions I accepted:**

- **Content references are generated server-side and handed to the client** in
  the dashboard payload, rather than assembled in the browser. The client posts
  back a string it was given. This keeps the definition of "what was voted on" in
  one module instead of scattered across components, and means a client cannot
  invent a reference.
- **References are order-insensitive but content-sensitive.** `prices:BTC,ETH`
  and `prices:ETH,BTC` are the same reference, so a vote survives the user
  reordering their assets; a different set of news URLs produces a different
  reference, so a vote does not silently carry over to unrelated content. Most
  implementations get this wrong in one direction — either the vote detaches on
  any trivial change, or it sticks to a section regardless of what is in it. Both
  directions are tested.
- **The personalization context is snapshotted server-side at vote time**, read
  from the database rather than trusted from the request body. A vote without the
  context it was cast in cannot train anything later, and a client-supplied
  context could be anything.
- **Optimistic UI with rollback** on the vote mutation. A vote that takes a round
  trip to appear reads as broken.

**Verified by hand against the live database:** unauthorized returns 401; an
invalid section type returns 400 and never reaches the database; an UP vote
followed by a DOWN vote on the same reference leaves **exactly one row** with
`vote: DOWN`, not two rows; `GET /api/feedback` returns the stored votes for
restoration; and the stored `context` column contained the real preference
snapshot.

**On cleanup, following the standing rule:** the only rows I deleted were the
ones this test created. I queried and printed them first, deleted by the exact
content reference I had generated, and confirmed the table returned to its
seeded count of three rather than issuing a broad delete.

---

## Phase 8 — dashboard assembly and interface

**Worked on:** `GET /api/dashboard`, the four section components, feedback wired
in, the refresh control, coin logos, the sparkline, the onboarding additions, and
the visual pass.

**A test nobody asked for**, carried over from the previous phase because it is
the clearest thing either of us wrote. It posts `userId: "someone_else"` in the
request body and asserts the upsert still keys on the authenticated user. Nothing
in my specification called for it. That is the difference between proving an
endpoint works and proving it cannot be abused, and it is the kind of test that
only gets written if someone is thinking about how the thing fails rather than
how it succeeds.

**The most serious mistake of the build, and how it surfaced.** The Phase 7
commit contained a TypeScript error: the feedback context was typed
`Record<string, unknown>` where Prisma expects its own JSON input type. Lint
passed. All 100 tests passed. Vitest does not type-check, and `npm run build` was
not run before that commit. The Render deploy failed, the previous instance kept
serving, and `/api/health` stayed green — so nothing looked wrong. Production ran
a stale build with no feedback or dashboard routes until this phase caught it.

Two things worth drawing out. First, a green test suite is not a green build, and
the gap between them is exactly wide enough to hide a type error. Second, a
failed deploy is invisible when the previous instance keeps serving; health
checks confirm _something_ is running, not that it is the thing you just pushed.
The fix was one line. Finding it took a direct check of whether the new routes
actually existed in production. `npm run build` now runs before every commit, and
deploys are verified by asking production for the new endpoints rather than
assuming a push means a release.

**Two lint errors that were real design problems, not noise.**

- `react-hooks/refs` rejected reading `previousMemeId.current` during render. The
  rule was right for a reason specific to this feature: what matters is which
  meme was on screen when the refresh was clicked, and a value captured during
  render is already stale by then. The hook now takes a getter and reads the ref
  inside the fetch, which is both rule-compliant and more correct.
- `react-hooks/set-state-in-effect` rejected the "waking up the server" flag,
  for the second time in this build. Fixed by raising the flag from the timer and
  clearing it in the effect's cleanup, rather than suppressing the rule.

**Problems I found by looking at the running app rather than the tests.**

- **The AI insight came back at 174 words** against a ~120 cap, filling an entire
  phone screen. The prompt asks for 60–110 and the model simply did not comply.
  Instructions to a model are a request, not a constraint, so the cap is now
  enforced in code — trimmed at a sentence boundary so the text never ends
  mid-thought, and applied on read as well as on write so an already-cached long
  insight cannot render. Verified in production: 174 words became 118.
- **Several meme illustrations sat low in their canvas**, leaving a third of the
  card empty above the artwork. A first attempt to measure the artwork by parsing
  the SVG source failed on path syntax like `q0-20 17-46`. Rather than write a
  fragile path parser, the bounding boxes were measured in a real browser with
  `getBBox()` and the measured offsets baked in. Exact, and it took one pass.
- **The news vote buttons wrapped below the section title** on a narrow viewport,
  because the source label listed all four publications. Fixed by truncating the
  label and shortening it to "Live RSS feeds" — each headline already carries its
  own publication, so nothing was lost.

Regenerating the memes overwrote `memes.json` and silently dropped the two images
I had supplied. The file-existence test caught it immediately. A generator that
writes into a hand-edited file is a hazard however careful the generator is.

**Verified by hand, in a browser at a real 375px viewport rather than a resized
desktop window:** all four sections rendering with live data; a vote on prices,
news and the insight surviving a hard reload; the meme changing on refresh
(meme-001 to meme-005) with the acknowledgement microcopy appearing; coin logos
loading with a symbol fallback wired for failure; sparklines present for the
Charts profile only; and the starter mix prefilling BTC, ETH, SOL with HODLer and
Market News while leaving everything editable.

**On database cleanup, again following the standing rule:** before removing test
accounts I printed every account in the database and listed exactly which would
be deleted and which kept. That listing showed an account belonging to neither me
nor the model — someone had found the public URL and signed up. It was left
alone. A pattern-matched delete without looking first would have been fine here
by luck, not by design.

---

## Production incident — the Coin Prices section was empty

Found by me, not by the tests, and worth recording in full because the failure
mode is the interesting part.

**Symptom.** The Coin Prices section — the one carrying the visual weight of the
whole dashboard — showed "No prices to show right now" on every production load,
including from a fresh incognito account. Every other section worked.

**Cause, in three compounding layers.**

1. CoinGecko rate limits keyless callers **per IP, shared across every caller on
   that IP**. Render's free tier egresses through shared datacenter addresses, so
   our share of that pool was already exhausted. The evidence was unambiguous:
   the identical URL with identical headers returned 200 in 0.27s from a
   residential IP and 429 from Render, six times out of six. Market News, which
   also makes outbound calls from the same instance, was fine — so this was not
   egress being blocked, it was CoinGecko and it was the IP.
2. The in-memory cache therefore never populated, because it only fills on
   success.
3. The stale-cache fallback consulted that same in-memory cache, so it had
   nothing to serve.

**The part I want on the record: correct-but-unreachable code.** The 429 handler,
the `getStale` lookup and the labelled degraded response were all implemented,
reviewed and tested. A unit test proved the fallback fired. It could never fire
in production, because the test seeded the cache with a prior success and
production never had one. That is worse than not having written it at all —
missing code announces itself, whereas this read as handled everywhere anyone
would look: in the source, in the tests, and in a phase report that listed
"serves stale cache on 429" as done.

Two things let it through. The test constructed a state that production could not
reach, and I reviewed the fallback's logic without asking what would have to be
true for it to run. A test that seeds its own precondition proves the branch
works; it does not prove the branch is reachable.

**Fix, in two parts.**

- A CoinGecko Demo API key, which moves the quota onto the key rather than the
  shared IP. The key lives only in Render's environment and in a gitignored local
  `.env`; `.env.example` carries an empty placeholder. A test asserts the key is
  sent as a header and never appears in the request URL.
- A `price_snapshots` table holding last-known-good prices, so the degraded path
  survives a process restart. This is what makes the fallback reachable at all:
  Render sleeps after fifteen minutes idle, so the in-process cache is empty on
  exactly the request a reviewer is most likely to make — the first one.

**On verifying the API key header.** The documentation was ambiguous between
`x-cg-demo-api-key` and `x_cg_demo_api_key`, and no local experiment could settle
it: from an IP with keyless quota available, a wrong header name still returns
200, and even a deliberately invalid key returns 200 because CoinGecko silently
falls back to keyless. CoinGecko exposes no rate-limit response headers to
inspect either. The convention — hyphens for headers, underscores for query
parameters — resolved it, and the deployed backend settled it definitively:
keyless 429s there, so `status: "ok"` proved the header was right.

**Verification, on production rather than locally.** Twelve consecutive loads
returned `ok` with zero fallbacks and zero errors, including two genuine
refetches after the cache expired — confirmed live because the price moved
between them. Then the instance was left idle for eighteen minutes to force a
real spin-down, confirmed by a 13.4 second first response and an uptime of five
seconds, and the first dashboard load on that cold process returned live prices
with logos and sparklines intact.

**A regression I introduced while fixing it**, caught by an existing test: the
rewritten degradation path dropped the timeout-specific message, so a timeout
reported "prices could not be loaded" instead of "CoinGecko did not respond in
time". The test that caught it was one I had written for the original timeout
behaviour. Fixed the code rather than the expectation.

---

## A second incident found by using the app, not by testing it

While exercising the meme and article hiding, sign-in suddenly returned 500. The
server log showed `Can't reach database server` — Neon's free tier suspends the
compute after inactivity, and the first connection to a suspended instance can
fail outright rather than wait for it to wake. A retry seconds later succeeded.

This matters more than it first appears. **Signing in is the reviewer's first
action.** A cold Render instance waking a suspended Neon instance is exactly the
sequence a reviewer triggers, and the failure mode is an opaque "An unexpected
error occurred" on the login screen — worse than the empty prices card, because
it stops them at the door rather than degrading one section.

Fixed by opening the database connection at boot with retries and backoff, so
the wake-up happens during Render's own cold start instead of landing on a user
request. The server still starts if the warm-up fails, because `/api/health`
reports database state separately and a later request may well succeed.

**The lesson is the same one the prices failure taught, which is why it is worth
recording twice.** No test caught this. No test could have: the suite mocks
Prisma entirely, and mocking is what makes the 429 and timeout tests possible in
the first place. Both incidents were found by opening the deployed application
and using it as a person would — once by the developer noticing an empty card,
once by the model hitting a 500 mid-verification.

A test suite proves the code does what it was written to do. It says nothing
about whether the platform underneath behaves as assumed. Two of the three worst
problems in this build came from that gap: shared-IP rate limiting on one
provider, and cold-start behaviour on the database. Neither is a coding mistake,
and neither would have been found by writing more tests.

---

## A verification method that hid the bug it was meant to catch

The "Show me less like this" control persisted correctly but did not remove the
article from the screen until the page was reloaded. To a user it looked like the
button did nothing.

The verification I had run was: click the control, **reload**, assert the article
is gone. It passed, and it was worthless for this purpose. The reload is exactly
the step that repaints from the server, so it can only ever prove persistence —
it structurally cannot see a missing optimistic update. The right check is to
click and then assert without reloading, which is what the developer did by
simply using the app.

The same gap existed in the meme section and I had reported it as working. The
hide *appeared* to take effect because the code advanced the index to the next
meme, so something visibly changed. The hidden meme was still in the deck, and
browsing back would have shown it again. One mechanism, two different-looking
symptoms, and the one that looked fine was the more misleading of the two.

**Cause.** The vote mutation updates the `feedback` query cache optimistically,
but both lists render from the `dashboard` query, which was untouched. Fixed by
deriving the hidden sets from the feedback cache and filtering both lists there,
so a hide takes effect on click and still agrees with the server after a reload.

**Re-verified without reloading:** the article disappeared within 250ms of the
click, far below a round trip; hiding a meme dropped the mounted deck from 14 to
13 immediately, and walking all 13 forward never showed the hidden one again.

The general lesson is narrower than "test more" and worth stating precisely: a
check that performs a state-resetting action between the interaction and the
assertion can only observe persisted state. If the thing under test is the
interface's immediate response, the reload has to come out of the test.

---

## Fixing one direction of a reversible action and calling it done

The dismissal bug — an article persisting but not leaving the screen until a
reload — was fixed by filtering the rendered lists from the optimistically
updated feedback cache. That fix was correct, verified without a reload, and
incomplete.

**"Show hidden articles again" had exactly the same bug, in reverse.** Clicking
it restored nothing until a refresh. Hiding was made instant; un-hiding was not
touched. The same was true of "Show hidden memes again".

The verification is the interesting part. Both directions had been checked, and
both checks passed, because **each one only exercised the direction that had been
fixed**. The hide test clicked hide and asserted the item vanished. The restore
test clicked restore and then reloaded — reintroducing precisely the reload that
the original bug had hidden behind. The earlier lesson, that a reload between
interaction and assertion can only observe persisted state, had been learned for
one control and not carried across to its inverse.

There is also a second cause worth recording, because it is not obvious: the
server filters hidden items out of the dashboard payload. So restoring cannot be
purely optimistic — the restored items are not merely filtered out on the client,
they are absent from the data. The fix clears the feedback cache optimistically
*and* refetches the dashboard, where the hide fix needed only the former. The two
directions of one reversible action genuinely required different mechanisms,
which is probably why the asymmetry survived.

**The generalisable rule:** when a fix makes an action feel immediate, the
inverse of that action needs the same treatment and the same test, and the test
for the inverse must not contain the escape hatch that hid the original bug.

Separately, in the same round: the meme hide dropped its subject instantly while
the confirmation stayed on screen for several seconds afterwards, hovering over a
meme the user had never rated. The acknowledgment outlived the thing it referred
to. Fixed by holding the mutation briefly so the confirmation is visible while
its own meme is still shown, then rotating and resetting the controls together —
verified by polling the DOM, which showed the rotation, the colour clearing and
the message clearing all happening on the same frame.


---

## A constraint shaping a solution, and the solution being dropped

The meme section originally shipped twelve hand-built SVG illustrations. They
existed for one reason: the model cannot source recognisable meme images —
shipping copyrighted images in a public repository is not a risk worth taking —
and it cannot write binary files into the repository at all, so it could not
save images even when supplied in chat. Original vector artwork was the only
thing it could produce unaided.

That was a reasonable answer to a real constraint, and it was visibly a
workaround: a section called "Fun" carrying flat-vector diagrams of candlesticks
is not the same product as one carrying actual memes.

Once the developer supplied fourteen real images the constraint no longer
existed, and the workaround was deleted outright rather than kept alongside
them. Keeping both would have meant a deck that alternated between real jokes
and diagrams, which is worse than either on its own.

Two details went with it. The UI caption was removed, because every real meme
carries its text inside the image and a caption above it duplicated the joke
word for word. And `altText` was rewritten per image from what each picture
actually shows rather than from its filename — filenames like `images (1).jpeg`
carry no information, and alt text is what a screen-reader user gets *instead of*
the image.

One limit remained honest rather than papered over: the model's file reader
cannot render `.avif`, so it could not describe that one image and said so
instead of inventing a description from the filename. Browsers display `.avif`
without difficulty, so the application is unaffected — only the alt text for that
single file needs a human.

---

## A mitigation that was present in the code and absent in practice

I asked for a security review before the final documentation pass, and I scoped
it deliberately narrowly: secrets, authorization, JWT handling, input validation,
CORS, error responses, the reviewer database role, dependencies. Not a general
audit.

The reasoning is that a broad audit of a 48-hour take-home produces a long list
of things that are true of every small application — no MFA, no account lockout,
no WAF, no secret rotation — and none of it is a finding, because none of it was
ever in scope. That list reads like diligence and contains no information. A
narrow scope aimed at what could actually be wrong *here* is the version that can
return something worth acting on. It did.

**The finding that justified the whole exercise was a mitigation that existed in
the code and did not exist in reality.** Login answered the same "Incorrect email
or password" whether or not the address was registered, and behind it compared
the supplied password against a dummy bcrypt hash so that response time would not
give the answer away. The comment said so. The dummy hash was a hand-written
literal — and it was one character short of a valid bcrypt hash, so bcrypt
rejected it outright in under a millisecond rather than doing the ~137ms of work
a real comparison costs.

The model's own summary of why this ranks above the other findings is worth
keeping verbatim, because it is the right way to think about it:

> It's worse than having no mitigation because the code comment asserts the
> protection is there.

What made it credible was that it was **measured against the deployed
application, not reasoned about**. Five samples each: an unregistered address
answered in 0.118, 0.119, 0.304, 0.124, 0.135 seconds; a registered one in 0.797,
0.597, 0.589, 0.728, 0.627. Nothing about reading the code produces that table,
and a reviewer can re-run it. After the fix the two paths measure ~0.64s and
~0.60s, overlapping. I asked for that line to be recorded here as written.

### Which findings I fixed, and which I accepted

I took all of them, including the one the model hedged on.

It flagged rate limiting as the highest-severity item and then recommended
weighing it, because it adds a dependency and needs `trust proxy` configured
correctly — get that wrong and every user is throttled as a single client. That
is a fair reservation and I overruled it. Shipping a login with unlimited
password attempts is not a thing I want a reviewer to find, and the limiter also
protects the CoinGecko and OpenRouter quotas, which had already caused a
production incident that same day.

What I asked for instead of caution was verification: set `trust proxy`, then
**prove against production that `req.ip` resolves distinct client addresses
rather than Render's proxy**, and if that could not be confirmed, stop and say so
— I would rather ship without rate limiting than ship a limiter that throttles
everyone together. I also asked for it early enough to leave room to back it out.

That instruction paid for itself immediately. `trust proxy: 1` is the value
almost every guide gives, it looked right, and against the deployed service it
resolved to `10.199.154.211` — Render's own internal address. Every user in the
world would have shared one bucket. The real chain is three hops, Cloudflare's
edge plus two inside Render. At `trust proxy: 3` a request from this machine and
a request routed through a different network resolved to two different addresses,
a deliberately forged `X-Forwarded-For` was correctly ignored, and the hop count
held at three across repeated requests. Then the limiter was confirmed live: ten
attempts admitted, the eleventh answered 429.

None of that would have been discovered by reading the code, and the plausible
version of this session is the one where the setting is copied from a blog post
and the limiter silently makes the application worse.

**Accepted rather than fixed**, and written into the README with the reasoning:
the reviewer's read-only role can read `users.passwordHash`, which is inherent to
giving someone database access; the token lives in `localStorage`, which is the
standard bearer-token trade-off and the reason the CSP was worth adding; and
there is no account lockout, MFA or password reset.

## Two smaller lessons from the same session

**A stale dev server will contradict the repository, confidently.** Checking the
meme sizing fix in a browser showed twelve images failing to load — the original
SVG illustrations, deleted commits earlier. The repository was correct and the
running server was serving an old build, which meant the first evidence about the
fix was evidence about something that no longer existed. Restarting it resolved
everything. Worth remembering before debugging a discrepancy between what the
code says and what the screen shows.

**The same one-directional blind spot as the un-hide bug, caught this time.** The
change that appends restored articles to the bottom of the list needed to know
when a fresh fetch had arrived, so that ordering resets. The first implementation
detected this by comparing the items array by reference — and it silently never
fired, because React Query's structural sharing returns the *identical* array
when a refetch produces the same headlines. The restore case worked; the refresh
case did not.

It was only caught because the refresh case was checked at all. The reported
problem was the restore, the restore demonstrably worked, and stopping there
would have been the natural place to stop. This is the same shape as the un-hide
bug recorded above — fixing the direction that was reported and not its
counterpart — and the difference is that this time the counterpart was tested
before the work was called done, not after a user found it. The fix keys on
`generatedAt`, which changes on every fetch and which the prices-only refresh
deliberately preserves.

### A process note, kept because tidying it away would be the wrong instinct

While staging the probe that measured the proxy depth, `git add -A server/src`
swept in four unrelated fixes that were sitting uncommitted — the bcrypt hash,
the error handler, the news link guard and the JWT floor. The commit message
described only the probe. The mistake was mine to catch and I caught it after
pushing, which left one commit whose message understates what it contains.

I chose not to correct it. Rewriting pushed history on the submission repository
the night before means a force-push whose failure mode surfaces the next morning,
and the following commit describes the full set of fixes, so the history is
incomplete rather than misleading. The honest note is worth more here than a
tidy graph would have been — and the general lesson is that `git add -A` after a
long working session stages whatever else happened to be in flight.

## Diagnosing a bug and then not fixing it

The article restore still jolted occasionally after the append fix. My
instruction was to diagnose rather than assume — the previous time I had guessed
a race and been wrong, and the real cause had been a `Set` that never released —
and, explicitly, that if it could not be reproduced or a fix could not be
verified, I wanted it documented as a rough edge rather than patched
speculatively the night before submission.

Both halves of that instruction ended up mattering.

**The reproduction changed what the bug was.** Automating dismiss-and-restore
cycles and sampling the DOM showed the articles already on screen holding their
positions *to the pixel* — the thing that had been reported as moving was not
moving. The row count was oscillating `4 → 6 → 4 → 6` over ~250ms, and because
the news card grows and shrinks with its contents, the sections **below** it
travelled about 250px down, up and down again. The jolt was real and in a
different place than it looked.

Three measurement mistakes were made and caught before they became conclusions:

1. `requestAnimationFrame` is paused while the pane is hidden, so the first
   harness measured nothing at all and reported clean runs.
2. The watch window closed before the restored rows arrived, scoring a restore
   that had not happened yet as "no movement".
3. A runner loop from an earlier attempt was still alive and clicking the same
   controls, which produced a spurious 142px reorder. Any conclusion drawn from
   that run would have been an artefact of the instrument.

The third is the one to remember: an earlier attempt at measurement was actively
corrupting the next one, and the reordering it produced looked exactly like a
plausible bug.

A probe that conflated two states nearly sent the diagnosis the wrong way.
Reading the restore button as "present or absent" scored `"Restoring…"` — a
pending state — as an empty hidden set, which made the evidence say the feedback
cache was fine when it was not. Capturing the button's text verbatim inverted the
conclusion and produced the actual mechanism: a `GET /api/feedback` in flight
when restore is pressed resolves afterwards and writes the pre-reset votes back
over the optimistic clear.

Then two fixes failed and I stopped. Suppressing the refetch after each vote
cut the pre-reset feedback requests from four to one and did not change the
flicker at all. Adding a `staleTime` to the feedback query did not change it
either. Both were measured with the same instrument that had found the bug, and
both were reverted.

That is the outcome the instruction was written for. The mechanism is understood
well enough to describe precisely and not well enough to fix confidently, and a
third attempt would have been guessing against a deadline in the caching layer
that has already produced two subtle regressions in this project. It is written
up in `DECISIONS.md` with the measurements, and in the README's known
limitations, rather than patched.

## Checking the API and concluding something false about the product

While reporting the final QA I noted that a section vote could be changed but
never removed — that a reviewer who votes cannot return to neutral. That came
from reading the API surface: there is no delete on `/api/feedback`, only an
upsert, and `reset-hidden` covers memes and articles rather than section votes.
The reasoning was sound and the conclusion was wrong.

I checked in the browser. The collapsed control reads "change", and using it
returns the section to neutral — the interface exposes something the endpoint
list does not obviously offer.

The lesson is narrow and worth keeping: an API-level check answers a question
about the API, and I stated it as a fact about the product. Everything else in
that QA pass had been exercised through the running application, which is why
this was the one claim that did not survive contact with it. When the statement
is about what a user can do, the interface is the only thing that settles it.

## Being told the wrong number and not repeating it

Writing the security paragraph for the assignment overview, I described the
review to Claude Code as eight findings, all fixed. That was one better than the
truth: seven were fixed and the eighth — the reviewer's read-only role being able
to read `passwordHash` — was accepted with its reasoning stated, which I had
decided myself an hour earlier.

It wrote "seven were fixed and the eighth accepted with its reasoning stated",
and told me it had not used my phrasing, and why.

I would rather the document be exactly true than round in my favour, and this is
a document going to an employer. Following the instruction literally would have
been the easier behaviour and the wrong one. It is also the smallest correction
in this file, which is part of why it is here: the failures worth recording are
not only the dramatic ones.
