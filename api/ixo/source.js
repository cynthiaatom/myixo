import {ixoFetch,errorDetail} from '../../lib/ixo-client.js';

const kinds=new Set(['message','answer','fact','profile_fact']);
const TARGET_CHAT='9760e122-6710-4977-bf82-b4731aa3c0fc';
const TARGET_RUN='f4c6ee9f-a23c-472d-9fc7-c88212a4be53';

const safeTime=v=>typeof v==='string'&&v.length<=64?v:null;
const safeId=v=>typeof v==='string'&&/^[0-9a-f-]{16,64}$/i.test(v)?v:null;
const safeCode=v=>typeof v==='string'&&/^[a-z0-9_.:-]{1,80}$/i.test(v)?v:null;
const readJson=async r=>r.json().catch(()=>({}));
const publicDiag=d=>{if(!d||typeof d!=='object')return{};const allow=/^(state|status|type|kind|stage|phase|run_id|chat_id|session_id|request_id|revision|generation|generation_state|conversation_state|current_chat_id|expected_chat_id|owner_id)$/i,out={};for(const[k,v]of Object.entries(d)){if(!allow.test(k))continue;if(typeof v==='string'){if(/(_id|id)$/i.test(k)){const x=safeId(v);if(x)out[k]=x}else{const x=safeCode(v);if(x)out[k]=x}}else if(typeof v==='number'||typeof v==='boolean'||v===null)out[k]=v}return out};
const safeContext=d=>({estimated_tokens:Number.isFinite(d?.estimated_tokens)?d.estimated_tokens:null,max_input_tokens:Number.isFinite(d?.max_input_tokens)?d.max_input_tokens:null,compaction_threshold_tokens:Number.isFinite(d?.compaction_threshold_tokens)?d.compaction_threshold_tokens:null,has_summary:typeof d?.has_summary==='boolean'?d.has_summary:null,can_compact:typeof d?.can_compact==='boolean'?d.can_compact:null,summary_upto_seq:Number.isFinite(d?.summary_upto_seq)?d.summary_upto_seq:null,compacted:typeof d?.compacted==='boolean'?d.compacted:null,before_tokens:Number.isFinite(d?.before_tokens)?d.before_tokens:null});
const safeHistory=d=>Array.isArray(d?.items)?d.items.map(x=>({run_id:safeId(x?.run_id),status:safeCode(x?.status),created_at:safeTime(x?.created_at),events:Array.isArray(x?.events)?x.events.map(e=>({seq:Number.isFinite(e?.seq)?e.seq:null,type:safeCode(e?.type)})).filter(e=>e.seq!==null||e.type):[]})):[];
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store, no-cache, must-revalidate');
 if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
 if(String(req.query?.diagnostic||'')==='lifecycle'){
  try{
   const qr=await ixoFetch(req,res,'/chats/'+TARGET_CHAT+'?include_messages=false',{method:'GET'}),qd=await readJson(qr);
   const cr=await ixoFetch(req,res,'/chats/'+TARGET_CHAT+'/context',{method:'GET'}),cd=await readJson(cr);
   const dr=await ixoFetch(req,res,'/conversation/diagnostics?run_id='+TARGET_RUN,{method:'GET'}),dd=await readJson(dr);
   const hr=await ixoFetch(req,res,'/chats/'+TARGET_CHAT+'/history?limit=100&offset=0&include_details=false&event_view=summary',{method:'GET'}),hd=await readJson(hr);
   return res.status(200).json({
    captured_at:new Date().toISOString(),
    target_chat:qr.ok?{id:safeId(qd?.id),created_at:safeTime(qd?.created_at),updated_at:safeTime(qd?.updated_at),project_id:safeId(qd?.project_id)}:{http_status:qr.status},
    context:cr.ok?safeContext(cd):{http_status:cr.status},
    targeted_conversation_diagnostics:dr.ok?publicDiag(dd):{http_status:dr.status},
    history:{http_status:hr.status,items:hr.ok?safeHistory(hd):[]},
    safety:{read_only:true,messages_excluded:true,event_payloads_discarded:true,run_details_excluded:true,artifacts_excluded:true,conversation_open_invoked:false,reset_invoked:false,chat_mutation:false,run_mutation:false}
   });
  }catch{return res.status(500).json({error:'Lifecycle diagnostic failed'})}
 }
 const kind=String(req.query?.kind||'').trim(),id=String(req.query?.id||'').trim();
 if(!kinds.has(kind)||!id)return res.status(400).json({error:'Valid source kind and id are required'});
 try{const r=await ixoFetch(req,res,'/conversation/sources/'+encodeURIComponent(kind)+'/'+encodeURIComponent(id),{method:'GET'}),data=await r.json().catch(()=>({}));if(!r.ok)return res.status(r.status).json({error:errorDetail(data)||'Could not load memory source'});return res.status(200).json(data)}catch{return res.status(500).json({error:'Could not load memory source'})}
}
