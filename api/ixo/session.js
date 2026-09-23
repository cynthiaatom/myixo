import {ixoFetch} from '../../lib/ixo-client.js';

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store, no-cache, must-revalidate');
  if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
  const r=await ixoFetch(req,res,'/auth/me',{method:'GET'});
  if(!r.ok)return res.status(401).json({connected:false});
  const me=await r.json().catch(()=>null);
  return res.status(200).json({connected:true,user:me&&{email:me.email,full_name:me.full_name,plan:me.plan}});
}
