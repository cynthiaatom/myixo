const BASE='https://api.ai.atqm.us/api/v1';
const token=req=>{const m=(req.headers.cookie||'').match(/(?:^|; )ixo_access=([^;]+)/);return m?decodeURIComponent(m[1]):null};
const auth=t=>({authorization:`Bearer ${t}`,'content-type':'application/json','X-UI-Locale':'en'});
const detail=x=>typeof x?.detail==='string'?x.detail:(x?.detail?.message||x?.message||'');
const terminal=s=>['completed','failed','cancelled','canceled'].includes(String(s||'').toLowerCase());

const findKey=(node,key)=>{
 if(!node||typeof node!=='object')return null;
 if(typeof node[key]==='string')return node[key];
 for(const v of Object.values(node)){const x=findKey(v,key);if(x)return x}
 return null;
};
const requestFromEvents=events=>{
 if(!Array.isArray(events))return null;
 for(let i=events.length-1;i>=0;i--){const id=findKey(events[i]?.payload||events[i],'request_id');if(id)return id}
 return null;
};
const activeConversation=async(t,openData)=>{
 let runId=findKey(openData,'run_id');
 let requestId=findKey(openData,'request_id');
 let chatId=findKey(openData,'chat_id');
 if(runId&&requestId)return {runId,requestId,chatId};

 let chatIds=[];
 if(chatId)chatIds.push(chatId);
 try{
  const ar=await fetch(BASE+'/chats/active',{headers:auth(t),cache:'no-store'});
  const ad=await ar.json().catch(()=>({}));
  if(ar.ok&&Array.isArray(ad?.chat_ids))chatIds.push(...ad.chat_ids);
 }catch{}
 chatIds=[...new Set(chatIds)];

 for(const id of chatIds){
  const hr=await fetch(BASE+`/chats/${id}/history?limit=8&offset=0&include_details=true`,{headers:auth(t),cache:'no-store'});
  const h=await hr.json().catch(()=>({}));
  if(!hr.ok)continue;
  for(const item of Array.isArray(h?.items)?h.items:[]){
   const rid=item?.run?.id||item?.run_id;
   const status=item?.run?.status||item?.status;
   if(!rid||terminal(status))continue;
   const req=requestFromEvents(item?.events);
   if(req)return {runId:rid,requestId:req,chatId:id};
  }
 }
 return {runId:null,requestId:null,chatId};
};
const openConversation=async t=>{
 const r=await fetch(BASE+'/conversation/open',{method:'POST',headers:auth(t),cache:'no-store'});
 const d=await r.json().catch(()=>({}));
 return {r,d};
};

export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store, no-cache, must-revalidate');
 if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
 const t=token(req);if(!t)return res.status(401).json({error:'Not connected'});
 const answer=String(req.body?.answer||'').trim();if(!answer)return res.status(400).json({error:'Answer is required'});
 const question=String(req.body?.question||'').trim();
 const text=`Personal Map onboarding. Question: ${question||'General context'}\nMy answer: ${answer}\nPlease save this as personal context when appropriate. Do not invent details I did not state.`;

 try{
  const {r:openR,d:openData}=await openConversation(t);
  if(!openR.ok)return res.status(openR.status).json({error:detail(openData)||'Could not open iXo conversation'});

  let state=await activeConversation(t,openData);
  if(state.runId&&state.requestId){
   const ir=await fetch(BASE+`/runs/${state.runId}/conversation-input`,{
    method:'POST',headers:auth(t),body:JSON.stringify({request_id:state.requestId,text})
   });
   const idata=await ir.json().catch(()=>({}));
   if(ir.ok)return res.status(200).json({accepted:true,processing:true,mode:'conversation',run_id:state.runId,result:idata});
   if(ir.status!==409)return res.status(ir.status).json({error:detail(idata)||'iXo could not accept this answer'});
   // The pending request may have rotated while we were submitting it. Re-open once.
   const reopened=await openConversation(t);
   if(reopened.r.ok){
    state=await activeConversation(t,reopened.d);
    if(state.runId&&state.requestId){
     const retry=await fetch(BASE+`/runs/${state.runId}/conversation-input`,{
      method:'POST',headers:auth(t),body:JSON.stringify({request_id:state.requestId,text})
     });
     const retryData=await retry.json().catch(()=>({}));
     if(retry.ok)return res.status(200).json({accepted:true,processing:true,mode:'conversation',run_id:state.runId,result:retryData});
    }
   }
  }

  // No paused dialogue run: start a normal run in the conversation returned by iXo.
  let chatId=state.chatId||findKey(openData,'chat_id');
  if(!chatId){
   const cr=await fetch(BASE+'/chats',{method:'POST',headers:auth(t),body:JSON.stringify({title:'Build My iXo'})});
   const chat=await cr.json().catch(()=>({}));
   if(!cr.ok)return res.status(cr.status).json({error:detail(chat)||'Could not create iXo conversation'});
   chatId=chat.id;
  }

  const rr=await fetch(BASE+`/chats/${chatId}/runs`,{
   method:'POST',headers:auth(t),body:JSON.stringify({prompt:text,locale:'en',max_steps:20})
  });
  const run=await rr.json().catch(()=>({}));
  if(rr.ok)return res.status(200).json({accepted:true,processing:true,mode:'run',run_id:run.id||null});
  if(rr.status===409){
   // A 409 means iXo already has its continuous dialogue run. Find its pending
   // request and feed the answer into that run instead of creating another one.
   state=await activeConversation(t,openData);
   if(state.runId&&state.requestId){
    const ir=await fetch(BASE+`/runs/${state.runId}/conversation-input`,{
     method:'POST',headers:auth(t),body:JSON.stringify({request_id:state.requestId,text})
    });
    const idata=await ir.json().catch(()=>({}));
    if(ir.ok)return res.status(200).json({accepted:true,processing:true,mode:'conversation',run_id:state.runId,result:idata});
   }
  }
  return res.status(rr.status).json({error:detail(run)||'iXo could not accept this answer',code:rr.status===409?'ixo_busy':'ixo_run_failed'});
 }catch(e){
  return res.status(500).json({error:'Could not process this answer with iXo'});
 }
}