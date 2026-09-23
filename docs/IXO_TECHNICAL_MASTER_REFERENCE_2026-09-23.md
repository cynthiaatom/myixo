# iXo Technical Integration Master Reference


**Canonical backup — do not delete**  
**Captured:** 2026-09-23  
**Purpose:** Preserve everything currently known about iXo's API, authentication, Personal Map, memory/profile architecture, conversations/runs, onboarding/briefing, and the `myixo` integration so the work can be reconstructed if a chat, deployment, or working copy is lost.


> Security note: This document intentionally contains **no passwords, bearer tokens, refresh tokens, cookies, API keys, or other live secrets**.


---


## 1. Platform identity and API base


- Backend title: **ATQM iXo Backend**
- Backend description in OpenAPI: HTTP/SSE API for an **internal OpenManus-based agent service**.
- Verified OpenAPI version: **1.11.0**
- API base: `https://api.ai.atqm.us/api/v1`
- OpenAPI contract: `https://api.ai.atqm.us/openapi.json`
- Errors are documented as an envelope such as `{"detail": string, "code": string}`.
- Paginated collections use the shape `{items, total, limit, offset}`.
- The API supports ordinary HTTP plus Server-Sent Events (SSE) for live run events.


Current Build My iXo production:
- Site: `https://myixo.vercel.app`
- GitHub: `cynthiaatom/myixo`
- Vercel project: `myixo`
- Vercel project ID: `prj_CoT2q792cWfdV01v7IKlhn91Xgmd`
- Vercel team ID: `team_ZSE5OAYwvzuLRzIe1jx6dVsX`
- Separate existing project `atqm-us` must not be touched.


---


## 2. Authentication and connection model


### Login


Endpoint:


`POST /api/v1/auth/login`


The login body is `application/x-www-form-urlencoded`, not JSON:


```text
username=<email>
password=<password>
```


Response shape:


```json
{
  "access_token": "...",
  "refresh_token": "...",
  "token_type": "bearer"
}
```


### Current myixo security design


The user's browser posts credentials only to the same-origin Vercel function:


```text
Browser
  -> HTTPS -> myixo.vercel.app/api/ixo/login
  -> server-to-server -> api.ai.atqm.us/api/v1/auth/login
```


The password is used for iXo authentication and is not persisted by the app.


Tokens are stored as HttpOnly cookies so browser JavaScript cannot read them.


Access cookie currently:


```text
name: ixo_access
HttpOnly
Secure in production
SameSite=Strict
Path=/
Max-Age=1800
```


Refresh cookie currently:


```text
name: ixo_refresh
HttpOnly
Secure in production
SameSite=Strict
Path=/api/ixo
Max-Age=2592000
```


Current issue: the refresh token is stored, but **automatic access-token refresh is not yet implemented** in the myixo proxy. This should be added.


### Auth endpoints verified in OpenAPI


- `POST /auth/activate-invitation`
- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `GET /auth/me`
- `PATCH /auth/me`
- `POST /auth/stream-ticket`
- `POST /auth/logout`


Refresh request:


```json
{
  "refresh_token": "..."
}
```


Logout supports an optional refresh token so the server can revoke the refresh-token family.


### `/auth/me` / UserRead


Verified fields include:


- `id`
- `email`
- `full_name`
- `role`
- `is_active`
- `max_steps`
- `credits_enabled`
- `balance_micro_credits`
- `balance_credits`
- `plan`
- `available_model_keys`
- `run_duration_estimates`
- `profile_self_update_enabled`
- `max_attachments_per_run`
- `api_keys_enabled`


The current myixo frontend intentionally exposes only a small subset: email, full name, and plan.


---


## 3. Capability discovery


Endpoint:


`GET /api/v1/capabilities`


The verified `FeatureCapabilities` contract includes:


- `conversation`
- `conversation_verdicts`
- `briefing`
- `files`
- `voice_input`
- `profile_memory`
- `personal_map`
- `personal_map_dialogue`
- `feedback`
- `support`
- `model_selection`
- `projects_ui`
- `computer_panel`


This is important: **Personal Map and Personal Map Dialogue are first-class backend capabilities**, not merely frontend conventions.


