# Project Status

Legend: `[ ]` not started · `[x]` done and verified · `[~]` partially done · `[!]` blocked or cut

Nothing is marked `[x]` until the behavior has been exercised and observed. Updated after every phase.

Last updated: end of Phase 8.

All routes are real. Nothing in the app is a placeholder.

## P0 — the assignment

- [x] 1. Signup (name, email, password) + login with JWT; passwords hashed; protected routes — verified against the live database and in a browser
- [x] 2. First-login onboarding: crypto assets, investor type, content preferences saved to DB — verified in a browser end to end
- [x] 3. Dashboard with all four sections: Market News, Coin Prices, AI Insight of the Day, Fun Crypto Meme — verified live in production
- [x] 4. Thumbs up/down on every section, persisted to DB, restored after refresh, changeable — three stable sections verified across a hard reload; see the meme note below
- [x] 5. Meme changes when the dashboard refreshes — verified: meme-001 to meme-005 on one refresh, previous never repeated
- [x] 6. Deployed frontend + backend + managed Postgres, publicly reachable — Vercel + Render + Neon, verified in production
- [x] 7. Public GitHub repo, no secrets committed, readable commit history — repo created public and verified in Phase 0 (not a fork, not a template); secret scan repeated at Phase 10
- [~] 8. Documentation — `docs/AI_USAGE.md` and `docs/DB_ACCESS.md` are written and current. **`README.md`, `docs/ASSIGNMENT_OVERVIEW.md` and `docs/FEEDBACK_MODEL_IMPROVEMENT.md` do not exist yet.** This is Phase 9 and it is the largest remaining gap
- [x] 9. Read-only DB access path for the reviewer — `moveo_readonly` created, connected to, reads allowed and all writes rejected

## P1 — what makes this stand out

- [x] 10. Real, observable personalization along all three dimensions — visible on screen and verified in production
- [x] 11. Provider abstractions with timeout + 429 + failure handling — including the isolation test: one provider fails, other three still `ok`
- [x] 12. API tests including explicit 429 and timeout tests — 114 tests; the timeout test really aborts at 5001ms
- [x] 13. Editable preferences after onboarding — `/preferences` reuses the onboarding form, pre-filled
- [x] 14. Loading/skeleton, empty, and partial-error states; responsive layout — checked at a real 375px viewport, not a resized desktop
- [x] 15. Seeded demo account so the reviewer can log in without signing up

## P2 — only with spare time

None of these were started. None are required, and none are blocking submission.

- [ ] 16. Claude Code post-edit lint hook
- [ ] 17. Health-check keep-alive to mitigate cold starts — would reduce the
      first-load cold start a reviewer hits. The honest "waking up the server"
      state is already implemented, so this is an improvement, not a gap
- [ ] 18. Extra market metrics, richer charts, animations

## Phase 8 priority list — nothing was cut

The agreed order was: (1) four sections with per-section status, (2) feedback
surviving refresh, (3) the refresh control, (4) the onboarding additions,
(5) visual polish and responsiveness, (6) coin logos and the sparkline, with 5
and 6 treated as cuttable.

**All six were completed. Neither 5 nor 6 was cut.** Coin logos come from the
`image` field already present in the CoinGecko response, so they cost no extra
request, and the sparkline is hand-rolled inline SVG with no charting library.

### Left rough, and worth a second look

- The dashboard header stacks the Refresh and Sign out buttons beside the
  greeting. It fits at 375px but it is tight, and a narrower phone would be
  worth checking.
- Section source labels are truncated with CSS rather than shortened per source.
  It reads fine, but a long label is cut mid-word rather than summarised.
- The meme illustrations are original flat-vector drawings. They are deliberate
  and consistent, but they are not the same thing as recognisable meme formats —
  the two supplied images carry that weight.
- No frontend tests exist. All 114 tests are server-side. The client has been
  verified by hand in a browser, including at a phone viewport, but nothing
  guards a regression in the React components.

## Onboarding additions agreed for Phase 8

- [x] Helper line under each investor type and content preference — verified in production
- [x] "Not sure? Start with a popular mix" button prefilling BTC + ETH + SOL, HODLer, Market News — verified editable after prefill
- [x] Decided against demographic/background questions — the assignment specifies three questions and the data would feed nothing

## Known issues

