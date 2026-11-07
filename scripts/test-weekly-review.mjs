import test from 'node:test';
import assert from 'node:assert/strict';
import {weeklyReview} from '../src/decisions/weekly-review.ts';
import {createDecision,recordCheckIn,updateDecision} from '../src/decisions/model.ts';
const record=(title,date)=>createDecision({title,nextStep:'Try one action',expectedOutcome:'',reviewDate:date},'2026-11-01T12:00:00Z');
test('weekly review sorts due, upcoming and undated decisions',()=>{
 const due=record('Due now','2026-11-07');
 const up=record('Future','2026-11-11');
 const wait=record('Unscheduled','');
 const paused=updateDecision(record('Paused','2026-11-07'),{status:'paused'});
 const result=weeklyReview([wait,paused,up,due],new Date(2026,10,7));
 assert.equal(result.due.length,1);
 assert.equal(result.upcoming.length,1);
 assert.equal(result.waiting.length,1);
});
test('weekly review contains only user-reported check-ins in the period',()=>{
 const d=record('Decision','2026-11-07');
 const inRange=recordCheckIn(d,{outcome:'partial',reported:'We tried the plan',nextStep:'',nextReviewDate:''},'2026-11-05T12:00:00Z');
 const old=recordCheckIn(inRange,{outcome:'completed',reported:'Earlier history',nextStep:'',nextReviewDate:''},'2026-10-01T12:00:00Z');
 const result=weeklyReview([old],new Date(2026,10,7));
 assert.equal(result.completedCheckIns,1);
 assert.equal(result.reportedOutcomes[0].report,'We tried the plan');
});
