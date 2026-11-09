import {ixoFetch,errorDetail} from '../../lib/ixo-client.js';

// Same-origin, authenticated diagnostic. Never log credentials or private memory.
export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  const origin=String(req.headers.origin||'');
  const host=String(req.headers.host||'');
  if(!origin||!host||!(()=>{try{return new URL(origin).host===host&&new URL(origin).protocol==='https:'}catch{return false}})())return res.status(403).json({error:'Same-origin HTTPS request required'});
  const marker='MY iXo native memory write integration test '+new Date().toISOString();
  try{
    const r=await ixoFetch(req,res,'/conversation/facts',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({value:marker,category:'work',scope:'work'})});
    const data=await r.json().catch(()=>({}));
    if(!r.ok)return res.status(r.status).json({ok:false,status:r.status,error:errorDetail(data)||'Native iXo rejected creation',validation:data?.detail||null});
    const id=String(data?.id||data?.fact?.id||data?.item?.id||'');
    return res.status(200).json({ok:true,id,marker,readback:'Not yet verified',message:'iXo accepted the test write. Check regular iXo for this marked test fact before enabling production saves.'});
  }catch{return res.status(503).json({ok:false,error:'Native iXo API unavailable'});}
}
