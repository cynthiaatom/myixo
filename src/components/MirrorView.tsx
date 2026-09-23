import {useMemo,useState} from 'react';
import {deriveMirror} from '../intelligence/derive';
import type {Explanation,MemoryPayload,NativeIntelligenceContext} from '../intelligence/types';
import ExplainPanel from './ExplainPanel';

export default function MirrorView({memory,nativeContext,onMemory,onDecide}:{memory:MemoryPayload;nativeContext?:NativeIntelligenceContext|null;onMemory:()=>void;onDecide:()=>void}){
  const findings=useMemo(()=>deriveMirror(memory,nativeContext),[memory,nativeContext]);
  const [explain,setExplain]=useState<Explanation|null>(null);
  return <section className="intelligenceView">
    <div className="viewHero"><div className="eyebrow">iXo MIRROR</div><h1>WHAT AM I <em>NOT SEEING?</em></h1><p>Observable gaps and unresolved context only. No mind-reading, diagnosis, or manufactured certainty.</p></div>
    {findings.length?<div className="mirrorGrid">{findings.map(f=><article className="mirrorCard" key={f.id}>
      <div className="findingMeta"><span className="findingType">{f.type}</span><span className="derivationBadge">{f.evidence.some(e=>e.kind==='native_pending')?'NATIVE PENDING CONTEXT':'APPLICATION-LEVEL FINDING'}</span></div><h2>{f.observation}</h2><p>{f.why}</p>
      <div className="mirrorColumns"><div><span>KNOWN</span>{f.known.map((x,i)=><p key={i}>{x}</p>)}</div><div><span>INFERRED</span>{f.inferred.length?f.inferred.map((x,i)=><p key={i}>{x}</p>):<p>Nothing beyond the evidence.</p>}</div><div><span>UNKNOWN</span>{f.unknown.map((x,i)=><p key={i}>{x}</p>)}</div></div>
      <div className="resolveQuestion"><span>QUESTION THAT WOULD RESOLVE THIS</span><b>{f.resolveQuestion}</b></div>
      <div className="actions"><button onClick={()=>setExplain({observation:f.observation,known:f.known,inferred:f.inferred,unknown:f.unknown,sources:f.evidence})}>Show me why</button><button onClick={()=>setExplain({observation:f.observation,known:f.known,inferred:f.inferred,unknown:f.unknown,sources:f.evidence})}>Show evidence</button>{f.type==='MISSING INFORMATION'&&<button onClick={onMemory}>Answer the missing question</button>}<button onClick={onMemory}>Correct iXo</button><button onClick={onDecide}>Think this through</button></div>
    </article>)}</div>:<div className="quietState"><div className="quietOrb"/><h2>I don't see a meaningful blind spot in the context available right now.</h2><p>Zero findings is better than invented insight.</p></div>}
    {explain&&<ExplainPanel explanation={explain} onClose={()=>setExplain(null)} onCorrect={()=>{setExplain(null);onMemory()}}/>}
  </section>
}
