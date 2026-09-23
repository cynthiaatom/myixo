import {useMemo,useState} from 'react';
import {deriveToday} from '../intelligence/derive';
import type {Explanation,MemoryPayload} from '../intelligence/types';
import ExplainPanel from './ExplainPanel';

export default function TodayView({memory,question,onMirror,onDecide}:{memory:MemoryPayload;question?:{id:string;text:string;reason?:string|null}|null;onMirror:()=>void;onDecide:()=>void}){
  const items=useMemo(()=>deriveToday(memory,question),[memory,question]);
  const [explain,setExplain]=useState<Explanation|null>(null);
  return <section className="intelligenceView">
    <div className="viewHero"><div className="eyebrow">TODAY · MISSION CONTROL</div><h1>WHAT DESERVES MY <em>ATTENTION?</em></h1><p>Not everything. Only context that currently has a reason to deserve another look.</p></div>
    {items.length?<div className="attentionList">{items.map((item,i)=><article className="attentionCard" key={item.id}>
      <div className="attentionNumber">0{i+1}</div><div className="attentionBody"><h2>{item.title}</h2><p>{item.why}</p>
      <div className="attentionFacts">{item.related&&<div><span>RELATED</span><b>{item.related}</b></div>}{item.changed&&<div><span>WHAT CHANGED</span><b>{item.changed}</b></div>}{item.unknown&&<div><span>IMPORTANT UNKNOWN</span><b>{item.unknown}</b></div>}<div><span>NEXT THINKING STEP</span><b>{item.nextStep}</b></div></div>
      <div className="actions"><button onClick={()=>setExplain(item.explanation)}>Why this matters</button><button onClick={onMirror}>What am I missing?</button><button onClick={onDecide}>Think this through</button></div></div>
    </article>)}</div>:<div className="quietState"><div className="quietOrb"/><h2>Nothing important needs your attention from the context I can currently see.</h2><p>Silence is a valid output. iXo should not manufacture urgency.</p></div>}
    {explain&&<ExplainPanel explanation={explain} onClose={()=>setExplain(null)}/>}
  </section>
}
