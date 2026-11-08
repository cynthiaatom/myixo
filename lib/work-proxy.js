import {parseCookies,refreshSession} from './ixo-client.js';
const EDGE='https://wmuwtgaxfihutroqiaqj.supabase.co/functions/v1/myixo-work';
export async function handleWork(req,res){
 res.setHeader('Cache-Control','no-store');
 res.setHeader('X-Content-Type-Options','nosniff');
 if(!['GET','POST','PATCH','DELETE'].includes(req.method))return res.status(405).json({error:'Method not allowed'});
 // Cookie-authenticated writes must originate from this exact application host.
 // SameSite cookies are defense in depth, not a replacement for an origin check.
 if(req.method!=='GET'){
  const origin=String(req.headers.origin||'');
  const host=String(req.headers.host||'').toLowerCase();
  let parsed;
  try{parsed=new URL(origin)}catch{return res.status(403).json({error:'A valid same-origin request is required'})}
  const proto=String(req.headers['x-forwarded-proto']||'https').split(',')[0].trim().toLowerCase();
  if(!host||!['https:','http:'].includes(parsed.protocol)||parsed.host.toLowerCase()!==host||
     (proto==='https'&&parsed.protocol!=='https:')||
     (proto!=='https'&&!(proto==='http'&&parsed.protocol==='http:')))
   return res.status(403).json({error:'Cross-origin business changes are not permitted'});
 }
 const cookies=parseCookies(req);
 let token=cookies.ixo_access;
 if(!token){try{token=(await refreshSession(req,res))?.access_token}catch{}}
 if(!token)return res.status(401).json({error:'Sign in to iXo to save My Work'});
 const q=new URLSearchParams();
 for(const k of ['resource','workspace','id','offset'])if(typeof req.query?.[k]==='string')q.set(k,req.query[k]);
 if(req.method!=='GET'&&!['application/json'].some(x=>String(req.headers['content-type']||'').toLowerCase().startsWith(x)))return res.status(415).json({error:'JSON required'});
 if(req.method!=='GET'&&JSON.stringify(req.body||{}).length>12000)return res.status(413).json({error:'Request too large'});
 const call=t=>fetch(EDGE+'?'+q.toString(),{method:req.method,headers:{authorization:'Bearer '+t,'content-type':'application/json'},body:req.method==='GET'?undefined:JSON.stringify(req.body||{}),signal:AbortSignal.timeout(12000),cache:'no-store'});
 try{
  let r=await call(token);
  if(r.status===401&&cookies.ixo_refresh){const fresh=await refreshSession(req,res);if(fresh?.access_token)r=await call(fresh.access_token)}
  const data=await r.json().catch(()=>({error:'Work storage returned an invalid response'}));
  return res.status(r.status).json(data);
 }catch{return res.status(503).json({error:'Work storage temporarily unavailable'})}
}
