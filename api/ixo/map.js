const BASE='https://api.ai.atqm.us/api/v1';
const token=req=>{const m=(req.headers.cookie||'').match(/(?:^|; )ixo_access=([^;]+)/);return m?decodeURIComponent(m[1]):null};
export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store, no-cache, must-revalidate');
  const t=token(req); if(!t) return res.status(401).json({error:'Not connected'});
  const r=await fetch(BASE+'/conversation/map',{headers:{authorization:`Bearer ${t}`},cache:'no-store'});
  const data=await r.json().catch(()=>({}));
  if(!r.ok) return res.status(r.status).json({error:data.detail||'Could not load Personal Map'});
  return res.status(200).json(data);
}