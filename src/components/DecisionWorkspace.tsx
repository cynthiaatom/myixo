import {useState} from 'react';
import {createDecision,decisionCounts,dueDecisions,recordCheckIn,updateDecision,
  type DecisionData,type DecisionRecord,type DecisionStatus,type DecisionOutcome} from '../decisions/model';

type Props={
  decisions:DecisionRecord[];
  onChange:(apply:(current:DecisionRecord[])=>DecisionRecord[])=>Promise<void>;
  onAnalyze:()=>void;
  storageMode:'session'|'loading'|'private'|'error';
  storageMessage:string;
  pending:boolean;
};
const blank:DecisionData={title:'',nextStep:'',expectedOutcome:'',reviewDate:''};
const today=()=>{const date=new Date();return [date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');};
const formatDate=(date:string)=>date?new Date(date+'T12:00:00').toLocaleDateString():'Not scheduled';
export default function DecisionWorkspace({decisions,onChange,onAnalyze,storageMode,storageMessage,pending}:Props){
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
  const commit=async(change:(current:DecisionRecord[])=>DecisionRecord[],success:string)=>{
    try{
      await onChange(change);
      setNotice(storageMode==='private'?'Saved to your private My iXo decision account.':success);
      return true;
    }catch(e:any){setNotice(e?.message||'The change could not be saved.');return false}
  };
  const save=async()=>{
    const ok=await commit(items=>items.map(d=>d.id===editing?updateDecision(d,form):d),'Updated in this tab only. No permanent account save has occurred.');
    if(ok){setEditing(null);setForm(blank)}
  };
  const updateStatus=async(d:DecisionRecord,status:DecisionStatus)=>{
    await commit(items=>items.map(item=>item.id===d.id?updateDecision(item,{status}):item),'Status updated in this tab only.');
  };
  const checkIn=async(d:DecisionRecord)=>{
    const ok=await commit(items=>items.map(item=>item.id===d.id?recordCheckIn(item,{outcome,reported:report,nextStep,nextReviewDate:nextReview}):item),'Reported outcome added to this tab. No native iXo memory was changed.');
    if(ok){setChecking(null);setReport('');setNextStep('');setNextReview('')}
  };
  return <section className="intelligenceView">
    <div className="viewHero"><div className="eyebrow">MY DECISIONS · DECISION CONTINUITY</div>
      <h1>MAKE PROGRESS. <em>COME BACK.</em></h1>
      <p>Keep your decisions, follow-through steps, and reported outcomes together—so you can see what changed and choose what comes next.</p>
    </div>
    <div className="decisionSessionNotice" role="status"><strong>{storageMode==='private'?'Private account storage connected':storageMode==='loading'?'Checking private storage':storageMode==='error'?'Private storage unavailable':'Development preview · temporary session'}</strong>
      <p>{storageMode==='private'?'Decisions and check-ins are saved by the private account service after an acknowledged server response. You can return on another device using the same authenticated iXo account.':storageMode==='loading'?'Verifying the private account-specific decision database; editing is temporarily unavailable.':storageMessage||'Records stay only in this open app session. They are not saved to iXo or Supabase, and will not survive reload or logout. Use fictional examples until private storage is connected.'}</p>
    </div>
    <div className="decisionMetrics">
      <div><strong>{counts.active}</strong><span>Active decisions</span></div>
      <div><strong>{counts.due}</strong><span>Ready to review</span></div>
      <div><strong>{counts.closed}</strong><span>Closed decisions</span></div>
      <div><strong>{counts.total}</strong><span>In this session</span></div>
    </div>
    <div className="decisionWorkspaceActions">
      <button className="primary" disabled={pending||storageMode==='loading'||storageMode==='error'} onClick={()=>{setForm(blank);setEditing('new');setNotice('')}}>Add decision manually</button>
      <button onClick={onAnalyze}>Analyze a decision with iXo</button>
    </div>
    {editing==='new'&&<div className="decisionEditPanel">
      <h2>Create a decision</h2>
      <DecisionFields form={form} onChange={setForm}/>
      <div className="actions"><button className="primary" disabled={pending||storageMode==='loading'||storageMode==='error'||!form.title.trim()||!form.nextStep.trim()} onClick={async()=>{try{const d=createDecision(form);const ok=await commit(items=>[d,...items],'Temporary decision added.');if(ok){setExpanded(d.id);setEditing(null);setForm(blank)}}catch(e:any){setNotice(e.message)}}}>{pending?'Saving...':storageMode==='private'?'Save decision':'Add to this session'}</button>
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
          <button disabled={pending||storageMode==='loading'||storageMode==='error'} onClick={()=>{setExpanded(d.id);setChecking(d.id);setEditing(null);setNotice('')}}>Record outcome</button>
          <button disabled={pending||storageMode==='loading'||storageMode==='error'} onClick={()=>beginEdit(d)}>Edit</button>
        </div>
        {expanded===d.id&&<div className="decisionExpanded">
          {editing===d.id&&<div className="decisionEditPanel"><h3>Edit next step and review date</h3><DecisionFields form={form} onChange={setForm}/>
            <div className="actions"><button className="primary" disabled={pending||storageMode==='loading'||storageMode==='error'} onClick={()=>void save()}>{pending?'Saving...':'Update decision'}</button><button onClick={()=>setEditing(null)}>Cancel</button></div></div>}
          {checking===d.id&&<div className="decisionEditPanel"><h3>What happened since your last review?</h3>
            <label>OUTCOME<select value={outcome} onChange={e=>setOutcome(e.target.value as DecisionOutcome)}>
              <option value="completed">Completed</option><option value="partial">Partially completed</option><option value="changed">Changed direction</option><option value="not_started">Not started</option>
            </select></label>
            <label>YOUR REPORT<textarea value={report} maxLength={2000} onChange={e=>setReport(e.target.value)} placeholder="What worked? What didn't? What changed?"/></label>
            <label>REVISED NEXT STEP · OPTIONAL<textarea value={nextStep} maxLength={1000} onChange={e=>setNextStep(e.target.value)}/></label>
            <label>NEXT REVIEW · OPTIONAL<input type="date" min={today()} value={nextReview} onChange={e=>setNextReview(e.target.value)}/></label>
            <div className="actions"><button className="primary" disabled={pending||storageMode==='loading'||storageMode==='error'||!report.trim()} onClick={()=>void checkIn(d)}>Add check-in</button><button onClick={()=>setChecking(null)}>Cancel</button></div>
          </div>}
          <h3>Review history</h3>
          {!d.checkIns.length&&<p>No outcomes reported yet. You decide when to check back.</p>}
          {d.checkIns.map(c=><div className="decisionCheckIn" key={c.id}>
            <time>{new Date(c.at).toLocaleString()}</time><strong>{c.outcome.replace('_',' ')}</strong>
            <p>{c.reported}</p>{c.nextStep&&<p>Revised step: {c.nextStep}</p>}
          </div>)}
          <div className="actions">
            {d.status!=='closed'&&<button disabled={pending||storageMode==='loading'||storageMode==='error'} onClick={()=>void updateStatus(d,d.status==='paused'?'active':'paused')}>{d.status==='paused'?'Resume':'Pause'}</button>}
            {d.status!=='closed'&&<button disabled={pending||storageMode==='loading'||storageMode==='error'} onClick={()=>void updateStatus(d,'closed')}>Close decision</button>}
            {d.status==='closed'&&<button disabled={pending||storageMode==='loading'||storageMode==='error'} onClick={()=>void updateStatus(d,'active')}>Reopen</button>}
            <button disabled={pending||storageMode==='loading'||storageMode==='error'} onClick={async()=>{if(window.confirm('Delete this decision and its check-ins?')){const ok=await commit(items=>items.filter(item=>item.id!==d.id),'Temporary decision discarded.');if(ok)setExpanded(null)}}}>Discard</button>
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
