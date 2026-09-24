import {BASE,setSessionCookies} from '../../lib/ixo-client.js';

export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  const {email,password}=req.body||{};
  const normalizedEmail=String(email||'').trim().toLowerCase();
  const rawPassword=String(password||'');
  if(!normalizedEmail||!rawPassword)return res.status(400).json({error:'Email and password are required'});

  // iXo's published OpenAPI contract is OAuth2 password flow:
  // application/x-www-form-urlencoded with email in username + password.
  const body=new URLSearchParams({username:normalizedEmail,password:rawPassword,grant_type:'password',scope:''});
  const r=await fetch(BASE+'/auth/login',{
    method:'POST',
    headers:{'content-type':'application/x-www-form-urlencoded'},
    body,
    cache:'no-store'
  });
  const data=await r.json().catch(()=>({}));
  if(!r.ok){
    const detail=typeof data?.detail==='string'?data.detail:'';
    const safe= r.status===401
      ? 'iXo rejected this account login. The app is using the current published iXo password-login contract; this does not prove that the password you entered is wrong.'
      : (detail||'Unable to sign in to iXo');
    return res.status(r.status).json({error:safe,auth_status:r.status});
  }
  setSessionCookies(res,data);

  const meR=await fetch(BASE+'/auth/me',{headers:{authorization:'Bearer '+data.access_token},cache:'no-store'});
  const me=await meR.json().catch(()=>null);
  return res.status(200).json({connected:true,user:me&&{email:me.email,full_name:me.full_name,plan:me.plan}});
}
