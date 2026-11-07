export type ProductView='me'|'memory'|'today'|'mirror'|'decide'|'decisions'|'ask'|'timeline';

export default function ProductNav({active,onNavigate}:{active:ProductView;onNavigate:(v:ProductView)=>void}){
  const main:[ProductView,string][]=[['me','ME'],['memory','MEMORY'],['today','TODAY'],['mirror','MIRROR'],['decide','DECIDE'],['decisions','MY DECISIONS']];
  return <nav className="productNav" aria-label="My iXo">
    <div className="productNavMain">{main.map(([id,label])=><button key={id} className={active===id?'active':''} onClick={()=>onNavigate(id)}>{label}</button>)}</div>
    <div className="productNavTools"><button className={active==='timeline'?'active':''} onClick={()=>onNavigate('timeline')}>TIMELINE</button><button className={'askNav '+(active==='ask'?'active':'')} onClick={()=>onNavigate('ask')}>ASK MY iXo</button></div>
  </nav>
}
