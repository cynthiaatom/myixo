import {ixoFetch,errorDetail} from '../../lib/ixo-client.js';

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store, no-cache, must-revalidate');
  try{
    if(req.method==='GET'){
      const limit=Math.min(100,Math.max(1,Number(req.query?.limit||100)));
      const cursor=String(req.query?.cursor||'').trim();
      const qs='?limit='+limit+(cursor?'&cursor='+encodeURIComponent(cursor):'');
      const r=await ixoFetch(req,res,'/profile/memory'+qs,{method:'GET'});
      const data=await r.json().catch(()=>({}));
      if(!r.ok)return res.status(r.status).json({error:errorDetail(data)||'Could not load iXo memory'});
      return res.status(200).json(data);
    }

    const id=String(req.body?.id||req.query?.id||'').trim();
    if(!id)return res.status(400).json({error:'Memory id is required'});

    if(req.method==='PATCH'){
      const expectedRevision=Number(req.body?.expected_revision||0);
      const value=String(req.body?.value||'').trim();
      if(expectedRevision<1||!value)return res.status(400).json({error:'Current revision and updated value are required'});
      const r=await ixoFetch(req,res,'/profile/memory/'+encodeURIComponent(id),{
        method:'PATCH',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({expected_revision:expectedRevision,value:value.slice(0,4000)})
      });
      const data=await r.json().catch(()=>({}));
      if(!r.ok)return res.status(r.status).json({error:errorDetail(data)||'Could not update iXo memory'});
      return res.status(200).json(data);
    }

    if(req.method==='DELETE'){
      const r=await ixoFetch(req,res,'/profile/memory/'+encodeURIComponent(id),{method:'DELETE'});
      if(!r.ok){
        const data=await r.json().catch(()=>({}));
        return res.status(r.status).json({error:errorDetail(data)||'Could not remove iXo memory'});
      }
      return res.status(204).end();
    }

    return res.status(405).json({error:'Method not allowed'});
  }catch{
    return res.status(500).json({error:'Could not access iXo memory'});
  }
}
