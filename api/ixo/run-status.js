import {ixoFetch,errorDetail} from '../../lib/ixo-client.js';

const terminal=s=>['completed','failed','cancelled','canceled'].includes(String(s||'').toLowerCase());

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store, no-cache, must-revalidate');
  if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
  const runId=String(req.query?.run_id||'').trim();
  const chatId=String(req.query?.chat_id||'').trim();
  if(!runId)return res.status(400).json({error:'run_id is required'});
  try{
    const r=await ixoFetch(req,res,'/runs/'+encodeURIComponent(runId),{method:'GET'});
    const run=await r.json().catch(()=>({}));
    if(!r.ok)return res.status(r.status).json({error:errorDetail(run)||'Could not read iXo run'});
    const out={status:run.status,result:run.result??null,error:run.error??null,steps:run.steps??null};
    if(terminal(run.status)&&chatId&&String(req.query?.cleanup||'')==='1'){
      try{await ixoFetch(req,res,'/chats/'+encodeURIComponent(chatId),{method:'DELETE'})}catch{}
    }
    return res.status(200).json(out);
  }catch{
    return res.status(500).json({error:'Could not read iXo run'});
  }
}
