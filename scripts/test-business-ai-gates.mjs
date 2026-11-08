import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/ixo/work-reason.js';
const ws='00000000-0000-4000-8000-000000000001';
function run({method='POST',origin='https://myixo.example',host='myixo.example',body={workspace_id:ws,question:'What is overdue?'},contentType='application/json'}={}){
 const req={method,headers:{origin,host,'content-type':contentType},body};
 const res={code:200,headers:{},setHeader(k,v){this.headers[k]=v},status(n){this.code=n;return this},json(v){this.data=v;return this}};
 return handler(req,res).then(()=>res);
}
test('business AI never runs without explicit model opt-in and app credential',async()=>{
 const prev=process.env.MYIXO_BUSINESS_AI_ENABLED;
 delete process.env.MYIXO_BUSINESS_AI_ENABLED;
 try{const res=await run();assert.equal(res.code,503);assert.match(res.data.error,/not enabled/)}
 finally{if(prev===undefined)delete process.env.MYIXO_BUSINESS_AI_ENABLED;else process.env.MYIXO_BUSINESS_AI_ENABLED=prev}
});
test('business AI rejects foreign origins and malformed scope before model access',async()=>{
 for(const origin of ['https://attacker.example','http://myixo.example',null]){
  const res=await run({origin});assert.equal(res.code,403);
 }
 for(const body of [{workspace_id:'bad',question:'What is overdue?'},{workspace_id:ws,question:'a'}]){
  const res=await run({body});assert.equal(res.code,400);
 }
});
test('business AI is POST-only and requires JSON',async()=>{
 assert.equal((await run({method:'GET'})).code,405);
 assert.equal((await run({contentType:'text/plain'})).code,415);
});
