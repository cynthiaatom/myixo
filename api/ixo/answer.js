const BASE='https://api.ai.atqm.us/api/v1';
const token=req=>{const m=(req.headers.cookie||'').match(/(?:^|; )ixo_access=([^;]+)/);return m?decodeURIComponent(m[1]):null};
const auth=t=>({authorization:`Bearer ${t}`,'content-type':'application/json'});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
export default async function handler(req,res){
 if(req.method!=='POST') return res.status(405).json({error:'Method not allowed'});
 const t=token(req); if(!t)return res.status(401).json({error:'Not connected'});
 const answer=String(req.body?.answer||'').trim(); if(!answer)return res.status(400).json({error:'Answer is required'});
 try{
   const beforeR=await fetch(BASE+'/conversation/map',{headers:auth(t)}); const before=await beforeR.json();
   if(!beforeR.ok) return res.status(beforeR.status).json({error:before.detail||'Could not read Personal Map'});
   const chatR=await fetch(BASE+'/chats',{method:'POST',headers:auth(t),body:JSON.stringify({title:'Build My iXo'})}); const chat=await chatR.json();
   if(!chatR.ok)return res.status(chatR.status).json({error:chat.detail||'Could not create iXo conversation'});
   const prompt=`Please learn and remember the following information about me as personal context. It is my answer to a Personal Map onboarding question. Use it to improve your understanding of me, but do not invent details I did not state. My answer: ${answer}`;
   const runR=await fetch(BASE+`/chats/${chat.id}/runs`,{method:'POST',headers:auth(t),body:JSON.stringify({prompt,locale:'en',max_steps:20})}); let run=await runR.json();
   if(!runR.ok)return res.status(runR.status).json({error:run.detail||'Could not send answer to iXo'});
   const started=Date.now();
   while(Date.now()-started<90000 && !['completed','failed','cancelled','canceled'].includes(String(run.status).toLowerCase())){
     await wait(1500); const rr=await fetch(BASE+`/runs/${run.id}`,{headers:auth(t)}); run=await rr.json(); if(!rr.ok)break;
   }
   if(String(run.status).toLowerCase()!=='completed') return res.status(202).json({processing:true,run_id:run.id,status:run.status,before});
   await wait(1200);
   const afterR=await fetch(BASE+'/conversation/map',{headers:auth(t)}); const after=await afterR.json();
   if(!afterR.ok)return res.status(afterR.status).json({error:after.detail||'Answer was processed, but map refresh failed'});
   return res.status(200).json({processing:false,run_id:run.id,before,after,result:run.result||null});
 }catch(e){return res.status(500).json({error:'Could not process this answer with iXo'});}
}