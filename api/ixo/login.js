import {BASE,setSessionCookies} from '../../lib/ixo-client.js';

export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  const {email,password}=req.body||{};
  if(!email||!password)return res.status(400).json({error:'Email and password are required'});

  const body=new URLSearchParams({username:String(email),password:String(password)});
  const r=await fetch(BASE+'/auth/login',{
    method:'POST',
    headers:{'content-type':'application/x-www-form-urlencoded'},
    body,
    cache:'no-store'
  });
  const data=await r.json().catch(()=>({}));
  if(!r.ok)return res.status(r.status).json({error:typeof data?.detail==='string'?data.detail:'Unable to sign in to iXo'});
  setSessionCookies(res,data);

  const meR=await fetch(BASE+'/auth/me',{headers:{authorization:'Bearer '+data.access_token},cache:'no-store'});
  const me=await meR.json().catch(()=>null);
  return res.status(200).json({connected:true,user:me&&{email:me.email,full_name:me.full_name,plan:me.plan}});
}
