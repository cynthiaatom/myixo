const STOP=new Set('about after again also because been before being between both could does doing during each from further have having into itself just more most other over same should some such than that their them then there these they this those through under very what when where which while who will with would your yourself business company please'.split(' '));
const words=s=>new Set(String(s||'').toLowerCase().match(/[a-z0-9]{3,}/g)?.filter(w=>!STOP.has(w))||[]);
export function selectBusinessEvidence(items,question,{limit=24,maxChars=14000,workspaceId}={}){
 if(!Array.isArray(items)||items.length>200||typeof question!=='string'||!workspaceId||items.some(x=>!x||x.workspace_id!==workspaceId))throw Error('Invalid or mixed-workspace evidence input');
 const terms=words(question);
 const scored=items.map((x,i)=>{
  const title=words(x.title),detail=words(x.details),kind=words(x.kind);
  let score=0;
  for(const t of terms)score+=(title.has(t)?5:0)+(detail.has(t)?2:0)+(kind.has(t)?1:0);
  return {x,i,score};
 });
 // No lexical matches: do not expose the whole company to the provider.
 const matched=scored.filter(x=>x.score>0).sort((a,b)=>b.score-a.score||a.i-b.i);
 const chosen=[];let used=0;
 for(const {x} of matched){
  if(chosen.length>=limit)break;
  const item={id:x.id,kind:x.kind,title:String(x.title||'').slice(0,250),details:String(x.details||'').slice(0,450),status:x.status,due_at:x.due_at,updated_at:x.updated_at};
  const size=JSON.stringify(item).length;
  if(used+size>maxChars)continue;
  chosen.push(item);used+=size;
 }
 return {records:chosen,total:items.length,matched:matched.length,truncated:matched.length>chosen.length};
}
