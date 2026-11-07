import {useState} from 'react';
import type {DecisionData} from '../decisions/model';

export default function DecisionContinuityDraft({decision,desiredOutcome,onAdd}:{
  decision:string;desiredOutcome:string;onAdd:(data:DecisionData)=>Promise<void>
}){
  const [nextStep,setNextStep]=useState('');
  const [expected,setExpected]=useState(desiredOutcome);
  const [reviewDate,setReviewDate]=useState('');
  const [message,setMessage]=useState('');
  const [saving,setSaving]=useState(false);
  const add=async()=>{
    if(!decision.trim()||!nextStep.trim()){setMessage('Decision and next step are required.');return}
    if(saving)return;
    setSaving(true);setMessage('');
    try{
      await onAdd({title:decision,nextStep,expectedOutcome:expected,reviewDate});
      setNextStep('');
    }catch(e:any){setMessage(e?.message||'Decision could not be added. No save was confirmed.')}
    finally{setSaving(false)}
  };
  return <section className="resultGroup" aria-label="Decision Continuity prototype">
    <div className="eyebrow">DECISION CONTINUITY · FOLLOW THROUGH</div>
    <h3>Turn the analysis into an action.</h3>
    <p>Make the next step yours. The My Decisions workspace can track subsequent check-ins and changes during this open session. Permanent saving is not yet connected.</p>
    <div className="decisionForm">
      <label>NEXT STEP · REQUIRED<textarea maxLength={1000} value={nextStep} onChange={e=>setNextStep(e.target.value)} placeholder="What will you try?"/></label>
      <label>EXPECTED OUTCOME · OPTIONAL<textarea maxLength={1000} value={expected} onChange={e=>setExpected(e.target.value)}/></label>
      <label>REVIEW DATE · OPTIONAL<input type="date" value={reviewDate} onChange={e=>setReviewDate(e.target.value)}/></label>
      <button className="primary" onClick={()=>void add()} disabled={saving||!nextStep.trim()}>{saving?'Saving...':'Add to My Decisions'}</button>
    </div>
    {message&&<p role="status">{message}</p>}
  </section>;
}
