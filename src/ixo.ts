export const categories=['psychology','health','relationships','family','work','finance','development','rest','values','environment'] as const;
export const labels={psychology:'Psychology',health:'Health',relationships:'Relationships',family:'Family',work:'Work',finance:'Finances',development:'Development',rest:'Rest',values:'Values',environment:'Environment'} as const;
export const aspects=['situation','priorities','goals'] as const;
export const aspectLabels={situation:'Current situation',priorities:'What matters to you',goals:'Goals & desired changes'} as const;

export type CategoryId=typeof categories[number];
export type AspectId=typeof aspects[number];
export type MapState=Record<CategoryId,AspectId[]>;
export type PersonalMapModel={
  mode:'areas'|'aspects';
  map:MapState;
  covered:CategoryId[];
  nativePercent:number|null;
  source:'native'|'demo';
};

const emptyMap=()=>Object.fromEntries(categories.map(c=>[c,[] as AspectId[]])) as MapState;
export const seed:MapState={psychology:[],health:['situation'],relationships:['situation'],family:['situation'],work:['situation'],finance:[],development:[],rest:['situation'],values:['priorities'],environment:['situation','priorities']};

export const questions=[
{prompt:'When you picture a normal weekday, what tends to shape how your day actually goes?',helper:'Tell iXo what usually takes your time and attention, what affects your energy or mood, what you wish you had more control over, and what matters most to you during a normal week.',placeholder:'For example: What fills most of your day? What gives you energy or drains it? When do you feel most in control, and what would you like to make more room for?',chips:['My schedule is usually full, and I want more control over where my time and energy go.','Work takes most of my attention, and I have a hard time fully switching off afterward.','My energy has a big effect on my day, so sleep, exercise, and downtime matter a lot to me.'],fills:[['psychology','situation'],['psychology','priorities'],['rest','priorities'],['health','priorities'],['values','situation']]},
{prompt:'What are you focused on building or improving in your life right now?',helper:'Think about your work, career, skills, finances, or a project you are developing. Tell iXo what you are working on now, why it matters to you, and what you would like to accomplish next.',placeholder:'For example: What are you working toward professionally? What skill are you developing? Is there something about your finances, business, or responsibilities you want to improve?',chips:['I want to spend less time managing day-to-day tasks and more time building systems, strategy, or something that can grow.','I am developing a skill or area of expertise that I want to become genuinely strong at.','I want my finances to be more organized and predictable so they require less day-to-day attention.'],fills:[['work','priorities'],['work','goals'],['development','situation'],['development','priorities'],['finance','situation']]},
{prompt:'If the next three years went really well, what would be different about your life?',helper:'Describe what success would actually look like. You can include your work, income or financial security, skills, home or location, freedom, responsibilities, or how you would spend your time.',placeholder:'For example: What would you be doing differently? What would you have accomplished or learned? How would your finances, home, work, or freedom be different?',chips:['I would have fewer obligations pulling me in different directions and more freedom to choose how I spend my time.','I would have developed expertise that people know and trust me for, with work that reflects that strength.','I would have greater financial stability and a home or work environment that supports the way I want to live and work.'],fills:[['finance','priorities'],['finance','goals'],['development','goals'],['environment','goals']]},
{prompt:'Which relationships would you most like to strengthen over the next year?',helper:'Think about your partner, close friends, family, children, parents, or other important people. Tell iXo who you want to feel closer to, what is working now, and what you would like to change.',placeholder:'For example: Who would you like to spend more meaningful time with? Is there a relationship you want to strengthen, repair, or protect from work and other demands?',chips:['I want deeper relationships with a smaller number of people and more meaningful time together.','I want to protect regular family time instead of letting work or other commitments continually take its place.','I want more unhurried conversations and time with the people I care about, without everything being scheduled around work.'],fills:[['relationships','priorities'],['relationships','goals'],['family','priorities'],['family','goals']]},
{prompt:'What helps you genuinely recover and feel like yourself again?',helper:'Think beyond simply having time off. Tell iXo what restores your physical energy and mental energy, what currently gets in the way of recovery, and what you would like your rest routine to look like.',placeholder:'For example: How much sleep do you need? What activities help you reset? Do you need quiet, exercise, social time, hobbies, travel, time outside, or less screen and work time?',chips:['Consistent, good-quality sleep makes the biggest difference in how I feel and function.','I need regular downtime where I can mentally disconnect from work and responsibilities without having to leave town.','Quiet time, movement, being outside, or time away from screens helps me reset and feel restored.'],fills:[['health','goals'],['rest','goals']]},
{prompt:'What is one meaningful change you would like to see in yourself or the way you live?',helper:'Think about your mindset, habits, priorities, stress, confidence, boundaries, or how you spend your time. Tell iXo what you want to change, why it matters, and what being successful would look like.',placeholder:'For example: Would you like to feel calmer, more confident, more focused, or less stressed? Do you want your daily choices to better reflect what matters to you?',chips:['I want to feel calmer and less mentally overloaded, even when life and work are busy.','I want the way I spend my time to better reflect the people, goals, and priorities that matter most to me.','I want stronger boundaries and habits so I can make progress without feeling like I always have to be working.'],fills:[['psychology','goals'],['values','goals']],final:true}
] as const;

