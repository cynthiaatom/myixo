# Decision Continuity — release gates (2026-11-05)

## Current branch: interactive prototype only
- Decision Lab renders a temporary next-step, expected outcome, review-date and check-in flow after a successful analysis.
- The user must explicitly enter a next step; reported outcomes are labeled as user testimony.
- Data lives only in React component memory. It does **not** survive unmount, refresh, browser closing, logout, or device change.
- There is no localStorage, IndexedDB, cookies, analytics, database write, upstream iXo memory write, automatic reasoning, email, calendar, or external reminder.
- The current component must not be advertised as durable decision saving, a complete MVP, or a shipped feature.

## Required before durable persistence is developed
1. Verify a **current authenticated** native iXo first-class decision/action contract; the old OpenAPI snapshot is not proof that it exists today.
2. If absent, obtain explicit approval for a dedicated private account-scoped storage destination. Do not use ATOM marketing/CRM Supabase by default.
3. Derive owner identity on the server using the established authenticated iXo session; never accept client owner IDs.
4. Define RLS/equivalent access enforcement, encryption, retention/export/delete, idempotent writes, record versions, privacy notice and user consent.
5. Confirm the data schema distinguishes decisions, intentions, user-reported check-ins, and any independently verified outcomes.
6. Test cross-user isolation, sign-out/in persistence, edit/delete, missing/expired sessions, failed reasoning, and no passive AI spend.
7. Only then wire a durable API and a My Decisions screen, TODAY due items, and decision journey entries.

## Release/QA
- Run `npm run validate` on this branch (TypeScript build and API validation); not yet executed as part of this change.
- Authenticate with fictional test accounts/data and inspect responsive layout and accessibility.
- Do not merge or deploy without review/approval per ATOM policy.
- Source proposal: https://github.com/cynthiaatom/ai-cmo/blob/main/docs/ixo/2026-11-05-myixo-decision-continuity-mvp-spec.md