The top-level capabilities response also includes access, legal, onboarding, support, limits, and a config revision.


---


## 4. Personal Map and profile memory


### Native endpoint


`GET /api/v1/conversation/map`


OpenAPI intentionally leaves this response schema loose, so actual live response inspection has been necessary.


### Live response observed from the connected account


Privacy-safe diagnostics showed the following top-level fields:


```text
pending_facts
revision
name
domains
facts
hypotheses
variants
checks
verdicts
about_me
personal_map
```


At the time of the diagnostic, the connected account contained:


- **25 domain records**
- **175 fact records**


Observed domain rows contain at least:


```json
{
  "id": "...",
  "label": "...",
  "covered": true
}
```


Observed domain IDs included:


```text
sleep
nutrition
body
substances
psyche
relations
family
work
money
meaning
rest
environment
```


There were 25 domain rows total; the list above is only the observed initial sample.


### Fact structure observed live


Fact rows have fields:


```json
{
  "id": "...",
  "domain": "...",
  "text": "...",
  "kind": "...",
  "revision": 1,
  "edited": false,
  "source": "...",
  "updated_at": "..."
}
```


The diagnostics deliberately log field names/counts, not the user's fact text.


### Fact editing and deletion


Edit:


`PATCH /api/v1/conversation/facts/{fact_id}`


Body:


```json
{
  "revision": 1,
  "text": "updated fact"
}
```


Delete:


`DELETE /api/v1/conversation/facts/{fact_id}?revision=<revision>`


The revision parameter shows the profile store is version-aware and uses optimistic concurrency concepts.


### Fact/source provenance


Endpoint:


`GET /api/v1/conversation/sources/{kind}/{source_id}`


Supported source kinds include:


- `message`
- `answer`
- `fact`
- `profile_fact`


This confirms that profile knowledge can retain source/provenance relationships.


---


## 5. The 10-area Personal Map


The known Personal Map categories are:


| ID | Label |
|---|---|
| psychology | Psychology |
| health | Health |
| relationships | Relationships |
| family | Family |
| work | Work |
| finance | Finances |
| development | Development |
| rest | Rest |
| values | Values |
| environment | Environment |


A previously captured structured iXo Personal Map tool result had this form:


```json
{
  "version": 1,
  "generated_at": "...",
  "profile_revision": 103,
  "index_status": "ready",
  "limited": false,
  "percent": 27,
  "categories": [
    {
      "id": "health",
      "percent": 33,
      "aspects": ["situation"]
    }
  ],
  "run_id": "..."
}
```


Known aspect IDs:


- `situation` = Current situation
- `priorities` = What matters to you
- `goals` = Goals & desired changes


This gives the conceptual model used in Build My iXo:


**10 categories × 3 dimensions = 30 dimensions**


### Important compatibility caution


The current native iXo UI does not always expose the Personal Map as a literal 30-point completion score. Current UI semantics have also been observed as area-level coverage: filled sectors/checkmarks mean iXo has saved context in that area and **do not rate the user's life or imply an area is complete**.


Therefore two representations have existed/been observed:


1. Structured 10×3 aspects (`situation`, `priorities`, `goals`).
2. Current category/domain-level saved-context coverage (`covered`).


Do not assume these are interchangeable without checking the backend response version/shape.


### Historical structured snapshot previously captured


A genuine historical structured snapshot showed:


```text
Psychology       0%
Health          33%  situation
Relationships   33%  situation
Family          33%  situation
Work            33%  situation
Finance          0%
Development      0%
Rest            33%  situation
Values          33%  priorities
Environment     67%  situation + priorities
```


That was 8/30 = 27% at that time. It is historical evidence of the schema, **not the current Personal Map state**.


### Current myixo fallback translation


When a structured Personal Map is unavailable, the myixo frontend currently maps lower-level iXo memory domains as follows:


| iXo domain | Build My iXo area |
|---|---|
| psyche | Psychology |
| sleep, nutrition, body, substances, health | Health |
| relations | Relationships |
| family | Family |
| work | Work |
| money | Finances |
| development | Development |
| rest | Rest |
| meaning | Values |
| environment | Environment |


This mapping is **our integration logic**, not a documented iXo contract.


---


