import test from 'node:test';
import assert from 'node:assert/strict';
import {handleNativeBusinessProbe} from '../lib/native-business-probe.js';
const old=globalThis.fetch;
function response(status,data){return {status,ok:status>=200&&status<300,async json(){return data}}}
function mockReq(method='GET'){const req={method,headers:{cookie:'ixo_access=test-native-session'}};const res={statusCode:200,setHeader(){},status(s){this.statusCode=s;return this},json(data){this.data=data;return this}};return {req,res}}
test('probe checks native account and chat read-only without business data',async()=>{
 const calls=[];
 globalThis.fetch=async(url,opts)=>{calls.push({url:String(url),method:opts.method||'GET',body:opts.body});return response(200,String(url).includes('/chats?')?{items:[]}: {id:'user'})};
 const {req,res}=mockReq();await handleNativeBusinessProbe(req,res);
 assert.equal(res.statusCode,200);
 assert.equal(res.data.native_chat_read_available,true);
 assert.equal(res.data.business_data_transfer_allowed,false);
 assert.equal(res.data.dedicated_business_chat_verified,false);
 assert.equal(calls.length,2);
 assert.ok(calls.every(c=>c.method==='GET'&&!c.body));
 assert.ok(calls.every(c=>!c.url.includes('/runs')));
});
test('probe refuses unauthenticated native session',async()=>{
 globalThis.fetch=async()=>response(401,{});
 const {req,res}=mockReq();await handleNativeBusinessProbe(req,res);
 assert.equal(res.statusCode,401);
});
test('probe does not permit mutations',async()=>{
 let called=false;globalThis.fetch=async()=>{called=true;throw Error('not allowed')};
 const {req,res}=mockReq('POST');await handleNativeBusinessProbe(req,res);
 assert.equal(res.statusCode,405);assert.equal(called,false);
});
test.after(()=>{globalThis.fetch=old});
