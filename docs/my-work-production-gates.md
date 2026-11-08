# MY iXo My Work — production acceptance gates
Updated 2026-11-08. **NOT PRODUCTION-APPROVED.** This document distinguishes implementation from verified behavior.

## 1. Permanent records
- [x] Existing Supabase project reused, separate private tables for company/work items.
- [x] Owner/workspace-scoped Edge CRUD, optimistic revisions, no direct browser DB credentials.
- [x] Verified anon and authenticated roles lack SELECT on both tables, RLS enabled.
- [x] Native iXo session same-origin proxy; refresh cookie path now includes /api/work.
- [ ] Authenticated save → logout → sign in → same records on another device, with actual account.
- [ ] Verify invalid/expired session refresh in a real authenticated browser.

## 2. Executive dashboard
- [x] Stored opportunity, decision, task and goal registers; due dates and overdue/upcoming records.
- [x] Pipeline is clearly potential value, not realized revenue.
- [ ] Real CRM, calendar, accounting, ClickUp and external operational sources connected per business with freshness/provenance.
- [ ] Data freshness, reconciliation, and quantitative progress-to-target.

## 3. MY iXo intelligence
- [x] Company-specific Business Map questionnaire, memory notes, TODAY and MIRROR rule-based signals.
- [ ] Business-scoped native reasoning with citeable source IDs, decisions options/outcomes and review lifecycle.
- [ ] Memory corrections, durable provenance and reasoning trace; verify no personal-memory leakage.

## 4. My AI Team
- [x] Six specialist planning areas and saved assignments.
- [ ] Real delegated specialist workflows with capabilities/approval gates, tool allowlists, audit trail and rollback.
- [ ] Team membership, least-privilege roles, invitations and cross-tenant access tests.
- [ ] Multi-user enterprise permission model. Current MVP is strictly single-owner.

## 5. Release QA
- [x] TypeScript/Vite builds passed after most recent UI changes (earlier SHA 2712a8c).
- [x] No-auth Edge request rejected with 401.
- [x] Re-ran build and API validation on consolidated endpoint commit 424a738 (12 functions, passed).
- [ ] Browser smoke tests: create company, save/edit/close, reload, switch business, sign out/in, two-device.
- [ ] Negative tests: owner A cannot read or mutate owner B, workspace A cannot see workspace B, invalid workspace ID, replay, malformed payload.
- [ ] Mobile viewport 320/375/768px, keyboard/focus/screenreader, WCAG contrast, loading/error/offline states.
- [ ] My Life full regression, branch reconciliation with concurrent decision-continuity work.
- [ ] Explicit go/no-go before production alias change.

**Do not promote until all blocking items are independently verified.** No fictional demo data should ever be presented as connected business records.

## 2026-11-08 continuous implementation pass
**Implemented on feature branch (not production):**
- Business Map now has three separately stored stages per dimension: current situation, challenges/evidence, and measurable goal. Each uses company-scoped `dimension` records with independent revision. Saving advances only after successful server response. Existing legacy note-format answers remain as historical notes, not counted as verified completion.
- Business Map coverage counts 30 dimensions only when all three stages have been saved; partial progress is shown separately. Prompts vary by stage, but do not yet adapt dynamically to answer content.
- Added source-labeled CEO attention queue for overdue items and missing follow-up/review dates; no claim of AI-generated diagnosis.
- Added decision alternatives/tradeoffs and evidence/unknowns fields in persisted decision details, and company-scoped project and meeting registers.
- Separated opportunity, decision and assignment due-date inputs.
- Prevented misleading cloud-data exports: session export/import only enabled for unsigned-in demo records until a complete authenticated export exists.
- Added API offset pagination and bounded multi-page loading; incomplete loading triggers an explicit warning. Maximum 25 pages / 5,000 records is an MVP guardrail.
- Confirmed Supabase private tables have RLS enabled and anon/authenticated roles lack direct SELECT, and anonymous Edge request returns 401.
- TypeScript/Vite and API regression validation performed on this branch; see current deployment checks for latest SHA.

**Still release-blocking:**
- Real authenticated end-to-end save, cross-device, expired token, cross-account and cross-workspace negative tests.
- Full native iXo business-scoped reasoning and source-grounded recommendations, not merely deterministic record summaries.
- Agent execution engine with tool scopes, approval workflow, observability and reversible actions. Current specialist cards are planning/assignment only.
- Real external integrations: CRM, finance, project management, calendar, documents. Existing ChatGPT connectors do not themselves authorize this independent app's workers.
- Team roles, organization membership and enterprise-level least-privilege enforcement.
- Structured business entity relationships beyond typed work items; evidence provenance, audit log, backups/export and migrations.
- Mobile accessibility and full My Life regression browser tests, plus explicit promotion approval.

