const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));
type NativeAdaptiveJob={run_id:string;chat_id:string;status:string};

async function start(mode:'adaptive_question'|'adaptive_answer',text:string):Promise<NativeAdaptiveJob>{
 const r=await fetch('/api/ixo/reason',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({mode,reason_source:'ask',question:text})});
 const d=await r.json().catch(()=>({}));
 if(!r.ok){const e:any=new Error(d.error||'iXo could not start adaptive learning');e.code=d.code||null;throw e}
 return d as NativeAdaptiveJob;
}
async function wait(job:NativeAdaptiveJob,maxMs=90000):Promise<string>{
 const started=Date.now();
 while(Date.now()-started<maxMs){
  const r=await fetch('/api/ixo/run-status?run_id='+encodeURIComponent(job.run_id)+'&chat_id='+encodeURIComponent(job.chat_id),{cache:'no-store'});
  const d=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(d.error||'Could not read adaptive iXo run');
  const status=String(d.status||'').toLowerCase();
  if(status==='completed'||status==='finished'){
   const value=typeof d.result==='string'?d.result.trim():'';
   if(!value)throw new Error('iXo completed without a question.');
   return value.replace(/^\s*["“]|["”]\s*$/g,'').trim();
  }
  if(['failed','cancelled','canceled','paused','waiting_for_input','requires_input','input_required'].includes(status))throw new Error(d.error||'iXo could not complete adaptive learning');
  await sleep(900);
 }
 throw new Error('iXo is still working on the adaptive question.');
}
export async function generateAdaptiveQuestion(target:string){return wait(await start('adaptive_question',target))}
export async function submitAdaptiveAnswer(answer:string){return wait(await start('adaptive_answer',answer))}
