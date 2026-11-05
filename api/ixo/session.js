import {ixoFetch,errorDetail} from '../../lib/ixo-client.js';

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store, no-cache, must-revalidate');
  if(req.query?.resource==='decision-capabilities'){
    if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
    try{
      const session=await ixoFetch(req,res,'/auth/me',{method:'GET'});
      if(!session.ok)return res.status(401).json({error:'Sign in to iXo first'});
      const [capabilities,projects]=await Promise.all([
        ixoFetch(req,res,'/capabilities',{method:'GET'}),
        ixoFetch(req,res,'/projects?limit=1',{method:'GET'})
      ]);
      const data=capabilities.ok?await capabilities.json().catch(()=>({})):{};
      const features=data&&typeof data.features==='object'?data.features:{};
      const featureKeys=Object.keys(features).filter(k=>/decision|goal|task|action|project|file/i.test(k));
      return res.status(200).json({
        source:'authenticated iXo backend',
        capability_http_status:capabilities.status,
        projects_http_status:projects.status,
        feature_flags:Object.fromEntries(featureKeys.map(k=>[k,typeof features[k]==='boolean'?features[k]:null])),
        dedicated_decision_contract_verified:false,
        note:'Feature flags and project access do not establish a structured decision/check-in storage contract. No data was written.'
      });
    }catch{return res.status(503).json({error:'Native capability check unavailable; no data was written'})}
  }
  if(req.method==='POST'){
    const action=String(req.body?.action||'');
    if(action==='request_verified_email'){
      const email=String(req.body?.email||'').trim();
      if(!email)return res.status(400).json({error:'Contact email is required'});
      const r=await ixoFetch(req,res,'/auth/verified-email/request',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email})});
      const d=await r.json().catch(()=>({}));
      if(!r.ok)return res.status(r.status).json({error:errorDetail(d)||'Could not send verification code',code:d?.code||d?.detail?.code||null});
      return res.status(202).json({sent:true});
    }
    if(action==='confirm_verified_email'){
      const code=String(req.body?.code||'').trim();
      if(!/^[0-9]{6}$/.test(code))return res.status(400).json({error:'Enter the 6-digit verification code'});
      const r=await ixoFetch(req,res,'/auth/verified-email/confirm',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({code})});
      const d=await r.json().catch(()=>({}));
      if(!r.ok)return res.status(r.status).json({error:errorDetail(d)||'Could not confirm contact email',code:d?.code||d?.detail?.code||null});
      return res.status(200).json({confirmed:true,verified_email_required:typeof d?.verified_email_required==='boolean'?d.verified_email_required:null});
    }
    return res.status(400).json({error:'Unsupported session action'});
  }
  if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
  const r=await ixoFetch(req,res,'/auth/me',{method:'GET'});
  if(!r.ok)return res.status(401).json({connected:false});
  const me=await r.json().catch(()=>null);
  return res.status(200).json({connected:true,user:me&&{email:me.email,full_name:me.full_name,plan:me.plan}});
}
