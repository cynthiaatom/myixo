import assert from 'node:assert/strict';
import {readFileSync,readdirSync,statSync} from 'node:fs';
import {join,relative} from 'node:path';
import {normalizeReasoningResult,ReasoningRepresentationError} from '../src/services/result-normalizer.ts';
import {validateReasoningResult,ReasoningSchemaError} from '../src/services/reasoning-schema.ts';
import {buildFailureTelemetry} from '../src/services/reasoning-observability.ts';
import {parseNativePersonalMap,mapProgress} from '../src/ixo.ts';

const askGood={answer:'synthetic',context_used:[],assumptions:[],missing_information:[],why_context_changed_answer:null,evidence_refs:[]};
const decideGood={summary:'synthetic',known_context:['synthetic known context'],goals_affected:[],constraints:[],options:[],assumptions:[],unknowns:[],tradeoffs:[],risks_dependencies:[],what_would_change:[],clarifying_questions:[],evidence_refs:[]};
assert.equal(validateReasoningResult('decision',normalizeReasoningResult(JSON.stringify(decideGood))).summary,'synthetic');
assert.equal(validateReasoningResult('decision',normalizeReasoningResult('```json\n'+JSON.stringify(decideGood)+'\n```')).summary,'synthetic');
assert.equal(validateReasoningResult('decision',normalizeReasoningResult('wrapper\n'+JSON.stringify({...decideGood,summary:'brace } inside string'})+'\nend')).summary,'brace } inside string');
assert.throws(()=>normalizeReasoningResult('before '+JSON.stringify(decideGood)+' between '+JSON.stringify(decideGood)+' after'),ReasoningRepresentationError);
assert.throws(()=>normalizeReasoningResult('plain markdown answer'),ReasoningRepresentationError);
assert.throws(()=>normalizeReasoningResult('{"summary":"broken",}'),ReasoningRepresentationError);
assert.throws(()=>normalizeReasoningResult('[1,2,3]'),ReasoningRepresentationError);
assert.throws(()=>validateReasoningResult('decision',normalizeReasoningResult(JSON.stringify({...decideGood,summary:''}))),ReasoningSchemaError);
assert.throws(()=>validateReasoningResult('decision',normalizeReasoningResult(JSON.stringify({...decideGood,unknowns:'not-array'}))),ReasoningSchemaError);
assert.equal(validateReasoningResult('personalized',normalizeReasoningResult(JSON.stringify(askGood))).answer,'synthetic');
assert.deepEqual(validateReasoningResult('today',normalizeReasoningResult('{"items":[]}')).items,[]);
assert.deepEqual(validateReasoningResult('mirror',normalizeReasoningResult('{"findings":[]}')).findings,[]);

const root=process.cwd(),read=f=>readFileSync(join(root,f),'utf8'),walk=d=>readdirSync(d).flatMap(n=>{const p=join(d,n);return statSync(p).isDirectory()?walk(p):[p]});
const today=read('src/components/TodayView.tsx'),mirror=read('src/components/MirrorView.tsx'),ask=read('src/components/AskIxoView.tsx'),decide=read('src/components/DecisionLab.tsx'),reasoning=read('src/services/reasoning.ts'),reasonApi=read('api/ixo/reason.js'),runStatus=read('api/ixo/run-status.js'),session=read('api/ixo/session.js'),app=read('src/App.tsx'),css=read('src/styles.css'),timeline=read('src/components/TimelineView.tsx'),explain=read('src/components/ExplainPanel.tsx');

