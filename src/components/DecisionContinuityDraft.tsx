import {useState} from 'react';
import type {DecisionData} from '../decisions/model';

export default function DecisionContinuityDraft({decision,desiredOutcome,onAdd}:{
  decision:string;desiredOutcome:string;onAdd:(data:DecisionData)=>void
}){
  const [nextStep,setNextStep]=useState('');
  const [expected,setExpected]=useState(desiredOutcome);
  const [reviewDate,setReviewDate]=useState('');
  const [message,setMessage]=useState('');
  const add=()=>{
    if(!decision.trim()||!nextStep.trim()){setMessage('Decision and next step are required.');return}
    onAdd({title:decision,nextStep,expectedOutcome:expected,reviewDate});
    setMessage('Added to My Decisions for this open app session; no account-level save yet.');
    setNextStep('');
  };
  return <section className="resultGroup" aria-label="Decision Continuity prototype">
    <div className="eyebrow">DECISION CONTINUITY · FOLLOW THROUGH</div>
    <h3>Turn the analysis into an action.</h3>
    <p>Make the next step yours. The My Decisions workspace can track subsequent check-ins and changes during this open session. Permanent saving is not yet connected.</p>
    <div className="decisionForm">
      <label>NEXT STEP · REQUIRED<textarea maxLength={1000} value={nextStep} onChange={e=>setNextStep(e.target.value)} placeholder="What will you try?"/></label>
      <label>EXPECTED OUTCOME · OPTIONAL<textarea maxLength={1000} value={expected} onChange={e=>setExpected(e.target.value)}/></label>
      <label>REVIEW DATE · OPTIONAL<input type="date" value={reviewDate} onChange={e=>setReviewDate(e.target.value)}/></label>
      <button className="primary" onClick={add} disabled={!nextStep.trim()}>Add to My Decisions</button>
    </div>
    {message&&<p role="status">{message}</p>}
  </section>;
}
