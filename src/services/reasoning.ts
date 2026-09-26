import type {DecisionInput,MemoryFact,ReasoningResult} from '../intelligence/types';
import {normalizeReasoningResult} from './result-normalizer';
import {validateReasoningResult} from './reasoning-schema';
import type {ReasoningMode} from './reasoning-schema';
import {buildFailureTelemetry} from './reasoning-observability';

const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));
export type FailureCode='run_failed'|'result_missing'|'result_representation_invalid'|'result_schema_invalid'|'render_failed';
export type ReasonSource='today'|'mirror'|'ask'|'decide'|'why'|'evidence'|'think_through';
export type ReasoningJob={run_id:string;chat_id:string;evidence:MemoryFact[];status:string;reason_source?:ReasonSource;context_status?:'ready'|'insufficient_context';diagnostics?:{memory_count:number;selected_count:number;category_counts:Record<string,number>;profile_revision:number;index_status:string}};

function failure(code:FailureCode,message:string){const e:any=new Error(message);e.code=code;return e}
function typeCategory(v:unknown){return v===null?'null':Array.isArray(v)?'array':typeof v}
function classifyFailure(e:any){if(['run_failed','result_missing','result_representation_invalid','result_schema_invalid','render_failed'].includes(String(e?.code)))return e;return failure('render_failed',e?.message||'Could not process iXo reasoning')}

export async function reportReasoningFailure(job:ReasoningJob,mode:ReasoningMode,source:ReasonSource,err:unknown,meta:{terminal_status?:string;result_present?:boolean;result_type?:string;duration_ms?:number}={}){
 const e=classifyFailure(err as any);(e as any).observed=true;
 const payload=buildFailureTelemetry(job,mode,source,e,meta);
 try{await fetch('/api/ixo/run-status',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload),keepalive:true})}catch{}
 return e;
}
export async function reportUnobservedFailure(job:ReasoningJob|null,mode:ReasoningMode,source:ReasonSource,err:unknown){
 const e=classifyFailure(err as any);if(job&&!(e as any).observed)await reportReasoningFailure(job,mode,source,e);return e;
}

export async function startReasoning(mode:ReasoningMode,input:{question?:string;decision?:string;desired_outcome?:string;options?:string[];assumptions?:string[]},reasonSource?:ReasonSource):Promise<ReasoningJob>{
  const source=reasonSource||mode as ReasonSource;
  const r=await fetch('/api/ixo/reason',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({mode,reason_source:source,...input})});
  const d=await r.json().catch(()=>({}));
  if(!r.ok){const e:any=new Error(d.error||'Could not start iXo reasoning');e.code=d.code||'run_failed';throw e}
  return {...d,reason_source:source} as ReasoningJob;
}

export function openRunEvents(runId:string,onStatus:(label:string)=>void){
  let es:EventSource|null=null;let closed=false;
  (async()=>{try{const r=await fetch('/api/ixo/stream-ticket',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({run_id:runId})});const d=await r.json().catch(()=>({}));if(!r.ok||!d.url||closed)return;es=new EventSource(d.url);es.onmessage=e=>{let t=e.data;try{const j=JSON.parse(e.data);t=String(j?.type||j?.event||j?.status||j?.name||e.data)}catch{}onStatus(t)};es.onerror=()=>{es?.close()}}catch{}})();
  return ()=>{closed=true;es?.close()};
}
function completedResult(d:any,mode:ReasoningMode):ReasoningResult{
  if(d.result==null||d.result==='')throw failure('result_missing','iXo reasoning completed without a usable result.');
  let result:ReasoningResult;
  try{result=normalizeReasoningResult(d.result)}
  catch(e:any){
    // Native iXo RunRead.result is officially a string and can legitimately be
    // plain prose even when a JSON-only response was requested. Preserve that
    // completed reasoning instead of misclassifying it as an unavailable run.
    const prose=typeof d.result==='string'?d.result.trim():'';
    if(!prose)throw e;
    if(mode==='today')result={items:[{title:'What iXo noticed',observation:prose,why_it_matters:prose,known:[],inferred:[],unknown:[],evidence_refs:[],next_question:''}]};
    else if(mode==='mirror')result={findings:[{type:'OBSERVATION',observation:prose,why_noticed:'',known:[],inferred:[],unknown:[],evidence_refs:[],resolving_question:''}]};
    else if(mode==='decision')result={summary:prose,unknowns:['Native iXo returned this analysis as prose rather than structured sections.']};
    else result={answer:prose,context_used:[],assumptions:[],missing_information:[],why_context_changed_answer:null,evidence_refs:[]};
  }
  result.runtime_tool_activity=Array.isArray(d.tool_activity)?d.tool_activity:[];return result;
}
export async function rereadReasoning(job:ReasoningJob,mode:ReasoningMode):Promise<ReasoningResult>{
  const q=new URLSearchParams({run_id:job.run_id,recover:'completed'});const r=await fetch('/api/ixo/run-status?'+q.toString(),{cache:'no-store'});const d=await r.json().catch(()=>({}));
  if(!r.ok)throw failure('run_failed',d.error||'Could not re-read iXo reasoning');
  const status=String(d.status||'').toLowerCase();if(status!=='completed'&&status!=='finished')throw failure('run_failed','The previous iXo reasoning result is not available to re-read.');
  return validateReasoningResult(mode,completedResult(d,mode));
}
export async function waitForReasoning(job:ReasoningJob,mode:ReasoningMode,onStatus?:(s:string)=>void,maxMs=90000):Promise<ReasoningResult>{
  const started=Date.now(),source=job.reason_source||mode as ReasonSource;
  while(Date.now()-started<maxMs){
    let d:any={};
    try{
      const r=await fetch('/api/ixo/run-status?run_id='+encodeURIComponent(job.run_id)+'&chat_id='+encodeURIComponent(job.chat_id),{cache:'no-store'});d=await r.json().catch(()=>({}));
      if(!r.ok)throw failure('run_failed',d.error||'Could not read iXo reasoning');
      const status=String(d.status||'').toLowerCase();onStatus?.(status);
      if(status==='completed'||status==='finished'){
        try{return validateReasoningResult(mode,completedResult(d,mode))}
        catch(e:any){const classified=classifyFailure(e);await reportReasoningFailure(job,mode,source,classified,{terminal_status:status,result_present:typeof d.result==='string'&&d.result.length>0,result_type:typeCategory(d.result),duration_ms:Date.now()-started});throw classified}
      }
      if(['paused','waiting_for_input','requires_input','input_required'].includes(status))throw failure('run_failed','iXo reasoning is paused and requires user input.');
      if(['failed','cancelled','canceled'].includes(status))throw failure('run_failed',d.error||'iXo reasoning did not complete');
    }catch(e:any){
      const classified=classifyFailure(e);if(!(classified as any).observed)await reportReasoningFailure(job,mode,source,classified,{terminal_status:String(d?.status||''),result_present:typeof d?.result==='string'&&d.result.length>0,result_type:typeCategory(d?.result),duration_ms:Date.now()-started});throw classified;
    }
    await sleep(900);
  }
  const e=failure('run_failed','iXo is still working. Try again in a moment.');await reportReasoningFailure(job,mode,source,e,{duration_ms:Date.now()-started});throw e;
}
export function decisionPayload(input:DecisionInput){return {decision:input.decision,desired_outcome:input.desiredOutcome,options:input.options,assumptions:input.assumptions};}
