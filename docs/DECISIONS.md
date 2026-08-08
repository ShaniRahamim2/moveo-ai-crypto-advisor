# Decisions

Product and engineering decisions taken during the build, with the reasoning.
Recorded because the reasoning is the part that gets lost — the code shows what
was chosen, not what was rejected or why.

`CLAUDE.md` §17 holds the amendments to the original build specification. This
file holds everything decided after that.

---

## Onboarding and personalization

**Asset cap is 12, not 8.** A cap exists at all for two reasons: an advisor
product that shows forty coins is a market table, and focus is the point; and
every selected asset is a coin in the CoinGecko request, so an uncapped list
walks into provider rate limits. Twelve is high enough not to feel arbitrary and
low enough to keep both properties. The minimum is 1, not 3 — a holder with only
Bitcoin is a real user, and rejecting them to satisfy a guideline would be worse
than allowing a single-asset dashboard. "Three to five works well" is on-screen
guidance, not a gate.

**Coin Prices is pinned to first or second place regardless of preferences.**
Content preferences can promote a section above prices; they cannot bury prices
at the bottom. A dashboard that opens with a meme, then news, then an AI
briefing, and reaches prices last does not read as a financial product. Verified
across all 15 preference combinations, with a test that enumerates them.

---

## Feedback

**Market News has no section-level vote.** Every article carries its own up/down
pair, which makes a section-level control redundant and adds clutter to a header
that already holds the collapse and source information. The section still has
voting, and the votes still land in the `feedback` table under `MARKET_NEWS`.
Stated in the README's Known Limitations so it reads as a decision rather than an
omission.

**A meme thumbs-down doubles as "hide".** This needed no schema change: the
existing `UNIQUE (userId, sectionType, contentRef)` already stores exactly one
row per user per item, so a `DOWN` vote _is_ the hidden set. It also means the
hidden state persists exactly the way votes do, by construction rather than by a
second mechanism that could drift.

**Article dismissals use an `article:` reference prefix.** `contentRef` is
namespaced — `article:<url>`, `meme:<id>`, `insight:<hash>`, `prices:<assets>` —
which is what lets per-article feedback share one table with section-level votes
without collision. The section-level news vote is keyed on a hash of the article
set, so the two never overlap.

**Feedback that cannot act says so.** A meme or article down-vote hides the item
immediately. Everywhere else the vote is recorded and the interface promises only
that. There is no recommender, and a control claiming to change what is on screen
while doing nothing reads as broken.

---

## Providers and caching

**The prices refresh cooldown matches the cache TTL (90s), not 30s.** A shorter
cooldown lets a press land inside the server's cache window and return
byte-identical data, which reads as a broken button. Matching the TTL means a
press always crosses it and always returns fresh data, and it protects the
CoinGecko quota harder than a shorter cooldown would.

**The `(cached)` label was dropped from source lines.** A cache hit is still live
data under 90 seconds old, and the timestamp beside it already conveys age. The
genuinely different case — the persisted snapshot — has its own `(saved)` label
_plus_ an explicit notice. A third distinction earned nothing and made the line
long enough to truncate on a phone.

**The insight summary and full text come from one model call, never two.** The
model returns `{"summary", "insight"}` in a single response. A second call to
summarise would double consumption against a free tier of roughly 50 requests a
day for no benefit. Malformed or truncated JSON degrades to showing the full text
uncollapsed rather than failing the section.

**Prices are excluded from the insight cache key.** Including them would defeat
the cache within a minute, since prices move constantly. The key is assets +
investor type + content preferences + date.

**The fallback insight is never cached.** A cached fallback would occupy the
day's slot and silently downgrade the section until tomorrow.

---

## Interface

**Collapsed section state lives in localStorage, not the database.** It is a
display preference, not user data: no schema change, no network call, no
migration. It does have to persist, because votes and dismissals do, and a
section springing back open on reload would stand out. Everything opens expanded
by default — a collapsed initial state reads as content that failed to load.

**Section votes collapse to a single control after voting, rather than
disappearing.** Hiding the controls entirely would break the requirement that
votes are changeable, and a reviewer who votes, changes their mind and finds no
control would read it as broken. The collapsed control doubles as a record of the
stored vote, which the two neutral buttons never showed.

**Names are title-cased for display only.** The stored value is never rewritten:
some names are deliberately lowercase, and overwriting what someone typed is not
ours to do. Each part of a hyphenated or apostrophised name is capitalised, and a
word that is already mixed case keeps its internal capitals, so `McDonald`
survives while `SHANI` and `shani` are both fixed.

**The greeting is computed client-side.** The server runs in one region and users
are in another; a server-side hour would greet people wrong, and a stored
timezone would be a schema field earning nothing.

---

## Scope

**Password reset is deliberately out of scope.** A reset flow needs a
transactional email provider with domain verification, which sits outside this
assignment's free-tier constraint. In a production build it would be the next
authentication feature. Recorded in the README's Known Limitations rather than
left for a reviewer to notice.

