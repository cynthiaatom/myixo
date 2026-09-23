import {ixoFetch,errorDetail} from '../../lib/ixo-client.js';

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store, no-cache, must-revalidate');
  try{
    if(req.method==='GET'){
      const limit=Math.min(100,Math.max(1,Number(req.query?.limit||100)));
      const cursor=String(req.query?.cursor||'').trim();
      const path='/profile/memory?limit='+limit+(cursor?'&cursor='+encodeURIComponent(cursor):'');
      const r=await ixoFetch(req,res,path,{method:'GET'});
      const data=await r.json().catch(()=>({}));
      if(!r.ok)return res.status(r.status).json({error:errorDetail(data)||'Could not load iXo memory'});
      return res.status(200).json(data);
    }

    if(req.method==='PATCH'){
      const {fact_id,expected_revision,value}=req.body||{};
      if(!fact_id||!expected_revision||!String(value||'').trim())return res.status(400).json({error:'fact_id, expected_revision and value are required'});
      const r=await ixoFetch(req,res,'/profile/memory/'+encodeURIComponent(String(fact_id)),{
        method:'PATCH',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({expected_revision:Number(expected_revision),value:String(value).trim().slice(0,4000)})
      });
      const data=await r.json().catch(()=>({}));
      if(!r.ok)return res.status(r.status).json({error:errorDetail(data)||'Could not update iXo memory'});
      return res.status(200).json(data);
    }

    if(req.method==='DELETE'){
      const factId=String(req.query?.fact_id||req.body?.fact_id||'').trim();
      if(!factId)return res.status(400).json({error:'fact_id is required'});
      const r=await ixoFetch(req,res,'/profile/memory/'+encodeURIComponent(factId),{method:'DELETE'});
      if(!r.ok){
        const data=await r.json().catch(()=>({}));
        return res.status(r.status).json({error:errorDetail(data)||'Could not remove iXo memory'});
      }
      return res.status(200).json({deleted:true});
    }

    return res.status(405).json({error:'Method not allowed'});
  }catch{
    return res.status(500).json({error:'Could not access iXo memory'});
  }
}