## 6. Continuous conversation architecture


The backend has a conversation system separate from simply creating independent chats/runs.


### Open current conversation


`POST /api/v1/conversation/open`


Optional query parameter:


- `chat_id`


Optional header:


- `X-UI-Locale`


The OpenAPI response schema is loose, but live integration behavior has exposed/required identifiers such as:


- `chat_id`
- `run_id`
- `request_id`


### Add continuous conversation input


`POST /api/v1/runs/{run_id}/conversation-input`


Body:


```json
{
  "request_id": "uuid",
  "text": "user response"
}
```


Constraints:


- `request_id`: UUID
- `text`: 1–4000 chars


### Why Question 1 originally failed


The initial Build My iXo implementation created a fresh chat + run for every questionnaire answer. iXo repeatedly returned **409 Conflict** because another continuous-dialogue run was already active.


A key discovery:


`GET /api/v1/chats/active`


returns **chat IDs**, not run IDs:


```json
{
  "chat_ids": ["uuid"]
}
```


An early recovery attempt incorrectly treated these as run IDs. That was fixed.


The newer flow is:


```text
POST /conversation/open
  -> find active chat
  -> inspect chat history
  -> locate active run + request_id
  -> POST /runs/{run_id}/conversation-input
```


Subsequent production testing showed the questionnaire answer endpoint returning HTTP 200, confirming the 409 loop was overcome for the tested submission.


---


## 7. Chats


Verified chat endpoints:


- `POST /chats` — create chat
- `GET /chats` — list chats
- `GET /chats/unread-count`
- `POST /chats/{chat_id}/read`
- `GET /chats/active`
- `GET /chats/search`
- `GET /chats/{chat_id}/context`
- `POST /chats/{chat_id}/context/compact`
- `GET /chats/{chat_id}`
- `PATCH /chats/{chat_id}`
- `DELETE /chats/{chat_id}`
- `GET /chats/{chat_id}/messages`
- `POST /chats/{chat_id}/runs`
- `GET /chats/{chat_id}/runs`
- `GET /chats/{chat_id}/history`


Create-chat body:


```json
{
  "title": "Build My iXo",
  "project_id": null
}
```


### Messages


Verified `MessageRead` fields include:


- `id`
- `chat_id`
- `run_id`
- `seq`
- `role`
- `content`
- `conversation_payload`
- `tool_calls`
- `name`
- `tool_call_id`
- `base64_image`
- `created_at`


`conversation_payload` and `tool_calls` are especially relevant because structured Personal Map/tool data may be persisted there.


`GET /chats/{chat_id}/messages` supports:


- `limit` up to 500
- `offset`
- `visible_only`


Using `visible_only=false` allows inspection of tool rows that may not be rendered as ordinary chat messages.


---


## 8. Runs / agent execution


Create run:


`POST /api/v1/chats/{chat_id}/runs`


Verified body fields:


```json
{
  "prompt": "...",
  "model_config_id": null,
  "atomus_model_id": null,
  "max_steps": 20,
  "adaptive_step_limit": null,
  "attachment_ids": [],
  "locale": "en"
}
```


`max_steps` range: 1–100; default 20.


Maximum attachments per run in this contract: 50.


Verified RunRead fields include:


- `id`
- `chat_id`
- `user_id`
- `model_config_id`
- `status`
- `prompt`
- `max_steps`
- `result`
- `error`
- `input_tokens`
- `completion_tokens`
- `created_at`
- `updated_at`
- `steps`
- `cost_micro_credits`
- `cost_credits`
- `step_limit_base`
- `step_limit_extensions`


This confirms built-in token, cost, and step accounting.


Run control endpoints:


- `GET /runs/{run_id}`
- `POST /runs/{run_id}/cancel`
- `POST /runs/{run_id}/input`
- `POST /runs/{run_id}/conversation-input`
- `GET /runs/{run_id}/briefing-input`
- `GET /runs/{run_id}/events`


Run cancellation can return `409 run_not_cancelable` if the run has already reached a terminal state.


Generic `/runs/{run_id}/input` is for human-in-the-loop requests such as `credential.request` / `ask_human`. The backend documentation explicitly says credential values should remain transient and are not to be logged or persisted.


