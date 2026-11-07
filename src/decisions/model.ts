export type DecisionStatus='active'|'paused'|'closed';
export type DecisionOutcome='completed'|'partial'|'changed'|'not_started';
export type DecisionCheckIn={
  id:string;at:string;outcome:DecisionOutcome;reported:string;
  nextStep:string;nextReviewDate:string;
};
export type DecisionRecord={
  id:string;title:string;nextStep:string;expectedOutcome:string;
  reviewDate:string;status:DecisionStatus;createdAt:string;
  updatedAt:string;checkIns:DecisionCheckIn[];
};
export type DecisionData={title:string;nextStep:string;expectedOutcome:string;reviewDate:string};
const clean=(value:string,max=1000)=>value.trim().slice(0,max);
const validDate=(date:string)=>!date||(/^\d{4}-\d{2}-\d{2}$/.test(date)&&!Number.isNaN(Date.parse(date+'T00:00:00Z')));
const uid=()=>crypto.randomUUID();
export function createDecision(data:DecisionData,at=new Date().toISOString()):DecisionRecord{
  const title=clean(data.title,500),nextStep=clean(data.nextStep);
  if(!title||!nextStep||!validDate(data.reviewDate))throw new Error('A decision, next step and valid review date are required.');
  return {id:uid(),title,nextStep,expectedOutcome:clean(data.expectedOutcome),
    reviewDate:data.reviewDate,status:'active',createdAt:at,updatedAt:at,checkIns:[]};
}
export function updateDecision(decision:DecisionRecord,data:Partial<DecisionData & {status:DecisionStatus}>,at=new Date().toISOString()):DecisionRecord{
  const next={...decision,...data};
  if(!clean(next.title,500)||!clean(next.nextStep)||!validDate(next.reviewDate)||!['active','paused','closed'].includes(next.status))
    throw new Error('Invalid decision update.');
  return {...next,title:clean(next.title,500),nextStep:clean(next.nextStep),expectedOutcome:clean(next.expectedOutcome),
    updatedAt:at,checkIns:decision.checkIns};
}
export function recordCheckIn(decision:DecisionRecord,data:{outcome:DecisionOutcome;reported:string;nextStep:string;nextReviewDate:string},at=new Date().toISOString()):DecisionRecord{
  if(!['completed','partial','changed','not_started'].includes(data.outcome)||!clean(data.reported,2000)||!validDate(data.nextReviewDate))
    throw new Error('A valid outcome, report and review date are required.');
  const entry:DecisionCheckIn={id:uid(),at,outcome:data.outcome,reported:clean(data.reported,2000),
    nextStep:clean(data.nextStep),nextReviewDate:data.nextReviewDate};
  return {...decision,updatedAt:at,nextStep:entry.nextStep||decision.nextStep,
    reviewDate:entry.nextReviewDate||decision.reviewDate,checkIns:[...decision.checkIns,entry]};
}
export function dueDecisions(decisions:DecisionRecord[],today:string){
  return decisions.filter(d=>d.status==='active'&&!!d.reviewDate&&d.reviewDate<=today);
}
export function decisionCounts(decisions:DecisionRecord[],today:string){
  return {total:decisions.length,active:decisions.filter(d=>d.status==='active').length,
    due:dueDecisions(decisions,today).length,closed:decisions.filter(d=>d.status==='closed').length};
}
