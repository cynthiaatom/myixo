import {useEffect,useRef,useState} from 'react';
import type {EvidenceRef,Explanation,MemoryFact,MemoryPayload,NativeIntelligenceContext} from '../intelligence/types';
import {openRunEvents,startReasoning,waitForReasoning} from '../services/reasoning';
import ExplainPanel from './ExplainPanel';

type Finding={type?:string;observation?:string;why_noticed?:string;known?:string[];inferred?:string[];unknown?:string[];evidence_refs?:string[];resolving_question?:string};
const evidenceFor=(ids:unknown,facts:MemoryFact[]):EvidenceRef[]=>{const wanted=new Set((Array.isArray(ids)?ids:[]).map(String).map(x=>x.replace(/[\[\]]/g,'')));return facts.filter(f=>wanted.has(f.id)).map(f=>({id:f.id,kind:'memory',label:f.category,detail:f.value,source:f.source,updated_at:f.updated_at}))};

export default function MirrorView({memory,onMemory,onDecide}:{memory:MemoryPayload;nativeContext?:NativeIntelligenceContext|null;onMemory:()=>void;onDecide:()=>void}){
  const [findings,setFindings]=useState<Finding[]|null>(null);
  const [evidence,setEvidence]=useState<MemoryFact[]>([]);
  const [state,setState]=useState<'loading'|'success'|'insufficient'|'error'>('loading');
  const [status,setStatus]=useState('starting');
  const [error,setError]=useState('');
  const [explain,setExplain]=useState<Explanation|null>(null);
  const autoStarted=useRef(false);
  const run=async()=>{
    setState('loading');setError('');setFindings(null);setStatus('starting');
    try{
      const job=await startReasoning('mirror',{},'mirror');
      setEvidence(job.evidence||[]);
      if(job.context_status==='insufficient_context'){setFindings([]);setState('insufficient');return}
      const close=openRunEvents(job.run_id,setStatus);
      try{const result=await waitForReasoning(job,setStatus);if(!Array.isArray(result.findings))throw new Error('MIRROR returned an invalid result shape.');setFindings(result.findings as Finding[]);setState('success')}finally{close()}
    }catch(e:any){setError(e.message||'MIRROR reasoning failed');setState('error')}
  };
  useEffect(()=>{if(autoStarted.current)return;autoStarted.current=true;void run()},[]);
  const explainFinding=(f:Finding):Explanation=>({observation:String(f.observation||''),known:Array.isArray(f.known)?f.known:[],inferred:Array.isArray(f.inferred)?f.inferred:[],unknown:Array.isArray(f.unknown)?f.unknown:[],sources:evidenceFor(f.evidence_refs,evidence)});

  return <section className="intelligenceView">
    <div className="viewHero"><div className="eyebrow">iXo MIRROR</div><h1>WHAT AM I <em>NOT SEEING?</em></h1><p>A bounded reasoning pass for observable gaps, dependencies and conflicts. No mind-reading, diagnosis or manufactured certainty.</p></div>
    {state==='loading'&&<div className="quietState"><div className="quietOrb"/><h2>Looking for supported blind spots…</h2><p>LIVE RUN · {status}</p></div>}
    {state==='error'&&<div className="connectError"><b>MIRROR reasoning is unavailable.</b><p>{error}</p><button onClick={run}>Try again</button></div>}
    {state==='insufficient'&&<div className="quietState"><h2>There isn't enough relevant context to evaluate MIRROR yet.</h2><p>This is not the same as finding no blind spots.</p></div>}
    {state==='success'&&findings?.length===0&&<div className="quietState"><div className="quietOrb"/><h2>No meaningful blind spot was found.</h2><p>iXo evaluated the selected context and returned no supported finding.</p></div>}
    {state==='success'&&findings&&findings.length>0&&<div className="mirrorGrid">{findings.slice(0,7).map((f,i)=>{const ex=explainFinding(f);return <article className="mirrorCard" key={i}>
      <div className="findingMeta"><span className="findingType">{f.type||'OBSERVATION'}</span><span className="derivationBadge">APPLICATION REASONING</span></div><h2>{f.observation}</h2><p>{f.why_noticed}</p>
      <div className="mirrorColumns"><div><span>KNOWN</span>{(f.known||[]).map((x,j)=><p key={j}>{x}</p>)}</div><div><span>INFERRED</span>{(f.inferred||[]).length?(f.inferred||[]).map((x,j)=><p key={j}>{x}</p>):<p>Nothing beyond the evidence.</p>}</div><div><span>UNKNOWN</span>{(f.unknown||[]).map((x,j)=><p key={j}>{x}</p>)}</div></div>
      <div className="resolveQuestion"><span>QUESTION THAT WOULD RESOLVE THIS</span><b>{f.resolving_question||'No resolving question supplied.'}</b></div>
      <div className="actions"><button onClick={()=>setExplain(ex)}>Show me why</button><button onClick={()=>setExplain(ex)}>Show evidence</button><button onClick={onMemory}>Correct iXo</button><button onClick={onDecide}>Think this through</button></div>
    </article>})}</div>}
    {explain&&<ExplainPanel explanation={explain} onClose={()=>setExplain(null)} onCorrect={()=>{setExplain(null);onMemory()}}/>}
  </section>
}
