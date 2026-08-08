# Reviewer database access

The application database is PostgreSQL, hosted on Neon (`eu-central-1`).

A dedicated `moveo_readonly` role exists for review. **The host and password are
not in this repository** — they are in the submission email. This repository is
public, and publishing the endpoint would name a target without giving a reviewer
anything they do not already receive. The database name is Neon's default,
`neondb`, and appears in the grant script; it identifies nothing on its own. The
application's owner role is never shared.

## Connecting

Any PostgreSQL client works. Substitute the values from the submission email:

```bash
psql "postgresql://moveo_readonly:<password>@<host>/neondb?sslmode=require"
```

GUI clients (TablePlus, DBeaver, pgAdmin) need:

| Setting | Value |
|---|---|
| Host | in the submission email |
| Port | `5432` |
| Database | `neondb` |
| User | `moveo_readonly` |
| Password | in the submission email |
| SSL | required |

## What the role can do

`SELECT` on every table in `public`, and nothing else. The grants are in
[`scripts/create-readonly-role.sql`](../scripts/create-readonly-role.sql).

Verified by connecting as the role and attempting each operation:

| Operation | Result |
|---|---|
| `SELECT` on all four tables | allowed |
| `INSERT` | rejected — `42501 permission denied` |
| `UPDATE` | rejected — `42501 permission denied` |
| `DELETE` | rejected — `42501 permission denied` |
| `CREATE TABLE` | rejected — `42501 permission denied for schema public` |
| `DROP TABLE` | rejected — `must be owner of table` |

`ALTER DEFAULT PRIVILEGES` is set, so tables added by later migrations are
readable by the role without a further grant.

Read access to `users` includes `passwordHash`. That is inherent to granting
database access rather than an oversight: the column holds bcrypt hashes at cost
10, not recoverable passwords. The demo account passwords are used nowhere else.

## Schema

Four application tables plus Prisma's `_prisma_migrations`.

| Table | Purpose |
|---|---|
| `users` | Account, hashed password, `onboardingCompleted` flag |
| `user_preferences` | One row per user: `selectedAssets`, `investorType`, `contentPreferences` |
| `feedback` | One row per (user, section, content item) with the vote |
| `insight_cache` | Generated AI insight keyed by a hash of the personalization context |

`selectedAssets` and `contentPreferences` are Postgres arrays rather than join
tables: they are small, fixed-vocabulary lists, and keeping them inline avoids
two join tables that would earn nothing at this scale.

Feedback is keyed `UNIQUE (userId, sectionType, contentRef)` and written as an
upsert, so changing a vote updates the existing row instead of accumulating
history. `contentRef` identifies the specific item voted on — a news URL, a meme
id, or the insight's context hash — so a vote stays attached to its content when
the dashboard refreshes.

## Seeded data

Two contrasting profiles are seeded so the tables are populated on first
inspection and the personalization comparison in the README can be reproduced:

| User | Assets | Investor type | Content preferences |
|---|---|---|---|
| `demo@cryptoadvisor.app` | BTC, ETH | HODLER | MARKET_NEWS, CHARTS |
| `daytrader@cryptoadvisor.app` | SOL, DOGE | DAY_TRADER | SOCIAL, FUN |

Both have `onboardingCompleted = true`. Sample feedback rows and one
`insight_cache` row are seeded as well.
