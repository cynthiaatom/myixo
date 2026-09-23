import {randomUUID} from 'node:crypto';
import {ixoFetch,errorDetail} from '../../lib/ixo-client.js';

const STOP=new Set('about after again also because been before being between both could does doing during each from further have having into itself just more most other over same should some such than that their them then there these they this those through under very what when where which while who will with would your yourself'.split(' '));
const tokens=s=>new Set(String(s||'').toLowerCase().match(/[a-z0-9]{3,}/g)?.filter(x=>!STOP.has(x))||[]);

async function loadMemory(req,res){
  const out=[];let cursor='';
  for(let page=0;page<3;page++){
    const path='/profile/memory?limit=100'+(cursor?'&cursor='+encodeURIComponent(cursor):'');
    const r=await ixoFetch(req,res,path,{method:'GET'});
    const d=await r.json().catch(()=>({}));
    if(!r.ok)break;
    if(Array.isArray(d.items))out.push(...d.items);
    cursor=String(d.next_cursor||'');
    if(!cursor)break;
  }
  return out;
}
function selectRelevant(memory,query,max=10){
  const q=tokens(query);
  const scored=memory.map((f,i)=>{
    const ft=tokens((f.category||'')+' '+(f.value||''));
    let score=0;for(const x of q)if(ft.has(x))score+=1;
    if(q.has(String(f.category||'').toLowerCase()))score+=2;
    return {f,score,i};
  }).filter(x=>x.score>0).sort((a,b)=>b.score-a.score||new Date(b.f.updated_at)-new Date(a.f.updated_at));
  return scored.slice(0,max).map(x=>x.f);
}
async function createChat(req,res,title){
  const r=await ixoFetch(req,res,'/chats',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({title,project_id:null})});
  const d=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(errorDetail(d)||'Could not create reasoning chat');
  return d;
}

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store, no-cache, must-revalidate');
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  const mode=String(req.body?.mode||'').trim();
  if(!['personalized','decision'].includes(mode))return res.status(400).json({error:'Unsupported reasoning mode'});
  const question=String(req.body?.question||req.body?.decision||'').trim();
  if(!question)return res.status(400).json({error:'A question or decision is required'});

  try{
    const memory=await loadMemory(req,res);
    const desired=String(req.body?.desired_outcome||'').trim();
    const options=Array.isArray(req.body?.options)?req.body.options.map(String).filter(Boolean).slice(0,12):[];
    const assumptions=Array.isArray(req.body?.assumptions)?req.body.assumptions.map(String).filter(Boolean).slice(0,20):[];
    const query=[question,desired,...options,...assumptions].join(' ');
    const relevant=selectRelevant(memory,query,10);

    const evidence=relevant.map(f=>({id:f.id,category:f.category,value:f.value,status:f.status,revision:f.revision,updated_at:f.updated_at,source:f.source}));
    const context=relevant.length?relevant.map(f=>'['+f.id+'] '+f.category+': '+f.value).join('\n'):'No stored profile memory was lexically relevant to this request. Do not force personalization.';

    const contract=mode==='decision'
      ?{
        summary:'Concise framing of the decision; do not choose for the user.',
        known_context:['Only verified stored facts that matter; cite memory IDs in brackets.'],
        goals_affected:['Only goals actually supported by context or user input.'],
        constraints:['Relevant constraints.'],
        options:['Options and material tradeoffs; preserve user options.'],
        assumptions:['Assumptions in the analysis, including user-entered assumptions.'],
        unknowns:['Missing information that could change the analysis.'],
        tradeoffs:['Tradeoffs between options.'],
        risks_dependencies:['Risks or dependencies supported by the inputs.'],
        what_would_change:['Facts or assumption changes that would materially change the analysis.'],
        clarifying_questions:['Minimum useful questions only.']
      }
      :{
        answer:'Personalized answer to the user question.',
        context_used:['Exact memory IDs in brackets for facts that materially affected the answer.'],
        assumptions:['Assumptions made beyond stored facts.'],
        missing_information:['Information that could materially change the answer.'],
        why_context_changed_answer:'Explain how personal context changed the answer, or null if it did not materially change it.'
      };

    const prompt=[
      'You are the reasoning layer for MY iXo. Use only the verified personal context supplied below plus the user input.',
      'Do not invent memories, provenance, confidence scores, activity, goals, constraints, or external data.',
      'If evidence is insufficient, say so. Distinguish stored facts from assumptions and unknowns.',
      mode==='decision'?'Help the user see the decision clearly. Do not tell them which option to choose.':'Answer the question using personal context only when it materially improves the answer.',
      '',
      'VERIFIED STORED PROFILE MEMORY:',
      context,
      '',
      'USER INPUT:',
      'Question/decision: '+question,
      desired?'Desired outcome: '+desired:'',
      options.length?'Options: '+options.join(' | '):'',
      assumptions.length?'User-entered assumptions: '+assumptions.join(' | '):'',
      '',
      'Return valid JSON only, matching this shape:',
      JSON.stringify(contract)
    ].filter(Boolean).join('\n');

    const chat=await createChat(req,res,mode==='decision'?'MY iXo · Decision Lab':'MY iXo · Personalized Answer');
    const rr=await ixoFetch(req,res,'/chats/'+encodeURIComponent(chat.id)+'/runs',{
      method:'POST',
      headers:{'content-type':'application/json','X-UI-Locale':'en','Idempotency-Key':String(req.headers['x-idempotency-key']||randomUUID())},
      body:JSON.stringify({prompt,locale:'en',max_steps:20})
    });
    const run=await rr.json().catch(()=>({}));
    if(!rr.ok)return res.status(rr.status).json({error:errorDetail(run)||'Could not start iXo reasoning'});
    return res.status(202).json({run_id:run.id,chat_id:chat.id,status:run.status,evidence});
  }catch(e){
    return res.status(500).json({error:e instanceof Error?e.message:'Could not start iXo reasoning'});
  }
}
