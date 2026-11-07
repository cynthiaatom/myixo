import type {DecisionRecord} from './model';

export type WeeklyReview={
  periodStart:string;periodEnd:string;
  due:DecisionRecord[];upcoming:DecisionRecord[];
  waiting:DecisionRecord[];completedCheckIns:number;
  reportedOutcomes:{decisionTitle:string;date:string;outcome:string;report:string}[];
};
const dateOnly=(date:Date)=>[date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');
export function weeklyReview(decisions:DecisionRecord[],date=new Date()):WeeklyReview{
  const now=new Date(date.getFullYear(),date.getMonth(),date.getDate());
  const end=new Date(now);end.setDate(end.getDate()+7);
  const start=new Date(now);start.setDate(start.getDate()-7);
  const periodStart=dateOnly(start),periodEnd=dateOnly(now),nextEnd=dateOnly(end);
  const active=decisions.filter(d=>d.status==='active');
  const due=active.filter(d=>d.reviewDate&&d.reviewDate<=periodEnd).sort((a,b)=>a.reviewDate.localeCompare(b.reviewDate));
  const upcoming=active.filter(d=>d.reviewDate&&d.reviewDate>periodEnd&&d.reviewDate<=nextEnd)
    .sort((a,b)=>a.reviewDate.localeCompare(b.reviewDate));
  const waiting=active.filter(d=>!d.reviewDate);
  const reportedOutcomes=decisions.flatMap(d=>d.checkIns.filter(c=>c.at.slice(0,10)>=periodStart&&c.at.slice(0,10)<=periodEnd)
    .map(c=>({decisionTitle:d.title,date:c.at,outcome:c.outcome,report:c.reported})))
    .sort((a,b)=>b.date.localeCompare(a.date));
  return {periodStart,periodEnd,due,upcoming,waiting,completedCheckIns:reportedOutcomes.length,reportedOutcomes};
}
