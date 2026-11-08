import test from 'node:test';
import assert from 'node:assert/strict';
import {handleBusinessReason} from '../lib/work-reason.js';

const A='11111111-1111-4111-8111-111111111111';
const B='22222222-2222-4222-8222-222222222222';
const R='33333333-3333-4333-8333-333333333333';
const S='44444444-4444-4444-8444-444444444444';
const originalFetch=globalThis.fetch;
const originalEnv=Object.fromEntries(['MYIXO_BUSINESS_AI_ENABLED','MYIXO_BUSINESS_AI_API_KEY','MYIXO_BUSINESS_AI_MODEL'].map(k=>[k,process.env[k]]));
function reply(value,status=200){return {ok:status>=200&&status<300,status,async json(){return value}}}
function request(workspace_id=A,cookie='ixo_access=user-A'){
 const req={method:'POST',headers:{origin:'https://myixo.example',host:'myixo.example','content-type':'application/json',cookie},body:{workspace_id,question:'Which commitments need follow-up?'}};
 const res={code:200,setHeader(){},status(n){this.code=n;return this},json(data){this.data=data;return this}};
 return {req,res};
}
async function scenario({owner='A',target=A,leak=false,modelAnswer,duplicate=false}={}){
 const calls=[];
 globalThis.fetch=async(url,opts)=>{
  const u=String(url);calls.push({url:u,auth:opts.headers.authorization,body:opts.body});
  if(u.includes('resource=workspaces'))return reply({items:[{id:owner==='A'?A:B,name:owner+' company'}]});
  if(u.includes('resource=items'))return reply({items:[{id:R,workspace_id:leak?B:target,kind:'task',title:'Follow-up agreement',details:'Commitments due soon',status:'open'},...(duplicate?[{id:R,workspace_id:target,kind:'task',title:'Duplicate',status:'open'}]:[])],has_more:false});
  if(u.includes('chat/completions'))return reply({choices:[{message:{content:modelAnswer??'Review renewal ['+R+']'}}]});
  throw Error('Unexpected network request '+u);
 };
 const {req,res}=request(target,'ixo_access=user-'+owner);
 await handleBusinessReason(req,res);
 return {res,calls,modelCalls:calls.filter(x=>x.url.includes('chat/completions'))};
}
test('two simulated owner identities cannot query each other business',async()=>{
 const r=await scenario({owner:'B',target:A});
 assert.equal(r.res.code,403);
 assert.equal(r.modelCalls.length,0);
 assert.equal(r.calls.length,1);
});
test('cross-company records are rejected before reaching model',async()=>{
 const r=await scenario({leak:true});
 assert.equal(r.res.code,502);
 assert.equal(r.modelCalls.length,0);
});
test('duplicate records fail closed before model access',async()=>{
 const r=await scenario({duplicate:true});
 assert.equal(r.res.code,502);
 assert.equal(r.modelCalls.length,0);
});
test('only authenticated owner scoped records are passed to the model',async()=>{
 const r=await scenario();
 assert.equal(r.res.code,200);
 assert.deepEqual(r.res.data.evidence_ids,[R]);
 assert.equal(r.res.data.company_id,A);
 assert.equal(r.res.data.external_actions_executed,false);
 assert.equal(r.modelCalls.length,1);
 const payload=JSON.parse(r.modelCalls[0].body);
 assert.equal(payload.messages[1].role,'user');
 assert.equal(JSON.parse(payload.messages[1].content).records[0].id,R);
 assert.equal(JSON.parse(payload.messages[1].content).company.id,A);
});
test('hallucinated or missing citations are rejected',async()=>{
 for(const modelAnswer of ['Wrong citation ['+S+']','There is a renewal']){
  const r=await scenario({modelAnswer});
  assert.equal(r.res.code,502);
 }
});
test.after(()=>{
 globalThis.fetch=originalFetch;
 for(const [k,v] of Object.entries(originalEnv))if(v===undefined)delete process.env[k];else process.env[k]=v;
});
process.env.MYIXO_BUSINESS_AI_ENABLED='true';
process.env.MYIXO_BUSINESS_AI_API_KEY='test-only-not-real';
process.env.MYIXO_BUSINESS_AI_MODEL='test-model';
