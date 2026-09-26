# MY iXo Adaptive Learning Methodology — v1

Date: 2026-09-26
Status: Product/research specification before implementation

## Product thesis
A personal AI should not require a person to know what questions to ask before it can become useful. MY iXo should actively decide what it most needs to learn, ask the smallest useful question, extract evidence-backed knowledge, qualify uncertainty, and improve the native iXo knowledge state.

The native 10-area Personal Map remains authoritative:
Psychology, Health, Relationships, Family, Work, Finances, Development, Rest, Values, Environment.

MY iXo adds a Learning Map used for acquisition strategy. It must never be presented as a native iXo score or native completion model.

## Research principles incorporated
1. Idiographic / experience-sampling principle: understand the individual through repeated observations in daily life, not only broad retrospective self-description. Use current/recent situations to discover within-person patterns.
2. Adaptive-testing principle: choose the next question for information value given what is already known, and stop drilling when additional questions have low marginal value.
3. Psychometric-reference principle: validated/public taxonomies may inform what constructs exist and how questions discriminate, but MY iXo is not a diagnostic test and must not manufacture clinical scores.
4. Autonomy-support principle: questions should preserve choice and minimize burden; avoid interrogation, forced disclosure, or covert diagnosis.
5. Work-context principle: use established work-style/value taxonomies as references for work-related constructs rather than inventing vague labels.
6. Evidence discipline: distinguish direct fact, stated preference, goal, constraint, observed pattern, inference/hypothesis, uncertainty, contradiction, and stale knowledge.

## Learning Map data model
Each knowledge node belongs to one native Personal Map area but has a richer application-level construct.

Node:
- id
- native_area
- construct
- knowledge_type: fact | preference | goal | constraint | pattern | relationship | current_state | history | uncertainty | contradiction
- status: unknown | weak | inferred | user_stated | corroborated | conflicted | stale
- evidence_refs[]
- last_observed_at
- temporal_scope: enduring | current | episodic
- sensitivity: normal | sensitive
- utility_tags[]
- confidence_basis (qualitative evidence state, not fake numeric certainty)
- next_learning_opportunity

No clinical diagnosis, mental-health label, or personality score is inferred unless the user explicitly participates in a valid instrument with appropriate scoring/permissions.

## Construct library v1
Psychology:
- decision style
- uncertainty tolerance
- planning/spontaneity
- motivation drivers
- autonomy/control preference
- persistence/follow-through
- emotional regulation context (non-diagnostic)
- stressors and coping behaviors (non-diagnostic)
- social/solitary processing preference
- self-efficacy / perceived capability
- personality tendencies only as user-described or instrument-supported

Health:
- sleep/recovery
- energy/fatigue patterns
- physical activity
- nutrition routines/preferences
- functional limitations
- health routines
- health priorities
- current constraints
Health information is sensitive and should be asked only when useful and user-appropriate; do not diagnose.

Relationships:
- important people
- support network
- communication preferences
- closeness/contact patterns
- interpersonal obligations
- recurring friction/conflict stated by user
- desired relationship investment

Family:
- household structure
- caregiving/dependents
- family obligations
- family priorities
- routines/traditions
- decision dependencies

Work:
- role/responsibilities
- current projects
- goals/outcomes
- strengths
- preferred work style
- workload/capacity
- boundaries
- collaboration/leadership style
- frustrations/friction
- deadlines/dependencies
- satisfaction/meaning

Finances:
- goals
- obligations
- liquidity constraints
- spending priorities
- risk preference as user-stated
- time horizon
- financial decision rules
Do not infer wealth, creditworthiness, or financial vulnerability from unrelated signals.

Development:
- learning goals
- skills
- curiosity/interests
- desired capabilities
- identity aspirations
- feedback preferences
- current learning projects

Rest:
- recovery activities
- leisure/hobbies
- travel
- downtime pattern
- restorative vs draining activities
- boundaries
- desired balance

Values:
- stated principles
- priorities
- meaning/purpose
- tradeoff preferences
- non-negotiables
- identity commitments
- what the person protects under constraint

Environment:
- home/work context
- location/travel context
- physical-environment preferences
- routines
- communities
- tools/systems
- recurring situational triggers

## Acquisition loop
1. INGEST — native memory/map + current user answer + recent verified context.
2. UPDATE — identify supported node changes and conflicts; never silently overwrite conflicting evidence.
3. GAP — calculate which nodes are unknown/weak/stale/conflicted.
4. VALUE — estimate value of learning each gap.
5. QUESTION — select one question or choose silence.
6. ANSWER — accept natural language; never require survey-like precision unless needed.
7. EXTRACT — propose atomic candidate learnings with evidence.
8. CONFIRM — confirm only consequential/ambiguous/inferred items; do not confirm obvious direct statements redundantly.
9. WRITE BACK — persist through supported native iXo mechanisms and application Learning Map.
10. REFRESH — update native map/memory state after processing.
11. EXPLAIN — show what changed and why the next question was chosen.

