import {ixoFetch} from './ixo-client.js';
const fail=(res,status,error)=>res.status(status).json({error});
export async function handleNativeBusinessProbe(req,res){
 res.setHeader('Cache-Control','no-store');
 res.setHeader('X-Content-Type-Options','nosniff');
 if(req.method!=='GET')return fail(res,405,'GET required');
 try{
  // Read-only capability inspection: do not create chats, start runs, or transmit company records.
  const [me,chats]=await Promise.all([
   ixoFetch(req,res,'/auth/me',{method:'GET'}),
   ixoFetch(req,res,'/chats?limit=1&offset=0',{method:'GET'})
  ]);
  if(me.status===401||chats.status===401)return fail(res,401,'Sign in to the existing iXo account');
  if(!me.ok||!chats.ok)return fail(res,503,'Native iXo service unavailable');
  const data=await chats.json().catch(()=>null);
  if(!data||!Array.isArray(data.items))return fail(res,502,'Native chat capability response invalid');
  return res.status(200).json({
   native_ixo_authenticated:true,
   native_chat_read_available:true,
   existing_native_reasoning_route:'/api/ixo/reason',
   dedicated_business_chat_verified:false,
   business_data_transfer_allowed:false,
   business_model_reuse_status:'requires_workspace_isolation',
   explanation:'Native iXo is reachable through the existing account. A dedicated company-scoped chat and run-ownership boundary must be verified before business records can be sent for generative reasoning.',
   external_actions_executed:false
  });
 }catch{return fail(res,503,'Native iXo compatibility check unavailable')}
}
