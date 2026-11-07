# Native iXo Decision Storage — Contract Audit (2026-11-05)

## Decision
**Native-first; persistent writes BLOCKED pending an authenticated schema and isolation proof.**

## Evidence checked
- Existing My iXo credentials are delegated to `https://api.ai.atqm.us/api/v1/auth/login`.
- Existing authenticated memory proxy supports listing and modifying **profile facts**. This is not an application-record create/read/update/delete ledger and must not be repurposed for reminders.
- The historical iXo technical master reference documents `GET /capabilities`, `GET /projects`, and project files. It does not document a dedicated `/decisions`, goal/action record, due-date, check-in, or outcome API.
- Remote anonymous probes of `/capabilities`, `/projects`, and `/profile/memory` returned HTTP 401, meaning authenticated API access is required. The published `/openapi.json` address returned 404 in the previous audit. Neither result proves a native decision contract exists or is absent.
- Only the user's browser/iXo session can validate user-specific capability behavior. No user credentials, cookies, or tokens should be copied into ChatGPT, GitHub or diagnostics.

## Code changes
- `GET /api/ixo/session?resource=decision-capabilities` is a **read-only**, authenticated diagnostic. It checks native capabilities and projects access, returns only status codes and relevant feature names, and never exposes private project contents. It does not grant native decision storage capabilities.
- The experimental separate-PostgREST storage route was removed from the development branch. No database was created or modified. Live production remains unchanged.
- The existing Decision Continuity component is a session-only demonstration; it must not promise saving after sign-out.

## Native-first acceptance contract
Before native persistence, verify with the iXo backend maintainers or current authenticated OpenAPI:
1. An account-owned entity supports explicit decision identity, next step, optional review date, statuses and multiple outcome check-ins; if using project files, prove stable overwrite, delete and list operations with per-user isolation.
2. All create/read/update/delete operations derive the identity from native auth, and a user cannot inspect or mutate another user's records even given their IDs.
3. Versioning or conditional writes prevent accidental lost updates; deleted decisions do not remain in due reminders.
4. Upstream returns the original record and full check-in history after sign-out/in and across devices.
5. No write changes the profile facts/Personal Map implicitly, no passive AI call, and no marketing telemetry contains private decision text.

If native storage cannot satisfy these requirements, escalate a *dedicated* encrypted private application database for approval. Do not use ATOM CRM/marketing Supabase or the unrelated AdLift project.

## Verification
Development branch only, no production deployment. Native authenticated diagnostics still need an approved preview/test and signed-in user run. Do not mark permanent storage complete.
