import {ixoFetch,errorDetail} from '../../lib/ixo-client.js';
const terminal=s=>['completed','finished','failed','cancelled','canceled','paused','waiting_for_input','requires_input','input_required'].includes(String(s||'').toLowerCase());
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store, no-cache, must-revalidate');if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
 const runId=String(req.query?.run_id||'').trim(),chatId=String(req.query?.chat_id||'').trim();if(!runId)return res.status(400).json({error:'run_id is required'});
 try{
  const r=await ixoFetch(req,res,'/runs/'+encodeURIComponent(runId),{method:'GET'}),run=await r.json().catch(()=>({}));if(!r.ok)return res.status(r.status).json({error:errorDetail(run)||'Could not read iXo run'});
  const status=String(run.status||'').toLowerCase(),out={status:run.status,result:run.result??null,error:run.error??null,steps:run.steps??null,tool_activity:[],result_source:run.result?'run_result':null,input_required:['paused','waiting_for_input','requires_input','input_required'].includes(status)};
  if(terminal(status)&&chatId&&(out.result==null||out.result==='')){
   try{
    const mr=await ixoFetch(req,res,'/chats/'+encodeURIComponent(chatId)+'/messages?limit=500&offset=0&visible_only=false',{method:'GET'}),md=await mr.json().catch(()=>({}));
    if(mr.ok&&Array.isArray(md?.items)){
     const names=new Set(),visit=node=>{if(!node)return;if(Array.isArray(node)){for(const x of node)visit(x);return}if(typeof node!=='object')return;if(typeof node.name==='string'&&node.name.trim())names.add(node.name.trim());if(typeof node.tool==='string'&&node.tool.trim())names.add(node.tool.trim());if(node.function&&typeof node.function.name==='string')names.add(node.function.name.trim());for(const v of Object.values(node))visit(v)};
     for(const m of md.items){if(String(m?.run_id||'')!==runId)continue;if(Array.isArray(m?.tool_calls)&&m.tool_calls.length)visit(m.tool_calls);if(String(m?.role||'').toLowerCase()==='tool'&&m?.name)names.add(String(m.name))}
     out.tool_activity=[...names].filter(Boolean).slice(0,30);
     const assistant=md.items.filter(m=>String(m?.run_id||'')===runId&&String(m?.role||'').toLowerCase()==='assistant'&&String(m?.content||'').trim()).sort((a,b)=>Number(a?.seq||0)-Number(b?.seq||0));
     const last=assistant.at(-1);if(last){out.result=String(last.content);out.result_source='assistant_message_recovery'}
    }
   }catch{}
  }
  out.result_present=typeof out.result==='string'&&out.result.length>0;return res.status(200).json(out);
 }catch{return res.status(500).json({error:'Could not read iXo run'})}
}
