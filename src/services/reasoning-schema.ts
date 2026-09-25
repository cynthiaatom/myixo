import type {ReasoningResult} from '../intelligence/types';

export type ReasoningMode='today'|'mirror'|'personalized'|'decision';
export class ReasoningSchemaError extends Error{code='result_schema_invalid';constructor(message:string){super(message);this.name='ReasoningSchemaError'}}

const array=(v:unknown)=>Array.isArray(v);
const arrayOfStrings=(v:unknown)=>Array.isArray(v)&&v.every(x=>typeof x==='string');
const requiredString=(v:unknown)=>typeof v==='string'&&v.trim().length>0;
const optionalString=(v:unknown)=>v===undefined||v===null||typeof v==='string';
const optionalStringArray=(v:unknown)=>v===undefined||arrayOfStrings(v);
const optionalArray=(v:unknown)=>v===undefined||array(v);

export function validateReasoningResult(mode:ReasoningMode,result:ReasoningResult):ReasoningResult{
 if(mode==='today'){
  if(!array(result.items))throw new ReasoningSchemaError('TODAY returned an invalid result shape.');
  return result;
 }
 if(mode==='mirror'){
  if(!array(result.findings))throw new ReasoningSchemaError('MIRROR returned an invalid result shape.');
  return result;
 }
 if(mode==='personalized'){
  if(!requiredString(result.answer)&&!requiredString(result.summary))throw new ReasoningSchemaError('ASK returned an invalid result shape.');
  for(const k of ['context_used','assumptions','missing_information','evidence_refs'])if(!arrayOfStrings(result[k]))throw new ReasoningSchemaError('ASK returned an invalid result shape.');
  if(!optionalString(result.why_context_changed_answer))throw new ReasoningSchemaError('ASK returned an invalid result shape.');
  return result;
 }
 // DECIDE core: a meaningful summary plus at least one structured decision-analysis signal.
 // Enrichment sections are optional, but when present their types remain strict.
 if(!requiredString(result.summary))throw new ReasoningSchemaError('Decision Lab returned an invalid result shape.');
 const stringArrays=['known_context','goals_affected','constraints','assumptions','unknowns','risks_dependencies','what_would_change','clarifying_questions','evidence_refs'];
 for(const k of stringArrays)if(!optionalStringArray(result[k]))throw new ReasoningSchemaError('Decision Lab returned an invalid result shape.');
 for(const k of ['options','tradeoffs'])if(!optionalArray(result[k]))throw new ReasoningSchemaError('Decision Lab returned an invalid result shape.');
 const signalKeys=['known_context','goals_affected','constraints','options','assumptions','unknowns','tradeoffs','risks_dependencies','what_would_change','clarifying_questions'];
 if(!signalKeys.some(k=>Array.isArray(result[k])&&result[k].length>0))throw new ReasoningSchemaError('Decision Lab returned an invalid result shape.');
 return result;
}
