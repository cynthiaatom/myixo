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
  const [contextState,setContextState]=useState<'ready'|'insufficient_context'|'unknown'>('unknown');

  const analyze=async()=>{
    if(!input.decision.trim())return;
    setWorking(true);setError('');setResult(null);setStatus('starting');
    try{
      const next={...input,options:lines(optionsText),assumptions:lines(assumptionsText)};
      setInput(next);
      const job=await startReasoning('decision',decisionPayload(next),'think_through');
      setEvidence(job.evidence||[]);setContextState(job.context_status||'unknown');
      const close=openRunEvents(job.run_id,s=>setStatus(s));
      try{setResult(await waitForReasoning(job,'decision',s=>setStatus(s)))}finally{close()}
    }catch{setError('I could not complete that analysis. You can try again when you are ready.')}
    finally{setWorking(false)}
  };

  const arr=(x:unknown)=>Array.isArray(x)?x:[];
  return <section className="intelligenceView">
    <div className="viewHero"><div className="eyebrow">DECIDE Â· DECISION LAB</div><h1>SEE THE DECISION <em>CLEARLY.</em></h1><p>iXo helps expose context, assumptions, unknowns and tradeoffsâ€”not choose for you.</p></div>
    <div className="decisionLayout"><div className="decisionForm">
      <label>DECISION<textarea value={input.decision} onChange={e=>setInput({...input,decision:e.target.value})} placeholder="What are you deciding?"/></label>
      <label>DESIRED OUTCOME Â· OPTIONAL<textarea value={input.desiredOutcome} onChange={e=>setInput({...input,desiredOutcome:e.target.value})} placeholder="What would a good outcome accomplish?"/></label>
      <label>OPTIONS Â· OPTIONAL Â· ONE PER LINE<textarea value={optionsText} onChange={e=>setOptionsText(e.target.value)} placeholder={'Option A\nOption B'}/></label>
      <label>ASSUMPTIONS TO TEST Â· OPTIONAL Â· ONE PER LINE<textarea value={assumptionsText} onChange={e=>setAssumptionsText(e.target.value)} placeholder={'This will require...\nI am assuming...'}/></label>
      <button className="primary" disabled={working||!input.decision.trim()} onClick={analyze}>{working?'iXo is thinking...':'Think this through â†’'}</button>
      {working&&<p className="liveStatus">Thinking through your decision{status==='starting'?'...':''}</p>}
      {error&&<div className="connectError"><b>Decision analysis is unavailable.</b><p>{error}</p><button onClick={analyze}>Try again</button></div>}
      {!working&&!error&&contextState==='insufficient_context'&&<div className="contextNotice">No relevant durable memory was selected. The analysis can still use what you entered without pretending it is personalized.</div>}
    </div>
    <div className="decisionResult">{result?<><div className="eyebrow">DECISION ANALYSIS Â· GROUNDED IN iXo CONTEXT</div><h2>{String(result.summary||'Decision context')}</h2>
      <ResultGroup title="WHAT iXo KNOWS" values={arr(result.known_context)}/>
      <ResultGroup title="GOALS AFFECTED" values={arr(result.goals_affected)}/>
      <ResultGroup title="CONSTRAINTS" values={arr(result.constraints)}/>
      <ResultGroup title="OPTIONS / TRADEOFFS" values={arr(result.tradeoffs).length?arr(result.tradeoffs):arr(result.options)}/>
      <ResultGroup title="ASSUMPTIONS WORTH TESTING" values={arr(result.assumptions)}/>
      <ResultGroup title="IMPORTANT UNKNOWNS" values={arr(result.unknowns||result.missing_information)}/>
      <ResultGroup title="RISKS / DEPENDENCIES" values={arr(result.risks_dependencies)}/>
      <ResultGroup title="WHAT WOULD CHANGE THE ANALYSIS?" values={arr(result.what_would_change)}/>
      <ResultGroup title="PRACTICAL NEXT QUESTIONS" values={arr(result.clarifying_questions)}/>
      <details className="contextUsed"><summary>Personal context used Â· {evidence.length}</summary>{evidence.map(f=><p key={f.id}><b>{f.category}</b> Â· {f.value}</p>)}</details>
    </>:<div className="quietState compact"><h2>Your analysis will appear here.</h2><p>Start with the decision itself. The optional fields can add context when you have it.</p></div>}</div></div>
  </section>
}
function ResultGroup({title,values}:{title:string;values:unknown[]}){
  if(!values.length)return null;
  return <section className="resultGroup"><h3>{title}</h3>{values.map((v,i)=><p key={i}>{typeof v==='string'?v:JSON.stringify(v)}</p>)}</section>
}


