import {randomUUID} from 'node:crypto';
import {ixoFetch} from './ixo-client.js';

// Private PostgREST store. No personal decisions are sent to native iXo memory
// or the shared ATOM marketing database. A dedicated, approved database is required.
const enabled=()=>Boolean(process.env.MYIXO_DECISIONS_URL&&process.env.MYIXO_DECISIONS_SERVICE_KEY);
const isoDate=s=>s==null||s===''||(/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s+'T00:00:00Z')));
const text=(x,n)=>typeof x==='string'?x.trim().slice(0,n):'';
const validId=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(x);
const statuses=['active','paused','closed'];
const outcomes=['completed','partial','changed','not_started'];
const respond=(res,n,p)=>res.status(n).json(p);

async function owner(req,res){
  const r=await ixoFetch(req,res,'/auth/me',{method:'GET'});
  if(!r.ok)return null;
  const user=await r.json().catch(()=>null);
  return validId(user?.id)?user.id:null;
}
async function db(method,table,filter,body,representation=false){
  const base=process.env.MYIXO_DECISIONS_URL.replace(/\/$/,'');
  if(!/^https:\/\//i.test(base))throw new Error('Invalid configured store URL');
  const path='/rest/v1/'+table+(filter?'?'+filter:'');
  const r=await fetch(base+path,{method,cache:'no-store',headers:{
    'apikey':process.env.MYIXO_DECISIONS_SERVICE_KEY,
    'authorization':'Bearer '+process.env.MYIXO_DECISIONS_SERVICE_KEY,
    'content-type':'application/json',
    'prefer':representation?'return=representation':'return=minimal'
  },...(body===undefined?{}:{body:JSON.stringify(body)})});
  if(!r.ok)throw new Error('Private decision store returned HTTP '+r.status);
  return representation?await r.json():null;
}
const filt=(ownerId,id,version)=>'owner_id=eq.'+encodeURIComponent(ownerId)+(id?'&id=eq.'+encodeURIComponent(id):'')+(version?'&revision=eq.'+version:'');
function fields(x){
  return {title:text(x.title,500),chosen_next_step:text(x.next_step,1000),
    expected_outcome:text(x.expected_outcome,1000),review_date:x.review_date||null,
    status:x.status||'active'};
}
function dataOK(x){
  return x&&typeof x==='object'&&text(x.title,500).length>0&&text(x.next_step,1000).length>0
    &&isoDate(x.review_date)&&statuses.includes(x.status||'active');
}
export async function decisionsHandler(req,res){
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(!enabled())return respond(res,503,{error:'Permanent decision storage has not been configured. No data was saved.',code:'storage_unavailable'});
  let userId;
  try{userId=await owner(req,res)}catch{return respond(res,503,{error:'Cannot verify your iXo account'})}
  if(!userId)return respond(res,401,{error:'Sign in to iXo to access your decisions'});
  const b=req.body||{};
  const id=b.id||req.query?.id;
  const action=String(b.action||'');
  try{
    if(req.method==='GET'){
      const rows=await db('GET','myixo_decisions',filt(userId,id)+'&select=*,myixo_checkins(*)&order=updated_at.desc&limit=100',undefined,true);
      return respond(res,200,{items:rows});
    }
    if(req.method==='POST'&&action==='create'){
      if(!dataOK(b))return respond(res,400,{error:'Decision title, next step, and valid fields required'});
      const row={id:randomUUID(),owner_id:userId,...fields(b)};
      const rows=await db('POST','myixo_decisions','',row,true);
      return respond(res,201,{item:rows[0]});
    }
    if(!validId(id))return respond(res,400,{error:'Valid decision ID required'});
    if(req.method==='PATCH'){
      if(!Number.isSafeInteger(b.revision)||b.revision<1)return respond(res,400,{error:'Current revision is required'});
      if(action==='checkin'){
        if(!outcomes.includes(b.outcome)||!text(b.reported,2000)||!isoDate(b.next_review_date))return respond(res,400,{error:'Actual reported outcome and valid review date required'});
        const found=await db('GET','myixo_decisions',filt(userId,id)+'&select=id,revision&limit=1',undefined,true);
        if(!found.length)return respond(res,404,{error:'Decision not found'});
        if(found[0].revision!==b.revision)return respond(res,409,{error:'Decision changed; refresh and try again'});
        // Transactional check-in append uses a row-locked RPC to avoid partial writes.
        const base=process.env.MYIXO_DECISIONS_URL.replace(/\/$/,'');
        const rr=await fetch(base+'/rest/v1/rpc/myixo_record_checkin',{method:'POST',cache:'no-store',
          headers:{apikey:process.env.MYIXO_DECISIONS_SERVICE_KEY,authorization:'Bearer '+process.env.MYIXO_DECISIONS_SERVICE_KEY,'content-type':'application/json'},
          body:JSON.stringify({p_owner:userId,p_decision:id,p_revision:b.revision,p_outcome:b.outcome,p_reported:text(b.reported,2000),p_next_step:text(b.next_step,1000)||null,p_next_review:b.next_review_date||null})});
        if(rr.status===409)return respond(res,409,{error:'Decision changed; refresh and try again'});
        if(!rr.ok)throw Error('Check-in could not be stored');
        const rows=await db('GET','myixo_decisions',filt(userId,id)+'&select=*,myixo_checkins(*)&limit=1',undefined,true);return respond(res,200,{item:rows[0]});
      }
      const original=await db('GET','myixo_decisions',filt(userId,id)+'&select=*&limit=1',undefined,true);
      if(!original.length)return respond(res,404,{error:'Decision not found'});
      const next={...original[0],next_step:original[0].chosen_next_step,...b};
      if(!dataOK(next))return respond(res,400,{error:'Invalid decision fields'});
      const rows=await db('PATCH','myixo_decisions',filt(userId,id,b.revision),{...fields(next),revision:b.revision+1,updated_at:new Date().toISOString()},true);
      if(!rows.length)return respond(res,409,{error:'Decision changed; refresh and try again'});
      return respond(res,200,{item:rows[0]});
    }
    if(req.method==='DELETE'){
      if(!Number.isSafeInteger(b.revision)||b.revision<1)return respond(res,400,{error:'Current revision required for deletion'});
      const rows=await db('DELETE','myixo_decisions',filt(userId,id,b.revision)+'&select=id',undefined,true);
      if(!rows.length)return respond(res,409,{error:'Decision not found or changed; refresh and try again'});
      return respond(res,200,{deleted:true});
    }
    return respond(res,405,{error:'Method not allowed'});
  }catch{return respond(res,503,{error:'The private decision store is unavailable. Your changes were not confirmed.'})}
}
