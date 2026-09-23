export type MemorySource={kind:string;id:string;chat_id?:string|null;question_text?:string|null};
export type MemoryFact={id:string;category:string;value:string;scope:string;status:string;supersedes_id?:string|null;revision:number;source:MemorySource;updated_at:string};
export type MemoryPayload={profile_revision:number;index_status:string;items:MemoryFact[];next_cursor?:string|null};

export type EvidenceKind='memory'|'briefing'|'personal_map'|'native_pending'|'native_structure'|'user_input';
export type EvidenceRef={id:string;kind:EvidenceKind;label:string;detail:string;source?:MemorySource|null;updated_at?:string|null};

export type Explanation={
  observation:string;
  known:string[];
  inferred:string[];
  unknown:string[];
  sources:EvidenceRef[];
};

export type AttentionItem={
  id:string;
  title:string;
  why:string;
  changed?:string|null;
  related?:string|null;
  unknown?:string|null;
  nextStep:string;
  evidence:EvidenceRef[];
  explanation:Explanation;
};

export type MirrorType='CONTRADICTION'|'MISSING INFORMATION'|'NEGLECTED PRIORITY'|'DEPENDENCY'|'STALE ASSUMPTION'|'LOOSE END'|'GOAL CONFLICT';
export type MirrorFinding={
  id:string;
  type:MirrorType;
  observation:string;
  why:string;
  known:string[];
  inferred:string[];
  unknown:string[];
  resolveQuestion:string;
  evidence:EvidenceRef[];
};

export type NativeIntelligenceContext={
  revision:number|null;
  personal_map:unknown;
  pending_facts:unknown;
  hypotheses:unknown;
  variants:unknown;
  checks:unknown;
  verdicts:unknown;
};

export type DecisionInput={
  decision:string;
  desiredOutcome:string;
  options:string[];
  assumptions:string[];
};

export type ReasoningResult={
  answer?:string;
  summary?:string;
  context_used?:string[];
  known_context?:string[];
  goals_affected?:string[];
  constraints?:string[];
  options?:unknown[];
  assumptions?:string[];
  missing_information?:string[];
  unknowns?:string[];
  tradeoffs?:unknown[];
  risks_dependencies?:string[];
  what_would_change?:string[];
  clarifying_questions?:string[];
  why_context_changed_answer?:string|null;
  runtime_tool_activity?:string[];
  [key:string]:unknown;
};
