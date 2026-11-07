import type {DecisionRecord} from './model';

const endpoint='/api/ixo/session?resource=decisions';
const headers={'content-type':'application/json'};
export class DecisionStorageError extends Error{
  constructor(message:string,public status:number){super(message)}
}
async function call(method:string,body?:object){
  const response=await fetch(endpoint,{
    method,headers,cache:'no-store',
    ...(body===undefined?{}:{body:JSON.stringify(body)})
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new DecisionStorageError(
    String(data.error||'Decision storage request failed'),response.status);
  return data;
}
export async function fetchDecisions():Promise<DecisionRecord[]>{
  const result=await call('GET');
  if(!Array.isArray(result.items))throw new Error('Invalid decision list from server');
  return result.items;
}
export async function commitDecisionChange(before:DecisionRecord[],after:DecisionRecord[]):Promise<DecisionRecord[]>{
  const originals=new Map(before.map(x=>[x.id,x]));
  const current=new Map(after.map(x=>[x.id,x]));
  const created=after.filter(x=>!originals.has(x.id));
  const deleted=before.filter(x=>!current.has(x.id));
  const edited=after.filter(x=>originals.has(x.id)&&x!==originals.get(x.id));
  if(created.length+deleted.length+edited.length!==1)
    throw new Error('Only one decision can be changed at a time.');
  if(created.length){
    const response=await call('POST',{action:'create',record:created[0]});
    return after.map(x=>x.id===created[0].id?response.item:x);
  }
  if(edited.length){
    const original=originals.get(edited[0].id)!;
    if(!Number.isSafeInteger(original.revision)||!original.revision)
      throw new Error('This decision has no verified server revision; reload first.');
    const response=await call('PATCH',{id:original.id,revision:original.revision,record:edited[0]});
    return after.map(x=>x.id===edited[0].id?response.item:x);
  }
  const old=deleted[0];
  if(!Number.isSafeInteger(old.revision)||!old.revision)
    throw new Error('This decision has no verified server revision; reload first.');
  await call('DELETE',{id:old.id,revision:old.revision});
  return after;
}
