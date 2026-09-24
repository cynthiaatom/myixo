# MY iXo — Personal Intelligence OS Architecture

Date: 2026-09-23

This document keeps four categories deliberately separate:

1. **VERIFIED NATIVE iXo CAPABILITY**
2. **APPLICATION-LEVEL FEATURE WE BUILT**
3. **INFERENCE / HEURISTIC**
4. **UNKNOWN / NEEDS VERIFICATION**

The product must never blur those categories.

## Foundation verification

### Verified against the connected production account

Vercel runtime logs on 2026-09-23 showed successful authenticated calls from the production app to:

- `GET /api/ixo/session` → 200
- `GET /api/ixo/map` → 200
- `GET /api/ixo/memory` → 200

Those calls demonstrate that the production session, native Personal Map route, and durable profile-memory route were accessible through the real connected iXo account.

The same logs showed:

- `GET /api/ixo/briefing` → 404

The upstream native briefing API uses 404 when no current continuous briefing session exists. The proxy previously surfaced that as an error. The Personal Intelligence OS branch now treats that condition as the honest empty state `{session:null}` and creates a native session only when the user begins/continues briefing.

### Implemented but not destructively re-tested against the real account from engineering tooling

The following are implemented against the documented native API contract, but were not deliberately forced against the real user's data because doing so would mutate/delete real personal context or require waiting for credential expiry:

- profile-memory edit
- profile-memory delete
- provenance source lookup after a real edit
- automatic access-token refresh after an intentionally expired token
- answer → profile_revision/index_status → map-refresh flow on a fresh native briefing answer
- SSE on a real reasoning run

These should be verified through normal product use, not by destructive test mutations.

## VERIFIED NATIVE iXo CAPABILITY

### Personal Map

Native source:

`GET /api/v1/conversation/map`

Production app reads `personal_map` directly and does not crawl old chats/history to reconstruct the map.

The optional application route `/api/ixo/map?detail=intelligence` exposes only selected native structures already present in the same response:

- `personal_map`
- `pending_facts`
- `hypotheses`
- `variants`
- `checks`
- `verdicts`
- `revision`

It does not return the large raw fact corpus.

### Durable profile memory

Native source:

`GET /api/v1/profile/memory`

Verified fields include:

- profile_revision
- index_status
- id
- category
- value
- scope
- status
- supersedes_id
- revision
- source
- updated_at

Native edit:

`PATCH /api/v1/profile/memory/{fact_id}`

with `expected_revision` and `value`.

Native delete:

`DELETE /api/v1/profile/memory/{fact_id}`

Native provenance:

`GET /api/v1/conversation/sources/{kind}/{source_id}`

### Adaptive briefing

Native endpoints:

- `GET /api/v1/briefing/sessions/current`
- `POST /api/v1/briefing/sessions`
- `POST /api/v1/briefing/questions/{question_id}/answers`

Native answer result exposes:

- answer_id
- profile_revision
- index_status
- session

### Asynchronous agent runs

Native run flow:

- create chat
- create run
- read run status/result
- receive SSE events using a short-lived stream ticket

The application uses this for grounded personalized reasoning and Decision Lab.

### Project triggers / proactive automation

Verified trigger API supports:

- cron, run-at, and webhook trigger definitions
- prompt_template
- model_key
- max_steps
- `allow_write_tools` (default false)
- monthly_credit_cap
- max_fires_per_day
- enabled (default false)
- webhook secret/filter
- fire history including run/chat IDs, status, error code, and cost

No production trigger has been created by Build My iXo yet.

## APPLICATION-LEVEL FEATURE WE BUILT

### Product shell

Connected navigation:

- ME
- MEMORY
- TODAY
- MIRROR
- DECIDE
- ASK MY iXo
- TIMELINE

The black/gold/cream visual system remains shared across all views.

### TODAY / Mission Control

TODAY is a small attention model over real iXo context.

It currently surfaces only evidence-backed conditions such as:

- durable memories that native iXo marks `needs_clarification`
- older confirmed memories that may deserve reconfirmation
- the current native adaptive-briefing question

It is intentionally allowed to return no items.

Every attention item carries an explanation object with:

- observation
- what iXo actually knows
- application-level inference
- unknowns
- evidence references

### iXo MIRROR

Current evidence-backed finding types implemented:

- MISSING INFORMATION
- STALE ASSUMPTION
- LOOSE END

Sources are:

- durable profile memory
- explicit native `pending_facts` text when present

The application does not currently manufacture:

- contradiction
- neglected priority
- dependency
- goal conflict

Those categories remain available in the type system for later use only when evidence semantics are sufficient.

### Explain My iXo

Reusable explanation panel separates:

- CONCLUSION / OBSERVATION
- WHAT iXo KNOWS
- WHAT iXo INFERRED
- WHAT iXo DOESN'T KNOW
- SOURCES
- CORRECT MY iXo

### Decision Lab

Decision Lab creates a temporary native iXo reasoning run.

Before starting the run, the server selects a small subset of durable memories with lexical relevance to the user's decision, desired outcome, options, and assumptions.

The prompt explicitly separates:

- verified stored memory
- user input
- assumptions
- unknowns

The requested output is structured around:

- decision framing
- known personal context
- goals affected
- constraints
- options
- assumptions
- unknowns
- tradeoffs
- risks/dependencies
- what would change the analysis
- minimum clarifying questions

The prompt explicitly tells iXo not to choose for the user.

### ASK MY iXo

Personalized answers run through native iXo using only the selected verified durable-memory context supplied by the application.

The response contract includes:

- answer
- context_used
- assumptions
- missing_information
- why_context_changed_answer

The UI only shows stored memories whose IDs the reasoning result identifies as materially used.

