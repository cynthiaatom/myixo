const BASE='https://api.ai.atqm.us/api/v1';
const token=req=>{const m=(req.headers.cookie||'').match(/(?:^|; )ixo_access=([^;]+)/);return m?decodeURIComponent(m[1]):null};
const auth=t=>({authorization:`Bearer ${t}`,'content-type':'application/json'});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const detail=x=>typeof x?.detail==='string'?x.detail:(x?.detail?.message||x?.message||'');

const activeChatIds=async t=>{
  const r=await fetch(BASE+'/chats/active',{headers:auth(t)});
  const d=await r.json().catch(()=>({}));
  return r.ok&&Array.isArray(d?.chat_ids)?d.chat_ids:[];
};

const clearBlockingRuns=async t=>{
  try{
    let chatIds=await activeChatIds(t);
    if(!chatIds.length)return true;

    // Give a just-finishing iXo response a moment to clear naturally.
    await wait(1200);
    chatIds=await activeChatIds(t);
    if(!chatIds.length)return true;

    for(const chatId of chatIds){
      const rr=await fetch(BASE+`/chats/${chatId}/runs?limit=10&offset=0`,{headers:auth(t)});
      const page=await rr.json().catch(()=>({}));
      if(!rr.ok)continue;
      const runs=Array.isArray(page?.items)?page.items:[];
      for(const run of runs){
        const status=String(run?.status||'').toLowerCase();
        if(run?.id&&!['completed','failed','cancelled','canceled'].includes(status)){
          await fetch(BASE+`/runs/${run.id}/cancel`,{method:'POST',headers:auth(t)}).catch(()=>null);
        }
      }
    }

    // Wait until the backend no longer reports any active chat.
    for(let i=0;i<8;i++){
      await wait(500);
      if(!(await activeChatIds(t)).length)return true;
    }
    return false;
  }catch{return false}
};

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store, no-cache, must-revalidate');
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  const t=token(req); if(!t)return res.status(401).json({error:'Not connected'});
  const answer=String(req.body?.answer||'').trim();
  if(!answer)return res.status(400).json({error:'Answer is required'});

  try{
    const beforeR=await fetch(BASE+'/conversation/map',{headers:auth(t),cache:'no-store'});
    const before=await beforeR.json().catch(()=>({}));
    if(!beforeR.ok)return res.status(beforeR.status).json({error:detail(before)||'Could not read Personal Map'});

    // iXo currently allows only one in-flight run for this user. Clear any stale
    // run BEFORE creating the onboarding run so Question 1 cannot bounce on 409.
    const ready=await clearBlockingRuns(t);
    if(!ready)return res.status(409).json({error:'iXo still has another response running. Wait a few seconds and submit again.',code:'ixo_busy'});

    const chatR=await fetch(BASE+'/chats',{method:'POST',headers:auth(t),body:JSON.stringify({title:'Build My iXo'})});
    const chat=await chatR.json().catch(()=>({}));
    if(!chatR.ok)return res.status(chatR.status).json({error:detail(chat)||'Could not create iXo conversation'});

    const prompt=`Please learn and remember the following information about me as personal context. It is my answer to a Personal Map onboarding question. Use it to improve your understanding of me, but do not invent details I did not state. My answer: ${answer}`;
    const body=JSON.stringify({prompt,locale:'en',max_steps:20});

    let runR=await fetch(BASE+`/chats/${chat.id}/runs`,{method:'POST',headers:auth(t),body});
    let run=await runR.json().catch(()=>({}));

    // One last recovery pass for the race where another run becomes active
    // between our preflight check and create_run.
    if(runR.status===409){
      await clearBlockingRuns(t);
      runR=await fetch(BASE+`/chats/${chat.id}/runs`,{method:'POST',headers:auth(t),body});
      run=await runR.json().catch(()=>({}));
    }

    if(!runR.ok)return res.status(runR.status).json({error:detail(run)||'Could not send answer to iXo',code:runR.status===409?'ixo_busy':'ixo_run_failed'});

    const started=Date.now();
    while(Date.now()-started<45000&&!['completed','failed','cancelled','canceled'].includes(String(run.status).toLowerCase())){
      await wait(1000);
      const rr=await fetch(BASE+`/runs/${run.id}`,{headers:auth(t),cache:'no-store'});
      run=await rr.json().catch(()=>run);
      if(!rr.ok)break;
    }

    if(String(run.status).toLowerCase()!=='completed'){
      return res.status(202).json({processing:true,run_id:run.id,status:run.status,before});
    }

    await wait(1200);
    const afterR=await fetch(BASE+'/conversation/map',{headers:auth(t),cache:'no-store'});
    const after=await afterR.json().catch(()=>({}));
    if(!afterR.ok)return res.status(afterR.status).json({error:detail(after)||'Answer was processed, but map refresh failed'});

    return res.status(200).json({processing:false,run_id:run.id,before,after,result:run.result||null});
  }catch{
    return res.status(500).json({error:'Could not process this answer with iXo'});
  }
}