- A vote on the Fun Crypto Meme section does not appear after a refresh. This is
  correct rather than broken: votes are attached to the specific content voted
  on, and the meme is required to change on every refresh, so the new meme has no
  vote yet. The other three sections keep their votes across a hard reload.
- The Phase 7 commit broke the production build (a Prisma JSON type error) and
  was not caught, because lint and tests pass without type-checking. Production
  served a stale build until it was found and fixed in Phase 8. `npm run build`
  now runs before every commit.

## Where this stopped, and what comes first tomorrow

**State at the end of Phase 8.** The application is feature-complete against P0
except for documentation. Everything is committed and pushed; `main` and
`origin/main` are identical at `401c066`, the working tree is clean, and the
deployed site runs that commit. 114 tests pass, lint is clean, both builds are
clean, and all four dashboard sections were verified returning `ok` with live
data in production at a 375px viewport.

**Two decisions waiting on the developer** — neither blocks Phase 9:

1. **The meme vote does not persist across a refresh.** This is a consequence of
   votes being attached to specific content while the meme is required to change
   on every refresh. It is arguably correct and arguably confusing to a reviewer.
   Flipping it to a section-scoped reference is a small change if preferred.
2. **The demo account carries votes left over from testing** (prices down, news
   up, insight up) rather than the seeded state. They demonstrate restoration
   working. They can be reset to the seed if a clean slate is preferred.

**First thing tomorrow: Phase 9, documentation.** It is the largest remaining
gap and three graded deliverables do not exist yet. In order:

1. `README.md` — live URLs, demo credentials, screenshots, the personalization
   comparison between the two seeded profiles, architecture, schema, API table,
   local setup, env vars, how to run the tests, provider and reliability notes,
   reviewer database access, and known limitations.
2. `docs/ASSIGNMENT_OVERVIEW.md` — one page, English, suitable to attach to the
   submission email.
3. `docs/FEEDBACK_MODEL_IMPROVEMENT.md` — the bonus. Documentation only. Must
   state plainly that the current version is rule-based personalization from
   explicit preferences and that no model is trained today.

`docs/AI_USAGE.md` is already written and current through Phase 8; it needs a
final pass in Phase 9, not a rewrite.

Then Phase 10: final QA on production, the two-profile personalization
comparison, and a git history secret scan before submission.

## Build hygiene

- [x] Temporary `/api/_diag` route removed before Phase 5 closed — added at `bdce63d`, removed at `a8ffbc4`; no references remain in `src/` or `tests/`

## Amendments (CLAUDE.md §17)

- [x] A1. "Charts" preference renders an inline SVG 7-day sparkline per coin row (no charting library) — rendering verified on screen
- [!] A1. "Social" preference weights news toward CryptoPanic community signal — CUT to reordering only. CryptoPanic unreachable from both a residential IP and Render; ranking code exists and is tested but no live tier supplies a signal
- [x] A1. Test asserting all four content preferences produce an observable difference
- [x] A2. `scripts/create-readonly-role.sql` committed, no credentials
- [x] A2. Read-only role connected to; SELECT succeeds and write is rejected, both observed
- [x] A2. `docs/DB_ACCESS.md` committed, no credentials
- [x] A2. Seed leaves real rows in every table — users 2, prefs 2, feedback 3, insight_cache 1
- [x] A3. `docs/AI_USAGE.md` opens with the full-honesty statement, written incrementally per phase

## Phase log

| Phase | Status | Notes |
|---|---|---|
| 0. Env, repo, hygiene files | done | `gh` installed mid-phase; repo created public under ShaniRahamim2, `06ee35f` pushed |
| 1. Design proposal | approved | |
| 2. Scaffold + deploy skeleton + Neon + DB access | done | Live on Render + Vercel + Neon; CORS, SPA fallback and full login verified in production |
| 3. Auth | done | 15 tests passing; verified live and in a browser |
| 4. Onboarding + preferences + personalization context | done | 44 tests; all 50 CoinGecko ids verified to resolve |
| 5. Market + News + Meme providers, Charts/Social prefs | done | 64 tests; RSS is the live news tier; temporary diagnostic route removed |
| 6. AI Insight | done | 84 tests; daily cache verified live (3856ms -> 76ms, one row) |
| 7. Feedback | done | 100 tests; upsert verified against the live database (one row after a changed vote) |
| 8. Dashboard integration + polish | done | 114 tests; deployed and verified in production at a phone viewport |
| 9. Documentation | not started | |
| 10. Final QA on production | not started | |
