import {ixoFetch,errorDetail} from '../../lib/ixo-client.js';

const allowed=new Set(['message','answer','fact','profile_fact']);
const pick=(node,key,depth=0)=>{
  if(depth>6||node==null)return null;
  if(typeof node==='object'){
    if(typeof node[key]==='string'&&node[key].trim())return node[key];
    for(const value of Object.values(node)){const hit=pick(value,key,depth+1);if(hit)return hit}
  }
  return null;
};

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store, no-cache, must-revalidate');
  if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
  const kind=String(req.query?.kind||'').trim();
  const id=String(req.query?.id||'').trim();
  if(!allowed.has(kind)||!id)return res.status(400).json({error:'Valid source kind and id are required'});
  try{
    const r=await ixoFetch(req,res,'/conversation/sources/'+encodeURIComponent(kind)+'/'+encodeURIComponent(id),{method:'GET'});
    const data=await r.json().catch(()=>({}));
    if(!r.ok)return res.status(r.status).json({error:errorDetail(data)||'Could not load memory source'});
    return res.status(200).json({
      kind,
      id,
      question_text:pick(data,'question_text'),
      text:pick(data,'text')||pick(data,'content')||pick(data,'value'),
      role:pick(data,'role'),
      created_at:pick(data,'created_at')||pick(data,'updated_at')
    });
  }catch{
    return res.status(500).json({error:'Could not load memory source'});
  }
}
