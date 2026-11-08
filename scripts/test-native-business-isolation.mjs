import test from 'node:test';
import assert from 'node:assert/strict';
import {nativeBusinessIsolationGate} from '../lib/native-business-isolation.js';
const keys=['owner_authenticated','workspace_membership_verified','workspace_chat_binding_verified','native_project_id_verified','native_memory_isolation_verified','native_tool_isolation_verified','run_ownership_verified','consent_to_business_transfer'];
test('native business reasoning is denied by default',()=>{const g=nativeBusinessIsolationGate();assert.equal(g.allowed,false);assert.deepEqual(g.missing,keys)});
test('each missing boundary individually prevents native business transfer',()=>{for(const missing of keys){const x=Object.fromEntries(keys.map(k=>[k,k!==missing]));const g=nativeBusinessIsolationGate(x);assert.equal(g.allowed,false,missing);assert.deepEqual(g.missing,[missing])}});
test('only fully verified boundary and explicit consent permits transfer',()=>{const x=Object.fromEntries(keys.map(k=>[k,true]));assert.equal(nativeBusinessIsolationGate(x).allowed,true);assert.equal(nativeBusinessIsolationGate({...x,native_memory_isolation_verified:'true'}).allowed,false)});