assert.match(reasoning,/normalizeReasoningResult/);assert.match(reasoning,/validateReasoningResult/);
for(const code of ['run_failed','result_missing','result_representation_invalid','result_schema_invalid','render_failed'])assert.match(reasoning+runStatus,new RegExp(code));
for(const [source,mode] of [[today,'today'],[mirror,'mirror'],[ask,'personalized'],[decide,'decision']]){assert.match(source,new RegExp("waitForReasoning\\(job,'"+mode+"'"));assert.match(source,/reportUnobservedFailure/)}
assert.match(today,/autoStarted=useRef\(false\)/);assert.match(mirror,/autoStarted=useRef\(false\)/);assert.doesNotMatch(today,/profile_revision[^\n]*useEffect|useEffect[^\n]*profile_revision/);
assert.match(today,/useEffect\(\(\)=>\{if\(autoStarted\.current\)return;autoStarted\.current=true;void run\(\)\},\[\]\)/);assert.match(mirror,/useEffect\(\(\)=>\{if\(autoStarted\.current\)return;autoStarted\.current=true;void run\(\)\},\[\]\)/);
assert.match(ask,/onClick=\{ask\}/);assert.match(ask,/Try to restore answer/);assert.match(ask,/rereadReasoning\(recoverableJob,'personalized'\)/);assert.match(decide,/onClick=\{analyze\}/);assert.match(decide,/disabled=\{working\|\|!input\.decision\.trim\(\)\}/);
assert.match(reasoning,/desired_outcome:input\.desiredOutcome,options:input\.options,assumptions:input\.assumptions/);
assert.match(runStatus,/req\.query\?\.recover\|\|''\)==='completed'/);assert.doesNotMatch(runStatus,/diagnostic/);assert.doesNotMatch(runStatus,/conversation-input|\/cancel|method:'PATCH'|method:'DELETE'/);
assert.match(runStatus,/event:'reasoning_failure'/);assert.match(runStatus,/ownedRun\(req,res,runId\)/);assert.match(runStatus,/failureCodes/);
assert.match(session,/\^\[0-9\]\{6\}\$/);assert.match(session,/confirmed:true/);assert.doesNotMatch(session,/verified_email_present/);
const confirmBlock=app.slice(app.indexOf('const confirmVerification='),app.indexOf('const retryPersonalMap='));assert.equal((confirmBlock.match(/await fetchMap\(\)/g)||[]).length,1);assert.doesNotMatch(confirmBlock,/startReasoning|\/api\/ixo\/reason/);assert.match(app,/Not now/);
for(const source of [today,mirror,ask,decide])assert.doesNotMatch(source,/LIVE RUN|runtime tool|tool calls|telemetry|unreadable result|invalid result shape/i);
assert.match(ask,/I could not complete that answer/);assert.match(decide,/I could not complete that analysis/);
for(const state of ['LOADING','READY','PARTIAL','AUTH_REQUIRED','ERROR'])assert.match(app,new RegExp(state));
assert.match(css,/\.mirrorGrid\{display:grid;grid-template-columns:minmax\(0,1fr\)/);assert.match(css,/@media\(max-width:900px\)/);
const nativeMap=parseNativePersonalMap({areas:[{id:'work',covered:true},{id:'family',covered:true},{id:'rest',covered:true},{id:'values',covered:true}]});assert.equal(nativeMap.covered.length,4);assert.equal(mapProgress(nativeMap).label,'4/10');assert.equal(nativeMap.source,'native');

// Privacy-safe telemetry payloads: allowlist only structural metadata.
const job={run_id:'synthetic-run-id'};
for(const code of ['result_representation_invalid','result_schema_invalid','result_missing','run_failed','render_failed']){
 const e=new Error('PRIVATE_SENTINEL');e.code=code;
 const payload=buildFailureTelemetry(job,'decision','think_through',e,{terminal_status:'finished',result_present:true,result_type:'string',duration_ms:123});
 assert.equal(payload.code,code);assert.equal(payload.mode,'decision');assert.equal(payload.source,'think_through');assert.equal(payload.run_id,'synthetic-run-id');
 const serialized=JSON.stringify(payload);for(const secret of ['PRIVATE_SENTINEL','prompt','question','decision text','memory value','email@example.com','123456'])assert.equal(serialized.includes(secret),false);
 assert.deepEqual(Object.keys(payload).sort(),['code','duration_ms','mode','result_present','result_type','run_id','source','terminal_status'].sort());
}

// Encoding reliability: reject corruption classes, not legitimate Unicode.
const encodingBad=s=>/[\uFFFD]|(?:Ã.|Â.|â(?:€|†|„|€œ|€�|€¦|€™|€”|€“|„¢))|\\u[0-9a-fA-F]{4}/u.test(s)||/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/u.test(s);
for(const bad of ['tradeoffsâ€”not choose','Think this through â†’','Continue My Personal Map \\u2192','bad � text','bad '+String.fromCharCode(0x1a)])assert.equal(encodingBad(bad),true);
for(const good of ['tradeoffs—not choose','Think this through →','Personal context · grounded','“memory off”','Continue &rarr;'])assert.equal(encodingBad(good),false);
const uiFiles=[join(root,'src','App.tsx'),...walk(join(root,'src','components')).filter(f=>/\.(tsx|jsx)$/.test(f))];
for(const f of uiFiles){const source=readFileSync(f,'utf8');assert.equal(encodingBad(source),false,'encoding corruption in '+relative(root,f))}

console.log('REGRESSION PASS: normalization/schema, lifecycle, verification, observability privacy, all-mode failure classification, demo-copy and comprehensive encoding gates passed.');
