import {ixoFetch,errorDetail} from '../../lib/ixo-client.js';

const kinds=new Set(['message','answer','fact','profile_fact']);

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store, no-cache, must-revalidate');
  if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
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
