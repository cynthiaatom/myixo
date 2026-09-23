import type {Explanation} from '../intelligence/types';

export default function ExplainPanel({explanation,onClose,onCorrect}:{explanation:Explanation;onClose:()=>void;onCorrect?:()=>void}){
  return <div className="explainBackdrop" onMouseDown={onClose}><aside className="explainPanel" onMouseDown={e=>e.stopPropagation()}>
    <div className="explainTop"><div><div className="eyebrow">EXPLAIN MY iXo</div><h2>Why do you think that?</h2></div><button onClick={onClose}>×</button></div>
    <section><h3>CONCLUSION / OBSERVATION</h3><p>{explanation.observation}</p></section>
    <section><h3>WHAT iXo KNOWS</h3>{explanation.known.length?explanation.known.map((x,i)=><p key={i}>{x}</p>):<p className="muted">No stored fact was required.</p>}</section>
    <section><h3>WHAT iXo INFERRED</h3>{explanation.inferred.length?explanation.inferred.map((x,i)=><p key={i}>{x}</p>):<p className="muted">No additional inference was required.</p>}</section>
    <section><h3>WHAT iXo DOESN'T KNOW</h3>{explanation.unknown.length?explanation.unknown.map((x,i)=><p key={i}>{x}</p>):<p className="muted">No material unknown was identified.</p>}</section>
    <section><h3>SOURCES</h3>{explanation.sources.length?explanation.sources.map(s=><div className="evidenceRow" key={s.kind+':'+s.id}><span>{s.kind.replace(/_/g,' ')}</span><div><b>{s.label}</b><p>{s.detail}</p></div></div>):<p className="muted">No source record available.</p>}</section>
    {onCorrect&&<button className="primary" onClick={onCorrect}>Correct my iXo in Memory →</button>}
  </aside></div>
}
