import {useMemo} from 'react';
import type {DecisionRecord} from '../decisions/model';
import {weeklyReview} from '../decisions/weekly-review';
export default function WeeklyPersonalReview({decisions,onOpenDecisions}:{decisions:DecisionRecord[];onOpenDecisions:()=>void}){
  const review=useMemo(()=>weeklyReview(decisions),[decisions]);
  return <section className="weeklyReview">
    <div className="eyebrow">MY iXo · WEEKLY PERSONAL REVIEW</div>
    <h2>Five minutes to regain clarity.</h2>
    <p>Your review is based on actions and outcomes you recorded. Nothing below is an invented result or automatically verified progress.</p>
    <div className="weeklyReviewStats">
      <div><strong>{review.due.length}</strong><span>Need a check-in</span></div>
      <div><strong>{review.upcoming.length}</strong><span>Coming up in 7 days</span></div>
      <div><strong>{review.completedCheckIns}</strong><span>Reported check-ins in 7 days</span></div>
    </div>
    {review.due.length>0?<div className="weeklyReviewGroup">
      <h3>Ready to review</h3>{review.due.slice(0,8).map(d=><div key={d.id} className="weeklyReviewItem">
        <strong>{d.title}</strong><p>{d.nextStep}</p><small>Review date: {d.reviewDate}</small>
      </div>)}
    </div>:<p>No active decisions with review dates due today or earlier.</p>}
    {review.upcoming.length>0&&<div className="weeklyReviewGroup">
      <h3>Looking ahead</h3>{review.upcoming.slice(0,8).map(d=><div key={d.id} className="weeklyReviewItem">
        <strong>{d.title}</strong><p>{d.nextStep}</p><small>Planned: {d.reviewDate}</small>
      </div>)}
    </div>}
    {review.reportedOutcomes.length>0&&<div className="weeklyReviewGroup">
      <h3>What you reported this week</h3>{review.reportedOutcomes.slice(0,8).map((x,i)=><div className="weeklyReviewItem" key={x.date+x.decisionTitle+i}>
        <strong>{x.decisionTitle}</strong><p>{x.report}</p><small>{x.outcome.replace('_',' ')} · {new Date(x.date).toLocaleDateString()}</small>
      </div>)}
    </div>}
    {review.waiting.length>0&&<p>{review.waiting.length} active {review.waiting.length===1?'decision has':'decisions have'} no review date yet.</p>}
    <div className="actions"><button className="primary" onClick={onOpenDecisions}>Review my decisions</button></div>
  </section>;
}
