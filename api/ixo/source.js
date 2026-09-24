import {ixoFetch,errorDetail} from '../../lib/ixo-client.js';

const kinds=new Set(['message','answer','fact','profile_fact']);

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
  if(String(req.query?.diagnostic||'')==='lifecycle'){
    const stamp=()=>new Date().toISOString();
    const readState=async()=>{
      const ar=await ixoFetch(req,res,'/chats/active',{method:'GET'}),ad=await readJson(ar);
      const br=await ixoFetch(req,res,'/briefing/sessions/current',{method:'GET',headers:{'X-UI-Locale':'en'}}),bd=await readJson(br);
      const dr=await ixoFetch(req,res,'/conversation/diagnostics',{method:'GET'}),dd=await readJson(dr);
      return {
        at:stamp(),
        active:{http_status:ar.status,chat_ids:ar.ok&&Array.isArray(ad?.chat_ids)?ad.chat_ids.map(safeId).filter(Boolean):[],error_code:ar.ok?null:safeCode(ad?.code)},
        briefing:br.ok&&bd?{id:safeId(bd.id),kind:safeCode(bd.kind),state:safeCode(bd.state),revision:Number.isFinite(bd.revision)?bd.revision:null,generation_state:safeCode(bd?.generation?.state)}:br.status===404?null:{http_status:br.status,error_code:safeCode(bd?.code)},
        conversation_diagnostics:dr.ok?publicDiag(dd):{http_status:dr.status,error_code:safeCode(dd?.code)}
      };
    };
    try{
      const pre=await readState();
      const cr=await ixoFetch(req,res,'/chats',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({title:'MY iXo lifecycle diagnostic',project_id:null})}),cd=await readJson(cr);
      const chatId=cr.ok?safeId(cd?.id):null;
      const created={at:stamp(),http_status:cr.status,chat_id:chatId,project_id:cr.ok?safeId(cd?.project_id):null,error_code:cr.ok?null:safeCode(cd?.code)};
      if(!cr.ok||!chatId)return res.status(200).json({pre_state:pre,create:created,start:null,post_state:null,interpretation:'Diagnostic chat creation did not succeed; no run was attempted.'});
      const requestShape={prompt:'constant_nonpersonal_diagnostic',model_config_id:null,atomus_model_id:null,max_steps:1,adaptive_step_limit:false,attachment_ids:[],locale:'en'};
      const rr=await ixoFetch(req,res,'/chats/'+encodeURIComponent(chatId)+'/runs',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...requestShape,prompt:'Return exactly OK. Do not use tools.'})}),rd=await readJson(rr);
      const rawMessage=typeof rd?.detail==='string'?rd.detail:typeof rd?.message==='string'?rd.message:null;
      const start={at:stamp(),http_status:rr.status,run_id:rr.ok?safeId(rd?.id):null,status:rr.ok?safeCode(rd?.status):null,error_code:safeCode(rd?.code||rd?.error_code),error_type:safeCode(rd?.type||rd?.error_type),safe_message:rawMessage&&rawMessage.length<=240&&!/(bearer|token|password|cookie|authorization|prompt)/i.test(rawMessage)?rawMessage:null,response_meta:{content_type:safeCode((rr.headers.get('content-type')||'').split(';')[0]),request_id:safeId(rr.headers.get('x-request-id'))}};
      const post=await readState();
      const newActive=post.active.chat_ids.includes(chatId);
      let new_chat_runs=[];
      if(newActive){
        const lr=await ixoFetch(req,res,'/chats/'+encodeURIComponent(chatId)+'/runs?limit=50&offset=0',{method:'GET'}),ld=await readJson(lr);
        if(lr.ok&&Array.isArray(ld?.items))for(const row of ld.items){const id=safeId(row?.id);if(!id)continue;const gr=await ixoFetch(req,res,'/runs/'+encodeURIComponent(id),{method:'GET'}),gd=await readJson(gr);new_chat_runs.push(gr.ok?publicRun(gd):{id,http_status:gr.status,error_code:safeCode(gd?.code)})}
      }
      post.new_chat_runs=new_chat_runs;
      return res.status(200).json({
        pre_state:pre,create:created,
        start:{raw_ixo_response:start,request_contract:{content_type:'application/json',fields:{prompt:'string',model_config_id:null,atomus_model_id:null,max_steps:1,adaptive_step_limit:false,attachment_ids:0,locale:'en'},retry_count:0}},
        post_state:post,
        interpretation:rr.ok?'iXo accepted the single diagnostic run start.':'iXo rejected the single diagnostic run start; safe_message is literal upstream text when present.'
      });
    }catch{return res.status(500).json({error:'Lifecycle diagnostic failed'})}
  }
  const kind=String(req.query?.kind||'').trim();
  const id=String(req.query?.id||'').trim();
  if(!kinds.has(kind)||!id)return res.status(400).json({error:'Valid source kind and id are required'});
  try{
    const r=await ixoFetch(req,res,'/conversation/sources/'+encodeURIComponent(kind)+'/'+encodeURIComponent(id),{method:'GET'});
    const data=await r.json().catch(()=>({}));
    if(!r.ok)return res.status(r.status).json({error:errorDetail(data)||'Could not load memory source'});
    return res.status(200).json(data);
  }catch{
    return res.status(500).json({error:'Could not load memory source'});
  }
}
