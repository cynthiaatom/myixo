import assert from 'node:assert/strict';
import test from 'node:test';
import {handleWork} from '../lib/work-proxy.js';

function request(method,origin,host='myixo.vercel.app',proto='https'){
 const req={method,headers:{origin,host,'x-forwarded-proto':proto},query:{resource:'items',workspace:'00000000-0000-0000-0000-000000000000'}};
 const res={code:200,headers:{},setHeader(k,v){this.headers[k]=v},status(n){this.code=n;return this},json(v){this.body=v;return this}};
 return {req,res};
}
test('work mutations reject cross-origin and absent origin before authentication',async()=>{
 for(const method of ['POST','PATCH','DELETE']){
  for(const origin of [undefined,'https://attacker.example','http://myixo.vercel.app','https://myixo.vercel.app.evil.example','null']){
   const {req,res}=request(method,origin);
   await handleWork(req,res);
   assert.equal(res.code,403,method+' '+origin);
  }
 }
});
test('valid same-origin mutation reaches authentication, not CSRF rejection',async()=>{
 const {req,res}=request('POST','https://myixo.vercel.app');
 await handleWork(req,res);
 assert.equal(res.code,401);
});
test('safe unauthenticated reads remain denied by session gate',async()=>{
 const {req,res}=request('GET',undefined);
 await handleWork(req,res);
 assert.equal(res.code,401);
});
