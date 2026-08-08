Screenshots referenced by the root README.

- `dashboard.png`  — the dashboard with all four sections, signed in as the demo account
- `onboarding.png` — the onboarding questions with the searchable asset picker

Both are captured from the live app rather than localhost, so they show real
market data.

The editable preferences screen has no screenshot of its own: it reuses the
onboarding component, pre-filled, so a third image would show the same form
twice. Degraded provider states have none either — they cannot be forced from
the browser. That behaviour is covered by tests instead: a provider returning
429, a provider exceeding its timeout, and one provider failing while the other
three still return `ok`.
