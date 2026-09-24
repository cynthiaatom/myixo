import {ixoFetch,errorDetail} from '../../lib/ixo-client.js';

const kinds=new Set(['message','answer','fact','profile_fact']);

const safeTime=v=>typeof v==='string'&&v.length<=64?v:null;
const safeId=v=>typeof v==='string'&&/^[0-9a-f-]{16,64}$/i.test(v)?v:null;
const safeCode=v=>typeof v==='string'&&/^[a-z0-9_.:-]{1,80}$/i.test(v)?v:null;
const readJson=async r=>r.json().catch(()=>({}));
const publicRun=r=>({id:safeId(r?.id),status:safeCode(r?.status),created_at:safeTime(r?.created_at),updated_at:safeTime(r?.updated_at)});
const publicDiag=d=>{if(!d||typeof d!=='object')return{};const allow=/^(state|status|type|kind|stage|phase|run_id|chat_id|session_id|request_id|revision|generation|generation_state|conversation_state)$/i,out={};for(const[k,v]of Object.entries(d)){if(!allow.test(k))continue;if(typeof v==='string'){if(/(_id|id)$/i.test(k)){const x=safeId(v);if(x)out[k]=x}else{const x=safeCode(v);if(x)out[k]=x}}else if(typeof v==='number'||typeof v==='boolean'||v===null)out[k]=v}return out};
const safeBriefing=b=>!b||typeof b!=='object'?null:{id:safeId(b.id),state:safeCode(b.state),status:safeCode(b.status),created_at:safeTime(b.created_at),updated_at:safeTime(b.updated_at),revision:Number.isFinite(b.revision)?b.revision:null,generation_state:safeCode(b?.generation?.state||b?.generation_state)};
const capabilityView=d=>({contract_version:safeCode(d?.contract_version),config_revision:Number.isFinite(d?.config_revision)?d.config_revision:null,features:{conversation:Boolean(d?.features?.conversation),conversation_verdicts:Boolean(d?.features?.conversation_verdicts),briefing:Boolean(d?.features?.briefing),profile_memory:Boolean(d?.features?.profile_memory),personal_map:Boolean(d?.features?.personal_map),personal_map_dialogue:Boolean(d?.features?.personal_map_dialogue),projects_ui:Boolean(d?.features?.projects_ui)},onboarding:{state:safeCode(d?.onboarding?.state),chat_allowed:Boolean(d?.onboarding?.chat_allowed),can_skip:Boolean(d?.onboarding?.can_skip)}});

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store, no-cache, must-revalidate');
  if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
  if(String(req.query?.diagnostic||'')==='lifecycle'){
    try{
      const cr=await ixoFetch(req,res,'/capabilities',{method:'GET'}),cd=await readJson(cr);
      const ar=await ixoFetch(req,res,'/chats/active',{method:'GET'}),ad=await readJson(ar);
      const br=await ixoFetch(req,res,'/briefing/sessions/current',{method:'GET',headers:{'X-UI-Locale':'en'}}),bd=await readJson(br);
      const dr=await ixoFetch(req,res,'/conversation/diagnostics',{method:'GET'}),dd=await readJson(dr);
      const lr=await ixoFetch(req,res,'/chats?limit=200&offset=0',{method:'GET'}),ld=await readJson(lr);
      const rows=lr.ok&&Array.isArray(ld?.items)?ld.items:[];
      const chats=[];
      for(const row of rows){
        const id=safeId(row?.id);if(!id)continue;
        const rr=await ixoFetch(req,res,'/chats/'+encodeURIComponent(id)+'/runs?limit=1&offset=0',{method:'GET'}),rd=await readJson(rr);
        const latest=rr.ok&&Array.isArray(rd?.items)&&rd.items.length?publicRun(rd.items[0]):null;
        chats.push({id,created_at:safeTime(row?.created_at),updated_at:safeTime(row?.updated_at),project_id:safeId(row?.project_id),has_runs:Boolean(latest),latest_run:latest,runs_http_status:rr.status});
      }
      return res.status(200).json({
        captured_at:new Date().toISOString(),
        capabilities:cr.ok?capabilityView(cd):{http_status:cr.status,error_code:safeCode(cd?.code)},
        chats_http_status:lr.status,
        chats,
        active:{http_status:ar.status,chat_ids:ar.ok&&Array.isArray(ad?.chat_ids)?ad.chat_ids.map(safeId).filter(Boolean):[],error_code:ar.ok?null:safeCode(ad?.code)},
        briefing:br.ok?safeBriefing(bd):br.status===404?null:{http_status:br.status,error_code:safeCode(bd?.code)},
        conversation_diagnostics:dr.ok?publicDiag(dd):{http_status:dr.status,error_code:safeCode(dd?.code)},
        safety:{read_only:true,conversation_open_invoked:false,reset_invoked:false,chat_mutation:false,run_mutation:false}
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