---


## 9. SSE / live run events


Endpoint:


`GET /api/v1/runs/{run_id}/events`


This is an SSE endpoint. It replays saved events and then streams live events.


Because browser `EventSource` cannot send an Authorization header, iXo provides:


`POST /api/v1/auth/stream-ticket`


Run stream request:


```json
{
  "scope": "sse:<run_id>"
}
```


Response:


```json
{
  "ticket": "...",
  "expires_in": 123
}
```


Browser stream pattern:


`/runs/{run_id}/events?ticket=<short-lived-ticket>`


The run SSE ticket is documented as short-lived and single-use.


Artifacts can use a ticket with:


```json
{
  "scope": "artifacts"
}
```


A future Build My iXo implementation should use SSE for accurate progress states such as:


```text
Understanding...
Saving memory...
Updating Personal Map...
Done
```


instead of relying only on polling or immediate refresh.


---


## 10. Run history and performance considerations


Endpoint:


`GET /chats/{chat_id}/history`


Parameters include:


- `limit`
- `offset`
- `before_run_id`
- `include_details`


The API documentation explains this endpoint exists to avoid opening an SSE replay for every old run.


Production measurements documented by the backend include approximately:


- median run: ~9 events / ~8.8 KB
- 99th percentile: ~541 KB
- largest observed individual run: ~3.4 MB
- five latest runs in one large chat: ~5.3 MB


Therefore indiscriminately scanning large run histories is not a good permanent design.


The current myixo Personal Map route has temporarily searched run history/tool messages while reverse-engineering structured map storage. This should be replaced with a direct stable Personal Map contract when the live `personal_map` field is fully understood.


---


## 11. Native onboarding and continuous briefing


This is likely the cleanest long-term API for Build My iXo.


### Onboarding endpoints


- `GET /onboarding`
- `POST /onboarding/start`
- `POST /onboarding/skip`


Onboarding state values:


- `not_started`
- `in_progress`
- `completed`


The status response includes:


- `state`
- `chat_allowed`
- `session`


### Continuous briefing endpoints


- `POST /briefing/sessions`
- `GET /briefing/sessions/current`
- `GET /briefing/sessions/{session_id}`
- `GET /briefing/sessions/{session_id}/questions/current`
- `POST /briefing/sessions/{session_id}/retry-generation`
- `POST /briefing/sessions/{session_id}/pause`
- `POST /briefing/questions/{question_id}/answers`
- `PATCH /briefing/answers/{answer_id}`


Briefing session create supports an optional `topic`.


Session kinds:


- `onboarding`
- `continuous`


Session states:


- `in_progress`
- `completed`
- `paused`


### Native question format


`BriefingQuestionRead` includes:


- `id`
- `revision`
- `state`
- `type`
- `text`
- `options`
- `allow_custom`
- `allow_skip`
- `reason`
- `hints`
- `source_refs`


Question options are `{id, label}`.


This is a strong fit for an adaptive questionnaire and is preferable to permanently hard-coding a fixed set of Build My iXo questions.


### Native answer submission


`POST /briefing/questions/{question_id}/answers`


Body supports:


```json
{
  "question_revision": 1,
  "expected_session_revision": 1,
  "option_ids": [],
  "custom_text": "my answer",
  "skipped": false,
  "input_method": "text",
  "transcript_confirmed": false
}
```


Allowed input methods:


- `choice`
- `text`
- `voice`
- `skip`


Custom text maximum: 4000 characters.


The result includes:


- `answer_id`
- `profile_revision`
- `index_status`
- `session`


This is a major architectural clue: profile indexing is explicitly asynchronous. A successful answer does not guarantee the Personal Map will change immediately.


Build My iXo currently refreshes too quickly after an accepted answer. A production design should wait for the relevant profile revision/index status before expecting the Personal Map to reflect the answer.


### Answer updates


`PATCH /briefing/answers/{answer_id}` supports revision-aware updates using `expected_revision` and can alter option IDs, custom text, skipped state, input method, and transcript confirmation.


---


## 12. Revisioned profile model


Observed revision concepts include:


- conversation map revision
- fact revision
- profile revision
- session revision
- question revision
- answer revision
- config revision


