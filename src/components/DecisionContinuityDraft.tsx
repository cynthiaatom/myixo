import {useState} from 'react';

/**
 * Decision Continuity interaction prototype — SESSION ONLY.
 * No persistence, tracking, reminders, backend writes, or automatic model calls.
 * Never represent this as a saved account decision. A verified account-scoped
 * persistence contract must be approved before enabling durable saves.
 */
type Outcome='completed'|'partial'|'changed'|'not_started';
type CheckIn={at:string;outcome:Outcome;reported:string;nextStep:string;nextReviewDate:string};
type Draft={title:string;nextStep:string;expectedOutcome:string;reviewDate:string;status:'active'|'paused'|'closed';checkIns:CheckIn[]};

export default function DecisionContinuityDraft({decision,desiredOutcome}:{decision:string;desiredOutcome:string}){
  const [draft,setDraft]=useState<Draft|null>(null);
  const [nextStep,setNextStep]=useState('');
  const [expected,setExpected]=useState(desiredOutcome);
  const [reviewDate,setReviewDate]=useState('');
  const [editing,setEditing]=useState(false);
  const [checking,setChecking]=useState(false);
  const [outcome,setOutcome]=useState<Outcome>('partial');
  const [reported,setReported]=useState('');
  const [followUp,setFollowUp]=useState('');
  const [nextReview,setNextReview]=useState('');
  const [message,setMessage]=useState('');
  const today=new Date().toLocaleDateString('en-CA');

  const store=()=>{
    if(!nextStep.trim()){setMessage('Choose a concrete next step first.');return}
    setDraft(prev=>({
      title:decision.trim(),
      nextStep:nextStep.trim(),
      expectedOutcome:expected.trim(),
      reviewDate,
      status:prev?.status||'active',
      checkIns:prev?.checkIns||[]
    }));
    setEditing(false);setMessage('Kept for this browser session only. This is not saved to your iXo account.');
  };
  const startEdit=()=>{
    if(!draft)return;
    setNextStep(draft.nextStep);setExpected(draft.expectedOutcome);
    setReviewDate(draft.reviewDate);setEditing(true);setMessage('');
  };
  const checkIn=()=>{
    if(!draft||!reported.trim()){setMessage('Describe what actually happened before recording a check-in.');return}
    const item:CheckIn={
      at:new Date().toISOString(),outcome,reported:reported.trim(),
      nextStep:followUp.trim(),nextReviewDate:nextReview
    };
    setDraft({...draft,checkIns:[...draft.checkIns,item],nextStep:item.nextStep||draft.nextStep,
      reviewDate:item.nextReviewDate||draft.reviewDate});
    setChecking(false);setReported('');setFollowUp('');setNextReview('');
    setMessage('Check-in recorded temporarily in this tab. No AI assessment or external action was triggered.');
  };

  return <section className="resultGroup" aria-label="Decision Continuity prototype">
    <div className="eyebrow">DECISION CONTINUITY · INTERACTIVE PROTOTYPE</div>
    <h3>Turn this analysis into a next step.</h3>
    <p><strong>Prototype only:</strong> Your entries remain in this page's temporary memory and will disappear when the page reloads or you leave Decision Lab. This does not save to iXo, send reminders, or change native memory.</p>
    {(!draft||editing)&&<div className="decisionForm">
      <label>NEXT STEP · REQUIRED<textarea value={nextStep} maxLength={1000} onChange={e=>setNextStep(e.target.value)} placeholder="What action will you personally try?"/></label>
      <label>EXPECTED OUTCOME · OPTIONAL<textarea value={expected} maxLength={1000} onChange={e=>setExpected(e.target.value)} placeholder="What are you hoping to learn or change?"/></label>
      <label>REVIEW DATE · OPTIONAL<input type="date" value={reviewDate} min={today} onChange={e=>setReviewDate(e.target.value)}/></label>
      <div className="actions"><button className="primary" onClick={store} disabled={!nextStep.trim()}>{editing?'Update temporary draft':'Try follow-through'}</button>{editing&&<button onClick={()=>setEditing(false)}>Cancel</button>}</div>
    </div>}
    {draft&&!editing&&<div className="decisionForm">
      <p><b>Decision:</b> {draft.title}</p>
      <p><b>Next step:</b> {draft.nextStep}</p>
      {draft.expectedOutcome&&<p><b>Expected outcome:</b> {draft.expectedOutcome}</p>}
      <p><b>Review:</b> {draft.reviewDate||'Not set'} {draft.reviewDate&&draft.reviewDate<=today?'· Due or overdue':''}</p>
      <p><b>Status:</b> {draft.status}</p>
      <div className="actions">
        <button onClick={startEdit}>Edit draft</button>
        <button onClick={()=>{setChecking(!checking);setMessage('')}}>Record what happened</button>
        <button onClick={()=>setDraft({...draft,status:draft.status==='paused'?'active':'paused'})}>{draft.status==='paused'?'Resume':'Pause'}</button>
        <button onClick={()=>setDraft({...draft,status:'closed'})}>Close</button>
        <button onClick={()=>{setDraft(null);setChecking(false);setMessage('Temporary decision discarded.')}}>Discard</button>
      </div>
      {checking&&<div>
        <h3>What actually happened?</h3>
        <label>RESULT<select value={outcome} onChange={e=>setOutcome(e.target.value as Outcome)}>
          <option value="completed">Completed</option><option value="partial">Partially completed</option>
          <option value="changed">Changed direction</option><option value="not_started">Not started</option>
        </select></label>
        <label>YOUR REPORT · REQUIRED<textarea value={reported} maxLength={2000} onChange={e=>setReported(e.target.value)} placeholder="What happened? What worked, and what did not?"/></label>
        <label>REVISED NEXT STEP · OPTIONAL<textarea value={followUp} maxLength={1000} onChange={e=>setFollowUp(e.target.value)} placeholder="What would you do differently?"/></label>
        <label>NEXT REVIEW DATE · OPTIONAL<input type="date" min={today} value={nextReview} onChange={e=>setNextReview(e.target.value)}/></label>
        <div className="actions"><button className="primary" disabled={!reported.trim()} onClick={checkIn}>Record temporary check-in</button><button onClick={()=>setChecking(false)}>Cancel</button></div>
      </div>}
      {draft.checkIns.length>0&&<section>
        <h3>Your reported outcomes</h3>
        {draft.checkIns.map((entry,i)=><div key={i} className="resultGroup">
          <p><b>{new Date(entry.at).toLocaleString()}</b> · {entry.outcome.replace('_',' ')}</p>
          <p><strong>You reported:</strong> {entry.reported}</p>
          {entry.nextStep&&<p><strong>Next step:</strong> {entry.nextStep}</p>}
          {entry.nextReviewDate&&<p><strong>Review date:</strong> {entry.nextReviewDate}</p>}
        </div>)}
      </section>}
    </div>}
    {message&&<p role="status">{message}</p>}
  </section>
}
