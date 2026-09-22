export const categories=['psychology','health','relationships','family','work','finance','development','rest','values','environment'] as const;
export const labels={psychology:'Psychology',health:'Health',relationships:'Relationships',family:'Family',work:'Work',finance:'Finances',development:'Development',rest:'Rest',values:'Values',environment:'Environment'} as const;
export const aspects=['situation','priorities','goals'] as const;
export const aspectLabels={situation:'Current situation',priorities:'What matters to you',goals:'Goals & desired changes'} as const;
export type CategoryId=typeof categories[number]; export type AspectId=typeof aspects[number]; export type Ref={category:CategoryId,aspect:AspectId};
export type MapState=Record<CategoryId,AspectId[]>;
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
export function fromLiveMap(raw:any):MapState{
 const out=Object.fromEntries(categories.map(c=>[c,[] as AspectId[]])) as MapState;
 const rows=Array.isArray(raw?.categories)?raw.categories:Array.isArray(raw?.personal_map?.categories)?raw.personal_map.categories:[];
 if(rows.length){
  for(const row of rows){
   const id=String(row?.id||'');
   if(!(categories as readonly string[]).includes(id))continue;
   const vals=Array.isArray(row?.aspects)?row.aspects:[];
   out[id as CategoryId]=vals.filter((a:any)=>(aspects as readonly string[]).includes(String(a))) as AspectId[];
  }
  return out;
 }
 // The production iXo /conversation/map endpoint currently returns its memory-domain
 // representation, while the iXo UI groups those domains into the ten Personal Map
 // life areas. Preserve only confirmed coverage here; never invent priorities/goals.
 const domains=Array.isArray(raw?.domains)?raw.domains:[];
 const covered=(names:string[])=>domains.some((d:any)=>{
  const id=String(d?.id||d?.name||d?.domain||'').toLowerCase();
  const isCovered=d?.covered===true || d?.is_covered===true || d?.status==='covered';
  return isCovered && names.includes(id);
 });
 const mapping:Record<CategoryId,string[]>={
  psychology:['psyche','psychology'],
  health:['sleep','nutrition','body','health','substances'],
  relationships:['relations','relationships'],
  family:['family'],
  work:['work'],
  finance:['money','finance','finances'],
  development:['development'],
  rest:['rest'],
  values:['meaning','values'],
  environment:['environment']
 };
 for(const c of categories) if(covered(mapping[c])) out[c]=['situation'];
 return out;
}
export function learnedBetween(before:MapState,after:MapState):Ref[]{const out:Ref[]=[];for(const c of categories)for(const a of after[c])if(!before[c].includes(a))out.push({category:c,aspect:a});return out}
