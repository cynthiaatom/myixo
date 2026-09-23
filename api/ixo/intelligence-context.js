import {ixoFetch,errorDetail} from '../../lib/ixo-client.js';

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store, no-cache, must-revalidate');
  if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
  try{
    const r=await ixoFetch(req,res,'/conversation/map',{method:'GET',headers:{'X-UI-Locale':'en'}});
    const raw=await r.json().catch(()=>({}));
    if(!r.ok)return res.status(r.status).json({error:errorDetail(raw)||'Could not load iXo intelligence context'});
    return res.status(200).json({
      revision:raw?.revision??null,
      personal_map:raw?.personal_map??null,
      pending_facts:raw?.pending_facts??null,
      hypotheses:raw?.hypotheses??null,
      variants:raw?.variants??null,
      checks:raw?.checks??null,
      verdicts:raw?.verdicts??null
    });
  }catch{
    return res.status(500).json({error:'Could not load iXo intelligence context'});
  }
}
