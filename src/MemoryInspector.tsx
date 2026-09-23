import {useEffect,useMemo,useState} from 'react';
import {labels,type CategoryId} from './ixo';

type MemorySource={kind:string,id:string,chat_id?:string|null,question_text?:string|null};
type MemoryFact={
  id:string;
  category:string;
  value:string;
  scope:string;
  status:'confirmed'|'needs_clarification';
  supersedes_id?:string|null;
  revision:number;
  source:MemorySource;
  updated_at:string;
};
type SourceDetail={kind:string,id:string,question_text?:string|null,text?:string|null,role?:string|null,created_at?:string|null};
type Filter='all'|'clarify'|'review';

const day=86400000;
const reviewDue=(f:MemoryFact)=>Date.now()-new Date(f.updated_at).getTime()>180*day;
const prettyCategory=(value:string)=>{
  const key=value.trim().toLowerCase() as CategoryId;
  return (labels as Record<string,string>)[key]||value.replace(/[_-]+/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
};
const when=(value:string)=>{
  const d=new Date(value);
  return Number.isNaN(d.getTime())?value:d.toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'});
};

export default function MemoryInspector({onClose}:{onClose:()=>void}){
  const [facts,setFacts]=useState<MemoryFact[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [filter,setFilter]=useState<Filter>('all');
  const [query,setQuery]=useState('');
  const [editing,setEditing]=useState<string|null>(null);
  const [draft,setDraft]=useState('');
  const [saving,setSaving]=useState(false);
  const [sourceOpen,setSourceOpen]=useState<string|null>(null);
  const [sources,setSources]=useState<Record<string,SourceDetail>>({});
  const [sourceLoading,setSourceLoading]=useState<string|null>(null);

  const load=async()=>{
    setLoading(true);setError('');
    try{
      const all:MemoryFact[]=[];
      let cursor='';
      for(let page=0;page<10;page++){
        const r=await fetch('/api/ixo/memory?limit=100'+(cursor?'&cursor='+encodeURIComponent(cursor):''),{cache:'no-store'});
        const d=await r.json().catch(()=>({}));
        if(!r.ok)throw new Error(d.error||'Could not load iXo memory');
        if(Array.isArray(d.items))all.push(...d.items);
        cursor=String(d.next_cursor||'');
        if(!cursor)break;
      }
      all.sort((a,b)=>new Date(b.updated_at).getTime()-new Date(a.updated_at).getTime());
      setFacts(all);
    }catch(e:any){setError(e.message||'Could not load iXo memory')}
    finally{setLoading(false)}
  };

  useEffect(()=>{load()},[]);

  const counts=useMemo(()=>({
    total:facts.length,
    confirmed:facts.filter(f=>f.status==='confirmed').length,
    clarify:facts.filter(f=>f.status==='needs_clarification').length,
    review:facts.filter(reviewDue).length
  }),[facts]);

  const visible=useMemo(()=>{
    const q=query.trim().toLowerCase();
    return facts.filter(f=>{
      if(filter==='clarify'&&f.status!=='needs_clarification')return false;
      if(filter==='review'&&!reviewDue(f))return false;
      if(q&&!((f.value+' '+f.category).toLowerCase().includes(q)))return false;
      return true;
    });
  },[facts,filter,query]);

  const grouped=useMemo(()=>{
    const out=new Map<string,MemoryFact[]>();
    for(const fact of visible){
      const key=prettyCategory(fact.category);
      if(!out.has(key))out.set(key,[]);
      out.get(key)!.push(fact);
    }
    return [...out.entries()];
  },[visible]);

  const startEdit=(fact:MemoryFact,blank=false)=>{
    setEditing(fact.id);
    setDraft(blank?'':fact.value);
    setError('');
  };

  const save=async(fact:MemoryFact)=>{
    if(!draft.trim())return;
    setSaving(true);setError('');
    try{
      const r=await fetch('/api/ixo/memory',{
        method:'PATCH',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({fact_id:fact.id,expected_revision:fact.revision,value:draft.trim()})
      });
      const d=await r.json().catch(()=>({}));
      if(!r.ok)throw new Error(d.error||'Could not update memory');
      setFacts(prev=>prev.map(x=>x.id===fact.id?d:x));
      setEditing(null);setDraft('');
    }catch(e:any){setError(e.message||'Could not update memory')}
    finally{setSaving(false)}
  };

  const remove=async(fact:MemoryFact)=>{
    if(!window.confirm('Remove this fact from iXo memory?'))return;
    setError('');
    try{
      const r=await fetch('/api/ixo/memory?fact_id='+encodeURIComponent(fact.id),{method:'DELETE'});
      const d=await r.json().catch(()=>({}));
      if(!r.ok)throw new Error(d.error||'Could not remove memory');
      setFacts(prev=>prev.filter(x=>x.id!==fact.id));
    }catch(e:any){setError(e.message||'Could not remove memory')}
  };

  const toggleSource=async(fact:MemoryFact)=>{
    if(sourceOpen===fact.id){setSourceOpen(null);return}
    setSourceOpen(fact.id);
    if(sources[fact.id])return;
    setSourceLoading(fact.id);
    try{
      const r=await fetch('/api/ixo/source?kind='+encodeURIComponent(fact.source.kind)+'&id='+encodeURIComponent(fact.source.id),{cache:'no-store'});
      const d=await r.json().catch(()=>({}));
      if(!r.ok)throw new Error(d.error||'Could not load source');
      setSources(prev=>({...prev,[fact.id]:d}));
    }catch(e:any){setError(e.message||'Could not load source')}
    finally{setSourceLoading(null)}
  };

  return <section className="memoryInspector">
    <div className="memoryTop">
      <div><div className="eyebrow">WHAT iXo KNOWS ABOUT ME</div><h2>Memory Inspector</h2><p>See the durable facts iXo is using, where they came from, when they changed, and what needs your review.</p></div>
      <button onClick={onClose}>← Personal Map</button>
    </div>

    <div className="memoryStats">
      <div><strong>{counts.total}</strong><span>MEMORIES</span></div>
      <div><strong>{counts.confirmed}</strong><span>CONFIRMED</span></div>
      <div><strong>{counts.clarify}</strong><span>NEED CLARIFICATION</span></div>
      <div><strong>{counts.review}</strong><span>REVIEW DUE</span></div>
    </div>

    <div className="memoryControls">
      <div className="memoryTabs">
        <button className={filter==='all'?'selected':''} onClick={()=>setFilter('all')}>All</button>
        <button className={filter==='clarify'?'selected':''} onClick={()=>setFilter('clarify')}>Needs clarification</button>
        <button className={filter==='review'?'selected':''} onClick={()=>setFilter('review')}>Review due</button>
      </div>
      <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search what iXo knows…"/>
    </div>

    {error&&<div className="connectError">{error}</div>}
    {loading?<div className="memoryEmpty">Loading your iXo memory…</div>:grouped.length===0?<div className="memoryEmpty">No memories match this view.</div>:grouped.map(([category,items])=><div className="memoryGroup" key={category}>
      <h3>{category}<span>{items.length}</span></h3>
      <div className="memoryGrid">{items.map(fact=>{
        const source=sources[fact.id];
        const due=reviewDue(fact);
        return <article className="memoryCard" key={fact.id}>
          <div className="memoryMeta">
            <span className={fact.status==='confirmed'?'memoryBadge confirmed':'memoryBadge clarify'}>{fact.status==='confirmed'?'Confirmed':'Needs clarification'}</span>
            {due&&<span className="memoryBadge review">Review due</span>}
          </div>
          {editing===fact.id?<div className="memoryEdit">
            <textarea value={draft} onChange={e=>setDraft(e.target.value)} placeholder="What is true now?"/>
            <div className="actions"><button className="primary" disabled={saving||!draft.trim()} onClick={()=>save(fact)}>{saving?'Saving…':'Save update'}</button><button onClick={()=>{setEditing(null);setDraft('')}}>Cancel</button></div>
          </div>:<p className="memoryValue">{fact.value}</p>}
          <div className="memoryFoot"><span>Updated {when(fact.updated_at)}</span><span>Revision {fact.revision}</span></div>
          <div className="memoryActions">
            <button onClick={()=>toggleSource(fact)}>Why does iXo know this?</button>
            <button onClick={()=>startEdit(fact,false)}>Update</button>
            <button onClick={()=>startEdit(fact,true)}>Changed</button>
            <button className="danger" onClick={()=>remove(fact)}>Remove</button>
          </div>
          {sourceOpen===fact.id&&<div className="sourceBox">
            <b>WHY iXo KNOWS THIS</b>
            {fact.source.question_text&&<div><span>Question</span><p>{fact.source.question_text}</p></div>}
            {sourceLoading===fact.id?<p>Loading source…</p>:source?<>{source.question_text&&!fact.source.question_text&&<div><span>Question</span><p>{source.question_text}</p></div>}{source.text&&<div><span>Source</span><p>{source.text}</p></div>}{source.created_at&&<div><span>Recorded</span><p>{when(source.created_at)}</p></div>}<div><span>Source type</span><p>{source.kind}</p></div></>:<p>Source metadata is available, but no additional displayable text was returned.</p>}
          </div>}
        </article>
      })}</div>
    </div>)}
  </section>
}
