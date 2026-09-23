import {useEffect,useMemo,useState} from 'react';
import {deriveToday} from '../intelligence/derive';
import type {Explanation,MemoryPayload} from '../intelligence/types';
import ExplainPanel from './ExplainPanel';

export default function TodayView({memory,question,onMirror,onDecide}:{memory:MemoryPayload;question?:{id:string;text:string;reason?:string|null}|null;onMirror:()=>void;onDecide:()=>void}){
  const items=useMemo(()=>deriveToday(memory,question),[memory,question]);
  const [explain,setExplain]=useState<Explanation|null>(null);
  const [notice,setNotice]=useState<{revision:number;items:string[]}|null>(null);
  useEffect(()=>{
    try{
      const prevRevision=Number(localStorage.getItem('myixo:last_seen_profile_revision')||0);
      const prevAt=localStorage.getItem('myixo:last_seen_profile_at')||'';
      const latestAt=memory.items.reduce((max,x)=>new Date(x.updated_at).getTime()>new Date(max||0).getTime()?x.updated_at:max,'');
      if(prevRevision===0){
        localStorage.setItem('myixo:last_seen_profile_revision',String(memory.profile_revision));
        localStorage.setItem('myixo:last_seen_profile_at',latestAt||new Date().toISOString());
      }else if(memory.profile_revision>prevRevision){
        const changed=memory.items.filter(x=>!prevAt||new Date(x.updated_at).getTime()>new Date(prevAt).getTime()).sort((a,b)=>new Date(b.updated_at).getTime()-new Date(a.updated_at).getTime()).slice(0,4).map(x=>x.category+': '+x.value);
        setNotice({revision:memory.profile_revision,items:changed});
      }
    }catch{}
  },[memory]);
  const markSeen=()=>{try{localStorage.setItem('myixo:last_seen_profile_revision',String(memory.profile_revision));localStorage.setItem('myixo:last_seen_profile_at',memory.items.reduce((max,x)=>new Date(x.updated_at).getTime()>new Date(max||0).getTime()?x.updated_at:max,'')||new Date().toISOString())}catch{}setNotice(null)};
  return <section className="intelligenceView">
    <div className="viewHero"><div className="eyebrow">TODAY · MISSION CONTROL</div><h1>WHAT DESERVES MY <em>ATTENTION?</em></h1><p>Not everything. Only context that currently has a reason to deserve another look.</p></div>
    {notice&&<div className="noticeCard"><div><span>iXo NOTICED SOMETHING</span><h2>Your durable profile changed since the last revision you saw.</h2><p>This is on-return change detection from real profile revisions—not a background notification.</p>{notice.items.length>0&&<details><summary>Show changed memories</summary>{notice.items.map((x,i)=><p key={i}>{x}</p>)}</details>}</div><button onClick={markSeen}>Mark seen</button></div>}
    {items.length?<div className="attentionList">{items.map((item,i)=><article className="attentionCard" key={item.id}>
      <div className="attentionNumber">0{i+1}</div><div className="attentionBody"><div className="derivationBadge">APPLICATION-LEVEL ATTENTION · VERIFIED iXo EVIDENCE</div><h2>{item.title}</h2><p>{item.why}</p>
      <div className="attentionFacts">{item.related&&<div><span>RELATED</span><b>{item.related}</b></div>}{item.changed&&<div><span>WHAT CHANGED</span><b>{item.changed}</b></div>}{item.unknown&&<div><span>IMPORTANT UNKNOWN</span><b>{item.unknown}</b></div>}<div><span>NEXT THINKING STEP</span><b>{item.nextStep}</b></div></div>
      <div className="actions"><button onClick={()=>setExplain(item.explanation)}>Why this matters</button><button onClick={()=>setExplain(item.explanation)}>Show evidence</button><button onClick={onMirror}>What am I missing?</button><button onClick={onDecide}>Think this through</button></div></div>
    </article>)}</div>:<div className="quietState"><div className="quietOrb"/><h2>Nothing important needs your attention from the context I can currently see.</h2><p>Silence is a valid output. iXo should not manufacture urgency.</p></div>}
    {explain&&<ExplainPanel explanation={explain} onClose={()=>setExplain(null)}/>}
  </section>
}
