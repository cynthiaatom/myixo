import {randomUUID} from 'node:crypto';
import {ixoFetch} from './ixo-client.js';

const permittedStatuses=new Set(['active','paused','closed']);
const outcomes=new Set(['completed','partial','changed','not_started']);
const validId=id=>typeof id==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
const validDate=s=>typeof s==='string'&&(!s||/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s+'T00:00:00Z')));
const str=(s,max)=>typeof s==='string'&&s.length<=max;
export function validRecord(r){
  return !!r&&typeof r==='object'&&!Array.isArray(r)&&validId(r.id)&&str(r.title,500)&&r.title.trim().length>0
    &&str(r.nextStep,1000)&&r.nextStep.trim().length>0&&str(r.expectedOutcome,1000)
    &&validDate(r.reviewDate)&&permittedStatuses.has(r.status)
    &&typeof r.createdAt==='string'&&Number.isFinite(Date.parse(r.createdAt))
    &&typeof r.updatedAt==='string'&&Number.isFinite(Date.parse(r.updatedAt))
    &&Array.isArray(r.checkIns)&&r.checkIns.length<=500&&r.checkIns.every(c=>
      c&&validId(c.id)&&typeof c.at==='string'&&Number.isFinite(Date.parse(c.at))
      &&outcomes.has(c.outcome)&&str(c.reported,2000)&&c.reported.trim().length>0
      &&str(c.nextStep,1000)&&validDate(c.nextReviewDate));
}
function config(){
  const raw=process.env.MYIXO_PRIVATE_SUPABASE_URL;
  const key=process.env.MYIXO_PRIVATE_SUPABASE_SECRET_KEY;
  if(!raw||!key)return null;
  let url;
  try{url=new URL(raw)}catch{return null}
  if(url.protocol!=='https:'||!url.hostname.endsWith('.supabase.co')||url.pathname!=='/'&&url.pathname!=='')return null;
  // Pin to the dedicated project, never the ATOM shared or AdLift databases.
  if(['fsoaqrfotefiobqyfgiq.supabase.co','cvmbedawcgsjihphbvls.supabase.co'].includes(url.hostname))return null;
  return {base:url.origin,key};
}
async function privateQuery(cfg,method,filter='',body){
  const response=await fetch(cfg.base+'/rest/v1/myixo_decisions'+(filter?'?'+filter:''),{
    method,cache:'no-store',signal:AbortSignal.timeout(10000),
    headers:{'apikey':cfg.key,'Content-Type':'application/json','Prefer':'return=representation'},
    ...(body===undefined?{}:{body:JSON.stringify(body)})
  });
  if(!response.ok)throw new Error('Private store HTTP '+response.status);
  return response.json().catch(()=>[]);
}
const filterOwner=owner=>'owner_id=eq.'+encodeURIComponent(owner);
const filterRow=(owner,id,revision)=>filterOwner(owner)+'&id=eq.'+encodeURIComponent(id)+(revision===undefined?'':'&revision=eq.'+revision);
function error(res,status,message){return res.status(status).json({error:message})}
export async function decisionStorage(req,res){
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  const cfg=config();
  if(!cfg)return error(res,503,'Private My iXo storage is not configured. No decision was saved.');
  const session=await ixoFetch(req,res,'/auth/me',{method:'GET'}).catch(()=>null);
  if(!session?.ok)return error(res,401,'iXo sign-in required');
  const me=await session.json().catch(()=>null);
  const owner=String(me?.id||'');
  if(!owner||owner.length>256)return error(res,401,'Verified account identity required');
  const body=req.body||{};
  try{
    if(req.method==='GET'){
      const id=req.query?.id;
      if(id&&!validId(id))return error(res,400,'Invalid decision ID');
      const rows=await privateQuery(cfg,'GET',filterOwner(owner)+(id?'&id=eq.'+id:'')+'&select=id,revision,record,updated_at&order=updated_at.desc&limit=100');
      return res.status(200).json({items:rows.map(x=>({...x.record,revision:x.revision}))});
    }
    if(req.method==='POST'){
      if(body.action!=='create')return error(res,400,'Unknown storage action');
      const record=body.record;
      if(!validRecord(record))return error(res,400,'Invalid decision record');
      const rows=await privateQuery(cfg,'POST','',{id:record.id||randomUUID(),owner_id:owner,revision:1,record});
      return res.status(201).json({item:{...rows[0].record,revision:rows[0].revision}});
    }
    if(req.method==='PATCH'){
      const {id,revision,record}=body;
      if(!validId(id)||!Number.isSafeInteger(revision)||revision<1||!validRecord(record)||record.id!==id)
        return error(res,400,'A valid record and expected revision are required');
      // No blind upsert; ownership plus revision are part of the filter.
      const rows=await privateQuery(cfg,'PATCH',filterRow(owner,id,revision),
        {record,revision:revision+1,updated_at:new Date().toISOString()});
      if(!rows.length)return error(res,409,'This decision changed or is unavailable. Reload before editing.');
      return res.status(200).json({item:{...rows[0].record,revision:rows[0].revision}});
    }
    if(req.method==='DELETE'){
      const {id,revision}=body;
      if(!validId(id)||!Number.isSafeInteger(revision)||revision<1)
        return error(res,400,'Valid decision ID and revision required');
      const rows=await privateQuery(cfg,'DELETE',filterRow(owner,id,revision));
      if(!rows.length)return error(res,409,'This decision changed or is unavailable.');
      return res.status(200).json({deleted:true,id});
    }
    return error(res,405,'Method not allowed');
  }catch{return error(res,503,'Private decision storage is unavailable. No save was confirmed.')}
}
