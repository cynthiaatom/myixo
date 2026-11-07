# My iXo — Decision Continuity private persistence activation (2026-11-07)

## Current state

Application UI, server persistence adapter, TODAY due items and Weekly Personal Review are implemented in the feature branch. They are not activated on production.

**No private decision database has been provisioned, migrated, connected, or written in this work.** The available Supabase account currently exposes two projects: `cynthia atom's Projects` (`fsoaqrfotefiobqyfgiq`, shared ATOM business data) and `AdLift` (`cvmbedawcgsjihphbvls`, inactive). Neither is a verified dedicated My iXo database. The server adapter explicitly refuses both known project hostnames to protect project isolation.

## Backend architecture

- Endpoint: `/api/ixo/session?resource=decisions` piggybacks the established authenticated server function and adds **no new Vercel function**.
- Every request verifies the native iXo session with `/auth/me` and derives `owner_id` on the server, never from supplied user IDs.
- The server is the only caller permitted to reach the private Supabase `myixo_decisions` table, with an **elevated server-side secret key only**. Browser clients never receive Supabase keys.
- SQL: `docs/migrations/0001_myixo_private_decisions.sql`. Requires a dedicated My iXo project; RLS enabled, all `anon` and `authenticated` table grants revoked.
- A JSONB decision record contains title, next step, expected outcome, review date, status, and user-reported check-in history. Revision integer supports optimistic concurrency.
- CRUD requests apply strict owner filter; PATCH and DELETE include expected revision and reject stale updates.
- Vercel environment variables **for a dedicated My iXo project only**:
  - `MYIXO_PRIVATE_SUPABASE_URL` = standard project endpoint `https://<dedicated-project-ref>.supabase.co`
  - `MYIXO_PRIVATE_SUPABASE_SECRET_KEY` = Supabase server-side secret key (`sb_secret_...`), never a publishable or browser key.
- Neither value is committed to source control. Set environments only after approving the private project and SQL migration. Always inspect Vercel environment scope to avoid leaking private records across deployment stages.

## Frontend behavior

- When a native iXo account is authenticated, the app queries the private storage endpoint.
- If configured and successful, My Decisions displays **Private account storage connected**, loads owner-scoped records, and requires server acknowledgement before confirming a create, update, check-in or delete.
- With no configured project (current state), My Decisions explicitly displays **Temporary session**; entries vanish on refresh/logout. There is no fallback write to the ATOM shared database or browser storage.
- If temporary data exists before account sign-in, the app **does not silently overwrite it** or auto-upload it.
- TODAY uses user-entered review dates independently of native AI reasoning; Weekly Personal Review uses only user-reported decisions and outcomes. Neither silently triggers another model call.

## Privacy and acceptance tests before activation

1. Approve a dedicated private My iXo Supabase project; verify no ATOM marketing/CRM or unrelated data is present. Establish cost/region expectations.
2. Apply reviewed SQL migration to that project only. Confirm RLS, grants, table shape, owner index, and absence of anonymous access.
3. Configure server-only Vercel keys scoped to appropriate environments.
4. Test with **two real, non-sensitive test accounts**, proving user A cannot access B's decision by forged ID or view/modify another user's records. Do not use their real personal decision content.
5. Verify create, list, edit, check-in, review-date recurrence, close/reopen, delete, optimistic revision conflicts, and persistence after reload/signout/signin on a second device.
6. Test unsupported/expired sessions, secret rotation, database failures, and that UI never labels a failed write as saved.
7. Review retention/export/delete requirements and data privacy notice before enabling real personal records.
8. Perform responsive browser QA. Merge or production deploy only after required ATOM/My iXo release approval.

## Evidence

- Typed app model and weekly review: `src/decisions/model.ts`, `src/decisions/weekly-review.ts`.
- Server owner scoping: `lib/private-decisions.js`; HTTP client: `src/decisions/persistence.ts`.
- UI: `src/components/DecisionWorkspace.tsx`, `src/components/WeeklyPersonalReview.tsx`, `src/components/TodayView.tsx`.
- Mock tests: `scripts/test-private-decision-store.mjs`, `scripts/test-decision-model.mjs`, `scripts/test-weekly-review.mjs`, plus existing authentication tests.

This handoff is not proof of a live database. Do not mark cross-device persistence complete until its end-to-end tests pass.
