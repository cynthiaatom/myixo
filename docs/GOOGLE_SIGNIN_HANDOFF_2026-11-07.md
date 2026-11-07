# My iXo — native Google sign-in handoff (2026-11-07)

## Status
Google sign-in integration is implemented **on feature/decision-continuity-mvp-prototype**, not in production. This reuses the existing official iXo Firebase web project, its Google sign-in UI flow, and native iXo `POST /api/v1/auth/google` exchange.

## Evidence from official iXo
- The live `ixo.chat` public JS uses Firebase `signInWithPopup(new GoogleAuthProvider())`, obtains a Firebase identity token, sends it to iXo `POST /auth/google`, and uses the normal iXo access/refresh session.
- The official public landing catalog reports `google_auth_enabled: true` and an empty/no Turnstile site key at the time of inspection.
- The Firebase public project configuration's authorized domains (2026-11-07) were `localhost`, `project-ixo.firebaseapp.com`, `project-ixo.web.app`, `app.stage.atqm.us`, `ixo.chat`, `stage.ixo.chat`, `app-stage.ixo.chat`, `app.ixo.chat`.
- **Neither `myixo.vercel.app` nor the feature-preview Vercel host is authorized.** Google popup sign-in cannot work from My iXo until a Firebase Auth administrator authorizes the exact domain(s). This is the verified blocker, not an issue with the user's password.

## Implementation
- `src/services/google-auth.ts`: lazy-load the same official Firebase SDK release into an isolated in-memory Firebase Auth instance. Verify availability before popup; clear Firebase SDK login afterward to avoid keeping a separate session.
- `api/ixo/login.js`: existing password login preserved; Google provider POST forwards an identity token server-to-server to the native iXo `/auth/google` contract, validates `/auth/me`, then sets existing HttpOnly iXo session cookies. The identity token is not stored or logged.
- `GET /api/ixo/login?mode=google-availability`: unauthenticated public-status response (no secrets or personal info), checking iXo's public provider enablement and Firebase authorized-domain list for the deployed host. The Google button will explain the administrator blocker when unavailable.
- Account linking: native backend may return `google_login_link_required`. Our UI sends the user to the official iXo email-ownership verification/link flow; it does not create a duplicate account or attempt to bypass verification.

## One-time external provider configuration needed
In the **existing** Firebase console for project `project-ixo`: Authentication → Settings → Authorized domains; authorize `myixo.vercel.app` for production. To test with the current Vercel preview, also authorize its exact `myixo-...vercel.app` hostname (not a wildcard). The administrator must confirm Firebase project ownership and allowed security policy. Do not change other ATQM applications or any native iXo credential/settings in this repository.
OAuth JavaScript origin/redirect settings should be checked if the popup still fails after the Firebase authorized-domain update.

## QA / release
- Repo branch compiled and all My iXo validation/regression checks passed for the first Google integration and subsequent same-origin readiness code; syntax and API final delta recheck needed.
- Feature preview has been automatically built on Vercel; live readiness currently blocked by Firebase authorized-domain configuration.
- Test Google login in a browser on an authorized exact hostname, confirm resulting `/api/ixo/session` and existing native Personal Map; confirm logout, account-link-required error and login continuity. Never print auth tokens.
- Decision Continuity native storage is a **separate pending contract**. Google login alone does not prove a durable decision/check-in ledger exists. Re-run the authenticated read-only `/api/ixo/session?resource=decision-capabilities` after login, then validate native persistence before writing any private decisions.
- Do not merge/publish to production before authenticated end-to-end tests and required release approval.
