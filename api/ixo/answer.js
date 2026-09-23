import {randomUUID} from 'node:crypto';
import {ixoFetch,errorDetail} from '../../lib/ixo-client.js';

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store, no-cache, must-revalidate');
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});

  const {question_id,question_revision,expected_session_revision,option_ids=[],custom_text=null,skipped=false,input_method,transcript_confirmed=false}=req.body||{};
  if(!question_id||!question_revision||!expected_session_revision||!input_method)return res.status(400).json({error:'Missing briefing question state'});

  const body={
    question_revision:Number(question_revision),
    expected_session_revision:Number(expected_session_revision),
    option_ids:Array.isArray(option_ids)?option_ids:[],
    custom_text:custom_text==null?null:String(custom_text).trim().slice(0,4000)||null,
    skipped:Boolean(skipped),
    input_method:String(input_method),
    transcript_confirmed:Boolean(transcript_confirmed)
  };

  try{
    const key=String(req.headers['x-idempotency-key']||randomUUID());
    const path='/briefing/questions/'+encodeURIComponent(String(question_id))+'/answers';
    const r=await ixoFetch(req,res,path,{
      method:'POST',
      headers:{'content-type':'application/json','X-UI-Locale':'en','Idempotency-Key':key},
      body:JSON.stringify(body)
    });
    const data=await r.json().catch(()=>({}));
    if(!r.ok)return res.status(r.status).json({error:errorDetail(data)||'iXo could not process this answer',code:data?.code||null});
    return res.status(200).json(data);
  }catch{
    return res.status(500).json({error:'Could not process this answer with iXo'});
  }
}
