# Existing iXo memory → My Work knowledge reuse

## Goal
Do not ask the user to re-enter business knowledge already held in their existing iXo account. Preserve strict isolation between My Life, ATOM, other businesses, and external clients.

## Implemented first stage
Data Management has an explicit, read-only **Preview existing iXo memory** action. It uses the existing authenticated `/api/ixo/memory` endpoint, pages through up to 1,000 facts, refuses incomplete pagination, and allows a user-entered text search. It never auto-assigns memories to a company, writes business records, invokes native AI reasoning, or executes actions. This is not an import. The browser preview is transient.

## Next acceptance gates
1. User selects an authenticated business workspace and searches source memories.
2. User explicitly selects each proposed fact and confirms the target business, category, evidence/source and confidence. Avoid bulk unreviewed transfer; don't infer company membership from keyword matching alone.
3. Store only approved facts in company-scoped business memory with source ID, source revision, timestamp, status and import consent. Enforce owner/workspace authorization at server and database layers. Support deduplication, correction, revocation and source updates.
4. Map confirmed imported facts to the 10 departments/30 dimensions using reviewable evidence. Imported facts are not automatically complete answers to every stage (current situation, challenges, goals).
5. Share only the selected business's verified knowledge with Decisions, Goals, Projects, Opportunities, Today and Mirror; retain provenance, avoid invented certainty and fail closed on incomplete evidence.
6. Before any native iXo generative business call, independently verify all conditions in `lib/native-business-isolation.js`, including native memory and tool boundaries and explicit consent. A separate chat alone is insufficient.
7. Test with two companies and personal facts that must never cross boundaries, plus revoked/stale/conflicting memories. Verify real signed-in flows and safe failure behavior.

## Current limitation
Native iXo personal memory is readable through the existing connector, but safe, persistent company-scoped transfer and automatic Business Map population are not yet implemented or verified. Do not describe the preview as completed synchronization.
