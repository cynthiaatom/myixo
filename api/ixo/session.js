const BASE='https://api.ai.atqm.us/api/v1';
const cookies=req=>Object.fromEntries((req.headers.cookie||'').split(';').map(x=>x.trim().split('=').map(decodeURIComponent)).filter(x=>x.length===2));
export default async function handler(req,res){
  const c=cookies(req),token=c.ixo_access;
  if(!token) return res.status(401).json({connected:false});
  const r=await fetch(BASE+'/auth/me',{headers:{authorization:`Bearer ${token}`}});
  if(!r.ok) return res.status(401).json({connected:false});
  const me=await r.json();
  return res.status(200).json({connected:true,user:{email:me.email,full_name:me.full_name,plan:me.plan}});
}