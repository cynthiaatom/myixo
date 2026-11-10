import {useEffect,useRef,useState} from 'react';
import type {EvidenceRef,Explanation,MemoryFact,MemoryPayload,NativeIntelligenceContext} from '../intelligence/types';
import {openRunEvents,reportUnobservedFailure,startReasoning,waitForReasoning} from '../services/reasoning';
import ExplainPanel from './ExplainPanel';

type Finding={type?:string;observation?:string;why_noticed?:string;known?:string[];inferred?:string[];unknown?:string[];evidence_refs?:string[];resolving_question?:string};
const irrelevant=/\b(make document|discussion summary|download to choose|markdown, word, or pdf|save a summary of this conversation)\b/i;
const isTestFact=(value:string)=>/\b(?:qa test|test checklist|juniper|dummy|synthetic|sample data|test goal|test fact)\b/i.test(value);
const validFacts=(facts:MemoryFact[])=>facts.filter(f=>String(f.value||'').trim().length>25&&!irrelevant.test(String(f.value||''))&&!isTestFact(String(f.value||''))&&f.status!=='retracted');
const makePrompts=(facts:MemoryFact[])=>validFacts(facts).filter(f=>/\b(?:goal|plan|need|want|decision|waiting|blocked|uncertain|priority|deadline|client|revenue|project)\b/i.test(f.value)).slice(0,4).map(fact=>{
  const v=fact.value;
  const hasDate=/\b(?:by|before|on)\s+(?:\w+\s+)?\d{1,2},?\s+20\d{2}\b|\b20\d{2}-\d{2}-\d{2}\b/i.test(v);
  const hasSteps=/\b(?:steps?|first|second|then|complete|review)\b/i.test(v);
  const question=/\b(?:waiting|blocked|dependent|approval)\b/i.test(v)?'What dependency is preventing progress, and who can resolve it?':/\b(?:decision|decide|choose|option)\b/i.test(v)?'What information would change this decision?':hasDate&&hasSteps?'Has this milestone been completed, and what changed as a result?':hasDate?'What could prevent this deadline from being met?':'What would make progress on this priority measurable?';
  return {fact,question};
});
const evidenceFor=(ids:unknown,facts:MemoryFact[]):EvidenceRef[]=>{const wanted=new Set((Array.isArray(ids)?ids:[]).map(String).map(x=>x.replace(/[\[\]]/g,'')));return facts.filter(f=>wanted.has(f.id)).map(f=>({id:f.id,kind:'memory',label:f.category,detail:f.value,source:f.source,updated_at:f.updated_at}))};

