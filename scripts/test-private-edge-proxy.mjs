import test from 'node:test';
import assert from 'node:assert/strict';
import {decisionStorage} from '../lib/private-decisions.js';
const endpoint='https://wmuwtgaxfihutroqiaqj.supabase.co/functions/v1/myixo-decisions';
const id='00000000-0000-4000-8000-000000000001';
function response(){return {statusCode:200,body:null,headers:{},setHeader(k,v){this.headers[k]=v},getHeader(k){return this.headers[k]},status(c){this.statusCode=c;return this},json(x){this.body=x;return this}}}
const j=(x,status=200)=>new Response(JSON.stringify(x),{status,headers:{'content-type':'application/json'}});
async function call(options={},fetcher){
 const old=process.env.MYIXO_PRIVATE_EDGE_URL,original=globalThis.fetch;
 process.env.MYIXO_PRIVATE_EDGE_URL=endpoint;
 const calls=[];
 globalThis.fetch=async(url,config)=>{calls.push({url:String(url),config});return fetcher(String(url),config)};
 const res=response();
 try{await decisionStorage({method:'GET',headers:{cookie:'ixo_access=fictional_user_access_token'} ,query:{resource:'decisions'},...options},res);return {res,calls}}
 finally{if(old===undefined)delete process.env.MYIXO_PRIVATE_EDGE_URL;else process.env.MYIXO_PRIVATE_EDGE_URL=old;globalThis.fetch=original}
}
test('server rejects absent native iXo identity before forwarding to storage',async()=>{
 const {res,calls}=await call({headers:{}},()=>{throw Error('network must not be used')});
 assert.equal(res.statusCode,401);assert.equal(calls.length,0);
});
test('server forwards iXo token only to pinned private function with no browser database key',async()=>{
 const {res,calls}=await call({},(url,opts)=>{
  assert.equal(url,endpoint);
  assert.equal(opts.headers.authorization,'Bearer fictional_user_access_token');
  assert.equal(opts.headers.apikey,undefined);
  return j({items:[]});
 });
 assert.equal(res.statusCode,200);assert.deepEqual(res.body.items,[]);assert.equal(calls.length,1);
});
test('server does not falsely confirm writes when Edge rejects session',async()=>{
 const {res}=await call({method:'POST',body:{action:'create',record:{id}}},(url,opts)=>{
  assert.equal(opts.method,'POST');return j({error:'iXo session expired'},401);
 });
 assert.equal(res.statusCode,401);
 assert.equal(res.body.error,'iXo session expired');
});
test('server fails closed when the private project URL is changed',async()=>{
 const prior=process.env.MYIXO_PRIVATE_EDGE_URL;
 process.env.MYIXO_PRIVATE_EDGE_URL='https://unrelated.supabase.co/functions/v1/myixo-decisions';
 const res=response();
 try{
   await decisionStorage({method:'GET',headers:{cookie:'ixo_access=fictional_user_access_token'},query:{resource:'decisions'}},res);
   assert.equal(res.statusCode,503);
 }finally{if(prior===undefined)delete process.env.MYIXO_PRIVATE_EDGE_URL;else process.env.MYIXO_PRIVATE_EDGE_URL=prior}
});