**Social is cut to section reordering.** CryptoPanic is unreachable from both a
residential IP and the deployed backend. The ranking code that would apply a
community signal exists and is tested, but no reachable source supplies one, and
inventing a score would be fabricating a signal.

**Screenshots are supplied by the developer.** The model can view the running
application but cannot write binary files into the repository, so it cannot
produce screenshots or source meme images. The same limitation applies to any
image asset. Expected files are listed in `docs/screenshots/`.

---

## Bugs worth remembering, and what caused them

**The meme stopped rotating on refresh — an assignment requirement, regressed
silently.** Removing a `setState`-in-effect to satisfy a lint rule replaced a
fallback to the server's rotated choice (`deck.current`) with a fallback to
`visibleMemes[0]` — the first entry of a stably ordered deck, identical on every
fetch. Browsing state had quietly taken ownership of which meme displayed.

Fixed by scoping browsing to the payload it happened in: a browsed choice records
`{ generatedAt, memeId }`, and a refresh produces a new `generatedAt`, retiring it
so the server's rotation wins. The two mechanisms no longer compete.

The requirement had **no test**, which is why it regressed unnoticed. Three now
guard it: consecutive fetches never repeat, the section reference matches the
rotated meme, and rotation never lands on a hidden one.

**"Show hidden articles again" appeared to do nothing, intermittently.** The
suspected cause was a query race between invalidation and refetch. The real cause
was simpler and only surfaced under repeated rapid clicking: the `dismissing` set
used for the removal animation **only ever grew**. A restored article came back
into the list rendering `opacity-0` with its control disabled. It worked whenever
the restore happened in a fresh component instance, which produced the roughly
one-in-ten success rate. The entry is now released once the item is hidden and
filtered out anyway.

The sequencing fix — refetch the hidden state to completion before the dashboard,
because the server filters hidden items out of the payload — was kept. It is
correct regardless, and the ordering genuinely matters.

**One account's data could paint under another's session.** The query cache was
not scoped to a user, so a previous account's dashboard rendered until the new
fetch landed, sometimes as a partial coin list. `queryClient.clear()` on sign-in
and sign-out makes this structural rather than timing-dependent: after clearing
there is no cached dashboard, so the skeleton renders and there is nothing stale
to paint.

**The prices refresh patches its own section rather than refetching the
dashboard.** The first fix refetched everything, which would have rotated the
meme and re-run the daily insight on every press — surprising, and the opposite
of why a prices-only endpoint exists. The response is now written into the cached
dashboard for that section alone.

**The section timestamp is our fetch time, not the upstream one.** Coin Prices
previously showed CoinGecko's `last_updated` in a footer, which lags by minutes
and never moves when we refetch, so the refresh button looked inert. The
duplicate footer was removed; the header timestamp reflects our own fetch.

---

## Meme artwork

**The original illustrations were a workaround, and were dropped when the
constraint lifted.** Twelve hand-built SVG illustrations existed because the
model cannot source copyrighted meme images and cannot write binary files into
the repository. Once the developer supplied real images, the workaround had no
reason to exist and was deleted entirely. Real memes are funnier, which is the
point of a section called Fun.

**No caption in the interface.** Every supplied image has its text baked in, so a
caption above or below the image duplicates it. `altText` is retained and written
per image from what the picture actually shows, since screen-reader users get
that instead of the image.

**The article-restore flicker was diagnosed and deliberately not fixed.** The
reported symptom was the list jolting when articles come back. Appending
restored articles to the bottom fixed the ordering half: measured across cycles,
the articles already on screen hold their position **to the pixel**.

What remains is different from what it looks like. In roughly one in three rapid
dismiss-and-restore cycles the row count goes `4 → 6 → 4 → 6` over about 250ms.
The rows on screen still never move — but the news card grows and shrinks with
them, so everything **below** it travels ~250px down, back up, and down again.
The jolt is real and it is not where it appears to be.

The mechanism was pinned down by capturing the restore button's verbatim text
alongside the row count:

```
t=3    n=4  "Show hidden articles again (2)"   figY=1475
t=13   n=4  "Restoring…"                       figY=1475
t=37   n=6  ABSENT                             figY=1727   optimistic clear
t=115  n=4  "Restoring…"                       figY=1475   hidden set is BACK
t=245  n=6  ABSENT                             figY=1727   reset's refetch wins
```

`"Restoring…"` renders only when the hidden set is non-empty *and* the mutation
is still pending, so at t=115 the optimistic clear had genuinely been overwritten
and then re-applied. A `GET /api/feedback` in flight when restore is pressed
resolves afterwards and writes the pre-reset votes back.

Two fixes were tried and measured with the same instrument. Marking the vote
invalidation `refetchType: 'none'` cut the pre-reset feedback requests from four
to one and **did not** change the flicker. Adding a `staleTime` to the feedback
query, on the theory that remounting article components refetch a stale query,
also did not change it. Both were reverted. Something still keeps a feedback
response in flight and the model is incomplete, so the honest position is a
documented rough edge rather than a third speculative patch the night before
submission.