export default function MirrorView({memory,onMemory,onDecide}:{memory:MemoryPayload;nativeContext?:NativeIntelligenceContext|null;onMemory:()=>void;onDecide:()=>void}){
  const [findings,setFindings]=useState<Finding[]|null>(null);
  const [filteredCount,setFilteredCount]=useState(0);
  const [evidencePrompts,setEvidencePrompts]=useState<{fact:MemoryFact;question:string}[]>([]);
  const [evidence,setEvidence]=useState<MemoryFact[]>([]);
  const availableFacts=validFacts(memory?.items||[]);
  const [state,setState]=useState<'loading'|'success'|'insufficient'|'error'>('loading');
  const [status,setStatus]=useState('starting');
  const [error,setError]=useState('');
  const [explain,setExplain]=useState<Explanation|null>(null);
  const autoStarted=useRef(false);
  const run=async()=>{
    let job:any=null;
    setState('loading');setError('');setFindings(null);setFilteredCount(0);setEvidencePrompts(makePrompts(memory?.items||[]));setStatus('starting');
    try{
      job=await startReasoning('mirror',{},'mirror');
      const combined=Array.from(new Map< string,MemoryFact >([...(memory?.items||[]),...(job.evidence||[])].map((f:MemoryFact)=>[f.id,f])).values());
      setEvidence(combined);
      const relevant=validFacts(combined).filter(f=>!/^\s*(?:hello|thanks|okay|yes|no)\s*[.!]?$/i.test(f.value));
      const prompts=makePrompts(relevant);
      setEvidencePrompts(prompts);
      if(job.context_status==='insufficient_context'){setFindings([]);setState('insufficient');return}
      const close=openRunEvents(job.run_id,setStatus);
      try{const result=await waitForReasoning(job,'mirror',setStatus);const candidates=(result.findings||[]) as Finding[];
        const supported=candidates.filter(f=>{
          const observation=String(f.observation||'').trim();
          const refs=evidenceFor(f.evidence_refs,combined);
          return observation.length>15&&!irrelevant.test(observation)&&refs.length>0&&((f.known||[]).length>0||(f.inferred||[]).length>0);
        });
        setFilteredCount(candidates.length-supported.length);setFindings(supported);setState(supported.length?'success':'insufficient')}finally{close()}
    }catch(e:any){await reportUnobservedFailure(job,'mirror','mirror',e);setError('The live iXo reasoning request did not complete. Your saved memories are still available below for source-backed exploration.');setEvidencePrompts(makePrompts(memory?.items||[]));setState('error')}
  };
  useEffect(()=>{if(autoStarted.current)return;autoStarted.current=true;void run()},[]);
  const explainFinding=(f:Finding):Explanation=>({observation:String(f.observation||''),known:Array.isArray(f.known)?f.known:[],inferred:Array.isArray(f.inferred)?f.inferred:[],unknown:Array.isArray(f.unknown)?f.unknown:[],sources:evidenceFor(f.evidence_refs,evidence)});

  return <section className="intelligenceView">
    <div className="viewHero"><div className="eyebrow">iXo MIRROR</div><h1>WHAT AM I <em>NOT SEEING?</em></h1><p>A bounded reasoning pass for observable gaps, dependencies and conflicts. No mind-reading, diagnosis or manufactured certainty.</p></div>
    {state==='loading'&&<div className="quietState"><div className="quietOrb"/><h2>Looking for supported blind spots...</h2><p>{status==='starting'?'Thinking...':'Thinking...'}</p></div>}
    {state==='error'&&<div className="connectError"><b>MIRROR reasoning is unavailable.</b><p>{error}</p><button onClick={run}>Try again</button></div>}
    {state==='error'&&evidencePrompts.length>0&&<div className="mirrorGrid">{evidencePrompts.map(({fact,question})=><article className="mirrorCard" key={fact.id}><div className="findingMeta"><span className="findingType">FOLLOW-UP TO EXPLORE</span><span className="derivationBadge">SAVED MEMORY</span></div><h2>{question}</h2><p>{fact.value}</p><div className="actions"><button onClick={()=>setExplain({observation:question,known:[fact.value],inferred:[],unknown:[],sources:evidenceFor([fact.id],[fact])})}>Show source</button><button onClick={onMemory}>Correct iXo</button><button onClick={onDecide}>Think this through</button></div></article>)}</div>}
    {state==='insufficient'&&<div className="quietState"><h2>{evidencePrompts.length?'Questions worth exploring from your saved memories':'MIRROR could not establish a supported blind spot yet'}</h2><p>{filteredCount?'The reasoning response contained '+filteredCount+' unsupported or unrelated observation(s), which were withheld. ':''}{evidencePrompts.length?'These follow-ups are grounded in your existing memories; they are not confirmed blind spots.':'No usable source-backed follow-up was available in this analysis.'}</p><button onClick={run}>Retry analysis</button>{evidencePrompts.length>0&&<div className="mirrorGrid">{evidencePrompts.map(({fact,question})=><article className="mirrorCard" key={fact.id}><div className="findingMeta"><span className="findingType">FOLLOW-UP TO EXPLORE</span><span className="derivationBadge">SAVED MEMORY</span></div><h2>{question}</h2><p>{fact.value}</p><div className="actions"><button onClick={()=>setExplain({observation:question,known:[fact.value],inferred:[],unknown:[],sources:evidenceFor([fact.id],[fact])})}>Show source</button><button onClick={onMemory}>Correct iXo</button><button onClick={onDecide}>Think this through</button></div></article>)}</div>}</div>}
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
