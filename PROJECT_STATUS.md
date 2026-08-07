# Project Status

Legend: `[ ]` not started · `[x]` done and verified · `[!]` blocked, partial, or cut

Nothing is marked `[x]` until the behavior has been exercised and observed. Updated after every phase.

Last updated: end of Phase 0.

## P0 — the assignment

- [ ] 1. Signup (name, email, password) + login with JWT; passwords hashed; protected routes
- [ ] 2. First-login onboarding: crypto assets, investor type, content preferences saved to DB
- [ ] 3. Dashboard with all four sections: Market News, Coin Prices, AI Insight of the Day, Fun Crypto Meme
- [ ] 4. Thumbs up/down on every section, persisted to DB, restored after refresh, changeable
- [ ] 5. Meme changes when the dashboard refreshes
- [ ] 6. Deployed frontend + backend + managed Postgres, publicly reachable
- [x] 7. Public GitHub repo, no secrets committed, readable commit history — repo created public and verified in Phase 0 (not a fork, not a template); secret scan repeated at Phase 10
- [ ] 8. `README.md`, `docs/ASSIGNMENT_OVERVIEW.md`, `docs/AI_USAGE.md`, `docs/FEEDBACK_MODEL_IMPROVEMENT.md`
- [ ] 9. Read-only DB access path for the reviewer (see amendment A2 below)

## P1 — what makes this stand out

- [ ] 10. Real, observable personalization along all three dimensions
- [ ] 11. Provider abstractions with timeout + 429 + failure handling; one dead provider does not kill the dashboard
- [ ] 12. API tests including explicit 429 and timeout tests
- [ ] 13. Editable preferences after onboarding
- [ ] 14. Loading/skeleton, empty, and partial-error states; responsive layout
- [ ] 15. Seeded demo account so the reviewer can log in without signing up

## P2 — only with spare time

- [ ] 16. Claude Code post-edit lint hook
- [ ] 17. Health-check keep-alive to mitigate cold starts
- [ ] 18. Extra market metrics, richer charts, animations

## Amendments (CLAUDE.md §17)

- [ ] A1. "Charts" preference renders an inline SVG 7-day sparkline per coin row (no charting library) — Phase 5
- [ ] A1. "Social" preference weights news toward CryptoPanic community signal and surfaces it — Phase 5
- [ ] A1. Test asserting all four content preferences produce an observable difference — Phase 5
- [ ] A2. `scripts/create-readonly-role.sql` committed, no credentials — Phase 2
- [ ] A2. Read-only role connected to; SELECT succeeds and write is rejected, both observed — Phase 2
- [ ] A2. `docs/DB_ACCESS.md` committed, no credentials — Phase 2
- [ ] A2. Seed leaves real rows in every table, feedback included — Phase 2
- [ ] A3. `docs/AI_USAGE.md` opens with the full-honesty statement, written incrementally per phase

## Phase log

| Phase | Status | Notes |
|---|---|---|
| 0. Env, repo, hygiene files | done | `gh` installed mid-phase; repo created public under ShaniRahamim2, `06ee35f` pushed |
| 1. Design proposal | awaiting approval | Blocked on B4 (Neon) for the DB half of Phase 2 |
| 2. Scaffold + deploy skeleton + Neon + DB access | not started | |
| 3. Auth | not started | |
| 4. Onboarding + preferences + personalization context | not started | |
| 5. Market + News + Meme providers, Charts/Social prefs | not started | |
| 6. AI Insight | not started | |
| 7. Feedback | not started | |
| 8. Dashboard integration + polish | not started | |
| 9. Documentation | not started | |
| 10. Final QA on production | not started | |
