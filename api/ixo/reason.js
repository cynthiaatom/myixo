import {randomUUID} from 'node:crypto';
import {ixoFetch,errorDetail} from '../../lib/ixo-client.js';

const STOP=new Set('about after again also because been before being between both could does doing during each from further have having into itself just more most other over same should some such than that their them then there these they this those through under very what when where which while who will with would your yourself'.split(' '));
const tokens=s=>new Set(String(s||'').toLowerCase().match(/[a-z0-9]{3,}/g)?.filter(x=>!STOP.has(x))||[]);
const terminal=s=>['completed','failed','cancelled','canceled'].includes(String(s||'').toLowerCase());
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

async function loadMemory(req,res){
  const out=[];let cursor='',profileRevision=0,indexStatus='unknown';
  for(let page=0;page<10;page++){
    const path='/profile/memory?limit=100'+(cursor?'&cursor='+encodeURIComponent(cursor):'');
    const r=await ixoFetch(req,res,path,{method:'GET'});
    const d=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(errorDetail(d)||'Could not load profile memory');
    if(Array.isArray(d.items))out.push(...d.items);
    profileRevision=Number(d.profile_revision||profileRevision);
    indexStatus=String(d.index_status||indexStatus);
    cursor=String(d.next_cursor||'');
    if(!cursor)break;
  }
  return {items:out,profileRevision,indexStatus};
}

function categoryCounts(memory){
  const counts={};
  for(const f of memory)counts[String(f.category||'other')]=(counts[String(f.category||'other')]||0)+1;
  return counts;
}

function selectRelevant(memory,query,mode,max=24){
  const q=tokens(query);
  const now=Date.now();
  const scored=memory.map((f,i)=>{
    const category=String(f.category||'other').toLowerCase();
    const ft=tokens(category+' '+(f.value||''));
    let score=0;
    for(const x of q)if(ft.has(x))score+=4;
    if(q.has(category))score+=6;
    if(f.status==='needs_clarification')score+=mode==='mirror'||mode==='today'?7:2;
    if(f.source?.id)score+=1;
    const age=Math.max(0,(now-new Date(f.updated_at||0).getTime())/86400000);
    if(age<30)score+=3; else if(age<180)score+=2; else if(age<365)score+=1;
    return {f,score,i,category};
  });
  if(q.size){
    const positive=scored.filter(x=>x.score>0).sort((a,b)=>b.score-a.score||a.i-b.i);
    return positive.slice(0,max).map(x=>x.f);
  }
  // TODAY/MIRROR have no user query. Give reasoning broad but bounded coverage:
  // unresolved + recent facts, then one representative from each remaining category.
  const chosen=[],seen=new Set();
  for(const x of scored.sort((a,b)=>b.score-a.score||new Date(b.f.updated_at)-new Date(a.f.updated_at))){
    if(chosen.length>=max)break;
    if(x.f.status==='needs_clarification'||!seen.has(x.category)){
      chosen.push(x.f);seen.add(x.category);
    }
  }
  for(const x of scored.sort((a,b)=>b.score-a.score)){
    if(chosen.length>=max)break;
    if(!chosen.some(f=>f.id===x.f.id))chosen.push(x.f);
  }
  return chosen;
}

async function createChat(req,res,title){
  const r=await ixoFetch(req,res,'/chats',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({title,project_id:null})});
  const d=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(errorDetail(d)||'Could not create reasoning chat');
  return d;
}

async function startRun(req,res,chatId,prompt){
  const rr=await ixoFetch(req,res,'/chats/'+encodeURIComponent(chatId)+'/runs',{
    method:'POST',
    headers:{'content-type':'application/json','X-UI-Locale':'en','Idempotency-Key':String(req.headers['x-idempotency-key']||randomUUID())},
    body:JSON.stringify({prompt,locale:'en',max_steps:20})
  });
  const run=await rr.json().catch(()=>({}));
  return {response:rr,run};
}

function contractFor(mode){
  if(mode==='today')return {items:[{title:'',observation:'',why_it_matters:'',known:[],inferred:[],unknown:[],evidence_refs:[],next_question:''}]};
  if(mode==='mirror')return {findings:[{type:'MISSING INFORMATION',observation:'',why_noticed:'',known:[],inferred:[],unknown:[],evidence_refs:[],resolving_question:''}]};
  if(mode==='decision')return {summary:'',known_context:[],goals_affected:[],constraints:[],options:[],assumptions:[],unknowns:[],tradeoffs:[],risks_dependencies:[],what_would_change:[],clarifying_questions:[],evidence_refs:[]};
  return {answer:'',context_used:[],assumptions:[],missing_information:[],why_context_changed_answer:null,evidence_refs:[]};
}

