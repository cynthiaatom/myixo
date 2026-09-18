const BASE='https://api.ai.atqm.us/api/v1';
export default async function handler(req,res){
  if(req.method!=='POST') return res.status(405).json({error:'Method not allowed'});
  const {email,password}=req.body||{};
  if(!email||!password) return res.status(400).json({error:'Email and password are required'});
  const body=new URLSearchParams({username:String(email),password:String(password)});
  const r=await fetch(BASE+'/auth/login',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body});
  const data=await r.json().catch(()=>({}));
  if(!r.ok) return res.status(r.status).json({error:data.detail||'Unable to sign in to iXo'});
  const secure=process.env.NODE_ENV==='production'?'; Secure':'';
  res.setHeader('Set-Cookie',[
    `ixo_access=${encodeURIComponent(data.access_token)}; HttpOnly${secure}; SameSite=Strict; Path=/; Max-Age=1800`,
    `ixo_refresh=${encodeURIComponent(data.refresh_token)}; HttpOnly${secure}; SameSite=Strict; Path=/api/ixo; Max-Age=2592000`
  ]);
  const me=await fetch(BASE+'/auth/me',{headers:{authorization:`Bearer ${data.access_token}`}}).then(x=>x.json()).catch(()=>null);
  return res.status(200).json({connected:true,user:me&&{email:me.email,full_name:me.full_name,plan:me.plan}});
}