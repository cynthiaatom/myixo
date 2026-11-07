import test from 'node:test';
import assert from 'node:assert/strict';
import {decisionStorage,validRecord} from '../lib/private-decisions.js';
const id='00000000-0000-4000-8000-000000000001';
const other='00000000-0000-4000-8000-000000000002';
const sample={id,title:'Delegate approvals?',nextStep:'Try seven days',expectedOutcome:'Fewer bottlenecks',reviewDate:'2026-11-14',status:'active',createdAt:'2026-11-07T00:00:00Z',updatedAt:'2026-11-07T00:00:00Z',checkIns:[]};
function res(){return {statusCode:200,body:null,headers:{},setHeader(k,v){this.headers[k]=v;},status(n){this.statusCode=n;return this},json(v){this.body=v;return this}}}
async function invoke(req,fetcher,env='https://private-test-project.supabase.co'){
  const prior=globalThis.fetch,oldUrl=process.env.MYIXO_PRIVATE_SUPABASE_URL,oldKey=process.env.MYIXO_PRIVATE_SUPABASE_SECRET_KEY;
  process.env.MYIXO_PRIVATE_SUPABASE_URL=env;
  process.env.MYIXO_PRIVATE_SUPABASE_SECRET_KEY='fictional-test-secret-key';
  const calls=[];
  globalThis.fetch=async(url,opts)=>{calls.push({url:String(url),opts});return fetcher(String(url),opts)};
  const response=res();
  try{await decisionStorage({method:'GET',headers:{cookie:'ixo_access=synthetic_test_token'},query:{resource:'decisions'},...req},response);return {response,calls}}
  finally{globalThis.fetch=prior;if(oldUrl===undefined)delete process.env.MYIXO_PRIVATE_SUPABASE_URL;else process.env.MYIXO_PRIVATE_SUPABASE_URL=oldUrl;
    if(oldKey===undefined)delete process.env.MYIXO_PRIVATE_SUPABASE_SECRET_KEY;else process.env.MYIXO_PRIVATE_SUPABASE_SECRET_KEY=oldKey}
}
const j=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});
test('validates structured decision and user-reported outcomes',()=>{
  assert.equal(validRecord(sample),true);
  assert.equal(validRecord({...sample,title:''}),false);
  assert.equal(validRecord({...sample,checkIns:[{id:other,at:sample.createdAt,outcome:'partial',reported:'',nextStep:'',nextReviewDate:''}]}),false);
});
test('blocks known ATOM shared project even with a secret configured',async()=>{
  const {response,calls}=await invoke({},()=>{throw Error('network should not run')},'https://fsoaqrfotefiobqyfgiq.supabase.co');
  assert.equal(response.statusCode,503);assert.equal(calls.length,0);
});
test('rejects unverified native sessions before private database access',async()=>{
  const {response,calls}=await invoke({},(url)=>{
    if(url.endsWith('/auth/me'))return j({detail:'not connected'},401);
    throw Error('should not access database');
  });
  assert.equal(response.statusCode,401);
  assert.equal(calls.length,1);
});
test('enforces owner-filtered reads using server-verified account ID',async()=>{
  const {response,calls}=await invoke({},(url,options)=>{
    if(url.endsWith('/auth/me'))return j({id:'native-account-one'});
    if(url.includes('/rest/v1/myixo_decisions')){
      assert.equal(options.headers.apikey,'fictional-test-secret-key');
      assert.equal(options.headers.Authorization,undefined);
      assert.ok(url.includes('owner_id=eq.native-account-one'));
      return j([{revision:1,record:sample}]);
    }
    throw Error('unexpected URL');
  });
  assert.equal(response.statusCode,200);
  assert.equal(response.body.items[0].title,'Delegate approvals?');
  assert.equal(calls.length,2);
});
test('conditional update uses account, ID and expected revision',async()=>{
  const {response}=await invoke({method:'PATCH',body:{id,revision:2,record:sample}},(url,options)=>{
    if(url.endsWith('/auth/me'))return j({id:'native-account-one'});
    assert.ok(url.includes('owner_id=eq.native-account-one'));
    assert.ok(url.includes('id=eq.'+id));
    assert.ok(url.includes('revision=eq.2'));
    assert.equal(JSON.parse(options.body).revision,3);
    return j([{revision:3,record:sample}]);
  });
  assert.equal(response.statusCode,200);
  assert.equal(response.body.item.revision,3);
});
test('refuses conflicting updates instead of overwriting',async()=>{
  const {response}=await invoke({method:'PATCH',body:{id,revision:2,record:sample}},url=>{
    if(url.endsWith('/auth/me'))return j({id:'native-account-one'});
    return j([]);
  });
  assert.equal(response.statusCode,409);
});
