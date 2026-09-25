import type {ReasoningResult} from '../intelligence/types';

export type ReasoningMode='today'|'mirror'|'personalized'|'decision';
export class ReasoningSchemaError extends Error{constructor(message:string){super(message);this.name='ReasoningSchemaError'}}

const arrayOfStrings=(v:unknown)=>Array.isArray(v)&&v.every(x=>typeof x==='string');
const requiredString=(v:unknown)=>typeof v==='string'&&v.trim().length>0;
const optionalString=(v:unknown)=>v===undefined||v===null||typeof v==='string';
const array=(v:unknown)=>Array.isArray(v);

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
 const stringArrays=['known_context','goals_affected','constraints','assumptions','unknowns','risks_dependencies','what_would_change','clarifying_questions','evidence_refs'];
 if(!requiredString(result.summary))throw new ReasoningSchemaError('Decision Lab returned an invalid result shape.');
 for(const k of stringArrays)if(!arrayOfStrings(result[k]))throw new ReasoningSchemaError('Decision Lab returned an invalid result shape.');
 if(!array(result.options)||!array(result.tradeoffs))throw new ReasoningSchemaError('Decision Lab returned an invalid result shape.');
 return result;
}
