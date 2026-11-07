import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/ixo/login.js';

function response(){
  const headers={};
  return {
    statusCode:200,body:null,
    setHeader(k,v){headers[k]=v},
    getHeader(k){return headers[k]},
    status(code){this.statusCode=code;return this},
    json(value){this.body=value;return this}
  };
}
async function invoke(body,mockedFetch){
  const prior=globalThis.fetch;
  const calls=[];
  globalThis.fetch=async (url,options={})=>{
    calls.push({url:String(url),options});
    return mockedFetch(String(url),options);
  };
  try{
    const res=response();
    await handler({method:'POST',body,headers:{}},res);
    return {res,calls};
  }finally{globalThis.fetch=prior}
}
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json'}});

test('rejects malformed email without making external calls',async()=>{
  const {res,calls}=await invoke({provider:'email_code',action:'request',email:'not an email'},()=>{throw Error('unexpected network')});
  assert.equal(res.statusCode,400);
  assert.equal(calls.length,0);
});
test('requests an existing-account email challenge using native iXo',async()=>{
  const {res,calls}=await invoke({provider:'email_code',action:'request',email:'test@example.com'},(url,options)=>{
    if(url.endsWith('/public/landing-catalog'))return json({auth:{email_code_enabled:true}});
    if(url.endsWith('/auth/email-code/request')){
      assert.equal(options.method,'POST');
      const b=JSON.parse(options.body);
      assert.equal(b.email,'test@example.com');
      assert.equal(b.captcha_token,null);
      assert.equal(b.purpose,undefined);
      return json({challenge_id:'fictional-test-challenge',resend_after:45});
    }
    throw Error('Unexpected URL '+url);
  });
  assert.equal(res.statusCode,200);
  assert.equal(res.body.challenge_id,'fictional-test-challenge');
  assert.equal(res.body.resend_after,45);
  assert.equal(calls.length,2);
});
test('valid six-digit code creates native account session without exposing tokens in response',async()=>{
  const {res,calls}=await invoke({provider:'email_code',action:'confirm',challenge_id:'fictional-test-challenge',code:'123456'},(url,options)=>{
    if(url.endsWith('/auth/email-code/confirm')){
      assert.equal(JSON.parse(options.body).code,'123456');
      return json({access_token:'synthetic_access_token',refresh_token:'synthetic_refresh_token'});
    }
    if(url.endsWith('/auth/me')){
      assert.equal(options.headers.authorization,'Bearer synthetic_access_token');
      return json({id:'00000000-0000-4000-8000-000000000001',email:'test@example.com',plan:'free'});
    }
    throw Error('Unexpected URL '+url);
  });
  assert.equal(res.statusCode,200);
  assert.equal(res.body.connected,true);
  assert.equal(res.body.user.email,'test@example.com');
  assert.equal(JSON.stringify(res.body).includes('synthetic_'),false);
  assert.equal(res.getHeader('Set-Cookie').length,2);
  assert.equal(calls.length,2);
});
test('rejects invalid code before accessing native iXo',async()=>{
  const {res,calls}=await invoke({provider:'email_code',action:'confirm',challenge_id:'fictional-test-challenge',code:'12ab56'},()=>{throw Error('unexpected network')});
  assert.equal(res.statusCode,400);
  assert.equal(calls.length,0);
});
test('expired code does not establish a session',async()=>{
  const {res,calls}=await invoke({provider:'email_code',action:'confirm',challenge_id:'fictional-test-challenge',code:'123456'},(url)=>{
    if(url.endsWith('/auth/email-code/confirm'))return json({code:'expired'},401);
    throw Error('No further requests allowed');
  });
  assert.equal(res.statusCode,401);
  assert.equal(res.getHeader('Set-Cookie'),undefined);
  assert.equal(calls.length,1);
});
test('rejects login with an invalid Google identity token',async()=>{
  const {res,calls}=await invoke({provider:'google',id_token:'not-a-valid-token'},()=>{throw Error('unexpected network')});
  assert.equal(res.statusCode,400);
  assert.equal(calls.length,0);
});
