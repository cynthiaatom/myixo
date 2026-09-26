import type {ReasoningResult} from '../intelligence/types';

type Candidate={start:number;end:number;text:string};

export function currentResultPreprocess(raw:string){
  return raw.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
}

function balancedCandidates(source:string):Candidate[]{
  const out:Candidate[]=[];
  let inString=false,escape=false;
  const stack:string[]=[];
  let start=-1;
  for(let i=0;i<source.length;i++){
    const c=source[i];
    if(inString){
      if(escape)escape=false;
      else if(c==='\\')escape=true;
      else if(c==='"')inString=false;
      continue;
    }
    if(c==='"'){inString=true;continue}
    if(c==='{'||c==='['){
      if(stack.length===0)start=i;
      stack.push(c);
      continue;
    }
    if(c==='}'||c===']'){
      if(!stack.length)continue;
      const open=stack[stack.length-1];
      if((open==='{'&&c!=='}')||(open==='['&&c!==']')){stack.length=0;start=-1;continue}
      stack.pop();
      if(stack.length===0&&start>=0){
        out.push({start,end:i,text:source.slice(start,i+1)});
        start=-1;
      }
    }
  }
  return out;
}

function parsedObject(value:unknown):ReasoningResult|null{
  return value!==null&&typeof value==='object'&&!Array.isArray(value)?value as ReasoningResult:null;
}

export class ReasoningRepresentationError extends Error{code='result_representation_invalid';constructor(){super('iXo reasoning completed but returned an unreadable result. Please try again.');this.name='ReasoningRepresentationError'}}

export function normalizeReasoningResult(raw:unknown):ReasoningResult{
  if(!raw)return {};
  const alreadyStructured=parsedObject(raw);
  if(alreadyStructured)return alreadyStructured;
  if(typeof raw!=='string')throw new ReasoningRepresentationError();
  const strict=currentResultPreprocess(raw);
  try{
    const parsed=parsedObject(JSON.parse(strict));
    if(!parsed)throw new Error('structured result must be a JSON object');
    return parsed;
  }catch{}
  const trimmed=raw.trim();
  const candidates=balancedCandidates(trimmed)
    .map(c=>{try{return{...c,value:JSON.parse(c.text)}}catch{return null}})
    .filter((x):x is Candidate&{value:unknown}=>Boolean(x));
  if(candidates.length===1){
    const parsed=parsedObject(candidates[0].value);
    if(parsed)return parsed;
  }
  throw new ReasoningRepresentationError();
}


