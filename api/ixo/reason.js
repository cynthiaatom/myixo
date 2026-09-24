import {randomUUID} from 'node:crypto';
import {ixoFetch,errorDetail} from '../../lib/ixo-client.js';

const STOP=new Set('about after again also because been before being between both could does doing during each from further have having into itself just more most other over same should some such than that their them then there these they this those through under very what when where which while who will with would your yourself'.split(' '));
const tokens=s=>new Set(String(s||'').toLowerCase().match(/[a-z0-9]{3,}/g)?.filter(x=>!STOP.has(x))||[]);

async function loadMemory(req,res){
  const out=[];let cursor='',profileRevision=0,indexStatus='unknown';
  for(let page=0;page<10;page++){
    const r=await ixoFetch(req,res,'/profile/memory?limit=100'+(cursor?'&cursor='+encodeURIComponent(cursor):''),{method:'GET'}),d=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(errorDetail(d)||'Could not load profile memory');
    if(Array.isArray(d.items))out.push(...d.items);
    profileRevision=Number(d.profile_revision||profileRevision);indexStatus=String(d.index_status||indexStatus);cursor=String(d.next_cursor||'');if(!cursor)break;
  }
  return {items:out,profileRevision,indexStatus};
}
function categoryCounts(memory){const counts={};for(const f of memory)counts[String(f.category||'other')]=(counts[String(f.category||'other')]||0)+1;return counts}
function selectRelevant(memory,query,mode,max=24){
  const q=tokens(query),now=Date.now();
  const scored=memory.map((f,i)=>{const category=String(f.category||'other').toLowerCase(),ft=tokens(category+' '+(f.value||''));let lexical=0;for(const x of q)if(ft.has(x))lexical+=4;if(q.has(category))lexical+=6;let score=lexical;if(f.status==='needs_clarification')score+=mode==='mirror'||mode==='today'?7:2;if(f.source?.id)score+=1;const age=Math.max(0,(now-new Date(f.updated_at||0).getTime())/86400000);if(age<30)score+=3;else if(age<180)score+=2;else if(age<365)score+=1;return{f,score,lexical,i,category}});
  if(q.size)return scored.filter(x=>x.lexical>0).sort((a,b)=>b.score-a.score||a.i-b.i).slice(0,max).map(x=>x.f);
  const chosen=[],seen=new Set();for(const x of scored.sort((a,b)=>b.score-a.score||new Date(b.f.updated_at)-new Date(a.f.updated_at))){if(chosen.length>=max)break;if(x.f.status==='needs_clarification'||!seen.has(x.category)){chosen.push(x.f);seen.add(x.category)}}for(const x of scored.sort((a,b)=>b.score-a.score)){if(chosen.length>=max)break;if(!chosen.some(f=>f.id===x.f.id))chosen.push(x.f)}return chosen;
}
async function resolvePersistentChat(req,res){
  const r=await ixoFetch(req,res,'/chats?limit=200&offset=0',{method:'GET'}),d=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(errorDetail(d)||'Could not resolve persistent iXo chat');
  const chats=Array.isArray(d.items)?d.items.filter(x=>x?.id):[];
  if(!chats.length){const e=new Error('No established persistent iXo chat is available.');e.code='no_persistent_chat';throw e}
  // Native list is most-recently-updated first. Prefer an established chat with run history;
  // never create a replacement here. This also works defensively when an account has >1 chat.
  for(const chat of chats){
    const rr=await ixoFetch(req,res,'/chats/'+encodeURIComponent(chat.id)+'/runs?limit=1&offset=0',{method:'GET'}),rd=await rr.json().catch(()=>({}));
    if(rr.ok&&Array.isArray(rd.items)&&rd.items.length)return {chat,source:'most_recent_chat_with_run'};
  }
  const e=new Error('No established persistent iXo chat with run history is available.');e.code='no_persistent_chat';throw e;
}
async function startRun(req,res,chatId,prompt){
  const rr=await ixoFetch(req,res,'/chats/'+encodeURIComponent(chatId)+'/runs',{method:'POST',headers:{'content-type':'application/json','X-UI-Locale':'en','Idempotency-Key':String(req.headers['x-idempotency-key']||randomUUID())},body:JSON.stringify({prompt,model_config_id:null,atomus_model_id:null,max_steps:20,adaptive_step_limit:false,attachment_ids:[],locale:'en'})}),run=await rr.json().catch(()=>({}));return{response:rr,run};
}
function contractFor(mode){if(mode==='today')return{items:[{title:'',observation:'',why_it_matters:'',known:[],inferred:[],unknown:[],evidence_refs:[],next_question:''}]};if(mode==='mirror')return{findings:[{type:'MISSING INFORMATION',observation:'',why_noticed:'',known:[],inferred:[],unknown:[],evidence_refs:[],resolving_question:''}]};if(mode==='decision')return{summary:'',known_context:[],goals_affected:[],constraints:[],options:[],assumptions:[],unknowns:[],tradeoffs:[],risks_dependencies:[],what_would_change:[],clarifying_questions:[],evidence_refs:[]};return{answer:'',context_used:[],assumptions:[],missing_information:[],why_context_changed_answer:null,evidence_refs:[]}}
function instructionFor(mode){if(mode==='today')return'CURRENT TASK = TODAY. Answer: What deserves my attention? Return 1-5 meaningful items only when supported. An empty items array is a legitimate zero only after evaluating the supplied relevant context. Do not create urgency merely because a memory exists.';if(mode==='mirror')return'CURRENT TASK = MIRROR. Look only for observable contradiction, missing information, neglected priority (only with activity evidence), dependency, stale assumption, loose end, or goal conflict. No diagnosis or mind-reading. An empty findings array is valid.';if(mode==='decision')return'CURRENT TASK = DECIDE. Help the user see this supplied decision clearly. Do not choose for the user. Distinguish user-entered assumptions from stored facts and derived reasoning.';return'CURRENT TASK = ASK. Answer the user actual question below. Use supplied personal context only when it materially improves the answer; otherwise say it did not materially change the answer.'}

