import {BASE,ixoFetch,errorDetail} from '../../lib/ixo-client.js';

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store, no-cache, must-revalidate');
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  const runId=String(req.body?.run_id||'').trim();
  if(!runId)return res.status(400).json({error:'run_id is required'});
  try{
    const r=await ixoFetch(req,res,'/auth/stream-ticket',{
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify({scope:'sse:'+runId})
    });
    const data=await r.json().catch(()=>({}));
    if(!r.ok)return res.status(r.status).json({error:errorDetail(data)||'Could not open iXo event stream'});
    return res.status(200).json({url:BASE+'/runs/'+encodeURIComponent(runId)+'/events?ticket='+encodeURIComponent(data.ticket),expires_in:data.expires_in});
  }catch{
    return res.status(500).json({error:'Could not open iXo event stream'});
  }
}
