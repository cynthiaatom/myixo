import {useMemo,useState} from 'react';

export type MemorySource={kind:string,id:string,chat_id?:string|null,question_text?:string|null};
export type MemoryFact={
  id:string;
  category:string;
  value:string;
  scope:string;
  status:'confirmed'|'needs_clarification'|string;
  supersedes_id?:string|null;
  revision:number;
  source:MemorySource;
  updated_at:string;
};
export type MemoryPayload={
  profile_revision:number;
  index_status:string;
  items:MemoryFact[];
  next_cursor?:string|null;
};

const title=(s:string)=>String(s||'Other').replace(/[_-]+/g,' ').replace(/\b\w/g,m=>m.toUpperCase());
const date=(s:string)=>{try{return new Intl.DateTimeFormat(undefined,{year:'numeric',month:'short',day:'numeric'}).format(new Date(s))}catch{return s}};

function FactCard({fact,onChanged,onRemoved}:{fact:MemoryFact,onChanged:(f:MemoryFact)=>void,onRemoved:(id:string)=>void}){
  const [editing,setEditing]=useState(false);
  const [value,setValue]=useState(fact.value);
  const [saving,setSaving]=useState(false);
  const [source,setSource]=useState<any>(null);
  const [sourceOpen,setSourceOpen]=useState(false);
  const [error,setError]=useState('');

  const save=async()=>{
    const next=value.trim();
    if(!next||next===fact.value){setEditing(false);return}
    setSaving(true);setError('');
    try{
      const r=await fetch('/api/ixo/memory',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({id:fact.id,expected_revision:fact.revision,value:next})});
      const d=await r.json().catch(()=>({}));
      if(!r.ok)throw new Error(d.error||'Could not update memory');
      onChanged(d);setEditing(false);
    }catch(e:any){setError(e.message||'Could not update memory')}
    finally{setSaving(false)}
  };

  const remove=async()=>{
    if(!window.confirm('Remove this memory from iXo?'))return;
    setSaving(true);setError('');
    try{
      const r=await fetch('/api/ixo/memory',{method:'DELETE',headers:{'content-type':'application/json'},body:JSON.stringify({id:fact.id})});
      if(!r.ok){const d=await r.json().catch(()=>({}));throw new Error(d.error||'Could not remove memory')}
      onRemoved(fact.id);
    }catch(e:any){setError(e.message||'Could not remove memory')}
    finally{setSaving(false)}
  };

  const why=async()=>{
    const next=!sourceOpen;setSourceOpen(next);
    if(!next||source)return;
    try{
      const r=await fetch('/api/ixo/source?kind='+encodeURIComponent(fact.source.kind)+'&id='+encodeURIComponent(fact.source.id),{cache:'no-store'});
      const d=await r.json().catch(()=>({}));
      if(r.ok)setSource(d);
    }catch{}
  };

  return <article className={'memoryFact '+(fact.status==='needs_clarification'?'needsClarification':'')}>
    <div className="memoryFactTop">
      <span className={'memoryStatus '+(fact.status==='needs_clarification'?'needs':'confirmed')}>{fact.status==='needs_clarification'?'Needs clarification':'Confirmed'}</span>
      <span className="memoryDate">Updated {date(fact.updated_at)}</span>
    </div>
    {editing?<textarea className="memoryEdit" value={value} onChange={e=>setValue(e.target.value)} maxLength={4000}/>:<p className="memoryValue">{fact.value}</p>}
    {fact.supersedes_id&&<div className="memoryMeta">Updated understanding · supersedes an earlier memory</div>}
    {fact.source?.question_text&&<div className="memoryQuestion">From question: “{fact.source.question_text}”</div>}
    {error&&<div className="connectError">{error}</div>}
    <div className="memoryActions">
      {editing?<><button className="primary" disabled={saving} onClick={save}>{saving?'Saving…':'Save update'}</button><button disabled={saving} onClick={()=>{setEditing(false);setValue(fact.value)}}>Cancel</button></>:<><button onClick={()=>setEditing(true)}>✎ Update</button><button onClick={why}>{sourceOpen?'Hide source':'Why does iXo know this?'}</button><button className="dangerBtn" disabled={saving} onClick={remove}>× Remove</button></>}
    </div>
    {sourceOpen&&<div className="sourcePanel">
      <b>PROVENANCE</b>
      <div><span>Source type</span><strong>{title(fact.source.kind)}</strong></div>
      {fact.source.question_text&&<div><span>Question</span><strong>{fact.source.question_text}</strong></div>}
      {fact.source.chat_id&&<div><span>Chat ID</span><code>{fact.source.chat_id}</code></div>}
      <div><span>Memory revision</span><strong>{fact.revision}</strong></div>
      {source&&<details><summary>Source record</summary><pre>{JSON.stringify(source,null,2)}</pre></details>}
    </div>}
  </article>
}

export default function MemoryInspector({memory,setMemory,onClose}:{memory:MemoryPayload,setMemory:(m:MemoryPayload)=>void,onClose:()=>void}){
  const [filter,setFilter]=useState<'all'|'clarify'>('all');
  const grouped=useMemo(()=>{
    const rows=filter==='clarify'?memory.items.filter(x=>x.status==='needs_clarification'):memory.items;
    const map=new Map<string,MemoryFact[]>();
    for(const f of rows){const key=f.category||'other';map.set(key,[...(map.get(key)||[]),f])}
    return [...map.entries()].sort((a,b)=>a[0].localeCompare(b[0]));
  },[memory,filter]);
  const clarifyCount=memory.items.filter(x=>x.status==='needs_clarification').length;

  const changed=(fact:MemoryFact)=>setMemory({...memory,items:memory.items.map(x=>x.id===fact.id?fact:x),profile_revision:Math.max(memory.profile_revision,fact.revision)});
  const removed=(id:string)=>setMemory({...memory,items:memory.items.filter(x=>x.id!==id)});

  return <section className="memoryInspector">
    <div className="memoryHeader">
      <div><div className="eyebrow">WHAT iXo KNOWS ABOUT ME</div><h2>Memory Inspector</h2><p>These are iXo's durable profile memories—not an AI-generated summary. Review what it knows, see where it came from, correct it, or remove it.</p></div>
      <button onClick={onClose}>← Personal Map</button>
    </div>
    <div className="memorySummary">
      <div><strong>{memory.items.length}</strong><span>durable memories</span></div>
      <div><strong>{clarifyCount}</strong><span>need clarification</span></div>
      <div><strong>{memory.profile_revision}</strong><span>profile revision</span></div>
      <div><strong>{memory.index_status}</strong><span>index status</span></div>
    </div>
    <div className="memoryTabs"><button className={filter==='all'?'selected':''} onClick={()=>setFilter('all')}>All memories</button><button className={filter==='clarify'?'selected':''} onClick={()=>setFilter('clarify')}>Clarification inbox {clarifyCount?('· '+clarifyCount):''}</button></div>
    {grouped.length?grouped.map(([category,facts])=><div className="memoryGroup" key={category}><h3>{title(category)}</h3><div className="memoryGrid">{facts.map(f=><FactCard key={f.id} fact={f} onChanged={changed} onRemoved={removed}/>)}</div></div>):<div className="emptyMemory">{filter==='clarify'?'Nothing currently needs clarification.':'No profile memories are available.'}</div>}
    <p className="memoryFootnote">“Needs clarification” comes directly from iXo. We do not manufacture contradictions or certainty scores that the backend did not provide.</p>
  </section>
}
