// Dedicated My iXo project Edge Function. No browser CORS access or public database grants.
// Authentication: official iXo /auth/me on every request. The caller's access
// token is NEVER logged or persisted. PostgREST secret stays in Supabase runtime.
const json=(status:number,value:unknown)=>new Response(JSON.stringify(value),{
  status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}
});
const validId=(s:unknown)=>typeof s==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
const validDate=(s:unknown)=>typeof s==='string'&&(!s||/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s+'T00:00:00Z')));
const isString=(s:unknown,max:number)=>typeof s==='string'&&s.length<=max;
const statuses=new Set(['active','paused','closed']);
const outcomes=new Set(['completed','partial','changed','not_started']);
function validRecord(r:any){
  return r&&typeof r==='object'&&!Array.isArray(r)&&validId(r.id)
    &&isString(r.title,500)&&r.title.trim().length>0
    &&isString(r.nextStep,1000)&&r.nextStep.trim().length>0
    &&isString(r.expectedOutcome,1000)&&validDate(r.reviewDate)&&statuses.has(r.status)
    &&isString(r.createdAt,64)&&Number.isFinite(Date.parse(r.createdAt))
    &&isString(r.updatedAt,64)&&Number.isFinite(Date.parse(r.updatedAt))
    &&Array.isArray(r.checkIns)&&r.checkIns.length<=500&&r.checkIns.every((c:any)=>
      c&&validId(c.id)&&isString(c.at,64)&&Number.isFinite(Date.parse(c.at))
      &&outcomes.has(c.outcome)&&isString(c.reported,2000)&&c.reported.trim().length>0
      &&isString(c.nextStep,1000)&&validDate(c.nextReviewDate));
}
function apiKey(){
  const keys=Deno.env.get('SUPABASE_SECRET_KEYS');
  if(keys){try{const key=JSON.parse(keys)?.default;if(typeof key==='string'&&key.startsWith('sb_secret_'))return {key,modern:true}}catch{}}
  const legacy=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  return legacy?{key:legacy,modern:false}:null;
}
Deno.serve(async(req:Request)=>{
  if(!['GET','POST','PATCH','DELETE'].includes(req.method))return json(405,{error:'Method not allowed'});
  const apiBase=Deno.env.get('SUPABASE_URL');
  const credential=apiKey();
  if(!apiBase||!credential)return json(503,{error:'Private storage is not available'});
  const auth=req.headers.get('authorization')||'';
  if(!/^Bearer [^\s]{20,20000}$/.test(auth))return json(401,{error:'iXo session required'});
  // Fixed upstream. Native token is verified, not decoded or trusted locally.
  let me:any=null;
  try{
    const a=await fetch('https://api.ai.atqm.us/api/v1/auth/me',{
      method:'GET',headers:{authorization:auth},signal:AbortSignal.timeout(5000),cache:'no-store'
    });
    if(!a.ok)return json(401,{error:'iXo session expired'});
    me=await a.json();
  }catch{return json(503,{error:'iXo identity verification unavailable'})}
  const owner=String(me?.id||'');
  if(!owner||owner.length>256)return json(401,{error:'iXo account identity required'});
  let body:any={};
  if(req.method!=='GET'){
    if(Number(req.headers.get('content-length')||0)>50000)return json(413,{error:'Request too large'});
    try{const raw=await req.text();if(raw.length>50000)return json(413,{error:'Request too large'});body=JSON.parse(raw)}catch{return json(400,{error:'Invalid JSON body'})}
  }
  const url=new URL(req.url);
  const ownerFilter='owner_id=eq.'+encodeURIComponent(owner);
  const id=url.searchParams.get('id');
  if(id&&!validId(id))return json(400,{error:'Invalid decision ID'});
  let filter='',payload:any=undefined;
  if(req.method==='GET')filter=ownerFilter+(id?'&id=eq.'+id:'')+'&select=id,revision,record,updated_at&order=updated_at.desc&limit=100';
  if(req.method==='POST'){
    if(body.action!=='create'||!validRecord(body.record))return json(400,{error:'Invalid decision'});
    payload={id:body.record.id,owner_id:owner,revision:1,record:body.record};
  }
  if(req.method==='PATCH'){
    if(!validId(body.id)||body.id!==body.record?.id||!Number.isSafeInteger(body.revision)||body.revision<1||!validRecord(body.record))return json(400,{error:'Invalid update'});
    filter=ownerFilter+'&id=eq.'+body.id+'&revision=eq.'+body.revision;
    payload={record:body.record,revision:body.revision+1,updated_at:new Date().toISOString()};
  }
  if(req.method==='DELETE'){
    if(!validId(body.id)||!Number.isSafeInteger(body.revision)||body.revision<1)return json(400,{error:'Invalid deletion'});
    filter=ownerFilter+'&id=eq.'+body.id+'&revision=eq.'+body.revision;
  }
  try{
    const headers:Record<string,string>={'apikey':credential.key,'Content-Type':'application/json','Prefer':'return=representation'};
    if(!credential.modern)headers['Authorization']='Bearer '+credential.key;
    const r=await fetch(apiBase+'/rest/v1/myixo_decisions'+(filter?'?'+filter:''),{
      method:req.method,headers,signal:AbortSignal.timeout(9000),cache:'no-store',
      ...(payload===undefined?{}:{body:JSON.stringify(payload)})
    });
    if(!r.ok)return json(503,{error:'Private storage unavailable'});
    const rows:any[]=await r.json().catch(()=>[]);
    if(req.method==='GET')return json(200,{items:rows.map(x=>({...x.record,revision:x.revision}))});
    if(req.method==='POST'){
      if(!rows.length)return json(503,{error:'Private storage did not confirm save'});
      return json(201,{item:{...rows[0].record,revision:rows[0].revision}});
    }
    if(!rows.length)return json(409,{error:'Decision has changed or is unavailable. Reload and retry.'});
    if(req.method==='DELETE')return json(200,{deleted:true,id:body.id});
    return json(200,{item:{...rows[0].record,revision:rows[0].revision}});
  }catch{return json(503,{error:'Private storage temporarily unavailable'})}
});
