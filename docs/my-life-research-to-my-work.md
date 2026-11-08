# MY iXo: Why My Life was built this way, and the My Work adaptation
2026-11-08 · source-grounded engineering/research synthesis

## Evidence reviewed
- Existing implementation: `src/ixo.ts`, `src/components/TodayView.tsx`, `MirrorView.tsx`, `DecisionLab.tsx`, `AskIxoView.tsx`, `ProductNav.tsx`, `src/intelligence/types.ts`.
- Earlier MY iXo product conversations (September 23–24, 2026): 30 dimensions in 10 personal areas; one-question adaptive onboarding; context and personal map as differentiators; KNOW→REASON, TODAY/MIRROR/DECIDE/ASK, memory provenance and correction.
- Existing native iXo reasoning lifecycle and official authenticated API: `src/services/reasoning.ts` and native `/api/ixo` proxy. Its personal memory is NOT equivalent to a verified company knowledge store.
- No independently validated psychometric instrument or full literature bibliography was recovered in this pass. Do not describe the business questions as clinically validated or empirically proven.

## Why My Life works
1. **Build context gradually**: one answer at a time, not a 50-field form. In `src/ixo.ts`, areas include psychology, health, relationships, family, work, finance, development, rest, values and environment. Each area tracks situation, priorities and goals.
2. **Make the intelligence inspectable**: personal map, memory inspector, source metadata, corrections and revision awareness. Never infer a fact merely from an unverified model output.
3. **Move from knowing to helping**: TODAY asks what deserves attention; MIRROR looks for supported contradictions, gaps, neglected priorities, dependencies and stale assumptions; DECIDE structures options, assumptions and tradeoffs; ASK uses bounded relevant context; TIMELINE makes continuity visible.
4. **Distinguish knowledge from speculation**: explicit KNOWN / INFERRED / UNKNOWN, evidence references, insufficient-context state, transparent failures, and no fabricated generic comparison.
5. **Keep the user in control**: suggestions and alternatives support decisions; agents do not silently make consequential choices.

## Translate to My Work, not copy personal psychology into companies
| My Life concept | My Work implementation |
|---|---|
| 10 personal areas × situation/priorities/goals | 10 business dimensions: Strategy, Customers, Revenue, Operations, Decisions, People, Constraints, Measurement, Risk, Leadership |
| One-question onboarding | Business Map interview, one meaningful question per step; save answers as company-scoped notes |
| Personal Map | Business Map: what is known, what matters, measurable desired outcomes, coverage gaps |
| Memory Inspector | Company memory with source, timestamp, edit/revision, correction, and per-company access |
| TODAY | Company-specific open opportunities, decisions, tasks, due dates and evidence-linked priority cards |
| MIRROR | Gaps and questions: missing goals, no follow-up dates, stale assumptions, unresolved decisions |
| DECIDE | Company decision register; options, tradeoffs, review dates and eventual outcome tracking |
| ASK | Bounded company-scoped context; cite the exact records used; no claims of native iXo business reasoning until verified |
| TIMELINE | Organization audit history, outcome reviews and changes over time |
| Agents | Marketing, Revenue, Operations, Research, Chief of Staff, Finance, with approval gates |

## Current implementation truth
- Supabase `wmuwtgaxfihutroqiaqj`: `myixo_workspaces` and `myixo_work_items` with RLS enabled and browser roles revoked. Native iXo identity verified server-side for each Edge request. Work records filtered by owner and workspace. This is a single-owner MVP, NOT multi-user enterprise membership.
- Same-origin `api/work/index.js` proxies using HttpOnly native iXo session cookies. No browser service credentials.
- React: workspace selector, create business, save opportunities, decisions, tasks and notes; evidence-linked rule-based TODAY/MIRROR; ten-step Business Map; Executive Brief and scenario calculator.
- AI specialist cards are assignment planning, not actual autonomous AI workers.
- Missing: real CRM/project integrations, robust team permissions and audit log, native business-scoped reasoning engine, fully persisted goals/notes metadata, per-company adaptive branching, evidence-linked generated recommendations, multi-user role model, end-to-end authenticated/cross-account tests.

## Research caution
Business interviews may borrow general principles of adaptive questioning and decision science without asserting that a personal psychological model validates a company diagnosis. Validate business questions through user research, avoid leading prompts, and explicitly separate observations from hypotheses.

## Release rules
Keep production untouched until authenticated end-to-end tests, cross-tenant negative tests, regression QA for My Life and mobile UI, and approval to promote.
