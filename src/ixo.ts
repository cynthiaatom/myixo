export const categories=['psychology','health','relationships','family','work','finance','development','rest','values','environment'] as const;
export const labels={psychology:'Psychology',health:'Health',relationships:'Relationships',family:'Family',work:'Work',finance:'Finances',development:'Development',rest:'Rest',values:'Values',environment:'Environment'} as const;
export const aspects=['situation','priorities','goals'] as const;
export const aspectLabels={situation:'Current situation',priorities:'What matters to you',goals:'Goals & desired changes'} as const;
export type CategoryId=typeof categories[number]; export type AspectId=typeof aspects[number]; export type Ref={category:CategoryId,aspect:AspectId};
export type MapState=Record<CategoryId,AspectId[]>;
export const seed:MapState={psychology:[],health:['situation'],relationships:['situation'],family:['situation'],work:['situation'],finance:[],development:[],rest:['situation'],values:['priorities'],environment:['situation','priorities']};
export const questions=[
{prompt:'When you picture an ordinary Tuesday, what is actually running your day?',helper:'Answer broadly — iXo can learn several things from one honest answer.',chips:['My calendar runs me, not the other way around.','I hold it together well, but I never really switch off.','Energy decides everything — good sleep, good day.'],fills:[['psychology','situation'],['psychology','priorities'],['rest','priorities'],['health','priorities'],['values','situation']]},
{prompt:'What are you actually building right now — in work, in skill, in resources?',chips:['Moving from running things to designing them.','Learning deeply in one area instead of skimming five.','Simplifying my finances so they need less of me.'],fills:[['work','priorities'],['work','goals'],['development','situation'],['development','priorities'],['finance','situation']]},
{prompt:'If the next three years went unusually well, what would be different?',chips:['Fewer moving parts, more freedom of movement.','One capability I’m genuinely known for.','A place built for deep work instead of borrowed space.'],fills:[['finance','priorities'],['finance','goals'],['development','goals'],['environment','goals']]},
{prompt:'Who do you want to be closer to a year from now, and what would that take?',chips:['Depth with a few people, not contact with many.','Real family time that nothing is allowed to move.','Conversations that aren’t scheduled around work.'],fills:[['relationships','priorities'],['relationships','goals'],['family','priorities'],['family','goals']]},
{prompt:'What does genuine recovery look like for you — not time off, actual recovery?',chips:['Sleep first. Everything else follows it.','An off-switch that doesn’t require a flight.','Silence, movement, no screens.'],fills:[['health','goals'],['rest','goals']]},
{prompt:'What would you want to be true about you that isn’t true yet?',chips:['That a quiet mind is my default, not my reward.','That my calendar proves my values without explanation.'],fills:[['psychology','goals'],['values','goals']],final:true}
] as const;
export function cloneSeed():MapState{return Object.fromEntries(categories.map(c=>[c,[...seed[c]]])) as MapState}
export function count(m:MapState){return categories.reduce((n,c)=>n+m[c].length,0)}
export function coverage(m:MapState){return Math.round(count(m)/30*100)}