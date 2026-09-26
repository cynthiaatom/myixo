import {ixoFetch,errorDetail} from '../../lib/ixo-client.js';
const terminal=s=>['completed','finished','failed','cancelled','canceled','paused','waiting_for_input','requires_input','input_required'].includes(String(s||'').toLowerCase());
const failureCodes=new Set(['run_failed','result_missing','result_representation_invalid','result_schema_invalid','render_failed']);
const modes=new Set(['today','mirror','personalized','decision']);
const sources=new Set(['today','mirror','ask','decide','think_through','why','evidence']);

async function resolvePersistentChatId(req,res){
 const cr=await ixoFetch(req,res,'/chats?limit=200&offset=0',{method:'GET'}),cd=await cr.json().catch(()=>({}));
 if(!cr.ok)return{error:true,status:cr.status};
 const chats=Array.isArray(cd.items)?cd.items.filter(x=>x?.id):[];
 for(const chat of chats){
  const rr=await ixoFetch(req,res,'/chats/'+encodeURIComponent(chat.id)+'/runs?limit=1&offset=0',{method:'GET'}),rd=await rr.json().catch(()=>({}));
  if(rr.ok&&Array.isArray(rd.items)&&rd.items.length)return{id:String(chat.id)};
 }
 return{id:null};
}
async function ownedRun(req,res,runId){
 const resolved=await resolvePersistentChatId(req,res);
 if(resolved.error)return{error:true,status:resolved.status,message:resolved.status===401?'Authenticated MY iXo session required':'Could not verify run ownership'};
 if(!resolved.id)return{error:true,status:404,message:'No established persistent chat is available'};
 const r=await ixoFetch(req,res,'/runs/'+encodeURIComponent(runId),{method:'GET'}),run=await r.json().catch(()=>({}));
 if(!r.ok)return{error:true,status:r.status,message:'Could not inspect run'};
 if(String(run.chat_id||'')!==resolved.id)return{error:true,status:403,message:'Run is not owned by the authenticated persistent chat'};
 return{run,chatId:resolved.id};
}
function extractStructuredResult(value){
 if(value&&typeof value==='object'&&!Array.isArray(value))return value;
 if(typeof value!=='string')return value;
 let layer=value.trim();
 for(let depth=0;depth<3;depth++){
  const unfenced=layer.replace(/^\`\`\`(?:json)?\\s*/i,'').replace(/\\s*\`\`\`$/,'').trim();
  try{const decoded=JSON.parse(unfenced);if(decoded&&typeof decoded==='object'&&!Array.isArray(decoded))return decoded;if(typeof decoded==='string'){layer=decoded;continue}}catch{}
  const first=unfenced.indexOf('{'),last=unfenced.lastIndexOf('}');
  if(first>=0&&last>first){try{const decoded=JSON.parse(unfenced.slice(first,last+1));if(decoded&&typeof decoded==='object'&&!Array.isArray(decoded))return decoded}catch{}}
  break;
 }
 return value;
}
function resultShape(value){
 if(typeof value!=='string')return {type:value===null?'null':Array.isArray(value)?'array':typeof value};
 const t=value.trim(),first=t[0]||'',last=t[t.length-1]||'';
 const token=x=>x==='{'
  ?'brace':x==='['?'bracket':x==='`'?'backtick':x==='"'?'double_quote':x==="'"?'single_quote':/[A-Za-z]/.test(x)?'letter':x?'other':'empty';
 let parsed='invalid';
 try{const v=JSON.parse(t);parsed=v===null?'null':Array.isArray(v)?'array':typeof v}catch{}
 const firstBrace=t.indexOf('{'),lastBrace=t.lastIndexOf('}');
 const bucket=n=>n<0?'none':n===0?'zero':n<=8?'1-8':n<=32?'9-32':n<=128?'33-128':'129+';
 const nl=(t.match(/\\n/g)||[]).length;
 return {type:'string',length_bucket:t.length<256?'<256':t.length<1024?'256-1023':t.length<4096?'1024-4095':'4096+',first_token:token(first),last_token:token(last),json_parse_type:parsed,starts_fence:/^\`\`\`/.test(t),contains_fence:t.includes('```'),first_brace_prefix_bucket:bucket(firstBrace),trailing_after_last_brace_bucket:bucket(lastBrace<0?-1:t.length-lastBrace-1),newline_bucket:nl<2?'<2':nl<8?'2-7':'8+'};
}
async function runOutput(req,res,run,runId,chatId){
 const status=String(run.status||'').toLowerCase(),out={status:run.status,result:extractStructuredResult(run.result??null),error:run.error??null,steps:run.steps??null,tool_activity:[],result_source:run.result?'run_result':null,input_required:['paused','waiting_for_input','requires_input','input_required'].includes(status)};
 if(terminal(status)&&run.result!=null&&run.result!=='')console.info(JSON.stringify({event:'reason_result_shape',run_id:runId,status,result_shape:resultShape(run.result),timestamp:new Date().toISOString()}));
 if(terminal(status)&&chatId&&(out.result==null||out.result==='')){
  try{
   const mr=await ixoFetch(req,res,'/chats/'+encodeURIComponent(chatId)+'/messages?limit=500&offset=0&visible_only=false',{method:'GET'}),md=await mr.json().catch(()=>({}));
   if(mr.ok&&Array.isArray(md?.items)){
    const names=new Set(),visit=node=>{if(!node)return;if(Array.isArray(node)){for(const x of node)visit(x);return}if(typeof node!=='object')return;if(typeof node.name==='string'&&node.name.trim())names.add(node.name.trim());if(typeof node.tool==='string'&&node.tool.trim())names.add(node.tool.trim());if(node.function&&typeof node.function.name==='string')names.add(node.function.name.trim());for(const v of Object.values(node))visit(v)};
    for(const m of md.items){if(String(m?.run_id||'')!==runId)continue;if(Array.isArray(m?.tool_calls)&&m.tool_calls.length)visit(m.tool_calls);if(String(m?.role||'').toLowerCase()==='tool'&&m?.name)names.add(String(m.name))}
    out.tool_activity=[...names].filter(Boolean).slice(0,30);
    const assistant=md.items.filter(m=>String(m?.run_id||'')===runId&&String(m?.role||'').toLowerCase()==='assistant'&&String(m?.content||'').trim()).sort((a,b)=>Number(a?.seq||0)-Number(b?.seq||0));
    const last=assistant.at(-1);if(last){out.result=extractStructuredResult(String(last.content));out.result_source='assistant_message_recovery'}
   }
  }catch{}
 }
 out.result_present=out.result!==null&&out.result!==undefined&&out.result!=='';
 return out;
}
function typeCategory(v){return v===null?'null':Array.isArray(v)?'array':typeof v}
async function recordFailure(req,res){
 const b=req.body&&typeof req.body==='object'?req.body:{};
 const runId=String(b.run_id||'').trim(),code=String(b.code||''),mode=String(b.mode||''),source=String(b.source||'');
 if(!runId||!failureCodes.has(code)||!modes.has(mode)||!sources.has(source))return res.status(400).json({error:'Invalid failure telemetry'});
 const owned=await ownedRun(req,res,runId);if(owned.error)return res.status(owned.status).json({error:owned.message});
 const clientStatus=typeof b.terminal_status==='string'?b.terminal_status.slice(0,40):null;
 const duration=Number.isFinite(Number(b.duration_ms))?Math.max(0,Math.min(Number(b.duration_ms),300000)):null;
 const present=typeof b.result_present==='boolean'?b.result_present:null;
 const category=['string','object','array','null','undefined'].includes(String(b.result_type))?String(b.result_type):null;
 console.info(JSON.stringify({event:'reasoning_failure',mode,reason_source:source,failure_code:code,run_id:runId,terminal_status:clientStatus||String(owned.run.status||''),result_present:present,result_type:category||typeCategory(owned.run.result),duration_ms:duration,timestamp:new Date().toISOString()}));
 return res.status(204).end();
}

export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store, no-cache, must-revalidate');
 if(req.method==='POST'){try{return await recordFailure(req,res)}catch{return res.status(500).json({error:'Could not record reasoning failure'})}}
 if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
 const runId=String(req.query?.run_id||'').trim(),chatId=String(req.query?.chat_id||'').trim();if(!runId)return res.status(400).json({error:'run_id is required'});
 if(String(req.query?.recover||'')==='completed'){
  try{
   const owned=await ownedRun(req,res,runId);if(owned.error)return res.status(owned.status).json({error:owned.message});
   const status=String(owned.run.status||'').toLowerCase();if(status!=='completed'&&status!=='finished')return res.status(409).json({error:'Completed result is not available'});
   return res.status(200).json(await runOutput(req,res,owned.run,runId,owned.chatId));
  }catch{return res.status(500).json({error:'Could not re-read completed result'})}
 }
 try{
  const r=await ixoFetch(req,res,'/runs/'+encodeURIComponent(runId),{method:'GET'}),run=await r.json().catch(()=>({}));if(!r.ok)return res.status(r.status).json({error:errorDetail(run)||'Could not read iXo run'});
  return res.status(200).json(await runOutput(req,res,run,runId,chatId));
 }catch{return res.status(500).json({error:'Could not read iXo run'})}
}
