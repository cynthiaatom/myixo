import {ixoFetch,errorDetail} from '../../lib/ixo-client.js';

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store, no-cache, must-revalidate');
  if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
  try{
    const r=await ixoFetch(req,res,'/profile/memory?limit=1',{method:'GET'});
    const data=await r.json().catch(()=>({}));
    if(!r.ok)return res.status(r.status).json({error:errorDetail(data)||'Could not read iXo profile status'});
    return res.status(200).json({profile_revision:Number(data?.profile_revision||0),index_status:String(data?.index_status||'unknown')});
  }catch{
    return res.status(500).json({error:'Could not read iXo profile status'});
  }
}
