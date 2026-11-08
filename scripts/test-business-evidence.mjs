import test from 'node:test';
import assert from 'node:assert/strict';
import {selectBusinessEvidence} from '../lib/business-evidence.js';
const rec=(id,title,details='')=>({id,kind:'task',title,details,status:'open'});
test('only question-relevant records enter model context',()=>{
 const r=selectBusinessEvidence([rec('1','Renewal follow-up'),rec('2','Payroll processing'),rec('3','Renewal risk')],'Which renewal needs follow-up?');
 assert.deepEqual(r.records.map(x=>x.id),['1','3']);
 assert.equal(r.total,3);
});
test('no match means zero disclosed records, not broad fallback',()=>{
 const r=selectBusinessEvidence([rec('1','Sensitive payroll information')],'What about inventory?');
 assert.equal(r.records.length,0);
});
test('bounded record count and byte budget prevent oversized inference',()=>{
 const records=Array.from({length:100},(_,i)=>rec(String(i),'Revenue forecast '+i,'Revenue '.repeat(120)));
 const r=selectBusinessEvidence(records,'Revenue',{limit:24,maxChars:2000});
 assert.ok(r.records.length<24);
 assert.ok(JSON.stringify(r.records).length<=2100);
 assert.equal(r.truncated,true);
});
test('reject unbounded input',()=>{
 assert.throws(()=>selectBusinessEvidence(Array.from({length:201},(_,i)=>rec(i,'test')),'test'));
});
