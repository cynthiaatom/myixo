import {BASE,setSessionCookies} from '../../lib/ixo-client.js';

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  const {email,password,id_token,captcha_token,provider}=req.body||{};
  const google=provider==='google';
  if(provider&&provider!=='google')return res.status(400).json({error:'Unsupported sign-in provider'});
  const normalizedEmail=String(email||'').trim().toLowerCase();
  const rawPassword=String(password||'');
  if(google){
    if(typeof id_token!=='string'||id_token.length<100||id_token.length>20000)
      return res.status(400).json({error:'Valid Google identity token required'});
    if(captcha_token!=null&&(typeof captcha_token!=='string'||captcha_token.length>4096))
      return res.status(400).json({error:'Invalid security verification'});
  }else if(!normalizedEmail||!rawPassword)return res.status(400).json({error:'Email and password are required'});

  try{
    const r=await fetch(BASE+(google?'/auth/google':'/auth/login'),{
      method:'POST',cache:'no-store',
      headers:{'content-type':google?'application/json':'application/x-www-form-urlencoded'},
      body:google?JSON.stringify({id_token,captcha_token:captcha_token||null}):
        new URLSearchParams({username:normalizedEmail,password:rawPassword,grant_type:'password',scope:''})
    });
    const data=await r.json().catch(()=>({}));
    if(!r.ok){
      const code=String(data?.code||data?.detail?.code||'');
      const error=google&&code==='google_login_link_required'
        ?'Your iXo account needs email ownership verification before Google can be linked. Complete the Google linking flow at ixo.chat first.'
        :google?'iXo did not accept this Google sign-in. Check your account on ixo.chat.':
          r.status===401?'iXo rejected this account login. This does not prove the password is incorrect.':
          'Unable to sign in to iXo';
      return res.status([400,401,403,409,429].includes(r.status)?r.status:502).json({error,code:google?code:null});
    }
    if(typeof data?.access_token!=='string'||typeof data?.refresh_token!=='string')
      return res.status(502).json({error:'iXo did not return a complete session'});
    const meR=await fetch(BASE+'/auth/me',{
      headers:{authorization:'Bearer '+data.access_token},cache:'no-store'});
    if(!meR.ok)return res.status(502).json({error:'Could not verify the iXo account'});
    const me=await meR.json().catch(()=>null);
    if(!me?.id)return res.status(502).json({error:'Could not verify the iXo account'});
    setSessionCookies(res,data);
    return res.status(200).json({connected:true,user:{email:me.email,full_name:me.full_name,plan:me.plan}});
  }catch{return res.status(503).json({error:'iXo authentication is temporarily unavailable'});}
}
