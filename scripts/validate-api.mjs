import {readdirSync,readFileSync,statSync} from 'node:fs';
import {join,relative} from 'node:path';
import {spawnSync} from 'node:child_process';
const root=process.cwd(),api=join(root,'api');
const walk=d=>readdirSync(d).flatMap(n=>{const p=join(d,n);return statSync(p).isDirectory()?walk(p):[p]});
const files=walk(api).filter(f=>/\.(m?js|cjs)$/.test(f));let bad=false;
for(const f of files){const r=spawnSync(process.execPath,['--check',f],{encoding:'utf8'});if(r.status){bad=true;console.error('PARSE FAIL',relative(root,f),r.stderr)}else console.log('PARSE OK',relative(root,f))}
const sourceFiles=[...walk(api),...walk(join(root,'src'))].filter(f=>/\.(m?js|cjs|ts|tsx|jsx)$/.test(f));
for(const f of sourceFiles){const s=readFileSync(f,'utf8');if(/\\n\s+(?:const|let|var|if|return|throw|try|for|while|function|export|import)\b/.test(s)){bad=true;console.error('ESCAPE ARTIFACT',relative(root,f))}}
const all=sourceFiles.map(f=>readFileSync(f,'utf8')).join('\n');
for(const forbidden of ['diagnostic=lifecycle','Run lifecycle diagnostic'])if(all.includes(forbidden)){bad=true;console.error('FORBIDDEN',forbidden)}
const reasonCalls=[];for(const f of sourceFiles){const s=readFileSync(f,'utf8');if(s.includes('/api/ixo/reason'))reasonCalls.push(relative(root,f))}console.log('REASON CALL FILES',reasonCalls.join(', ')||'none');
const unsafeLog=/console\.(?:log|info|warn|error)\([^\n]*(?:prompt|memory|decision|question|desired_outcome|assumptions)/i;for(const f of sourceFiles){const s=readFileSync(f,'utf8');if(unsafeLog.test(s)){bad=true;console.error('POTENTIAL PERSONAL LOG',relative(root,f))}}
if(bad)process.exit(1);console.log(`API VALIDATION PASS: ${files.length} executable /api modules parsed; privacy/static gates passed.`);
