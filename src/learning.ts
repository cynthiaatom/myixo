import type {MemoryPayload} from './MemoryInspector';
import {categories,labels,type CategoryId,type PersonalMapModel} from './ixo';
export type KnowledgeType='fact'|'preference'|'goal'|'constraint'|'pattern'|'relationship'|'current_state'|'history'|'uncertainty'|'contradiction';
export type LearningTarget={area:CategoryId;construct:string;knowledgeType:KnowledgeType;state:'unknown'|'weak'|'supported';reason:string;questionIntent:string;crossDomain:CategoryId[];burden:'low'|'medium';priority:number};
export type LearningPlan={targets:LearningTarget[];next:LearningTarget|null;topic:string;summary:string};
const lex:Record<CategoryId,string[]>={
 psychology:['stress','confidence','motivat','decision','overwhelm','control','focus','mood','mindset','uncertain','personality','emotion'],
 health:['sleep','energy','exercise','health','medical','nutrition','pain','fatigue','workout','diet'],
 relationships:['friend','relationship','partner','social','people','connection','support'],
 family:['family','son','daughter','child','parent','husband','wife','caregiv','household'],
 work:['work','job','career','business','project','client','company','role','launch','build'],
 finance:['finance','money','income','budget','invest','cost','financial','saving','spend'],
 development:['learn','skill','develop','growth','expert','training','course','improve'],
 rest:['rest','downtime','recover','vacation','travel','hobby','relax','weekend','switch off'],
 values:['value','matter','priority','meaning','important','principle','freedom','autonomy','purpose'],
 environment:['home','location','environment','office','workspace','city','travel','routine','schedule']
};
const constructs:Record<CategoryId,{name:string,type:KnowledgeType,intent:string,cross:CategoryId[]}[]>={
 psychology:[{name:'decision style',type:'pattern',intent:'learn how you make difficult decisions when the answer is not obvious',cross:['values','work']},{name:'motivation and control',type:'preference',intent:'learn what gives you momentum and what makes you feel in control',cross:['values','work']},{name:'stress response',type:'pattern',intent:'learn what tends to overload you and what actually helps',cross:['health','rest']}],
 health:[{name:'energy and recovery',type:'pattern',intent:'learn what most affects your energy in real life',cross:['rest','work']},{name:'health priorities',type:'goal',intent:'learn what you most want to protect or improve about your health',cross:['values']}],
 relationships:[{name:'important relationships',type:'relationship',intent:'learn which relationships matter most and what you want from them',cross:['family','values']},{name:'support and connection',type:'pattern',intent:'learn who you rely on and how connection fits your life',cross:['psychology']}],
 family:[{name:'family responsibilities',type:'constraint',intent:'learn which family commitments shape your time and choices',cross:['work','values']},{name:'family priorities',type:'goal',intent:'learn what you most want to protect or improve in family life',cross:['values','relationships']}],
 work:[{name:'current priorities',type:'current_state',intent:'learn what you are actually trying to accomplish right now',cross:['values','development']},{name:'work boundaries',type:'constraint',intent:'learn what determines when work expands or stops',cross:['rest','health']},{name:'preferred work style',type:'preference',intent:'learn the conditions in which you do your best work',cross:['environment','psychology']}],
 finance:[{name:'financial priorities',type:'goal',intent:'learn what financial outcomes matter most to you now',cross:['values','work']},{name:'financial constraints',type:'constraint',intent:'learn which financial realities materially shape your choices',cross:['work']}],
 development:[{name:'learning goals',type:'goal',intent:'learn what you want to become genuinely better at',cross:['work','values']},{name:'feedback and learning style',type:'preference',intent:'learn how you prefer to learn, practice and receive feedback',cross:['psychology']}],
 rest:[{name:'restorative activities',type:'preference',intent:'learn what genuinely restores you rather than merely filling free time',cross:['health','psychology']},{name:'recovery constraints',type:'constraint',intent:'learn what most often prevents enough recovery',cross:['work','health']}],
 values:[{name:'tradeoff priorities',type:'preference',intent:'learn what you protect when two important things compete',cross:['work','family']},{name:'meaning and non-negotiables',type:'goal',intent:'learn what makes a choice or period of life feel worthwhile',cross:['development','relationships']}],
 environment:[{name:'daily context',type:'current_state',intent:'learn how your physical setting and routines shape your days',cross:['work','rest']},{name:'environment preferences',type:'preference',intent:'learn which surroundings help you function and feel best',cross:['psychology','work']}]
};
function textOf(memory:MemoryPayload|null){return (memory?.items||[]).map((x:any)=>String(x.category||'')+' '+String(x.value||'')).join(' ').toLowerCase()}
function hits(text:string,words:string[]){return words.reduce((n,w)=>n+(text.includes(w)?1:0),0)}
export function buildLearningPlan(model:PersonalMapModel,memory:MemoryPayload|null):LearningPlan{
 const text=textOf(memory),covered=new Set(model.covered),targets:LearningTarget[]=[];
 for(const area of categories){const areaHits=hits(text,lex[area]);const nativeKnown=covered.has(area);constructs[area].forEach((c,idx)=>{const signal=areaHits+(c.name.split(' ').some(w=>text.includes(w))?1:0);const state:LearningTarget['state']=signal>=3?'supported':signal>0||nativeKnown?'weak':'unknown';const gap=state==='unknown'?3:state==='weak'?2:0;if(!gap)return;const crossYield=c.cross.filter(x=>!covered.has(x)).length;const priority=gap*10+crossYield*3+(nativeKnown?0:4)-idx;targets.push({area,construct:c.name,knowledgeType:c.type,state,reason:state==='unknown'?labels[area]+' has little usable context for '+c.name+'.':'iXo has some '+labels[area]+' context, but '+c.name+' is still thin or indirect.',questionIntent:c.intent,crossDomain:c.cross,burden:'low',priority})})}
 targets.sort((a,b)=>b.priority-a.priority||a.area.localeCompare(b.area));const next=targets[0]||null;
 const topic=next?'Build my Personal Map adaptively. Focus the next question on '+labels[next.area]+' / '+next.construct+': '+next.questionIntent+'. Prefer one concrete, natural, low-burden question about a recent or typical real situation. It may also clarify '+(next.crossDomain.map(x=>labels[x]).join(', ')||'related context')+' when genuinely supported. Do not diagnose, do not ask a generic "what can I help with", do not ask multiple unrelated questions, and do not repeat information already known. Explain briefly why this question is useful.':'Continue learning only if there is a genuinely useful missing piece of personal context. Avoid generic questions and repetition.';
 return {targets,next,topic,summary:next?'Next best learning target: '+labels[next.area]+' · '+next.construct:'No high-value deterministic gap found.'};
}