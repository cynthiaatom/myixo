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
- [ ] Re-run latest branch build and API validation.
- [ ] Browser smoke tests: create company, save/edit/close, reload, switch business, sign out/in, two-device.
- [ ] Negative tests: owner A cannot read or mutate owner B, workspace A cannot see workspace B, invalid workspace ID, replay, malformed payload.
- [ ] Mobile viewport 320/375/768px, keyboard/focus/screenreader, WCAG contrast, loading/error/offline states.
- [ ] My Life full regression, branch reconciliation with concurrent decision-continuity work.
- [ ] Explicit go/no-go before production alias change.

**Do not promote until all blocking items are independently verified.** No fictional demo data should ever be presented as connected business records.
