import test from 'node:test';
import assert from 'node:assert/strict';
import {createDecision,updateDecision,recordCheckIn,dueDecisions,decisionCounts} from '../src/decisions/model.ts';

const draft=()=>({title:'Hire an assistant?',nextStep:'Delegate invoices this week',expectedOutcome:'Recover two hours',reviewDate:'2026-11-07'});
test('a new decision has an owner-selected action and no invented outcomes',()=>{
  const d=createDecision(draft(),'2026-11-01T12:00:00.000Z');
  assert.equal(d.status,'active');assert.equal(d.checkIns.length,0);assert.equal(d.reviewDate,'2026-11-07');
  assert.ok(d.id);
});
test('review counts include due active decisions only',()=>{
  const active=createDecision(draft());
  const paused=updateDecision(createDecision(draft()),{status:'paused'});
  const closed=updateDecision(createDecision(draft()),{status:'closed'});
  const all=[active,paused,closed];
  assert.equal(dueDecisions(all,'2026-11-08').length,1);
  assert.deepEqual(decisionCounts(all,'2026-11-08'),{total:3,active:1,due:1,closed:1});
});
test('a user-reported outcome is retained without claiming verification',()=>{
  const d=createDecision(draft(),'2026-11-01T12:00:00.000Z');
  const after=recordCheckIn(d,{outcome:'partial',reported:'Some approvals were delegated',nextStep:'Review queue next week',nextReviewDate:'2026-11-14'},'2026-11-07T12:00:00.000Z');
  assert.equal(after.checkIns.length,1);
  assert.equal(after.checkIns[0].reported,'Some approvals were delegated');
  assert.equal(after.nextStep,'Review queue next week');
  assert.equal(after.reviewDate,'2026-11-14');
  assert.equal(d.checkIns.length,0);
});
test('updates preserve original outcome history',()=>{
  const d=recordCheckIn(createDecision(draft()),{outcome:'completed',reported:'Experiment done',nextStep:'',nextReviewDate:''});
  const next=updateDecision(d,{status:'closed'});
  assert.equal(next.status,'closed');
  assert.equal(next.checkIns.length,1);
});
test('required fields and malformed dates are rejected',()=>{
  assert.throws(()=>createDecision({...draft(),nextStep:'  '}));
  assert.throws(()=>createDecision({...draft(),reviewDate:'not-a-date'}));
  assert.throws(()=>recordCheckIn(createDecision(draft()),{outcome:'partial',reported:'',nextStep:'',nextReviewDate:''}));
});
