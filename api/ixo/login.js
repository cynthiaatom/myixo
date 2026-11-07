import {BASE,setSessionCookies} from '../../lib/ixo-client.js';

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method==='GET'&&req.query?.mode==='google-availability'){
    try{
      const host=String(req.headers.host||'').split(':')[0].toLowerCase();
      if(!/^[a-z0-9.-]{1,253}$/.test(host))return res.status(400).json({error:'Invalid hostname'});
      // Same public Firebase web configuration used by the official iXo frontend.
      const key='AIzaSyBkS5V8U1KccGrDGlWgYJ5k2bCJmWCf4o0';
      const [catalog,project]=await Promise.all([
        fetch(BASE+'/public/landing-catalog',{cache:'no-store',signal:AbortSignal.timeout(4000)}),
        fetch('https://identitytoolkit.googleapis.com/v1/projects?key='+encodeURIComponent(key),{cache:'no-store',signal:AbortSignal.timeout(4000)})
      ]);
      if(!catalog.ok||!project.ok)throw Error('Provider availability check failed');
      const native=await catalog.json();
      const firebase=await project.json();
      const enabled=native?.auth?.google_auth_enabled===true;
      const allowed=Array.isArray(firebase?.authorizedDomains)&&firebase.authorizedDomains.includes(host);
      return res.status(200).json({ready:enabled&&allowed,provider_enabled:enabled,domain_authorized:allowed,hostname:host});
    }catch{return res.status(503).json({error:'Could not verify Google domain authorization'});}
  }
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  // Native email-code sign-in is an alternative when the existing Firebase
  // provider has not yet authorized the My iXo hostname. Initiated only by
  // explicit user click; no credentials or codes are retained in logs.
  if(req.body?.provider==='email_code'){
    const action=req.body?.action;
    if(action==='request'){
      const email=String(req.body?.email||'').trim().toLowerCase();
      if(email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
        return res.status(400).json({error:'Enter a valid iXo account email address'});
      try{
        const check=await fetch(BASE+'/public/landing-catalog',{cache:'no-store',signal:AbortSignal.timeout(5000)});
        if(!check.ok||!(await check.json())?.auth?.email_code_enabled)
          return res.status(503).json({error:'Email code sign-in is not available at iXo'});
        const upstream=await fetch(BASE+'/auth/email-code/request',{
          method:'POST',cache:'no-store',signal:AbortSignal.timeout(12000),
          headers:{'content-type':'application/json'},
          body:JSON.stringify({email,captcha_token:null})
        });
        const result=await upstream.json().catch(()=>({}));
        if(!upstream.ok)return res.status(upstream.status===429?429:400)
          .json({error:upstream.status===429?'Too many attempts. Try later.':'iXo could not send a sign-in code. Check the email or use official iXo sign-in.'});
        if(typeof result.challenge_id!=='string'||result.challenge_id.length>200)
          return res.status(502).json({error:'iXo did not return a valid verification challenge'});
        return res.status(200).json({challenge_id:result.challenge_id,resend_after:Math.max(0,Math.min(600,Number(result.resend_after)||60))});
      }catch{return res.status(503).json({error:'iXo email verification is temporarily unavailable'});}
    }
    if(action==='confirm'){
      const challenge_id=String(req.body?.challenge_id||'');
      const code=String(req.body?.code||'');
      if(challenge_id.length<4||challenge_id.length>200||!/^\d{6}$/.test(code))
        return res.status(400).json({error:'Enter the six-digit code from your email'});
      try{
        const upstream=await fetch(BASE+'/auth/email-code/confirm',{
          method:'POST',cache:'no-store',signal:AbortSignal.timeout(12000),
          headers:{'content-type':'application/json'},
          body:JSON.stringify({challenge_id,code})
        });
        const result=await upstream.json().catch(()=>({}));
        if(!upstream.ok)return res.status(upstream.status===429?429:401).json({
          error:upstream.status===429?'Too many attempts. Try again later.':'The code was not accepted or expired.'
        });
        return finishSession(res,result);
      }catch{return res.status(503).json({error:'Could not verify this email code with iXo'});}
    }
    return res.status(400).json({error:'Unsupported verification action'});
  }
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
    return await finishSession(res,data);
  }catch{return res.status(503).json({error:'iXo authentication is temporarily unavailable'});}
}

async function finishSession(res,data){
  if(typeof data?.access_token!=='string'||typeof data?.refresh_token!=='string')
    return res.status(502).json({error:'iXo did not return a complete session'});
  const meR=await fetch(BASE+'/auth/me',{
    headers:{authorization:'Bearer '+data.access_token},cache:'no-store',signal:AbortSignal.timeout(10000)});
  if(!meR.ok)return res.status(502).json({error:'Could not verify the iXo account'});
  const me=await meR.json().catch(()=>null);
  if(!me?.id)return res.status(502).json({error:'Could not verify the iXo account'});
  setSessionCookies(res,data);
  return res.status(200).json({connected:true,user:{email:me.email,full_name:me.full_name,plan:me.plan}});
}