The backend is therefore not just storing an unversioned memory blob. It is designed around versioned profile state and optimistic concurrency.


---


## 13. Other conversation intelligence APIs


Verified endpoints include:


- `GET /conversation/verdicts/{verdict_id}`
- `POST /conversation/verdicts/{verdict_id}/choice`
- `PATCH /conversation/verdicts/{verdict_id}/checks/{direction_id}`


Choice actions include:


- `explore`
- `check`
- `reject`


Diagnostics:


`GET /conversation/diagnostics`


Optional parameters include `run_id` and `owner_id`.


Prompt-management endpoints:


- `GET /conversation/prompts`
- `PUT /conversation/prompts/{stage}/selection`
- `DELETE /conversation/prompts/{stage}/selection`


Known prompt stages:


- `dialogue`
- `verdict`
- `facts`


---


## 14. Projects, files, connectors, triggers


Projects:


- `POST /projects`
- `GET /projects`
- `GET /projects/{project_id}`
- `PATCH /projects/{project_id}`
- `DELETE /projects/{project_id}`
- `GET /projects/{project_id}/chats`


Project files:


- `GET /projects/{project_id}/files`
- `POST /projects/{project_id}/files`
- `DELETE /projects/{project_id}/files/{artifact_id}`


Project skills/connectors:


- `GET /projects/{project_id}/skills`
- `PUT /projects/{project_id}/skills`
- `GET /projects/{project_id}/connectors`
- `PUT /projects/{project_id}/connectors`


Project triggers:


- `GET /projects/{project_id}/triggers`
- `POST /projects/{project_id}/triggers`
- `PATCH /projects/{project_id}/triggers/activation`
- `PATCH /projects/{project_id}/triggers/{slug}`
- `DELETE /projects/{project_id}/triggers/{slug}`
- `POST /projects/{project_id}/triggers/{slug}/fire`


This shows iXo has a broader agent/workspace architecture underneath the consumer interface.


### Files/uploads/artifacts


Chat uploads:


- `POST /chats/{chat_id}/uploads`
- `POST /chats/{chat_id}/uploads/direct`
- `POST /chats/{chat_id}/uploads/direct/complete`
- `POST /chats/{chat_id}/uploads/direct/abort`


Artifacts/files:


- `GET /runs/{run_id}/artifacts`
- `GET /chats/{chat_id}/artifacts`
- `GET /runs/{run_id}/artifacts.zip`
- `GET /chats/{chat_id}/artifacts.zip`
- `GET /files`


Chat export:


`GET /exports/chats.zip`


The export endpoint accepts a date/time range.


---


## 15. Feedback, support, and API-key capability


Run feedback:


`PUT /runs/{run_id}/feedback`


Support:


- `POST /support/requests`
- `GET /support/requests`
- `GET /support/requests/{request_id}`


The user object exposes `api_keys_enabled`; the OpenAPI also includes create/list/rotate/revoke API-key capabilities. Build My iXo **does not use API keys**. User login + delegated session is the current integration model.


---


## 16. Current myixo code architecture


Serverless routes:


```text
api/ixo/login.js
api/ixo/session.js
api/ixo/map.js
api/ixo/answer.js
api/ixo/logout.js
```


Frontend/core:


```text
src/App.tsx
src/ixo.ts
src/Map.tsx
```


### Current answer route


Approximate behavior:


```text
POST /conversation/open
  -> inspect chat_id/run_id/request_id
  -> inspect /chats/active if needed
  -> inspect active chat history if needed
  -> if continuous run is waiting, POST /runs/{run_id}/conversation-input
  -> otherwise use/create a chat and POST /chats/{chat_id}/runs
```


Question payload currently wraps the user's answer as Personal Map onboarding context and asks iXo to save it as personal context when appropriate without inventing details.


### Current map route


The temporary reverse-engineering route currently:


1. Calls `GET /conversation/map`.
2. Looks for structured Personal Map data directly.
3. Can recursively parse JSON embedded inside tool-result strings.
4. Can inspect `POST /conversation/open` output.
5. Can inspect active chats.
6. Can search chats for `personal map`, `saved context`, and `map`.
7. Can inspect run history.
8. Can inspect messages with `visible_only=false` to find hidden tool rows.
9. Falls back to raw profile/domain mapping.


