import {ixoFetch,errorDetail} from '../../lib/ixo-client.js';
const terminal=s=>['completed','finished','failed','cancelled','canceled','paused','waiting_for_input','requires_input','input_required'].includes(String(s||'').toLowerCase());

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
async function runOutput(req,res,run,runId,chatId){
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
 out.result_present=typeof out.result==='string'&&out.result.length>0;
 return out;
}

const typeOf=v=>v===null?'null':Array.isArray(v)?'array':typeof v;
const charCat=c=>!c?'none':c==='{'?'{':c==='['?'[':c==='}'?'}':c===']'?']':c==='`'?'backtick':'other';
const fieldType=(o,k)=>Object.prototype.hasOwnProperty.call(o,k)?typeOf(o[k]):null;
const tryParse=s=>{try{return{ok:true,value:JSON.parse(s)}}catch{return{ok:false,value:null}}};
const preprocess=s=>s.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
function scanCandidates(s){
 const out=[];let inString=false,escape=false;const stack=[];let start=-1;
 for(let i=0;i<s.length;i++){
  const c=s[i];
  if(inString){if(escape)escape=false;else if(c==='\\')escape=true;else if(c==='"')inString=false;continue}
  if(c==='"'){inString=true;continue}
  if(c==='{'||c==='['){if(stack.length===0)start=i;stack.push(c);continue}
  if(c==='}'||c===']'){
   if(!stack.length)continue;
   const open=stack.at(-1);if((open==='{'&&c!=='}')||(open==='['&&c!==']')){stack.length=0;start=-1;continue}
   stack.pop();if(stack.length===0&&start>=0){const candidate=s.slice(start,i+1),p=tryParse(candidate);out.push({start,end:i,parse_ok:p.ok,value:p.value});start=-1}
  }
 }
 return out;
}
function classify({before,after,beginsFence,endsFence,candidates,sourceLength}){
 if(after.ok&&before.ok)return'C';
 if(after.ok&&(beginsFence||endsFence))return'A';
 const good=candidates.filter(x=>x.parse_ok);
 if(good.length===1){const c=good[0];if(c.start>0||c.end<sourceLength-1)return'B';return'C'}
 if(candidates.length&&good.length===0)return'D';
 return'E';
}
async function diagnostic(req,res,runId){
 const owned=await ownedRun(req,res,runId);if(owned.error)return res.status(owned.status).json({error:owned.message});
 const run=owned.run,status=String(run.status||'').toLowerCase();if(!terminal(status))return res.status(409).json({error:'Run is not terminal'});
 const raw=run.result??null,rt=typeOf(raw),isString=typeof raw==='string',s=isString?raw:'',trim=s.trim(),pre=isString?preprocess(s):'',before=isString?tryParse(trim):{ok:false,value:null},after=isString?tryParse(pre):{ok:false,value:null};
 const beginsFence=isString?/^\s*```/.test(s):false,endsFence=isString?/```\s*$/.test(s):false;
 let fenceLanguage='none';if(beginsFence){const m=s.match(/^\s*```([^\r\n]*)/);const tag=String(m?.[1]||'').trim().toLowerCase();fenceLanguage=tag==='json'?'json':tag?'other':'unknown'}
 const scanned=isString?scanCandidates(trim):[],good=scanned.filter(x=>x.parse_ok),one=good.length===1?good[0]:null,obj=one&&one.value&&typeof one.value==='object'&&!Array.isArray(one.value)?one.value:null;
 const fields=['answer','summary','context_used','assumptions','missing_information','why_context_changed_answer','evidence_refs'],presence={};
 for(const k of fields)presence[k]={present:Boolean(obj&&Object.prototype.hasOwnProperty.call(obj,k)),type:obj?fieldType(obj,k):null};
 return res.status(200).json({status:run.status,result_type:rt,character_length:isString?s.length:null,empty_or_whitespace_only:isString?!trim.length:null,begins_markdown_fence:beginsFence,ends_markdown_fence:endsFence,fence_language:fenceLanguage,preprocessing_changes_string:isString?pre!==s:null,json_parse_before_preprocessing:before.ok,json_parse_after_preprocessing:after.ok,first_structural_character:isString?charCat(trim[0]):'none',last_structural_character:isString?charCat(trim.at(-1)):'none',balanced_top_level_json_candidate_count:scanned.length,exactly_one_candidate:scanned.length===1,candidate_parse_success:scanned.length===1?Boolean(scanned[0].parse_ok):null,top_level_keys:obj?Object.keys(obj):[],fields:presence,classification:isString?classify({before,after,beginsFence,endsFence,candidates:scanned,sourceLength:trim.length}):'F'});
}
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store, no-cache, must-revalidate');if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
 const runId=String(req.query?.run_id||'').trim(),chatId=String(req.query?.chat_id||'').trim();if(!runId)return res.status(400).json({error:'run_id is required'});
 if(String(req.query?.diagnostic||'')==='structure'){try{return await diagnostic(req,res,runId)}catch{return res.status(500).json({error:'Could not inspect run structure'})}}
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
