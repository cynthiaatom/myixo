import {ixoFetch} from '../../lib/ixo-client.js';

const kinds=new Set(['message','answer','fact','profile_fact']);
const TARGET_CHAT='9760e122-6710-4977-bf82-b4731aa3c0fc';
const EXPECTED='INZO_RUN_OK';
const terminal=s=>['finished','completed','failed','cancelled','canceled','paused','waiting_for_input','requires_input'].includes(String(s||'').toLowerCase());
const safeTime=v=>typeof v==='string'&&v.length<=64?v:null;
const safeId=v=>typeof v==='string'&&/^[0-9a-f-]{16,64}$/i.test(v)?v:null;
const safeCode=v=>typeof v==='string'&&/^[a-z0-9_.:-]{1,80}$/i.test(v)?v:null;
const safeMessage=v=>typeof v==='string'&&v.length<=240&&!/(bearer|token|password|cookie|authorization|prompt)/i.test(v)?v:null;
const readJson=async r=>r.json().catch(()=>({}));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const errorCode=d=>safeCode(d?.code||d?.error_code||d?.detail?.code);
const errorMessage=d=>safeMessage(typeof d?.detail==='string'?d.detail:d?.detail?.message||d?.message);
const publicRun=r=>({run_id:safeId(r?.id),chat_id:safeId(r?.chat_id),status:safeCode(r?.status),created_at:safeTime(r?.created_at),updated_at:safeTime(r?.updated_at),completed_at:safeTime(r?.completed_at),result_exists:typeof r?.result==='string'&&r.result.length>0,error_code:safeCode(r?.error_code||r?.code)});
async function recoverExpected(req,res,runId){
 const mr=await ixoFetch(req,res,'/chats/'+TARGET_CHAT+'/messages?limit=100&offset=0&visible_only=true',{method:'GET'}),md=await readJson(mr);
 if(!mr.ok||!Array.isArray(md?.items))return {checked:mr.ok,matching_assistant_output_exists:false,expected_response_produced:false};
 const matching=md.items.filter(m=>String(m?.role||'').toLowerCase()==='assistant'&&String(m?.run_id||'')===runId);
 return {checked:true,matching_assistant_output_exists:matching.length>0,expected_response_produced:matching.some(m=>String(m?.content||'').trim()===EXPECTED)};
}
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store, no-cache, must-revalidate');
 if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
 if(String(req.query?.diagnostic||'')==='lifecycle'){
  try{
   const ar=await ixoFetch(req,res,'/chats/active',{method:'GET'}),ad=await readJson(ar);
   const active=ar.ok&&Array.isArray(ad?.chat_ids)?ad.chat_ids.map(safeId).filter(Boolean):[];
   if(!ar.ok||active.length)return res.status(200).json({captured_at:new Date().toISOString(),preflight:{http_status:ar.status,active_chat_ids:active,error_code:ar.ok?null:errorCode(ad)},start_attempted:false,stop_reason:active.length?'run_in_flight':'active_state_unavailable',safety:{attempts:0,chat_created:false,conversation_open_invoked:false,reset_invoked:false,run_cancelled:false,input_sent:false,memory_or_map_modified:false}});
   const body={prompt:'Respond with exactly: INZO_RUN_OK',model_config_id:null,atomus_model_id:null,max_steps:1,adaptive_step_limit:false,attachment_ids:[],locale:'en'};
   const sr=await ixoFetch(req,res,'/chats/'+TARGET_CHAT+'/runs',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}),sd=await readJson(sr);
   if(!sr.ok)return res.status(200).json({captured_at:new Date().toISOString(),preflight:{http_status:ar.status,active_chat_ids:[]},start_attempted:true,start:{http_status:sr.status,run_id:safeId(sd?.id),chat_id:safeId(sd?.chat_id),status:safeCode(sd?.status),error_code:errorCode(sd),safe_message:errorMessage(sd)},safety:{attempts:1,retries:0,chat_created:false,conversation_open_invoked:false,reset_invoked:false,run_cancelled:false,input_sent:false,memory_or_map_modified:false}});
   const runId=safeId(sd?.id);
   let run=sd;
   for(let i=0;i<20&&!terminal(run?.status);i++){await sleep(1000);const rr=await ixoFetch(req,res,'/runs/'+encodeURIComponent(runId),{method:'GET'}),rd=await readJson(rr);if(!rr.ok){return res.status(200).json({captured_at:new Date().toISOString(),preflight:{http_status:200,active_chat_ids:[]},start_attempted:true,start:{http_status:sr.status,...publicRun(sd)},observation:{http_status:rr.status,error_code:errorCode(rd)},safety:{attempts:1,retries:0,chat_created:false,conversation_open_invoked:false,reset_invoked:false,run_cancelled:false,input_sent:false,memory_or_map_modified:false}})}run=rd}
   let recovered={checked:false,matching_assistant_output_exists:false,expected_response_produced:false};
   const directExpected=typeof run?.result==='string'&&run.result.trim()===EXPECTED;
   if(terminal(run?.status)&&!directExpected)recovered=await recoverExpected(req,res,runId);
   return res.status(200).json({captured_at:new Date().toISOString(),preflight:{http_status:200,active_chat_ids:[]},start_attempted:true,start:{http_status:sr.status,run_id:runId,chat_id:safeId(sd?.chat_id),status:safeCode(sd?.status)},observation:{...publicRun(run),terminal:terminal(run?.status),matching_assistant_output_exists:recovered.matching_assistant_output_exists,result_recovery_checked:recovered.checked,expected_response_produced:directExpected||recovered.expected_response_produced},safety:{attempts:1,retries:0,chat_created:false,conversation_open_invoked:false,reset_invoked:false,run_cancelled:false,input_sent:false,memory_or_map_modified:false}});
  }catch{return res.status(500).json({error:'Lifecycle diagnostic failed'})}
 }
 const kind=String(req.query?.kind||'').trim(),id=String(req.query?.id||'').trim();
 if(!kinds.has(kind)||!id)return res.status(400).json({error:'Valid source kind and id are required'});
 try{const r=await ixoFetch(req,res,'/conversation/sources/'+encodeURIComponent(kind)+'/'+encodeURIComponent(id),{method:'GET'}),data=await r.json().catch(()=>({}));if(!r.ok)return res.status(r.status).json({error:'Could not load memory source'});return res.status(200).json(data)}catch{return res.status(500).json({error:'Could not load memory source'})}
}
