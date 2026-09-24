import {useState} from 'react';
import {openRunEvents,startReasoning,waitForReasoning} from '../services/reasoning';
import type {MemoryFact,ReasoningResult} from '../intelligence/types';

export default function AskIxoView(){
  const [question,setQuestion]=useState('');
  const [result,setResult]=useState<ReasoningResult|null>(null);
  const [evidence,setEvidence]=useState<MemoryFact[]>([]);
  const [working,setWorking]=useState(false);
  const [status,setStatus]=useState('');
  const [error,setError]=useState('');
  const [contextState,setContextState]=useState<'ready'|'insufficient_context'|'unknown'>('unknown');

  const ask=async()=>{
    if(!question.trim())return;
    setWorking(true);setResult(null);setError('');setStatus('starting');
    try{
      const job=await startReasoning('personalized',{question});
      setEvidence(job.evidence||[]);setContextState(job.context_status||'unknown');
      const close=openRunEvents(job.run_id,s=>setStatus(s));
      try{setResult(await waitForReasoning(job,s=>setStatus(s)))}finally{close()}
    }catch(e:any){setError(e.message||'Could not ask iXo')}
    finally{setWorking(false)}
  };

  const arr=(x:unknown)=>Array.isArray(x)?x:[];
  const used=new Set(arr(result?.context_used).map(String).map(x=>x.replace(/[\[\]]/g,'')));
  const usedFacts=evidence.filter(f=>used.has(f.id)||arr(result?.context_used).some(x=>String(x).includes(f.id)));

  return <section className="intelligenceView">
    <div className="viewHero"><div className="eyebrow">ASK MY iXo</div><h1>WHAT CHANGES WHEN AI <em>KNOWS ME?</em></h1><p>Personal context is used only when it materially affects the reasoning.</p></div>
    <div className="askComposer"><textarea value={question} onChange={e=>setQuestion(e.target.value)} placeholder="Ask something where your goals, constraints, priorities or situation could matter…"/><button className="primary" disabled={working||!question.trim()} onClick={ask}>{working?'My iXo is thinking…':'Ask My iXo →'}</button>{working&&<span>LIVE RUN · {status||'working'}</span>}{error&&<div className="connectError"><b>ASK reasoning failed.</b><p>{error}</p><button onClick={ask}>Try again</button></div>}{!working&&!error&&contextState==='insufficient_context'&&<div className="contextNotice">No relevant durable memory was selected. The answer can still be useful, but it is not being presented as personalized.</div>}</div>
    <div className="compareGrid">
      <article className="genericCompare"><div className="eyebrow">ASK AI</div><h2>Context-free comparison</h2><p>Not generated yet. The current iXo run API does not expose a verifiable “memory off” mode. This product will not pretend a memory-aware agent is generic.</p><div className="trustBadge">HELD BACK FOR TRUST</div></article>
      <article className="personalCompare"><div className="eyebrow">ASK MY iXo · GROUNDED REASONING</div>{result?<><h2>{String(result.answer||result.summary||'')}</h2>
        <div className={"runAudit "+((result.runtime_tool_activity||[]).length?'warning':'clean')}>{(result.runtime_tool_activity||[]).length?('Additional runtime tools were observed: '+(result.runtime_tool_activity||[]).join(', ')+'.'):'No additional runtime tool calls were observed. Hidden runtime context isolation is not independently verifiable.'}</div>
        <div className="contextDelta"><b>{result.why_context_changed_answer?'Your personal context changed this answer.':'Personal context did not materially change this answer.'}</b>{result.why_context_changed_answer&&<p>{String(result.why_context_changed_answer)}</p>}</div>
        <Result title="PERSONAL CONTEXT USED" values={usedFacts.map(f=>f.category+': '+f.value)}/>
        <Result title="ASSUMPTIONS" values={arr(result.assumptions)}/>
        <Result title="MISSING INFORMATION" values={arr(result.missing_information)}/>
      </>:<p className="muted">Your personalized answer will appear here.</p>}</article>
    </div>
  </section>
}
function Result({title,values}:{title:string;values:unknown[]}){if(!values.length)return null;return <div className="askResultGroup"><span>{title}</span>{values.map((x,i)=><p key={i}>{String(x)}</p>)}</div>}
