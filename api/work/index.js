import {parseCookies,refreshSession} from '../../lib/ixo-client.js';
const EDGE='https://wmuwtgaxfihutroqiaqj.supabase.co/functions/v1/myixo-work';
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 res.setHeader('X-Content-Type-Options','nosniff');
 if(!['GET','POST','PATCH','DELETE'].includes(req.method))return res.status(405).json({error:'Method not allowed'});
 const cookies=parseCookies(req);
 let token=cookies.ixo_access;
 if(!token){try{token=(await refreshSession(req,res))?.access_token}catch{}}
 if(!token)return res.status(401).json({error:'Sign in to iXo to save My Work'});
 const q=new URLSearchParams();
 for(const k of ['resource','workspace','id'])if(typeof req.query?.[k]==='string')q.set(k,req.query[k]);
 const call=t=>fetch(EDGE+'?'+q.toString(),{method:req.method,headers:{authorization:'Bearer '+t,'content-type':'application/json'},body:req.method==='GET'?undefined:JSON.stringify(req.body||{}),signal:AbortSignal.timeout(12000),cache:'no-store'});
 try{
  let r=await call(token);
  if(r.status===401&&cookies.ixo_refresh){const fresh=await refreshSession(req,res);if(fresh?.access_token)r=await call(fresh.access_token)}
  const data=await r.json().catch(()=>({error:'Work storage returned an invalid response'}));
  return res.status(r.status).json(data);
 }catch{return res.status(503).json({error:'Work storage temporarily unavailable'})}
}
