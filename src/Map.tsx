import {useMemo} from 'react';
import {categories,labels,aspects,aspectLabels,type PersonalMapModel,type CategoryId,mapProgress} from './ixo';

const C=220,R=[[62,96],[102,136],[142,176]],G=2.4;
function p(a:number,r:number){const z=(a-90)*Math.PI/180;return{x:Math.round((C+r*Math.cos(z))*1000)/1000,y:Math.round((C+r*Math.sin(z))*1000)/1000}}
function path(a:number,b:number,i:number,o:number){const q=[p(a,o),p(b,o),p(b,i),p(a,i)];return`M ${q[0].x} ${q[0].y} A ${o} ${o} 0 0 1 ${q[1].x} ${q[1].y} L ${q[2].x} ${q[2].y} A ${i} ${i} 0 0 0 ${q[3].x} ${q[3].y} Z`}

export default function Map({model,highlight=[]}:{model:PersonalMapModel,highlight?:CategoryId[]}){
  const hi=useMemo(()=>new Set(highlight),[highlight]);
  const covered=new Set(model.covered);
  const progress=mapProgress(model);
  const sl=36;

  return <svg viewBox="0 0 440 440" className="map" role="img" aria-label={model.mode==='areas'?('Personal Map '+progress.current+' of 10 areas with saved context'):('Personal Map '+progress.current+' of 30 context dimensions')}>
    <defs><radialGradient id="core"><stop offset="0" stopColor="var(--gold)" stopOpacity=".7"/><stop offset="1" stopColor="var(--gold)" stopOpacity="0"/></radialGradient></defs>
    <circle cx={C} cy={C} r="200" fill="url(#core)" opacity=".25"/>
    {categories.map((cat,ci)=>{
      const a=ci*sl+G/2,b=(ci+1)*sl-G/2,mid=(a+b)/2,l=p(mid,200);
      if(model.mode==='areas'){
        const known=covered.has(cat);
        return <g key={cat}>
          <path d={path(a,b,R[0][0],R[2][1])} fill={known?'var(--gold)':'var(--raised)'} stroke={known?'var(--gold2)':'var(--border)'} className={hi.has(cat)?'ignite':known?'breathe':'dim'}>
            <title>{labels[cat]} — {known?'iXo has saved context':'no saved context yet'}</title>
          </path>
          <text x={l.x} y={l.y} textAnchor="middle" dominantBaseline="middle">{labels[cat]}</text>
        </g>
      }
      return <g key={cat}>
        {aspects.map((asp,ai)=>{
          const known=model.map[cat].includes(asp);
          return <path key={asp} d={path(a,b,R[ai][0],R[ai][1])} fill={known?'var(--gold)':'var(--raised)'} stroke={known?'var(--gold2)':'var(--border)'} className={hi.has(cat)&&known?'ignite':known?'breathe':'dim'}>
            <title>{labels[cat]} — {aspectLabels[asp]}: {known?'known':'not yet known'}</title>
          </path>
        })}
        <text x={l.x} y={l.y} textAnchor="middle" dominantBaseline="middle">{labels[cat]}</text>
      </g>
    })}
    <circle cx={C} cy={C} r="54" fill="var(--deep)" stroke="var(--border)"/>
    <text x={C} y={C-5} textAnchor="middle" className="pct">{progress.label}</text>
    <text x={C} y={C+17} textAnchor="middle" className="small">{model.mode==='areas'?'AREAS':'DIMENSIONS'}</text>
  </svg>
}