## Next-question value model
Do not optimize for filling boxes.

Conceptual score:
LearningValue =
  GapSeverity
  × FutureUsefulness
  × InformationGain
  × CrossDomainYield
  × DecisionRelevance
  × Timeliness
  × Answerability
  - UserBurden
  - SensitivityCost
  - RepetitionPenalty

Use qualitative bands initially rather than fabricated numerical precision.

### GapSeverity
Prefer unknown, conflicted, stale, or consequential weak knowledge over already corroborated knowledge.

### FutureUsefulness
Prefer knowledge likely to improve TODAY/MIRROR/DECIDE/ASK or future proactive assistance.

### InformationGain
Prefer questions that discriminate among plausible explanations rather than invitations to ramble.

### CrossDomainYield
Prefer one natural question that can legitimately inform several constructs.

### Timeliness
Recent active situations can be more informative than abstract autobiography.

### UserBurden
Penalize long, vague, repetitive, emotionally invasive, or cognitively difficult questions.

## Question ladder
Use the least burdensome level that can resolve the gap.

1. Broad discovery — only when the territory is genuinely unknown and one answer has high cross-domain yield.
2. Situational — ask about a recent concrete example.
3. Discriminating — offer plausible distinctions without forcing a false choice.
4. Prioritization/tradeoff — discover what matters when goals conflict.
5. Confirmation — verify an inference or conflict.
6. Longitudinal check — test whether a pattern persists or changed.
7. Silence — ask nothing when information value is too low.

Examples:
Broad: “When you picture a normal weekday, what tends to shape how your day actually goes?”
Situational: “Think about the last day that felt unusually good. What was different?”
Discriminating: “When work runs late, is it usually too much work, getting absorbed in it, outside interruptions, or something else?”
Tradeoff: “When you cannot have both, which matters more right now: finishing more or having a reliable stopping time?”
Confirmation: “You have said control over your evenings matters, but recent examples include late work. Has the priority changed, or is something getting in the way?”
Longitudinal: “Is that still true lately, or has it changed?”

## Question-generation rules
- One primary question at a time.
- Explain why it is being asked when that increases trust.
- Prefer concrete recent examples over global self-labels.
- Never smuggle an inference into a question as fact.
- Avoid double-barreled questions unless intentionally collecting a narrative.
- Do not repeatedly ask about the same construct after sufficient evidence.
- Allow “something else,” “not sure,” “skip,” and correction.
- Avoid diagnostic framing.
- For sensitive domains, require stronger usefulness and lower burden.
- Never ask for data merely because a field is empty.
- A good question should have a defined expected learning target before it is asked.

## Extraction contract
For every answer, extract only supported atomic candidates:
{
  native_area,
  construct,
  knowledge_type,
  statement,
  evidence_quote_or_answer_ref,
  temporal_scope,
  status,
  contradiction_with[],
  writeback_recommendation
}

Direct user statements may be user_stated. Derived patterns remain inferred until supported. Contradictions are preserved, not overwritten.

## Stopping rules
Stop questioning a construct when:
- current evidence is sufficient for likely product use;
- the next question adds little information;
- the user signals fatigue/disinterest;
- sensitivity cost exceeds expected usefulness;
- the topic is not relevant now.

Resume when knowledge becomes stale, a contradiction appears, a new decision makes it relevant, or the user naturally supplies new evidence.

## Interface
Primary Build My iXo experience:
- native 10-area Personal Map
- “What iXo is learning” layer
- one adaptive question
- concise “Why I’m asking”
- after answer: “What I learned” candidate chips/cards
- correction controls
- visible native processing state
- next best question only after writeback/readiness
- progress expressed as useful knowledge growth, not a fake universal percent complete

TODAY/MIRROR/DECIDE should be downstream beneficiaries of LEARN, not substitutes for it.

## Evaluation
Offline/fixture tests:
- question is supported by a real gap
- expected learning targets declared
- no unsupported psychological claim
- no duplicate/redundant question
- cross-domain extraction does not overreach
- conflicts preserved
- sensitive-domain guard works
- silence possible

Human acceptance:
- question feels specific, natural and worth answering
- user can understand why it was asked
- extracted learning accurately reflects answer
- user can correct it
- later reasoning visibly improves from acquired knowledge

Product metrics:
- useful accepted learnings per question
- correction/rejection rate
- repeated-question rate
- cross-domain yield
- downstream reasoning improvement
- user skip/fatigue rate
- stale/conflict resolution rate
Do not optimize raw question count or map-fill percentage.

## Implementation sequence
Phase 1: Learning Map schema + deterministic gap inventory over native memory/map.
Phase 2: question planner with explicit expected-learning targets and qualitative value ranking.
Phase 3: answer extraction + review/confirmation UX.
Phase 4: supported native writeback + readiness/refresh loop.
Phase 5: longitudinal/experience-sampling triggers and stale/conflict handling.
Phase 6: evaluate whether calibrated psychometric modules are useful; keep them optional and clearly distinct from conversational inference.