function instructionFor(mode){
  if(mode==='today')return 'Answer: What deserves my attention? Return 1-5 meaningful items only when supported. An empty items array is valid after evaluating the supplied context. Do not create urgency merely because a memory exists.';
  if(mode==='mirror')return 'Look only for observable contradiction, missing information, neglected priority (only with activity evidence), dependency, stale assumption, loose end, or goal conflict. No diagnosis or mind-reading. An empty findings array is valid.';
  if(mode==='decision')return 'Help the user see the decision clearly. Do not choose for the user. Distinguish user-entered assumptions from stored facts and derived reasoning.';
  return 'Answer the user question. Use personal context only when it materially improves the answer; otherwise say it did not materially change the answer.';
}

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store, no-cache, must-revalidate');
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  const mode=String(req.body?.mode||'').trim();
  if(!['today','mirror','personalized','decision'].includes(mode))return res.status(400).json({error:'Unsupported reasoning mode'});

  const question=String(req.body?.question||req.body?.decision||'').trim();
  if(['personalized','decision'].includes(mode)&&!question)return res.status(400).json({error:'A question or decision is required'});

  try{
    const loaded=await loadMemory(req,res);
    const desired=String(req.body?.desired_outcome||'').trim();
    const options=Array.isArray(req.body?.options)?req.body.options.map(String).filter(Boolean).slice(0,12):[];
    const assumptions=Array.isArray(req.body?.assumptions)?req.body.assumptions.map(String).filter(Boolean).slice(0,20):[];
    const query=[question,desired,...options,...assumptions].join(' ');
    const relevant=selectRelevant(loaded.items,query,mode,mode==='today'||mode==='mirror'?30:18);
    const evidence=relevant.map(f=>({id:f.id,category:f.category,value:f.value,status:f.status,revision:f.revision,updated_at:f.updated_at,source:f.source}));
    const context=relevant.length?relevant.map(f=>'['+f.id+'] '+f.category+': '+f.value).join('\n'):'No stored profile memory was selected as relevant. Do not force personalization or findings.';
    const contextStatus=relevant.length?'ready':'insufficient_context';

    const prompt=[
      'You are the bounded reasoning layer for the INZO application, using iXo as the underlying personal intelligence system.',
      'Use only the verified personal context supplied below plus the user input. Do not call memory, Personal Map, connected-app, web, file, or other tools.',
      'Every personal claim must be supported by a supplied memory ID or explicit user input. Evidence refs MUST contain only memory IDs actually relied upon.',
      'Do not invent provenance, confidence scores, activity, goals, constraints, changes, urgency, or external data.',
      'Separate known facts, inference, and unknowns. If evidence is insufficient, say so rather than manufacturing a result.',
      instructionFor(mode),
      '',
      'VERIFIED STORED PROFILE MEMORY:',
      context,
      '',
      'USER INPUT:',
      question?'Question/decision: '+question:'No direct user question; evaluate the supplied context for this feature.',
      desired?'Desired outcome: '+desired:'',
      options.length?'Options: '+options.join(' | '):'',
      assumptions.length?'User-entered assumptions: '+assumptions.join(' | '):'',
      '',
      'Return valid JSON only matching this shape:',
      JSON.stringify(contractFor(mode))
    ].filter(Boolean).join('\n');

    const title='INZO · '+({today:'Today',mirror:'Mirror',personalized:'Ask',decision:'Decision Lab'}[mode]);
    const chat=await createChat(req,res,title);
    const {response:rr,run}=await startRun(req,res,chat.id,prompt);
    if(!rr.ok){
      // Do not disguise conflicts as zero findings. Preserve the chat so the user can inspect it.
      return res.status(rr.status).json({error:errorDetail(run)||'Could not start iXo reasoning',code:run?.code||null,chat_id:chat.id,recoverable:rr.status===409});
    }
    return res.status(202).json({
      run_id:run.id,chat_id:chat.id,status:run.status,evidence,
      context_status:contextStatus,
      diagnostics:{memory_count:loaded.items.length,selected_count:relevant.length,category_counts:categoryCounts(loaded.items),profile_revision:loaded.profileRevision,index_status:loaded.indexStatus}
    });
  }catch(e){
    return res.status(500).json({error:e instanceof Error?e.message:'Could not start iXo reasoning'});
  }
}
