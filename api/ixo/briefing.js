import {randomUUID} from 'node:crypto';
import {ixoFetch,errorDetail} from '../../lib/ixo-client.js';

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store, no-cache, must-revalidate');
  try{
    if(req.method==='GET'){
      const r=await ixoFetch(req,res,'/briefing/sessions/current',{method:'GET',headers:{'X-UI-Locale':'en'}});
      const data=await r.json().catch(()=>null);
      if(r.status===404)return res.status(200).json({session:null});
      if(!r.ok)return res.status(r.status).json({error:errorDetail(data)||'Could not load iXo briefing'});
      return res.status(200).json({session:data});
    }
    if(req.method==='POST'){
      const key=String(req.headers['x-idempotency-key']||randomUUID());
      const r=await ixoFetch(req,res,'/briefing/sessions',{
        method:'POST',
        headers:{'content-type':'application/json','X-UI-Locale':'en','Idempotency-Key':key},
        body:JSON.stringify({topic:req.body?.topic??null})
      });
      const data=await r.json().catch(()=>({}));
      if(!r.ok)return res.status(r.status).json({error:errorDetail(data)||'Could not start iXo briefing'});
      return res.status(201).json({session:data});
    }
    return res.status(405).json({error:'Method not allowed'});
  }catch{
    return res.status(500).json({error:'Could not access iXo briefing'});
  }
}