### Context-free ASK AI comparison

**Not implemented as a generated answer yet.**

Reason: the current native run API does not expose a verified "profile memory off" or "personal context off" execution flag.

Using the user's normal iXo agent and merely prompting it to ignore memory would not prove that the answer was context-free.

The UI therefore explicitly holds this side back rather than faking a generic comparison.

### iXo Noticed Something — safe proof of concept

The application stores the last profile revision/timestamp the user has seen locally.

On a later visit, if native `profile_revision` increased, TODAY can show:

"iXo noticed something."

It then lists only actual durable memories updated since the previous seen point.

This is **on-return change detection**, not background monitoring, push notification, or scheduled automation.

No production trigger or write-capable automation is created.

### Personal Intelligence Timeline

Timeline is built only from real durable-memory timestamps and revision relationships.

Current event labels:

- Memory learned
- Memory corrected (when `supersedes_id` exists)
- Memory needs clarification

It is not chat history and does not invent historical events.

## INFERENCE / HEURISTIC

The following are application-level heuristics, not native iXo truth:

- TODAY considers a confirmed memory older than 180 days a candidate for reconfirmation.
- MIRROR considers a confirmed memory older than 365 days a possible stale assumption.
- Relevance selection for Decision Lab / ASK MY iXo uses lexical overlap between the user query and memory category/value.
- If no stored memory has lexical relevance, the reasoning prompt explicitly says not to force personalization.

These thresholds and relevance rules should remain inspectable and replaceable.

## UNKNOWN / NEEDS VERIFICATION

### Native hypotheses / variants / checks / verdicts

The fields are verified to exist in `/conversation/map`, and native verdict/check endpoints are documented.

Their exact real-account payload semantics have not yet been inspected in this branch.

Therefore Mirror and Decision Lab do not currently force them into application semantics.

### Generic context-free model execution

No verified native flag currently proves a run cannot access profile memory.

Needed before the ASK AI side can honestly generate a generic comparator:

- a memory-disabled run option, or
- a separate context-free inference provider/environment whose isolation can be verified.

### Truly proactive NOTICE

Native project triggers are verified, but a safe production proof still requires:

- a specific project context
- confirmation that triggers are enabled for the user's plan/account
- a strict read-only prompt
- write tools disabled
- low frequency / low daily fire cap
- a small monthly credit cap
- a relevance gate that outputs nothing when nothing meaningful changed

Until then, the product uses on-return profile revision detection and does not pretend background monitoring exists.

## Engineering constraints

- No refresh token is exposed to frontend JavaScript.
- No personal-memory content is written to server logs by application diagnostics.
- Native map history crawling remains removed.
- There are currently 12 serverless API functions, the Vercel Hobby deployment limit for this project. New server endpoints must be consolidated into existing routes unless the hosting plan changes.
- Temporary reasoning chats are application-created and are cleaned up after completed reasoning where possible.
- Production data mutation is not used merely for engineering verification.

## Demonstration path

ME
→ native Personal Map and adaptive briefing

MEMORY
→ exact durable memories + provenance + correction

TODAY
→ small evidence-backed attention list, or honest silence

MIRROR
→ observable missing/stale/loose context, with explanation

WHY?
→ known / inferred / unknown / sources

DECIDE
→ structured reasoning grounded in selected verified memory

ASK MY iXo
→ personalized answer + exact memory subset that changed the answer

NOTICE
→ real profile revision change detected on return

TIMELINE
→ actual evolution of durable memory

The product progression remains:

CHAT
→ KNOW ME
→ UNDERSTAND ME
→ REASON WITH ME
→ NOTICE FOR ME
→ ACT WITH ME


## Real-account acceptance debugging pass — September 23, 2026

The first connected-account acceptance test established that native Personal Map and profile memory were working, while the application intelligence layer was not yet end-to-end trustworthy.

Root causes found in code:
- TODAY and MIRROR were deterministic local derivations and did not execute a reasoning run.
- ASK and DECIDE created native runs, but the context selector was narrow lexical matching and execution conflicts were not represented as distinct product states.
- A completed run could have useful assistant output in chat messages even when `run.result` was empty.
- Malformed structured output could previously degrade into generic text and then look like a valid empty result.
- Memory Inspector markup had drifted from its CSS class names, causing labels and values to visually run together.

Acceptance branch changes:
- `/api/ixo/reason` is the shared bounded reasoning entry point for TODAY, MIRROR, ASK and DECIDE.
- The server loads profile memory privately, returns privacy-safe counts/revisions, and sends only a bounded selected subset into the reasoning prompt.
- ASK/DECIDE require lexical relevance for durable-memory personalization. Recency/provenance only rank facts after a lexical match; they do not make unrelated facts relevant.
- TODAY/MIRROR receive bounded cross-category coverage because they have no direct query, with unresolved/recent context prioritized.
- Transient 409 run conflicts are retried by waiting only. The app does not cancel, hijack conversation-input, or touch native briefing/onboarding runs.
- Execution failure, insufficient context, successful zero findings, and malformed output are separate UI states.
- Evidence drawers show only stored memories whose IDs the structured result explicitly cites.
- Completed-run output can be recovered from the matching assistant message if the native run result field is empty.
- Memory Inspector spacing/readability was corrected without changing stored values.

Still requires real-account validation before production acceptance:
- Confirm native run behavior under an actual account-level active-run conflict.
- Confirm TODAY and MIRROR return structured JSON under the real model/runtime.
- Re-run the eFoil Decision Lab case.
- Submit a personalized ASK question with a known relevant memory and verify the returned evidence IDs.
- Confirm no native briefing/onboarding state is changed by these read-only reasoning runs.

INZO naming is intentionally not part of this acceptance branch.
