export const BASE='https://api.ai.atqm.us/api/v1';

export const parseCookies=req=>{
  const out={};
  for(const part of String(req.headers.cookie||'').split(';')){
    const i=part.indexOf('=');
    if(i<0)continue;
    const key=part.slice(0,i).trim();
    const value=part.slice(i+1).trim();
    if(!key)continue;
    try{out[key]=decodeURIComponent(value)}catch{out[key]=value}
  }
  return out;
};

const secure=()=>process.env.NODE_ENV==='production'?'; Secure':'';
const accessCookie=t=>'ixo_access='+encodeURIComponent(t)+'; HttpOnly'+secure()+'; SameSite=Strict; Path=/; Max-Age=1800';
const refreshCookie=t=>'ixo_refresh='+encodeURIComponent(t)+'; HttpOnly'+secure()+'; SameSite=Strict; Path=/api/ixo; Max-Age=2592000';

export const setSessionCookies=(res,tokens)=>{
  const cookies=[accessCookie(tokens.access_token),refreshCookie(tokens.refresh_token)];
  const existing=res.getHeader?.('Set-Cookie');
  if(existing)res.setHeader('Set-Cookie',[...(Array.isArray(existing)?existing:[existing]),...cookies]);
  else res.setHeader('Set-Cookie',cookies);
};

export const clearSessionCookies=res=>{
  const s=secure();
  res.setHeader('Set-Cookie',[
    'ixo_access=; HttpOnly'+s+'; SameSite=Strict; Path=/; Max-Age=0',
    'ixo_refresh=; HttpOnly'+s+'; SameSite=Strict; Path=/api/ixo; Max-Age=0'
  ]);
};

const withAuth=(token,headers={})=>({...headers,authorization:'Bearer '+token});

export async function refreshSession(req,res){
  const c=parseCookies(req);
  if(!c.ixo_refresh)return null;
  const rr=await fetch(BASE+'/auth/refresh',{
    method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify({refresh_token:c.ixo_refresh}),
    cache:'no-store'
  });
  const data=await rr.json().catch(()=>({}));
  if(!rr.ok||!data?.access_token||!data?.refresh_token){
    clearSessionCookies(res);
    return null;
  }
  setSessionCookies(res,data);
  return data;
}

export async function ixoFetch(req,res,path,options={}){
  const c=parseCookies(req);
  let access=c.ixo_access;
  if(!access){
    const fresh=await refreshSession(req,res);
    access=fresh?.access_token;
    if(!access)return new Response(JSON.stringify({detail:'Not connected'}),{status:401,headers:{'content-type':'application/json'}});
  }

  const make=token=>fetch(BASE+path,{
    ...options,
    headers:withAuth(token,options.headers||{}),
    cache:options.cache||'no-store'
  });

  let r=await make(access);
  if(r.status!==401||!c.ixo_refresh)return r;

  const fresh=await refreshSession(req,res);
  if(!fresh?.access_token)return r;
  return make(fresh.access_token);
}

export const errorDetail=data=>
  typeof data?.detail==='string'?data.detail:
  typeof data?.detail?.message==='string'?data.detail.message:
  typeof data?.message==='string'?data.message:'';
