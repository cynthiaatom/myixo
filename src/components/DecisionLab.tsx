import {useState} from 'react';
import {decisionPayload,openRunEvents,startReasoning,waitForReasoning} from '../services/reasoning';
import type {DecisionInput,MemoryFact,ReasoningResult} from '../intelligence/types';

const lines=(s:string)=>s.split('\n').map(x=>x.trim()).filter(Boolean);

export default function DecisionLab(){
  const [input,setInput]=useState<DecisionInput>({decision:'',desiredOutcome:'',options:[],assumptions:[]});
  const [optionsText,setOptionsText]=useState('');
  const [assumptionsText,setAssumptionsText]=useState('');
  const [result,setResult]=useState<ReasoningResult|null>(null);
  const [evidence,setEvidence]=useState<MemoryFact[]>([]);
  const [status,setStatus]=useState('');
  const [error,setError]=useState('');
  const [working,setWorking]=useState(false);

  const analyze=async()=>{
    if(!input.decision.trim())return;
    setWorking(true);setError('');setResult(null);setStatus('starting');
    try{
      const next={...input,options:lines(optionsText),assumptions:lines(assumptionsText)};
      setInput(next);
      const job=await startReasoning('decision',decisionPayload(next));
      setEvidence(job.evidence||[]);
      const close=openRunEvents(job.run_id,s=>setStatus(s));
      try{setResult(await waitForReasoning(job,s=>setStatus(s)))}finally{close()}
    }catch(e:any){setError(e.message||'Could not analyze decision')}
    finally{setWorking(false)}
  };

  const arr=(x:unknown)=>Array.isArray(x)?x:[];
  return <section className="intelligenceView">
    <div className="viewHero"><div className="eyebrow">DECIDE · DECISION LAB</div><h1>SEE THE DECISION <em>CLEARLY.</em></h1><p>iXo should help you expose context, assumptions, unknowns and tradeoffs—not choose for you.</p></div>
    <div className="decisionLayout"><div className="decisionForm">
      <label>DECISION<textarea value={input.decision} onChange={e=>setInput({...input,decision:e.target.value})} placeholder="What are you deciding?"/></label>
      <label>DESIRED OUTCOME<textarea value={input.desiredOutcome} onChange={e=>setInput({...input,desiredOutcome:e.target.value})} placeholder="What would a good outcome accomplish?"/></label>
      <label>OPTIONS · ONE PER LINE<textarea value={optionsText} onChange={e=>setOptionsText(e.target.value)} placeholder={'Option A\nOption B'}/></label>
      <label>ASSUMPTIONS YOU WANT TO TEST · ONE PER LINE<textarea value={assumptionsText} onChange={e=>setAssumptionsText(e.target.value)} placeholder={'This will require...\nI am assuming...'}/></label>
      <button className="primary" disabled={working||!input.decision.trim()} onClick={analyze}>{working?'iXo is reasoning…':'Think this through →'}</button>
      {working&&<p className="liveStatus">LIVE RUN · {status||'working'}</p>}{error&&<div className="connectError">{error}</div>}
    </div>
    <div className="decisionResult">{result?<><div className="eyebrow">APPLICATION REASONING · GROUNDED IN VERIFIED MEMORY</div><h2>{String(result.summary||'Decision context')}</h2>
      <ResultGroup title="KNOWN PERSONAL CONTEXT" values={arr(result.known_context)}/>
      <ResultGroup title="GOALS AFFECTED" values={arr(result.goals_affected)}/>
      <ResultGroup title="CONSTRAINTS" values={arr(result.constraints)}/>
      <ResultGroup title="OPTIONS / TRADEOFFS" values={arr(result.tradeoffs).length?arr(result.tradeoffs):arr(result.options)}/>
      <ResultGroup title="ASSUMPTIONS" values={arr(result.assumptions)}/>
      <ResultGroup title="UNKNOWNS" values={arr(result.unknowns||result.missing_information)}/>
      <ResultGroup title="RISKS / DEPENDENCIES" values={arr(result.risks_dependencies)}/>
      <ResultGroup title="WHAT WOULD CHANGE THE ANALYSIS?" values={arr(result.what_would_change)}/>
      <ResultGroup title="MINIMUM CLARIFYING QUESTIONS" values={arr(result.clarifying_questions)}/>
      <details className="contextUsed"><summary>Verified personal context supplied to this analysis · {evidence.length}</summary>{evidence.map(f=><p key={f.id}><b>{f.category}</b> · {f.value}</p>)}</details>
    </>:<div className="quietState compact"><h2>Your analysis will appear here.</h2><p>Only relevant durable memories are supplied. If none match, iXo is told not to force personalization.</p></div>}</div></div>
  </section>
}
function ResultGroup({title,values}:{title:string;values:unknown[]}){
  if(!values.length)return null;
  return <section className="resultGroup"><h3>{title}</h3>{values.map((v,i)=><p key={i}>{typeof v==='string'?v:JSON.stringify(v)}</p>)}</section>
}
