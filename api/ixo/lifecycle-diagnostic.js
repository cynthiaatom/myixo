import {ixoFetch} from '../../lib/ixo-client.js';
const safeTime=v=>typeof v==='string'&&v.length<=64?v:null;
const safeId=v=>typeof v==='string'&&/^[0-9a-f-]{16,64}$/i.test(v)?v:null;
const safeCode=v=>typeof v==='string'&&/^[a-z0-9_.:-]{1,80}$/i.test(v)?v:null;
const readJson=async r=>r.json().catch(()=>({}));
const publicRun=r=>({id:safeId(r?.id),chat_id:safeId(r?.chat_id),status:safeCode(r?.status),created_at:safeTime(r?.created_at),updated_at:safeTime(r?.updated_at),pending_human_input:['paused','waiting_input','requires_input','input_required'].includes(String(r?.status||'').toLowerCase()),error_code:safeCode(r?.error_code||r?.code)});
const publicChat=c=>({id:safeId(c?.id),project_id:safeId(c?.project_id),created_at:safeTime(c?.created_at),updated_at:safeTime(c?.updated_at),trigger_label:safeCode(c?.trigger_label)});
const publicDiag=d=>{if(!d||typeof d!=='object')return{};const allow=/^(state|status|type|kind|stage|phase|run_id|chat_id|session_id|request_id|revision|generation|generation_state|conversation_state)$/i,out={};for(const[k,v]of Object.entries(d)){if(!allow.test(k))continue;if(typeof v==='string'){if(/(_id|id)$/i.test(k)){const x=safeId(v);if(x)out[k]=x}else{const x=safeCode(v);if(x)out[k]=x}}else if(typeof v==='number'||typeof v==='boolean'||v===null)out[k]=v}return out};
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store, no-cache, must-revalidate');
 if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
 try{
  const ar=await ixoFetch(req,res,'/chats/active',{method:'GET'}),ad=await readJson(ar);
  if(!ar.ok)return res.status(ar.status).json({error:'Could not read active iXo lifecycle',status:ar.status,code:safeCode(ad?.code)});
  const activeIds=Array.isArray(ad?.chat_ids)?ad.chat_ids.map(safeId).filter(Boolean):[],chats=[];
  for(const chatId of activeIds){
   const cr=await ixoFetch(req,res,'/chats/'+encodeURIComponent(chatId)+'?include_messages=false',{method:'GET'}),cd=await readJson(cr);
   const rr=await ixoFetch(req,res,'/chats/'+encodeURIComponent(chatId)+'/runs?limit=50&offset=0',{method:'GET'}),rd=await readJson(rr),runs=[];
   if(rr.ok&&Array.isArray(rd?.items))for(const row of rd.items){const runId=safeId(row?.id);if(!runId)continue;const gr=await ixoFetch(req,res,'/runs/'+encodeURIComponent(runId),{method:'GET'}),gd=await readJson(gr);runs.push(gr.ok?publicRun(gd):{id:runId,status:'read_failed',http_status:gr.status,error_code:safeCode(gd?.code)})}
   chats.push({chat:cr.ok?publicChat(cd):{id:chatId,read_status:cr.status},runs});
  }
  const br=await ixoFetch(req,res,'/briefing/sessions/current',{method:'GET',headers:{'X-UI-Locale':'en'}),bd=await readJson(br);
  const briefing=br.ok&&bd?{id:safeId(bd.id),kind:safeCode(bd.kind),state:safeCode(bd.state),revision:Number.isFinite(bd.revision)?bd.revision:null,generation_state:safeCode(bd?.generation?.state),generation_retryable:typeof bd?.generation?.retryable==='boolean'?bd.generation.retryable:null}:br.status===404?null:{read_status:br.status,error_code:safeCode(bd?.code)};
  const dr=await ixoFetch(req,res,'/conversation/diagnostics',{method:'GET'}),dd=await readJson(dr);
  return res.status(200).json({captured_at:new Date().toISOString(),active_chat_ids:activeIds,chats,briefing,conversation_diagnostics:dr.ok?publicDiag(dd):{read_status:dr.status,error_code:safeCode(dd?.code)}});
 }catch{return res.status(500).json({error:'Lifecycle diagnostic failed'})}
}