**Security posture:** Production untouched. No autonomous specialist actions or third-party account writes performed.

- Follow-up prompts now incorporate the previous saved situation and challenge within the same company/dimension. This is deterministic context adaptation, not native model reasoning.
- Added project and meeting records with explicit source IDs; existing ChatGPT integrations are not silently imported into MY iXo.

## Subsequent reliability pass
- Cloud saves for opportunities, decisions, tasks, notes, projects, and meetings now retain form contents when the server rejects or fails the write; only successful saves clear the corresponding form. The Business Map already uses confirmed-write advancement.
- Decision register now visibly displays stored alternatives and evidence/unknowns, including older plain-text details.
- TypeScript/Vite build and API regression suite passed during this pass. Authenticated end-to-end cross-device and cross-company tests remain outstanding; production promotion remains gated.

## Next continuous workflow pass (2026-11-08)
Implemented and validated on the development branch:
- Owner-scoped **complete business JSON export**: re-fetches every page through the authenticated Work API, rejects incomplete pagination and workspace changes, verifies every returned record belongs to the selected company, and exports that company only. Import into cloud storage remains disabled pending schema/version conflict handling. Downloaded files contain confidential business data and must be protected.
- **Read-only specialist evidence briefs** for Marketing, Revenue, Operations, Research, Finance and Chief of Staff. Briefs select company-scoped saved records, include source IDs, missing context, and explicit approval boundaries. They are drafts for review, **not executed autonomous AI agents** and do not write to external systems.
- **Proactive deterministic signals**: business dimension answers not updated in 90 days and incomplete Business Map coverage now appear in MIRROR; stale answers also enter the CEO attention queue. No scheduled background monitoring or model-generated advice is claimed.
- Existing RLS and table privileges checked again: both private tables have RLS enabled; anon/authenticated roles lack direct read/write grants.
- Anonymous GET/POST/PATCH/DELETE to the Edge Work endpoint each returned 401.
- TypeScript/Vite build and API regression suite passed (12 API functions).
Remaining production blockers: authenticated two-account and two-device tests; owner/workspace IDOR tests using real test identities; native company-scoped model reasoning; autonomous specialist execution and approvals; app-worker integration credentials; enterprise roles; mobile/accessibility and My Life browser regressions. **Do not promote this branch yet.**

## Continued execution: isolated decision review and safeguards
- Implemented **company-scoped decision evidence review**: parses saved options and evidence, finds title-related records in the selected company, cites record IDs, flags missing evidence/review dates and keeps final decisions with the human. This is deterministic decision support, not a claim of native model reasoning.
- Switching companies now clears both the specialist draft and decision review so sensitive previous-company material is not left visible in those panels.
- Production build and 12-function API regression suite passed after these changes.
- Authenticated two-account negative testing remains blocked by the absence of two authorized native iXo test identities in this tool session. **Do not fabricate passing cross-tenant results.**
- The native iXo personal reasoning endpoint uses personal profile memory and persistent chats. Passing confidential company context into it without a distinct business-scoped conversation/memory contract could cross-contaminate My Life and My Work. Native business reasoning is intentionally gated pending a separate verified isolation path.
- Independent MY iXo workers do not inherit ChatGPT's connected account credentials. CRM, finance, ClickUp, Google Drive, email and calendar write integrations require their own app-scoped credentials, least-privilege scopes, user consent and audit logs; no unauthorized connectors or credentials were created.
- Multi-user role grants, delegated specialists, and automatic external writes remain gated until an audited authorization model and real cross-tenant acceptance tests pass. The existing private single-owner model must not be silently upgraded to team access.

## Further continuous pass — data completeness and CEO snapshot
- On every company change or logout, the frontend immediately invalidates prior record completeness and clears specialist/decision drafts. Failed paginated loads also remain incomplete, preventing misleading evidence-based briefs and CEO priority calculations.
- TODAY now offers a **Generate evidence-backed executive snapshot** action. It creates a read-only, company-scoped record summary with IDs for overdue, unscheduled and stale records, and explicitly distinguishes deterministic checks from native model inference. The generated snapshot appears in the specialist review area; no autonomous action is triggered.
- TypeScript/Vite build and existing 12-function API regression suite passed.
- Native reasoning, application-worker connectors, multi-account browser security, mobile and accessibility checks remain not verified. No production release authorization is implied.
