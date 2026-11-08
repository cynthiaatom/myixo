export type BusinessEvidence={id:string;workspace_id:string;kind:string;title:string;details?:string;status?:string;due_at?:string|null;updated_at?:string};
const terms=(s:string)=>new Set((s.toLowerCase().match(/[a-z0-9]{3,}/g)||[]).filter(x=>!['what','when','where','which','about','have','does','with','from','that','this','your','there','their','would','could','should','business','company','show','tell','please','into','were','been','them','than','then'].includes(x)));
export function reasonFromBusinessRecords(records:BusinessEvidence[],workspaceId:string,question:string,now=new Date()):string{
 if(!workspaceId||!question.trim())throw Error('Company and question required');
 if(records.some(x=>x.workspace_id!==workspaceId))throw Error('Mixed company evidence rejected');
 const query=terms(question);
 const scored=records.map(x=>{const title=x.title.toLowerCase(),details=(x.details||'').toLowerCase();const score=[...query].reduce((n,t)=>n+(title.includes(t)?4:0)+(details.includes(t)?2:0)+(x.kind.includes(t)?1:0),0);return{x,score}}).filter(x=>x.score>0).sort((a,b)=>b.score-a.score).slice(0,12);
 const due=records.filter(x=>x.status!=='done'&&x.due_at&&Number.isFinite(Date.parse(x.due_at))&&Date.parse(x.due_at)<now.getTime()).sort((a,b)=>Date.parse(a.due_at!)-Date.parse(b.due_at!));
 const open=records.filter(x=>x.status==='open');
 const q=question.toLowerCase();
 const lines=['INZO · BUSINESS EVIDENCE ANALYSIS','This is deterministic analysis of saved records, not generative AI. No external model was called.',''];
 if(/overdue|late|past due|deadline|due|priority|urgent|attention|next/.test(q)){
  lines.push('OPEN ITEMS: '+open.length,'OVERDUE ITEMS: '+due.length);
  for(const x of due.slice(0,8))lines.push('- '+x.title+' (due '+x.due_at+') [record '+x.id+']');
  if(!due.length)lines.push('No overdue items found among records with valid due dates.');
  lines.push('');
 }
 if(scored.length){lines.push('RELEVANT SAVED EVIDENCE:');for(const {x} of scored)lines.push('- '+x.kind+': '+x.title+' ['+x.status+']'+(x.due_at?' due '+x.due_at:'')+' [record '+x.id+']'+(x.details?' — '+x.details.slice(0,180):''));}
 else lines.push('No saved records directly match the question. This does not establish that the issue does not exist.');
 lines.push('','KNOWN: '+records.length+' records loaded from the selected business.','UNKNOWN: External systems, unrecorded activity, and whether saved information is current.','SUGGESTED NEXT STEP: Review the cited records and update missing statuses or deadlines.','External actions performed: none.');
 return lines.join('\n');
}