This is intentionally broad while the real `personal_map` shape is being decoded. It is not the desired final architecture.


### Privacy-safe diagnostics


Temporary production diagnostics currently record only structural metadata such as:


- top-level keys
- domain IDs
- object keys
- collection counts
- fact-domain labels
- Personal Map structural keys


They intentionally do not log passwords, tokens, fact text, or questionnaire answer text.


These diagnostics should be removed once the final Personal Map parser is stable.


---


## 17. Known integration problems / technical debt


| Item | Status |
|---|---|
| Email/password login | Working |
| `/auth/me` | Working |
| HttpOnly session cookies | Working |
| Question 1 409 loop | Fixed for tested flow; later request returned HTTP 200 |
| Continuous dialogue input | Implemented partially |
| Raw Personal Map API access | Working |
| Correct native Personal Map rendering | Still being finalized |
| Automatic access-token refresh | Not implemented |
| Wait for profile indexing after answer | Not implemented |
| Native adaptive briefing API | Not yet used by Build My iXo |
| SSE progress updates | Not yet used |
| Large history scanning | Temporary workaround; should be removed |
| Temporary diagnostic metadata logging | Still present; remove after parser stabilizes |


---


## 18. Recommended target architecture


Knowing the API now, the clean Build My iXo architecture should be:


```text
1. POST /auth/login
2. GET /capabilities
3. GET /conversation/map
   -> render the backend's native personal_map representation directly
4. GET /briefing/sessions/current
   or POST /briefing/sessions
5. GET /briefing/sessions/{id}/questions/current
6. Render the iXo-native adaptive question
7. POST /briefing/questions/{question_id}/answers
8. Capture answer_id + profile_revision + index_status
9. Wait/poll until profile/index processing reaches the required revision/readiness
10. GET /conversation/map again
11. Animate only actual changes in Personal Map
12. Continue until native session state says completed/paused
```


This avoids creating a competing questionnaire engine and makes Build My iXo a visual accelerator/interface for iXo's own profile-building system.


SSE can later be used for live progress where appropriate.


---


## 19. Product/UX principle to preserve


The Personal Map should be framed as **context coverage**, never as a score of the person's life.


Native iXo wording/behavior supports the idea that a filled area means there is saved context. It does **not** mean the area is good, complete, healthy, or successful.


Build My iXo should preserve that distinction.


---


## 20. Important caution about external IXO information


Do not assume public documentation for unrelated products/platforms named IXO describes ATOM's iXo backend.


Technical claims about ATOM iXo should be grounded in:


1. the live `api.ai.atqm.us` OpenAPI contract,
2. live responses from the authenticated iXo backend,
3. ATOM's own frontend/backend code or official internal documentation,
4. captured tool/run events from the real iXo system.


---


## 21. Key source locations for reconstruction


### Live API


- `https://api.ai.atqm.us/api/v1`
- `https://api.ai.atqm.us/openapi.json`


### Production UI


- `https://myixo.vercel.app`


### Source repository


- GitHub repository: `cynthiaatom/myixo`


### Key code paths


- `api/ixo/login.js`
- `api/ixo/session.js`
- `api/ixo/map.js`
- `api/ixo/answer.js`
- `api/ixo/logout.js`
- `src/App.tsx`
- `src/ixo.ts`
- `src/Map.tsx`


### Current implementation notes as of 2026-09-23


- `api/ixo/map.js` includes privacy-safe structural diagnostics while the live `personal_map` object is being decoded.
- `src/ixo.ts` recognizes both older structured aspect-level maps and newer category-level coverage signals.
- `api/ixo/answer.js` prefers continuous conversation input when a run is waiting rather than blindly creating a competing run.


---


## 22. Backup rule


This reference should exist in at least three durable locations:


1. **Google Drive for `cynthia@atomventure.holdings`** — canonical human-readable copy.
2. **GitHub repository `cynthiaatom/myixo`** — versioned engineering copy next to the code.
3. **ChatGPT Library** — independent backup for retrieval across conversations.


When major iXo API discoveries are made, update all three copies rather than relying on chat history alone.