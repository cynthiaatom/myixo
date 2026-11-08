# MY iXo — My Work implementation contract
Status: development specification, not production acceptance. 2026-11-08.

## Boundaries and sources
- Preserve all existing My Life components and native iXo authentication; My Work must be an independently navigable area.
- Existing Supabase project: `wmuwtgaxfihutroqiaqj` ("My iXo"), **not** ATOM Mission Control `fsoaqrfotefiobqyfgiq`.
- Existing `myixo_decisions` and `myixo-decisions` Edge Function belong to native personal decision continuity. Do not repurpose or weaken their auth, validation, owner scoping or revision protections.
- Existing AI CMO/CRO methods may be adapted from `cynthiaatom/ai-cmo`; never copy ATOM business records, contacts, tokens, worker credentials, or client data.
- No production promotion without user authorization and complete QA.

## Data model (proposed; do not apply until existing feature branch is reconciled)
- `work_organizations`: uuid id, owner_native_id, display_name, description, objective, timestamps.
- `work_memberships`: organization_id, native_user_id, role (owner/admin/member/viewer), status, timestamps. Owner membership established server-side.
- `work_opportunities`: uuid id, organization_id, title, potential_value, currency, status, source, source_timestamp, created_by, updated_at, revision.
- `work_decisions`: uuid id, organization_id, question, context, alternatives, status, expected_outcome, review_at, evidence, revision, created_by, updated_at.
- `work_activity`: organization_id, entity_type, entity_id, action, actor_native_id, event_at, metadata. Immutable audit events for writes.
- `work_approvals`: organization_id, requested_action, payload_hash, requester, approver, status, expires_at. No execution before authorization.

## Authorization
- Browser never receives Supabase service role / secret keys, native iXo access tokens, or unrestricted direct SQL privileges.
- Same-origin server route uses HttpOnly iXo cookie, refreshes/validates native token, and forwards to dedicated MY iXo work Edge Function.
- Edge Function validates the native iXo identity with fixed upstream `/auth/me` on each request, resolves organization membership on server, and filters all operations by organization id + authenticated native user membership. Never trust client-supplied owner or role.
- Tenant switching must not imply tenant access. Deny unknown membership, malformed input, stale revision, and missing auth.
- All public schema tables require RLS. Service credentials stay server-side. Never broaden existing `myixo_decisions` policies.
- Every consequential external action (send, post, purchase, bulk CRM update, delete, permission change) requires explicit approval, audited action payload and provider receipt.

## Workspaces
1. Executive Brief: real source-grounded alerts; no fake company insights. Each alert includes source, freshness, confidence, estimated impact and action.
2. My Business: organizations and goals; selector; user membership; company memory scoped by org.
3. Opportunities: create/edit/close with currency, value, source and dates; never conflate potential value with realized revenue.
4. Decisions: alternatives, assumptions, supporting evidence, next step, review date, and actual outcome.
5. Business Improvement Calculator: keep interactive; clearly label scenarios, contribution margin, hours recovered, costs and double-counting.
6. My AI Team: CMO, CRO, operations, research and chief of staff; role-based tools and approvals; no autonomous external outreach by default.

## Release gates
- Baseline latest `feature/decision-continuity-mvp-prototype` before merging; identify conflicts.
- TypeScript/Vite build and API import/parse checks pass.
- Test anonymous request 401, invalid token 401, non-member 403, cross-tenant read/write denied, stale revision 409, owner create/read/update/delete, data persists across sessions, no secret in browser bundles, and personal decision records unchanged.
- Manual browser QA on desktop/mobile: tab switching, accessibility, keyboard, responsive layouts, empty/loading/error states.
- Confirm Vercel preview READY and authenticated end-to-end tests before any production release.
