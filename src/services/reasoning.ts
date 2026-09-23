import type {DecisionInput,MemoryFact,ReasoningResult} from '../intelligence/types';

const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));

export type ReasoningJob={run_id:string;chat_id:string;evidence:MemoryFact[];status:string};

export async function startReasoning(mode:'personalized'|'decision',input:{question?:string;decision?:string;desired_outcome?:string;options?:string[];assumptions?:string[]}):Promise<ReasoningJob>{
  const r=await fetch('/api/ixo/reason',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({mode,...input})});
  const d=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(d.error||'Could not start iXo reasoning');
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

function parseResult(raw:string|null):ReasoningResult{
  if(!raw)return {};
  const s=raw.trim().replace(/^\`\`\`(?:json)?\s*/i,'').replace(/\s*\`\`\`$/,'');
  try{return JSON.parse(s)}catch{return {answer:raw,summary:raw}}
}

export async function waitForReasoning(job:ReasoningJob,onStatus?:(s:string)=>void,maxMs=90000):Promise<ReasoningResult>{
  const started=Date.now();
  while(Date.now()-started<maxMs){
    const r=await fetch('/api/ixo/run-status?run_id='+encodeURIComponent(job.run_id)+'&chat_id='+encodeURIComponent(job.chat_id),{cache:'no-store'});
    const d=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(d.error||'Could not read iXo reasoning');
    const status=String(d.status||'').toLowerCase();
    onStatus?.(status);
    if(status==='completed'){
      const result=parseResult(d.result??null);
      fetch('/api/ixo/run-status?run_id='+encodeURIComponent(job.run_id)+'&chat_id='+encodeURIComponent(job.chat_id)+'&cleanup=1',{cache:'no-store'}).catch(()=>{});
      return result;
    }
    if(['failed','cancelled','canceled'].includes(status))throw new Error(d.error||'iXo reasoning did not complete');
    await sleep(900);
  }
  throw new Error('iXo is still working. Try again in a moment.');
}

export function decisionPayload(input:DecisionInput){
  return {decision:input.decision,desired_outcome:input.desiredOutcome,options:input.options,assumptions:input.assumptions};
}
