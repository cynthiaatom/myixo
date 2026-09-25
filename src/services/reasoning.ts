import type {DecisionInput,MemoryFact,ReasoningResult} from '../intelligence/types';
import {normalizeReasoningResult} from './result-normalizer';

const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));

export type ReasoningJob={run_id:string;chat_id:string;evidence:MemoryFact[];status:string;context_status?:'ready'|'insufficient_context';diagnostics?:{memory_count:number;selected_count:number;category_counts:Record<string,number>;profile_revision:number;index_status:string}};

export type ReasonSource='today'|'mirror'|'ask'|'decide'|'why'|'evidence'|'think_through';

export async function startReasoning(mode:'today'|'mirror'|'personalized'|'decision',input:{question?:string;decision?:string;desired_outcome?:string;options?:string[];assumptions?:string[]},reasonSource?:ReasonSource):Promise<ReasoningJob>{
  const r=await fetch('/api/ixo/reason',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({mode,reason_source:reasonSource||mode,...input})});
  const d=await r.json().catch(()=>({}));
  if(!r.ok){const e:any=new Error(d.error||'Could not start iXo reasoning');e.code=d.code||null;throw e}
  return d as ReasoningJob;
}

export function openRunEvents(runId:string,onStatus:(label:string)=>void){
  let es:EventSource|null=null;
  let closed=false;
  (async()=>{
    try{
      const r=await fetch('/api/ixo/stream-ticket',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({run_id:runId})});
      const d=await r.json().catch(()=>({}));
      if(!r.ok||!d.url||closed)return;
      es=new EventSource(d.url);
      es.onmessage=e=>{
        let t=e.data;
        try{const j=JSON.parse(e.data);t=String(j?.type||j?.event||j?.status||j?.name||e.data)}catch{}
        onStatus(t);
      };
      es.onerror=()=>{es?.close()};
    }catch{}
  })();
  return ()=>{closed=true;es?.close()};
}

function completedResult(d:any):ReasoningResult{
  const result=normalizeReasoningResult(d.result??null);
  result.runtime_tool_activity=Array.isArray(d.tool_activity)?d.tool_activity:[];
  return result;
}

export async function rereadReasoning(job:ReasoningJob):Promise<ReasoningResult>{
  const q=new URLSearchParams({run_id:job.run_id,recover:'completed'});
  const r=await fetch('/api/ixo/run-status?'+q.toString(),{cache:'no-store'});
  const d=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(d.error||'Could not re-read iXo reasoning');
  const status=String(d.status||'').toLowerCase();
  if(status!=='completed'&&status!=='finished')throw new Error('The previous iXo reasoning result is not available to re-read.');
  return completedResult(d);
}

export async function waitForReasoning(job:ReasoningJob,onStatus?:(s:string)=>void,maxMs=90000):Promise<ReasoningResult>{
  const started=Date.now();
  while(Date.now()-started<maxMs){
    const r=await fetch('/api/ixo/run-status?run_id='+encodeURIComponent(job.run_id)+'&chat_id='+encodeURIComponent(job.chat_id),{cache:'no-store'});
    const d=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(d.error||'Could not read iXo reasoning');
    const status=String(d.status||'').toLowerCase();
    onStatus?.(status);
    if(status==='completed'||status==='finished')return completedResult(d);
    if(['paused','waiting_for_input','requires_input','input_required'].includes(status))throw new Error('iXo reasoning is paused and requires user input.');
    if(['failed','cancelled','canceled'].includes(status))throw new Error(d.error||'iXo reasoning did not complete');
    await sleep(900);
  }
  throw new Error('iXo is still working. Try again in a moment.');
}

export function decisionPayload(input:DecisionInput){
  return {decision:input.decision,desired_outcome:input.desiredOutcome,options:input.options,assumptions:input.assumptions};
}
