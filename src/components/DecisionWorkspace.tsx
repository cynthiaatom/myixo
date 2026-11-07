import {useState} from 'react';
import {createDecision,decisionCounts,dueDecisions,recordCheckIn,updateDecision,
  type DecisionData,type DecisionRecord,type DecisionStatus,type DecisionOutcome} from '../decisions/model';

type Props={
  decisions:DecisionRecord[];
  onChange:(apply:(current:DecisionRecord[])=>DecisionRecord[])=>void;
  onAnalyze:()=>void;
};
const blank:DecisionData={title:'',nextStep:'',expectedOutcome:'',reviewDate:''};
const today=()=>{const date=new Date();return [date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');};
const formatDate=(date:string)=>date?new Date(date+'T12:00:00').toLocaleDateString():'Not scheduled';
export default function DecisionWorkspace({decisions,onChange,onAnalyze}:Props){
  const [filter,setFilter]=useState<'all'|'due'|'active'|'paused'|'closed'>('all');
  const [expanded,setExpanded]=useState<string|null>(null);
  const [editing,setEditing]=useState<string|null>(null);
  const [checking,setChecking]=useState<string|null>(null);
  const [form,setForm]=useState<DecisionData>(blank);
  const [outcome,setOutcome]=useState<DecisionOutcome>('partial');
  const [report,setReport]=useState('');
  const [nextStep,setNextStep]=useState('');
  const [nextReview,setNextReview]=useState('');
  const [notice,setNotice]=useState('');
  const counts=decisionCounts(decisions,today());
  const dueIds=new Set(dueDecisions(decisions,today()).map(d=>d.id));
  const visible=decisions.filter(d=>filter==='all'||(filter==='due'?dueIds.has(d.id):d.status===filter))
    .slice().sort((a,b)=>(a.reviewDate||'9999').localeCompare(b.reviewDate||'9999')||b.updatedAt.localeCompare(a.updatedAt));
  const beginEdit=(d:DecisionRecord)=>{
    setForm({title:d.title,nextStep:d.nextStep,expectedOutcome:d.expectedOutcome,reviewDate:d.reviewDate});
    setEditing(d.id);setExpanded(d.id);setChecking(null);setNotice('');
  };
  const save=()=>{
    try{
      const record=editing?undefined:createDecision(form);
      onChange(items=>editing?items.map(d=>d.id===editing?updateDecision(d,form):d):[record!,...items]);
      setEditing(null);setForm(blank);setNotice('Updated in this tab only. No permanent account save has occurred.');
    }catch(e:any){setNotice(e.message)}
  };
  const updateStatus=(d:DecisionRecord,status:DecisionStatus)=>{
    onChange(items=>items.map(item=>item.id===d.id?updateDecision(item,{status}):item));
    setNotice('Status updated in this tab.');};
  const checkIn=(d:DecisionRecord)=>{
    try{
      onChange(items=>items.map(item=>item.id===d.id?recordCheckIn(item,{outcome,reported:report,nextStep,nextReviewDate:nextReview}):item));
      setChecking(null);setReport('');setNextStep('');setNextReview('');
      setNotice('Reported outcome added to this tab. No native iXo memory was changed.');
    }catch(e:any){setNotice(e.message)}
  };
  return <section className="intelligenceView">
    <div className="viewHero"><div className="eyebrow">MY DECISIONS · DECISION CONTINUITY</div>
      <h1>MAKE PROGRESS. <em>COME BACK.</em></h1>
      <p>Keep your decisions, follow-through steps, and reported outcomes together—so you can see what changed and choose what comes next.</p>
    </div>
    <div className="decisionSessionNotice" role="note"><strong>Development preview · temporary session</strong>
      <p>Records stay only in this open app session. They are not yet saved to iXo or Supabase, survive neither reload nor logout, and do not send reminders. Use fictional examples until secure permanent storage is connected.</p>
    </div>
    <div className="decisionMetrics">
      <div><strong>{counts.active}</strong><span>Active decisions</span></div>
      <div><strong>{counts.due}</strong><span>Ready to review</span></div>
      <div><strong>{counts.closed}</strong><span>Closed decisions</span></div>
      <div><strong>{counts.total}</strong><span>In this session</span></div>
    </div>
    <div className="decisionWorkspaceActions">
      <button className="primary" onClick={()=>{setForm(blank);setEditing('new');setNotice('')}}>Add decision manually</button>
      <button onClick={onAnalyze}>Analyze a decision with iXo</button>
    </div>
    {editing==='new'&&<div className="decisionEditPanel">
      <h2>Create a decision</h2>
      <DecisionFields form={form} onChange={setForm}/>
      <div className="actions"><button className="primary" disabled={!form.title.trim()||!form.nextStep.trim()} onClick={()=>{try{const d=createDecision(form);onChange(items=>[d,...items]);setExpanded(d.id);setEditing(null);setForm(blank);setNotice('Temporary decision added.')}catch(e:any){setNotice(e.message)}}}>Add to this session</button>
      <button onClick={()=>setEditing(null)}>Cancel</button></div>
    </div>}
    <div className="decisionFilters" aria-label="Filter decisions">
      {(['all','due','active','paused','closed'] as const).map(v=><button key={v} aria-pressed={filter===v} className={filter===v?'active':''} onClick={()=>setFilter(v)}>{v==='due'?'Due for review':v.charAt(0).toUpperCase()+v.slice(1)}</button>)}
    </div>
    {!visible.length&&<div className="quietState compact"><h2>{decisions.length?'No decisions match this filter.':'Your decision history starts here.'}</h2>
      <p>{decisions.length?'Try a different status filter.':'Add a next step and review date to begin a follow-through experiment.'}</p></div>}
    <div className="decisionCards">
      {visible.map(d=><article className="decisionCard" key={d.id}>
        <div className="decisionCardHead">
          <div><span className="eyebrow">{dueIds.has(d.id)?'REVIEW DUE · ':''}{d.status.toUpperCase()}</span><h2>{d.title}</h2><p>{d.nextStep}</p></div>
          <div className="decisionReviewDate"><span>REVIEW</span><strong>{formatDate(d.reviewDate)}</strong></div>
        </div>
        {d.expectedOutcome&&<p className="decisionGoal">Hoped-for result: {d.expectedOutcome}</p>}
        <div className="actions">
          <button aria-expanded={expanded===d.id} onClick={()=>{setExpanded(expanded===d.id?null:d.id);setChecking(null)}}>{expanded===d.id?'Hide details':'View progress'} · {d.checkIns.length} check-ins</button>
          <button onClick={()=>{setExpanded(d.id);setChecking(d.id);setEditing(null);setNotice('')}}>Record outcome</button>
          <button onClick={()=>beginEdit(d)}>Edit</button>
        </div>
        {expanded===d.id&&<div className="decisionExpanded">
          {editing===d.id&&<div className="decisionEditPanel"><h3>Edit next step and review date</h3><DecisionFields form={form} onChange={setForm}/>
            <div className="actions"><button className="primary" onClick={save}>Update temporary decision</button><button onClick={()=>setEditing(null)}>Cancel</button></div></div>}
          {checking===d.id&&<div className="decisionEditPanel"><h3>What happened since your last review?</h3>
            <label>OUTCOME<select value={outcome} onChange={e=>setOutcome(e.target.value as DecisionOutcome)}>
              <option value="completed">Completed</option><option value="partial">Partially completed</option><option value="changed">Changed direction</option><option value="not_started">Not started</option>
            </select></label>
            <label>YOUR REPORT<textarea value={report} maxLength={2000} onChange={e=>setReport(e.target.value)} placeholder="What worked? What didn't? What changed?"/></label>
            <label>REVISED NEXT STEP · OPTIONAL<textarea value={nextStep} maxLength={1000} onChange={e=>setNextStep(e.target.value)}/></label>
            <label>NEXT REVIEW · OPTIONAL<input type="date" min={today()} value={nextReview} onChange={e=>setNextReview(e.target.value)}/></label>
            <div className="actions"><button className="primary" disabled={!report.trim()} onClick={()=>checkIn(d)}>Add check-in</button><button onClick={()=>setChecking(null)}>Cancel</button></div>
          </div>}
          <h3>Review history</h3>
          {!d.checkIns.length&&<p>No outcomes reported yet. You decide when to check back.</p>}
          {d.checkIns.map(c=><div className="decisionCheckIn" key={c.id}>
            <time>{new Date(c.at).toLocaleString()}</time><strong>{c.outcome.replace('_',' ')}</strong>
            <p>{c.reported}</p>{c.nextStep&&<p>Revised step: {c.nextStep}</p>}
          </div>)}
          <div className="actions">
            {d.status!=='closed'&&<button onClick={()=>updateStatus(d,d.status==='paused'?'active':'paused')}>{d.status==='paused'?'Resume':'Pause'}</button>}
            {d.status!=='closed'&&<button onClick={()=>updateStatus(d,'closed')}>Close decision</button>}
            {d.status==='closed'&&<button onClick={()=>updateStatus(d,'active')}>Reopen</button>}
            <button onClick={()=>{if(window.confirm('Discard this temporary decision and its check-ins?')){onChange(items=>items.filter(item=>item.id!==d.id));setExpanded(null);setNotice('Temporary decision discarded.')}}}>Discard</button>
          </div>
        </div>}
      </article>)}
    </div>
    {notice&&<p role="status" className="decisionNotice">{notice}</p>}
  </section>;
}

function DecisionFields({form,onChange}:{form:DecisionData;onChange:(data:DecisionData)=>void}){
  return <div className="decisionForm">
    <label>DECISION · REQUIRED<textarea maxLength={500} value={form.title} onChange={e=>onChange({...form,title:e.target.value})} placeholder="What am I deciding?"/></label>
    <label>NEXT STEP · REQUIRED<textarea maxLength={1000} value={form.nextStep} onChange={e=>onChange({...form,nextStep:e.target.value})} placeholder="What will I actually try?"/></label>
    <label>EXPECTED OUTCOME · OPTIONAL<textarea maxLength={1000} value={form.expectedOutcome} onChange={e=>onChange({...form,expectedOutcome:e.target.value})}/></label>
    <label>REVIEW DATE · OPTIONAL<input type="date" value={form.reviewDate} onChange={e=>onChange({...form,reviewDate:e.target.value})}/></label>
  </div>;
}
