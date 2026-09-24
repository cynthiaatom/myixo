import {useEffect,useRef,useState} from 'react';
import type {EvidenceRef,Explanation,MemoryFact,MemoryPayload} from '../intelligence/types';
import {openRunEvents,startReasoning,waitForReasoning} from '../services/reasoning';
import ExplainPanel from './ExplainPanel';

type Item={title?:string;observation?:string;why_it_matters?:string;known?:string[];inferred?:string[];unknown?:string[];evidence_refs?:string[];next_question?:string};

const refs=(ids:unknown,facts:MemoryFact[]):EvidenceRef[]=>{
  const wanted=new Set((Array.isArray(ids)?ids:[]).map(String).map(x=>x.replace(/[\[\]]/g,'')));
  return facts.filter(f=>wanted.has(f.id)).map(f=>({id:f.id,kind:'memory',label:f.category,detail:f.value,source:f.source,updated_at:f.updated_at}));
};
const explanation=(x:Item,facts:MemoryFact[]):Explanation=>({observation:String(x.observation||x.title||''),known:Array.isArray(x.known)?x.known:[],inferred:Array.isArray(x.inferred)?x.inferred:[],unknown:Array.isArray(x.unknown)?x.unknown:[],sources:refs(x.evidence_refs,facts)});

export default function TodayView({memory,onMirror,onDecide}:{memory:MemoryPayload;question?:{id:string;text:string;reason?:string|null}|null;onMirror:()=>void;onDecide:()=>void}){
  const [items,setItems]=useState<Item[]|null>(null);
  const [evidence,setEvidence]=useState<MemoryFact[]>([]);
  const [state,setState]=useState<'loading'|'success'|'insufficient'|'error'>('loading');
  const [status,setStatus]=useState('starting');
  const [error,setError]=useState('');
  const [explain,setExplain]=useState<Explanation|null>(null);\n  const autoStarted=useRef(false);

  const run=async()=>{
    setState('loading');setError('');setItems(null);setStatus('starting');
    try{
      const job=await startReasoning('today',{},'today');
      setEvidence(job.evidence||[]);
      if(job.context_status==='insufficient_context'){setItems([]);setState('insufficient');return}
      const close=openRunEvents(job.run_id,setStatus);
      try{
        const result=await waitForReasoning(job,setStatus);
        if(!Array.isArray(result.items))throw new Error('TODAY returned an invalid result shape.');
        setItems(result.items as Item[]);setState('success');
      }finally{close()}
    }catch(e:any){setError(e.message||'TODAY reasoning failed');setState('error')}
  };
  useEffect(()=>{if(autoStarted.current)return;autoStarted.current=true;void run()},[]);

  return <section className="intelligenceView">
    <div className="viewHero"><div className="eyebrow">TODAY · MISSION CONTROL</div><h1>WHAT DESERVES MY <em>ATTENTION?</em></h1><p>A real reasoning pass over a bounded set of durable iXo context. Silence is allowed, but failures are never presented as silence.</p></div>
    {state==='loading'&&<div className="quietState"><div className="quietOrb"/><h2>Evaluating what deserves your attention…</h2><p>LIVE RUN · {status}</p></div>}
    {state==='error'&&<div className="connectError"><b>TODAY reasoning is unavailable.</b><p>{error}</p><button onClick={run}>Try again</button></div>}
    {state==='insufficient'&&<div className="quietState"><h2>There isn't enough relevant context to evaluate TODAY yet.</h2><p>This is different from a successful reasoning pass with no findings.</p></div>}
    {state==='success'&&items?.length===0&&<div className="quietState"><div className="quietOrb"/><h2>No meaningful attention items were found.</h2><p>iXo evaluated the selected context and returned no supported findings.</p></div>}
    {state==='success'&&items&&items.length>0&&<div className="attentionList">{items.slice(0,5).map((item,i)=>{const ex=explanation(item,evidence);return <article className="attentionCard" key={i}>
      <div className="attentionNumber">0{i+1}</div><div className="attentionBody"><div className="derivationBadge">APPLICATION REASONING · VERIFIED iXo CONTEXT</div><h2>{item.title||item.observation}</h2><p>{item.why_it_matters}</p>
      <div className="attentionFacts"><div><span>KNOWN</span><b>{(item.known||[]).join(' · ')||'No additional known fact claimed.'}</b></div><div><span>IMPORTANT UNKNOWN</span><b>{(item.unknown||[]).join(' · ')||'None identified.'}</b></div><div><span>NEXT THINKING STEP</span><b>{item.next_question||'No follow-up required.'}</b></div></div>
      <div className="actions"><button onClick={()=>setExplain(ex)}>Why this matters</button><button onClick={()=>setExplain(ex)}>Show evidence</button><button onClick={onMirror}>What am I missing?</button><button onClick={onDecide}>Think this through</button></div></div>
    </article>})}</div>}
    {explain&&<ExplainPanel explanation={explain} onClose={()=>setExplain(null)}/>}
  </section>
}
