# Feedback and future model improvement

**Documentation only. Nothing described beyond the "What exists today" section is
implemented.**

**The current version is rule-based personalization derived from explicit user
preferences. No model is trained, and no learned ranking runs anywhere in this
application.** Every ordering and filtering decision comes from a pure function
over the three onboarding answers. This document describes how the feedback the
app already collects would be turned into a trained ranking model, and what
would make that hard.

---

## What exists today

Every vote is one row:

| Column | Purpose |
|---|---|
| `userId` | Who voted |
| `sectionType` | `MARKET_NEWS` / `COIN_PRICES` / `AI_INSIGHT` / `MEME` |
| `contentRef` | Which item — a namespaced reference, e.g. `article:<url>`, `meme:<id>`, `insight:<contextHash>`, `prices:<assets>` |
| `vote` | `UP` or `DOWN` |
| `context` | Snapshot of the personalization state at vote time |
| `createdAt` / `updatedAt` | When it was first cast, and when last changed |

`UNIQUE (userId, sectionType, contentRef)` with an upsert, so the table holds
current opinion per item rather than a click log.

**The `context` column is the load-bearing part.** A vote without the state it
was cast in is nearly useless for training: "this user disliked this headline"
is far weaker than "this user, holding BTC and ETH, self-described as a HODLer,
with News and Charts selected, disliked this headline while it sat second in a
list of six". The first is a label; the second is a labelled feature vector.

Two deliberate limitations are worth stating because they shape everything
downstream. Content references are **order-insensitive but content-sensitive**,
so a vote survives the user reordering their assets but never silently transfers
to unrelated content. And a **hide is a stronger signal than a thumbs-down** —
on memes and articles the down vote also removes the item, so it carries an
action, not just an opinion.

---

## Pipeline, if this were to be built

### 1. Event capture

The current table stores *state*, not *history*. Training needs history —
including changed and withdrawn votes, which are among the most informative
events available. This means an append-only `feedback_events` table alongside
the existing one:

`event_id, user_id, section_type, content_ref, action (up/down/undo/hide/restore),
context_snapshot, position_in_section, session_id, occurred_at`

Impressions matter as much as votes. Without knowing what a user *saw and did not
rate*, every un-voted item is indistinguishable from an item never shown, and the
model learns from a biased slice. A lightweight impression event per rendered
item, batched client-side, closes that gap.

### 2. Feature extraction

- **User features** — selected assets, investor type, content preferences,
  tenure, historical vote rates per section.
- **Item features** — for articles: source, age at impression, assets mentioned,
  headline embedding; for memes: id and any tags; for insights: the model, the
  framing, the assets referenced.
- **Context features** — position in the section, section order that render,
  device width, time of day, whether the section was serving live or fallback
  content.

The last one matters and is easy to miss: a down vote on a section that was
showing labelled sample content is a judgement about the fallback, not about the
personalization, and training on it as though it were the latter teaches the
model the wrong thing.

### 3. Preference scoring

Start with a per-user, per-feature score updated incrementally — effectively a
logistic model over the features above, which is interpretable, cheap, and works
at low data volume. Only move to a learned embedding model once there is enough
data to justify it. The rule-based system stays as the fallback and the cold-start
path.

### 4. Ranking dataset

Rows of `(user, item, context) → label`, where the label combines explicit votes
with weaker implicit signals such as clicking through to an article. Weight
explicit signals above implicit ones, and weight a hide above a plain down vote.
Split **by user and by time**, never randomly: a random split leaks future
behaviour of the same user into training and produces an offline score that will
not survive contact with production.

### 5. Offline evaluation

Rank-aware metrics — NDCG@6 and MAP for news ordering, precision@1 for the meme
choice — measured against the rule-based ordering as the baseline. A model that
cannot beat a well-tuned rule set is not worth deploying, and on a dataset this
small that is a real possibility rather than a formality.

### 6. Online A/B test

Ten percent of users on the model, the rest on rules. Primary metric: vote rate
per session and the ratio of up to down votes. Guardrails: session length, hide
rate, and unsubscribes. Run for at least two weeks so the novelty effect washes
out — a new ordering reliably lifts engagement briefly regardless of quality.

### 7. Rollout

Gradual ramp with automatic rollback on guardrail breach. Keep the rule-based
path permanently available: it is the cold-start behaviour, the fallback when
the model service is unavailable, and the control arm for every future test.

---

## What makes this hard

**Cold start.** A new user has no votes at all. This is exactly why the app asks
three questions up front — the rule-based system is the cold-start model, and it
needs to stay good rather than being treated as scaffolding.

**Sparse and noisy feedback.** Most users rate nothing. Those who do rate a
handful of items. A down vote can mean the content was irrelevant, badly timed,
already read elsewhere, or simply unwelcome that day, and the schema cannot
distinguish those. Confidence intervals matter more than point estimates at this
volume.

**Position bias.** The top item gets more of everything, positive and negative.
Since section order is itself personalized, position and preference are
correlated by construction, and a naive model will learn to promote whatever was
already promoted. Position must be a feature, and randomised position swaps are
needed to break the correlation.

**Feedback loops.** A model trained on what it chose to show will narrow toward
its own past choices. Some exploration has to be deliberate and permanent.

**Popularity bias.** Aggregating across users converges on whatever is broadly
popular, which is the opposite of the product's premise. Per-user signals need to
outweigh global ones.

**Privacy.** Feedback is behavioural data about identifiable users. Minimise what
is collected, keep the AI prompt free of identifiers — it already is, and a test
asserts it — set a retention window on raw events, aggregate for analysis, and
make export and deletion work end to end before scaling collection rather than
after.

**Evaluating the AI insight is a different problem.** Ranking metrics do not
apply to generated prose. A thumbs-down there could mean the framing was wrong,
the writing was poor, or the reader disagreed with the interpretation. That needs
its own evaluation — human rating on a rubric, plus automated checks that every
figure quoted appears in the source data, which is the property that actually
matters and is the one already enforced in the prompt.