export function cloneSeed():MapState{return Object.fromEntries(categories.map(c=>[c,[...seed[c]]])) as MapState}
export function count(m:MapState){return categories.reduce((n,c)=>n+m[c].length,0)}
export function coverage(m:MapState){return Math.round(count(m)/30*100)}

export function demoPersonalMap():PersonalMapModel{
  const map=cloneSeed();
  return {mode:'aspects',map,covered:categories.filter(c=>map[c].length>0),nativePercent:coverage(map),source:'demo'};
}

const categoryAliases:Record<string,CategoryId>={
  psychology:'psychology',psychological:'psychology',
  health:'health',
  relationships:'relationships',relationship:'relationships',
  family:'family',
  work:'work',
  finance:'finance',finances:'finance',financial:'finance',
  development:'development',growth:'development',
  rest:'rest',
  values:'values',value:'values',
  environment:'environment'
};

const aspectAliases:Record<string,AspectId>={
  situation:'situation','current situation':'situation',current:'situation',
  priorities:'priorities',priority:'priorities','what matters to you':'priorities',
  goals:'goals',goal:'goals','goals & desired changes':'goals','goals and desired changes':'goals'
};

const normalized=(v:unknown)=>String(v??'').trim().toLowerCase().replace(/[_-]+/g,' ').replace(/\s+/g,' ');
const categoryOf=(v:unknown)=>categoryAliases[normalized(v)]||null;
const aspectOf=(v:unknown)=>aspectAliases[normalized(v)]||null;

function parseJson(value:unknown):unknown{
  if(typeof value!=='string')return value;
  const s=value.trim();
  if(!s)return null;
  try{return JSON.parse(s)}catch{return value}
}

function rowsFrom(node:unknown,depth=0):unknown[]{
  const value=parseJson(node);
  if(depth>4||value==null)return [];
  if(Array.isArray(value))return value;
  if(typeof value!=='object')return [];
  const o=value as Record<string,unknown>;
  for(const key of ['categories','areas','sectors','items']){
    if(Array.isArray(o[key]))return o[key] as unknown[];
  }
  for(const key of ['map','data','personal_map']){
    const rows=rowsFrom(o[key],depth+1);
    if(rows.length)return rows;
  }
  const keyed:unknown[]=[];
  for(const [key,v] of Object.entries(o)){
    const cat=categoryOf(key);
    if(!cat)continue;
    if(typeof v==='boolean'||typeof v==='number'||typeof v==='string')keyed.push({id:cat,value:v});
    else if(v&&typeof v==='object')keyed.push({id:cat,...v as Record<string,unknown>});
  }
  return keyed;
}

function coveredFromRow(row:Record<string,unknown>){
  if(typeof row.value==='boolean')return row.value;
  if(typeof row.value==='number')return row.value>0;
  const flags=['covered','filled','has_context','hasContext','known','active','confirmed'];
  if(flags.some(k=>row[k]===true))return true;
  const pct=Number(row.percent??row.coverage??0);
  if(Number.isFinite(pct)&&pct>0)return true;
  const status=normalized(row.status??row.value);
  return ['covered','filled','known','active','confirmed','has context','has_context'].includes(status);
}

export function parseNativePersonalMap(payload:unknown):PersonalMapModel{
  const envelope=parseJson(payload);
  const pm=envelope&&typeof envelope==='object'&&'personal_map' in (envelope as Record<string,unknown>)
    ?parseJson((envelope as Record<string,unknown>).personal_map)
    :envelope;
  const map=emptyMap();
  const rows=rowsFrom(pm);
  const covered=new Set<CategoryId>();
  let aspectSchema=false;

  for(const rawRow of rows){
    if(rawRow==null)continue;
    const row=typeof rawRow==='object'?rawRow as Record<string,unknown>:{value:rawRow};
    const cat=categoryOf(row.id??row.key??row.category??row.area??row.slug??row.name??row.label);
    if(!cat)continue;

    if(Array.isArray(row.aspects)){
      aspectSchema=true;
      const vals=row.aspects.map(a=>{
        if(typeof a==='string')return aspectOf(a);
        if(a&&typeof a==='object'){
          const x=a as Record<string,unknown>;
          return aspectOf(x.id??x.key??x.name??x.aspect??x.label);
        }
        return null;
      }).filter((a):a is AspectId=>Boolean(a));
      map[cat]=[...new Set(vals)];
      if(vals.length)covered.add(cat);
    }

    if(coveredFromRow(row))covered.add(cat);
  }

  const pmObj=pm&&typeof pm==='object'?pm as Record<string,unknown>:null;
  const nativePercent=pmObj&&Number.isFinite(Number(pmObj.percent??pmObj.coverage))
    ?Number(pmObj.percent??pmObj.coverage)
    :null;

  return {
    mode:aspectSchema?'aspects':'areas',
    map,
    covered:categories.filter(c=>covered.has(c)),
    nativePercent,
    source:'native'
  };
}

export function mapProgress(model:PersonalMapModel){
  if(model.mode==='areas')return {current:model.covered.length,total:10,label:model.covered.length+'/10',description:'AREAS WITH SAVED CONTEXT'};
  return {current:count(model.map),total:30,label:count(model.map)+'/30',description:'CONTEXT DIMENSIONS'};
}

export function changedAreas(before:PersonalMapModel,after:PersonalMapModel):CategoryId[]{
  const b=new Set(before.covered);
  return after.covered.filter(c=>!b.has(c));
}
