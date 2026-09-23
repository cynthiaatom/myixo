import type {AttentionItem,EvidenceRef,MemoryFact,MemoryPayload,MirrorFinding,NativeIntelligenceContext} from './types';

const DAY=86400000;
const ageDays=(iso:string)=>Math.max(0,Math.floor((Date.now()-new Date(iso).getTime())/DAY));
const title=(s:string)=>String(s||'context').replace(/[_-]+/g,' ').replace(/\b\w/g,m=>m.toUpperCase());
const memoryEvidence=(f:MemoryFact):EvidenceRef=>({id:f.id,kind:'memory',label:title(f.category),detail:f.value,source:f.source,updated_at:f.updated_at});

export function deriveToday(memory:MemoryPayload,briefingQuestion?:{id:string;text:string;reason?:string|null}|null):AttentionItem[]{
  const items:AttentionItem[]=[];
  for(const f of memory.items.filter(x=>x.status==='needs_clarification').slice(0,3)){
    const evidence=[memoryEvidence(f)];
    items.push({
      id:'clarify:'+f.id,
      title:'Clarify '+title(f.category)+' context',
      why:'iXo has a durable memory in this area that its own backend marks as needing clarification.',
      changed:'The stored memory is not currently marked confirmed.',
      related:title(f.category),
      unknown:'Whether this still accurately describes you.',
      nextStep:'Confirm the meaning or update the memory so future reasoning does not depend on ambiguity.',
      evidence,
      explanation:{observation:'A stored '+title(f.category)+' memory needs clarification.',known:[f.value,'Backend status: needs_clarification.'],inferred:[],unknown:['Whether the stored statement is still accurate and current.'],sources:evidence}
    });
  }

  const already=new Set(items.map(x=>x.id.split(':')[1]));
  for(const f of memory.items.filter(x=>x.status==='confirmed'&&ageDays(x.updated_at)>=180&&!already.has(x.id)).sort((a,b)=>ageDays(b.updated_at)-ageDays(a.updated_at)).slice(0,2)){
    const days=ageDays(f.updated_at), evidence=[memoryEvidence(f)];
    items.push({
      id:'stale:'+f.id,
      title:'Reconfirm an older '+title(f.category)+' memory',
      why:'This memory may still be correct, but it has not been updated in '+days+' days.',
      changed:null,
      related:title(f.category),
      unknown:'Whether anything important has changed since it was last updated.',
      nextStep:'Reconfirm it only if this area matters to a current decision or priority.',
      evidence,
      explanation:{observation:'A relevant stored memory is older than six months.',known:[f.value,'Last updated '+days+' days ago.'],inferred:['Its age makes it a candidate for reconfirmation, not evidence that it is wrong.'],unknown:['Whether the underlying situation changed.'],sources:evidence}
    });
  }

  if(items.length<5&&briefingQuestion?.text){
    const ev:EvidenceRef={id:briefingQuestion.id,kind:'briefing',label:'Current iXo question',detail:briefingQuestion.text};
    items.push({
      id:'briefing:'+briefingQuestion.id,
      title:'One question could improve iXo’s picture',
      why:briefingQuestion.reason||'iXo generated this as the current adaptive briefing question.',
      related:'Personal context',
      unknown:'The information requested by this question.',
      nextStep:'Answer it when you want iXo to improve its understanding.',
      evidence:[ev],
      explanation:{observation:'iXo has an active adaptive briefing question.',known:[briefingQuestion.text],inferred:briefingQuestion.reason?[briefingQuestion.reason]:[],unknown:['Your answer.'],sources:[ev]}
    });
  }
  return items.slice(0,5);
}

function pendingFacts(ctx:NativeIntelligenceContext):Array<{id:string;text:string}>{
  const p=ctx.pending_facts;
  if(!Array.isArray(p))return [];
  return p.flatMap((x:any,i)=>{
    if(typeof x==='string'&&x.trim())return [{id:'pending:'+i,text:x.trim()}];
    if(!x||typeof x!=='object')return [];
    const text=String(x.text||x.value||x.question||x.prompt||x.description||'').trim();
    const id=String(x.id||('pending:'+i));
    return text?[{id,text}]:[];
  });
}

export function deriveMirror(memory:MemoryPayload,ctx?:NativeIntelligenceContext|null):MirrorFinding[]{
  const out:MirrorFinding[]=[];
  for(const f of memory.items.filter(x=>x.status==='needs_clarification').slice(0,4)){
    const evidence=[memoryEvidence(f)];
    out.push({
      id:'missing:'+f.id,type:'MISSING INFORMATION',
      observation:'iXo has unresolved '+title(f.category)+' context.',
      why:'The durable memory itself is marked needs_clarification.',
      known:[f.value],inferred:[],unknown:['Whether this statement is accurate, incomplete, or out of date.'],
      resolveQuestion:'What should iXo understand instead?',
      evidence
    });
  }

  for(const f of memory.items.filter(x=>x.status==='confirmed'&&ageDays(x.updated_at)>=365).sort((a,b)=>ageDays(b.updated_at)-ageDays(a.updated_at)).slice(0,3)){
    const days=ageDays(f.updated_at), evidence=[memoryEvidence(f)];
    out.push({
      id:'stale:'+f.id,type:'STALE ASSUMPTION',
      observation:'A stored '+title(f.category)+' fact may deserve reconfirmation.',
      why:'It has not been updated in '+days+' days. Age alone does not mean it is wrong.',
      known:[f.value,'Last updated '+days+' days ago.'],
      inferred:['This could become a stale assumption if current reasoning still depends on it.'],
      unknown:['Whether the fact still holds today.'],
      resolveQuestion:'Is this still true today? If not, what changed?',
      evidence
    });
  }

  if(ctx){
    for(const p of pendingFacts(ctx).slice(0,Math.max(0,5-out.length))){
      const ev:EvidenceRef={id:p.id,kind:'native_pending',label:'Native pending context',detail:p.text};
      out.push({
        id:'native:'+p.id,type:'LOOSE END',
        observation:'iXo has native pending context that does not yet appear resolved.',
        why:'This comes directly from the backend pending_facts structure; no additional meaning is assumed.',
        known:[p.text],inferred:[],unknown:['Whether this pending item is still relevant or already resolved elsewhere.'],
        resolveQuestion:'Does this still need resolution?',
        evidence:[ev]
      });
    }
  }
  return out.slice(0,7);
}

export function timelineFromMemory(memory:MemoryPayload){
  return [...memory.items].sort((a,b)=>new Date(b.updated_at).getTime()-new Date(a.updated_at).getTime()).map(f=>({
    id:f.id,
    at:f.updated_at,
    type:f.supersedes_id?'Memory corrected':f.status==='needs_clarification'?'Memory needs clarification':'Memory learned',
    category:title(f.category),
    value:f.value,
    evidence:memoryEvidence(f)
  }));
}
