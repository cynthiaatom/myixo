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
    const out={status:run.status,result:run.result??null,error:run.error??null,steps:run.steps??null,tool_activity:[]};
    if(terminal(run.status)&&chatId){
      try{
        const mr=await ixoFetch(req,res,'/chats/'+encodeURIComponent(chatId)+'/messages?limit=500&offset=0&visible_only=false',{method:'GET'});
        const md=await mr.json().catch(()=>({}));
        if(mr.ok&&Array.isArray(md?.items)){
          const names=new Set();
          const visit=node=>{
            if(!node)return;
            if(Array.isArray(node)){for(const x of node)visit(x);return}
            if(typeof node!=='object')return;
            if(typeof node.name==='string'&&node.name.trim())names.add(node.name.trim());
            if(typeof node.tool==='string'&&node.tool.trim())names.add(node.tool.trim());
            if(node.function&&typeof node.function.name==='string')names.add(node.function.name.trim());
            for(const v of Object.values(node))visit(v);
          };
          for(const m of md.items){
            if(Array.isArray(m?.tool_calls)&&m.tool_calls.length)visit(m.tool_calls);
            if(String(m?.role||'').toLowerCase()==='tool'&&m?.name)names.add(String(m.name));
          }
          out.tool_activity=[...names].filter(Boolean).slice(0,30);
        }
      }catch{}
      if(String(req.query?.cleanup||'')==='1'){
        try{await ixoFetch(req,res,'/chats/'+encodeURIComponent(chatId),{method:'DELETE'})}catch{}
      }
    }
    return res.status(200).json(out);
  }catch{
    return res.status(500).json({error:'Could not read iXo run'});
  }
}