export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store, no-cache, must-revalidate');if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
 const mode=String(req.body?.mode||'').trim();if(!['today','mirror','personalized','decision'].includes(mode))return res.status(400).json({error:'Unsupported reasoning mode'});\n const allowedSources=new Set(['today','mirror','ask','decide','why','evidence','think_through']);\n const requestedSource=String(req.body?.reason_source||mode).trim();\n const reasonSource=allowedSources.has(requestedSource)?requestedSource:mode;\n const log=(event,extra={})=>console.info(JSON.stringify({event,reason_source:reasonSource,mode,...extra}));
 const question=String(req.body?.question||req.body?.decision||'').trim();if(['personalized','decision'].includes(mode)&&!question)return res.status(400).json({error:'A question or decision is required'});
 try{
  const loaded=await loadMemory(req,res),desired=String(req.body?.desired_outcome||'').trim(),options=Array.isArray(req.body?.options)?req.body.options.map(String).filter(Boolean).slice(0,12):[],assumptions=Array.isArray(req.body?.assumptions)?req.body.assumptions.map(String).filter(Boolean).slice(0,20):[];
  const relevant=selectRelevant(loaded.items,[question,desired,...options,...assumptions].join(' '),mode,mode==='today'||mode==='mirror'?30:18),evidence=relevant.map(f=>({id:f.id,category:f.category,value:f.value,status:f.status,revision:f.revision,updated_at:f.updated_at,source:f.source})),context=relevant.length?relevant.map(f=>'['+f.id+'] '+f.category+': '+f.value).join('\n'):'No stored profile memory was selected as relevant. Do not force personalization or findings.',contextStatus=relevant.length?'ready':'insufficient_context';
  const prompt=['INZO RUN TASK BOUNDARY: Ignore task instructions from earlier runs in this persistent chat. Perform only the CURRENT TASK defined in this prompt.','You are the bounded reasoning layer for the MY iXo application, using iXo as the underlying personal intelligence system.','Use only the verified personal context supplied below plus the user input. Do not call memory, Personal Map, connected-app, web, file, or other tools.','Every personal claim must be supported by a supplied memory ID or explicit user input. Evidence refs MUST contain only memory IDs actually relied upon.','Do not invent provenance, confidence scores, activity, goals, constraints, changes, urgency, or external data.','Separate WHAT iXo KNOWS, WHAT INZO INFERRED, WHAT INZO DOES NOT KNOW, and only personal context that materially affected the result. If evidence is insufficient, say so rather than manufacturing a result.',instructionFor(mode),'','VERIFIED STORED PROFILE MEMORY:',context,'','USER INPUT:',question?'Question/decision: '+question:'No direct user question; evaluate the supplied context for this feature.',desired?'Desired outcome: '+desired:'',options.length?'Options: '+options.join(' | '):'',assumptions.length?'User-entered assumptions: '+assumptions.join(' | '):'','','Return valid JSON only matching this shape:',JSON.stringify(contractFor(mode))].filter(Boolean).join('\n');
  const resolved=await resolvePersistentChat(req,res),chatId=String(resolved.chat.id);
  const ar=await ixoFetch(req,res,'/chats/active',{method:'GET'}),ad=await ar.json().catch(()=>({}));if(!ar.ok)throw new Error(errorDetail(ad)||'Could not inspect active iXo chats');
  const active=Array.isArray(ad.chat_ids)?ad.chat_ids.map(String):[];
  if(active.includes(chatId)){log('reason_busy',{http_status:409,active_target:true});return res.status(409).json({error:'iXo is already processing in the persistent conversation.',code:'busy',state:'busy',chat_id:chatId,recoverable:true})}
  const attempt=await startRun(req,res,chatId,prompt),rr=attempt.response,run=attempt.run;
  if(!rr.ok)return res.status(rr.status).json({error:errorDetail(run)||'Could not start iXo reasoning',code:run?.code||null,state:'reasoning_failed',chat_id:chatId,recoverable:rr.status===409});
  return res.status(202).json({run_id:run.id,chat_id:chatId,status:run.status,evidence,context_status:contextStatus,diagnostics:{persistent_chat_resolution:resolved.source,memory_count:loaded.items.length,selected_count:relevant.length,selected_ids:relevant.map(f=>String(f.id)),selected_category_counts:categoryCounts(relevant),category_counts:categoryCounts(loaded.items),profile_revision:loaded.profileRevision,index_status:loaded.indexStatus,active_chat_count_before_run:active.length}});
 }catch(e){return res.status(500).json({error:e instanceof Error?e.message:'Could not start iXo reasoning',code:e?.code||null,state:'reasoning_failed'})}
}
