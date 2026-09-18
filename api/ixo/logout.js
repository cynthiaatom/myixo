const BASE='https://api.ai.atqm.us/api/v1';
const cookies=req=>Object.fromEntries((req.headers.cookie||'').split(';').map(x=>x.trim().split('=').map(decodeURIComponent)).filter(x=>x.length===2));
export default async function handler(req,res){
  const c=cookies(req);
  if(c.ixo_access) await fetch(BASE+'/auth/logout',{method:'POST',headers:{authorization:`Bearer ${c.ixo_access}`,'content-type':'application/json'},body:JSON.stringify({refresh_token:c.ixo_refresh||null})}).catch(()=>{});
  res.setHeader('Set-Cookie',['ixo_access=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0','ixo_refresh=; HttpOnly; Secure; SameSite=Strict; Path=/api/ixo; Max-Age=0']);
  return res.status(200).json({connected:false});
}