const BASE='https://api.ai.atqm.us/api/v1';
const CATS=new Set(['psychology','health','relationships','family','work','finance','development','rest','values','environment']);
const token=req=>{const m=(req.headers.cookie||'').match(/(?:^|; )ixo_access=([^;]+)/);return m?decodeURIComponent(m[1]):null};
const headers=t=>({authorization:`Bearer ${t}`,'content-type':'application/json','X-UI-Locale':'en'});

const findStructured=node=>{
 if(!node||typeof node!=='object')return null;
 const rows=Array.isArray(node.categories)?node.categories:null;
 if(rows&&rows.some(x=>CATS.has(String(x?.id||''))))return node;
 for(const v of Object.values(node)){const hit=findStructured(v);if(hit)return hit}
 return null;
};
const findKey=(node,key)=>{
 if(!node||typeof node!=='object')return null;
 if(typeof node[key]==='string')return node[key];
 for(const v of Object.values(node)){const x=findKey(v,key);if(x)return x}
 return null;
};
const structuredFromHistory=h=>{
 const items=Array.isArray(h?.items)?h.items:[];
 for(const item of items){
  const events=Array.isArray(item?.events)?item.events:[];
  for(let i=events.length-1;i>=0;i--){
   const hit=findStructured(events[i]?.payload||events[i]);
   if(hit)return hit;
  }
 }
 return null;
};

export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store, no-cache, must-revalidate');
 const t=token(req);if(!t)return res.status(401).json({error:'Not connected'});
 try{
  const rawR=await fetch(BASE+'/conversation/map',{headers:headers(t),cache:'no-store'});
  const raw=await rawR.json().catch(()=>({}));
  if(!rawR.ok)return res.status(rawR.status).json({error:raw?.detail||'Could not load Personal Map'});
  const direct=findStructured(raw);if(direct)return res.status(200).json(direct);

  // iXo's visible 10-area Personal Map is emitted by the continuous conversation
  // as a structured tool result. Reuse the most recent one instead of guessing
  // coverage from the lower-level 12-domain memory payload.
  let open={};
  try{
   const or=await fetch(BASE+'/conversation/open',{method:'POST',headers:headers(t),cache:'no-store'});
   open=await or.json().catch(()=>({}));
   const inOpen=findStructured(open);if(inOpen)return res.status(200).json(inOpen);
  }catch{}

  const ids=[];
  const openChat=findKey(open,'chat_id');if(openChat)ids.push(openChat);
  try{
   const ar=await fetch(BASE+'/chats/active',{headers:headers(t),cache:'no-store'});
   const ad=await ar.json().catch(()=>({}));
   if(ar.ok&&Array.isArray(ad?.chat_ids))ids.push(...ad.chat_ids);
  }catch{}
  try{
   const cr=await fetch(BASE+'/chats?limit=12&offset=0',{headers:headers(t),cache:'no-store'});
   const cd=await cr.json().catch(()=>({}));
   if(cr.ok&&Array.isArray(cd?.items))ids.push(...cd.items.map(x=>x?.id).filter(Boolean));
  }catch{}

  for(const chatId of [...new Set(ids)].slice(0,8)){
   const hr=await fetch(BASE+`/chats/${chatId}/history?limit=20&offset=0&include_details=true`,{headers:headers(t),cache:'no-store'});
   const h=await hr.json().catch(()=>({}));
   if(!hr.ok)continue;
   const structured=structuredFromHistory(h);
   if(structured)return res.status(200).json(structured);
  }

  return res.status(200).json(raw);
 }catch{
  return res.status(500).json({error:'Could not load Personal Map'});
 }
}