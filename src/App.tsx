import {useEffect,useRef,useState} from 'react';
import Map from './Map';
import MemoryInspector,{type MemoryPayload} from './MemoryInspector';
import ProductNav,{type ProductView} from './components/ProductNav';
import TodayView from './components/TodayView';
import MirrorView from './components/MirrorView';
import DecisionLab from './components/DecisionLab';
import AskIxoView from './components/AskIxoView';
import TimelineView from './components/TimelineView';
import type {NativeIntelligenceContext} from './intelligence/types';
import {changedAreas,demoPersonalMap,labels,mapProgress,parseNativePersonalMap,questions,type CategoryId,type PersonalMapModel} from './ixo';

type Stage='hero'|'demo'|'done'|'connect'|'memory'|'today'|'mirror'|'decide'|'ask'|'timeline';
type User={email:string,full_name?:string|null,plan?:string|null};
type Option={id:string,label:string};
type BriefingQuestion={id:string,revision:number,state:string,type:string,text:string,options:Option[],allow_custom:boolean,allow_skip:boolean,reason:string};
type BriefingSession={id:string,kind:'onboarding'|'continuous',state:'in_progress'|'completed'|'paused',revision:number,progress:{answered:number,total:number|null},question:BriefingQuestion|null,generation?:{state:'ready'|'generating'|'failed',retryable:boolean},completion_summary?:string|null};
type ProcessStep=0|1|2|3;
type InitState='LOADING'|'READY'|'PARTIAL'|'AUTH_REQUIRED'|'ERROR';

const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));

export default function App(){
  const [model,setModel]=useState<PersonalMapModel>(demoPersonalMap);
  const [mapReady,setMapReady]=useState(false);
  const [stage,setStage]=useState<Stage>('hero');
  const [demoQi,setDemoQi]=useState(0);
  const [answer,setAnswer]=useState('');
  const [selected,setSelected]=useState<string[]>([]);
  const [phase,setPhase]=useState<'ask'|'thinking'|'reveal'>('ask');
  const [changed,setChanged]=useState<CategoryId[]>([]);
  const [previousLabel,setPreviousLabel]=useState(mapProgress(demoPersonalMap()).label);
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [user,setUser]=useState<User|null>(null);
  const [session,setSession]=useState<BriefingSession|null>(null);
  const [connecting,setConnecting]=useState(false);
  const [initState,setInitState]=useState<InitState>('LOADING');
  const [briefingLoading,setBriefingLoading]=useState(false);
  const [connectError,setConnectError]=useState('');
  const [processStep,setProcessStep]=useState<ProcessStep>(0);
  const [memory,setMemory]=useState<MemoryPayload|null>(null);
  const [memoryLoading,setMemoryLoading]=useState(false);
  const [nativeContext,setNativeContext]=useState<NativeIntelligenceContext|null>(null);
  const eventSource=useRef<EventSource|null>(null);

  const progress=mapProgress(model);
  const question=user?session?.question:null;
  const nativeTotal=session?.progress?.total;
  const questionLabel=user
    ?(session?('QUESTION '+(session.progress.answered+1)+(nativeTotal?(' OF '+nativeTotal):'')):'ADAPTIVE BRIEFING')
    :('QUESTION '+(demoQi+1)+' OF '+questions.length);
  const liveStatuses=['Understanding your answer','Saving memory','Updating your Personal Map','Done'];

  const resetDemo=()=>{setModel(demoPersonalMap());setDemoQi(0);setAnswer('');setSelected([]);setPhase('ask');setChanged([]);setStage('hero')};

  const fetchMap=async()=>{
    const r=await fetch('/api/ixo/map?ts='+Date.now(),{cache:'no-store'});
    const data=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(data.error||'Could not load Personal Map');
    const parsed=parseNativePersonalMap(data);
    setModel(parsed);setMapReady(true);
    return parsed;
  };

  const getBriefing=async()=>{
    const r=await fetch('/api/ixo/briefing?ts='+Date.now(),{cache:'no-store'});
    const data=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(data.error||'Could not load iXo briefing');
    return (data.session||null) as BriefingSession|null;
  };

  const startBriefing=async()=>{
    const r=await fetch('/api/ixo/briefing',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({topic:'Build my Personal Map with the highest-value missing personal context.'})});
    const data=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(data.error||'Could not start iXo briefing');
    return data.session as BriefingSession;
  };

  const waitForBriefing=async(initial:BriefingSession,maxMs=30000)=>{
    let current=initial;
    const started=Date.now();
    while(current.state==='in_progress'&&!current.question&&current.generation?.state==='generating'&&Date.now()-started<maxMs){
      await sleep(900);
      const next=await getBriefing();
      if(!next)break;
      current=next;
    }
    return current;
  };

  const ensureBriefing=async()=>{
    setBriefingLoading(true);
    try{
      let current=await getBriefing();
      if(!current||current.state==='completed'||current.state==='paused')current=await startBriefing();
      current=await waitForBriefing(current);
      setSession(current);
      if(current.state==='completed'){setStage('done');return current}
      if(current.generation?.state==='failed')throw new Error('iXo could not generate the next question.');
      return current;
    }finally{setBriefingLoading(false)}
  };

  const restore=async()=>{
    setInitState('LOADING');
    try{
      const r=await fetch('/api/ixo/session',{cache:'no-store'});
      const d=await r.json().catch(()=>({}));
      if(!r.ok||!d.connected){setUser(null);setMapReady(false);setInitState('AUTH_REQUIRED');return}
      setUser(d.user);
      try{
        await fetchMap();
        setInitState('READY');
      }catch{
        setMapReady(false);
        setInitState('PARTIAL');
        return;
      }
      const current=await getBriefing().catch(()=>null);
      if(current)setSession(current);
    }catch{
      setMapReady(false);
      setInitState(user?'ERROR':'AUTH_REQUIRED');
    }
  };

  const retryPersonalMap=async()=>{
    if(!user){setInitState('AUTH_REQUIRED');return}
    setInitState('LOADING');
    try{await fetchMap();setInitState('READY')}
    catch{setMapReady(false);setInitState('PARTIAL')}
  };

  useEffect(()=>{restore();return()=>eventSource.current?.close()},[]);

  const connect=async()=>{
    setConnecting(true);setConnectError('');
    try{
      const r=await fetch('/api/ixo/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email,password})});
      const d=await r.json().catch(()=>({}));
      if(!r.ok)throw new Error(d.error||'Could not connect');
      setUser(d.user);setPassword('');
      setInitState('LOADING');
      try{await fetchMap();setInitState('READY')}catch{setMapReady(false);setInitState('PARTIAL');return}
      const current=await getBriefing().catch(()=>null);
      if(current)setSession(current);
    }catch(e:any){setConnectError(e.message||'Could not connect to iXo')}
    finally{setConnecting(false)}
  };

  const loadMemoryData=async()=>{
    if(memory){
      try{
        const sr=await fetch('/api/ixo/profile-status?ts='+Date.now(),{cache:'no-store'});
        const sd=await sr.json().catch(()=>({}));
        if(sr.ok&&Number(sd.profile_revision||0)===Number(memory.profile_revision||0))return memory;
        if(sr.ok&&Number(sd.profile_revision||0)!==Number(memory.profile_revision||0))setNativeContext(null);
      }catch{return memory}
    }
    const all:any[]=[];
    let cursor='';
    let profileRevision=0,indexStatus='unknown';
    for(let page=0;page<10;page++){
      const r=await fetch('/api/ixo/memory?limit=100'+(cursor?'&cursor='+encodeURIComponent(cursor):''),{cache:'no-store'});
      const d=await r.json().catch(()=>({}));
      if(!r.ok)throw new Error(d.error||'Could not load iXo memory');
      profileRevision=Number(d.profile_revision||profileRevision);
      indexStatus=String(d.index_status||indexStatus);
      if(Array.isArray(d.items))all.push(...d.items);
      cursor=String(d.next_cursor||'');
      if(!cursor)break;
    }
    const loaded={profile_revision:profileRevision,index_status:indexStatus,items:all,next_cursor:null};
    setMemory(loaded);
    return loaded;
  };

  const loadNativeContext=async()=>{
    if(nativeContext)return nativeContext;
    const r=await fetch('/api/ixo/map?detail=intelligence&ts='+Date.now(),{cache:'no-store'});
    const d=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(d.error||'Could not load iXo intelligence context');
    setNativeContext(d);
    return d as NativeIntelligenceContext;
  };

  const openView=async(view:ProductView)=>{
    if(!user){setStage('connect');return}
    setConnectError('');
    if(view==='me'){setStage('hero');return}
    if(view==='decide'||view==='ask'){setStage(view);return}
    setMemoryLoading(true);
    try{
      await loadMemoryData();
      if(view==='mirror')await loadNativeContext();
      setStage(view);
    }catch(e:any){setConnectError(e.message||'Could not load iXo context');setStage('connect')}
    finally{setMemoryLoading(false)}
  };

  const openMemory=async()=>openView('memory');

  const disconnect=async()=>{
    eventSource.current?.close();
    await fetch('/api/ixo/logout',{method:'POST'});
    setUser(null);setSession(null);setMemory(null);setNativeContext(null);setEmail('');setPassword('');setModel(demoPersonalMap());setMapReady(false);setStage('hero');
  };

  const begin=async()=>{
    if(!user){setStage('connect');return}
    setConnectError('');
    try{
      const current=await ensureBriefing();
      if(current?.state==='in_progress'){setAnswer('');setSelected([]);setPhase('ask');setStage('demo')}
    }catch(e:any){setConnectError(e.message||'Could not start iXo briefing');setStage('connect')}
  };

  const updateStatusFromEvent=(raw:string)=>{
    let statusText=raw;
    try{
      const data=JSON.parse(raw);
      statusText=String(data?.type||data?.event||data?.status||data?.name||raw);
    }catch{}
    const s=statusText.toLowerCase();
    if(/map|index/.test(s))setProcessStep(2);
    else if(/memory|profile|fact|save/.test(s))setProcessStep(1);
    else if(/complete|completed|done|finish|final/.test(s))setProcessStep(3);
    else setProcessStep(0);
  };

  const followRun=async(runId:string)=>{
    try{
      const r=await fetch('/api/ixo/stream-ticket',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({run_id:runId})});
      const d=await r.json().catch(()=>({}));
      if(!r.ok||!d.url)return;
      eventSource.current?.close();
      const es=new EventSource(d.url);
      eventSource.current=es;
      es.onmessage=e=>updateStatusFromEvent(e.data);
      es.onerror=()=>{es.close();if(eventSource.current===es)eventSource.current=null};
    }catch{}
  };

  const waitForProfile=async(target:number,status:string)=>{
    if(target<=0)return;
    let currentStatus=String(status||'').toLowerCase();
    let revision=0;
    const started=Date.now();
    while(Date.now()-started<30000){
      if(revision>=target&&!['pending','building','indexing','processing','queued','running'].includes(currentStatus))return;
      await sleep(700);
      setProcessStep(2);
      const r=await fetch('/api/ixo/profile-status?ts='+Date.now(),{cache:'no-store'});
      if(!r.ok)continue;
      const d=await r.json().catch(()=>({}));
      revision=Number(d.profile_revision||0);
      currentStatus=String(d.index_status||'unknown').toLowerCase();
    }
  };

  const sendNative=async(skipped=false)=>{
    if(!session||!question)return;
    const custom=answer.trim();
    if(!skipped&&!custom&&!selected.length)return;
    const before=model;
    setPreviousLabel(mapProgress(before).label);
    setConnectError('');setPhase('thinking');setProcessStep(0);
    try{
      const inputMethod=skipped?'skip':custom?'text':'choice';
      const r=await fetch('/api/ixo/answer',{
        method:'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({
          question_id:question.id,
          question_revision:question.revision,
          expected_session_revision:session.revision,
          option_ids:skipped?[]:selected,
          custom_text:skipped?null:(custom||null),
          skipped,
          input_method:inputMethod,
          transcript_confirmed:false
        })
      });
      const d=await r.json().catch(()=>({}));
      if(!r.ok)throw new Error(d.error||'iXo could not process the answer');

      const runId=String(d.run_id||d.run?.id||'');
      if(runId)followRun(runId);
      setProcessStep(1);

      await waitForProfile(Number(d.profile_revision||0),String(d.index_status||''));
      setProcessStep(2);
      const after=await fetchMap();
      setMemory(null);
      setNativeContext(null);
      const newAreas=changedAreas(before,after);
      setChanged(newAreas);

      let next=(d.session||null) as BriefingSession|null;
      if(next)next=await waitForBriefing(next);
      else next=await getBriefing();
      if(next)setSession(next);

      setAnswer('');setSelected([]);setProcessStep(3);
      eventSource.current?.close();eventSource.current=null;

      if(next?.state==='completed'){setStage('done');return}
      setPhase('reveal');
    }catch(e:any){
      eventSource.current?.close();eventSource.current=null;
      setConnectError(e.message||'Could not process answer');
      setPhase('ask');
    }
  };

  const sendDemo=()=>{
    const q=questions[demoQi];
    if(!q||!answer.trim())return;
    setPreviousLabel(mapProgress(model).label);setPhase('thinking');
    setTimeout(()=>{
      const next:PersonalMapModel={...model,map:structuredClone(model.map),covered:[...model.covered]};
      const areas=new Set(next.covered);
      for(const [cat,asp] of q.fills){
        const c=cat as CategoryId;
        if(!next.map[c].includes(asp as any))next.map[c].push(asp as any);
        areas.add(c);
      }
      next.covered=Array.from(areas) as CategoryId[];
      setModel(next);setChanged(next.covered.filter(c=>!model.covered.includes(c)));setAnswer('');
      if(demoQi===questions.length-1)setStage('done');
      else{setDemoQi(demoQi+1);setPhase('reveal')}
    },800);
  };

  const toggleOption=(id:string)=>{
    const multi=Boolean(question?.type?.toLowerCase().includes('multi'));
    setSelected(prev=>multi?(prev.includes(id)?prev.filter(x=>x!==id):[...prev,id]):(prev.includes(id)?[]:[id]));
  };

  const currentPrompt=user?question?.text:questions[demoQi]?.prompt;
  const currentHelper=user?(question?.reason||'iXo chose this question based on what it already knows and what would add the most useful context.'):questions[demoQi]?.helper;
  const currentPlaceholder=user?'Tell iXo in your own words…':questions[demoQi]?.placeholder;
  const chips=user?(question?.options||[]):questions[demoQi].chips.map((label,i)=>({id:String(i),label}));
  const activeView:ProductView=stage==='memory'?'memory':stage==='today'?'today':stage==='mirror'?'mirror':stage==='decide'?'decide':stage==='ask'?'ask':stage==='timeline'?'timeline':'me';

  return <main><div className="veil"/><header><div className="logo"><span className="my">MY</span><span className="ixo">iXo</span></div><div className="demo">{user?'iXo CONNECTED':'EXECUTIVE DEMO'}</div></header><div className="wrap">
    {user&&stage!=='connect'&&<ProductNav active={activeView} onNavigate={openView}/>}
    {memoryLoading&&<div className="contextLoading">Loading your iXo context…</div>}
    {stage==='hero'&&initState==='LOADING'&&<section className="hero loadingHero"><div><div className="eyebrow">PERSONAL INTELLIGENCE, MADE VISIBLE</div><h1>BUILD YOUR <em>iXo</em></h1><p className="lead">Syncing your real iXo context before showing your Personal Map.</p><div className="syncPill"><span/>Checking session · loading native Personal Map</div></div><div className="mapLoading"><div className="mapLoadingCore">MY<br/><b>iXo</b></div><p>SYNCING PERSONAL MAP</p></div></section>}
    {stage==='hero'&&(initState==='PARTIAL'||initState==='ERROR')&&user&&<section className="hero"><div><div className="eyebrow">CONNECTED · PERSONAL MAP UNAVAILABLE</div><h1>BUILD YOUR <em>iXo</em></h1><p className="lead">Connected to iXo, but the Personal Map couldn't be loaded.</p><div className="actions"><button className="primary" onClick={retryPersonalMap}>Retry Personal Map</button><button onClick={()=>setStage('connect')}>Connection</button></div><p className="note">Your native Personal Map is unavailable right now. Durable Memory is separate and is not being used as a replacement.</p></div></section>}
    {stage==='hero'&&(initState==='READY'||initState==='AUTH_REQUIRED')&&(!user||mapReady)&&<section className="hero"><div><div className="eyebrow">PERSONAL INTELLIGENCE, MADE VISIBLE</div><h1>BUILD YOUR <em>iXo</em></h1><p className="lead">Turn what iXo knows about you into an intelligent personal operating system.</p><div className="stat"><strong>{progress.label}</strong><div><b>{progress.description}</b><p>{model.mode==='areas'?('iXo currently has saved context in '+progress.current+' of 10 Personal Map areas.'):('Executive demo: '+progress.current+' of 30 illustrative context dimensions.')}</p></div></div><div className="actions"><button className="primary" disabled={briefingLoading} onClick={begin}>{briefingLoading?'Preparing iXo…':user?'Continue My Personal Map →':'Connect My iXo →'}</button><button onClick={()=>setStage('demo')}>Executive Demo</button>{user&&<button disabled={memoryLoading} onClick={openMemory}>{memoryLoading?'Loading Memory…':'Memory Inspector'}</button>}{user&&<button onClick={()=>setStage('connect')}>Connection</button>}</div><p className="note">The Personal Map shows where iXo has saved context. It is never a rating of your life.</p></div><Map model={model}/></section>}

    {stage==='demo'&&<section className="flow"><div className="panel">{phase==='thinking'?<div className="center"><div className="eyebrow">LIVE iXo STATUS</div><div className="statusSteps">{liveStatuses.map((s,i)=><div key={s} className={i<processStep?'complete':i===processStep?'current':''}><span>{i<processStep?'✓':i+1}</span><b>{s}</b></div>)}</div><div className="scan"/></div>:phase==='reveal'?<div className="center"><div className="eyebrow">PERSONAL MAP UPDATED</div><h2>{changed.length?('iXo added context to '+changed.length+' '+(changed.length===1?'area':'areas')):'Your answer added useful context to iXo'}</h2><div className="jump">{previousLabel} → {mapProgress(model).label}</div>{changed.length>0?<div className="learned">{changed.map(c=><div key={c}><b>{labels[c]}</b> · new saved context</div>)}</div>:<p className="helper">The answer was saved, but it did not create a newly covered Personal Map area. iXo can still use the context.</p>}<button className="primary" onClick={()=>setPhase('ask')}>Continue →</button></div>:<><div className="eyebrow">{questionLabel} · {progress.label} {model.mode==='areas'?'AREAS':'DIMENSIONS'} UNDERSTOOD</div>{currentPrompt?<><h2>{currentPrompt}</h2><p className="helper">{currentHelper}</p><div className="chips">{chips.map(c=><button key={c.id} onClick={()=>user?toggleOption(c.id):setAnswer(c.label)} className={(user?selected.includes(c.id):answer===c.label)?'selected':''}>{c.label}</button>)}</div>{(!user||question?.allow_custom!==false)&&<textarea value={answer} onChange={e=>setAnswer(e.target.value)} placeholder={currentPlaceholder}/>} {connectError&&<div className="connectError">{connectError}</div>}<div className="actions"><button className="primary" onClick={()=>user?sendNative(false):sendDemo()}>Send to iXo →</button>{user&&question?.allow_skip&&<button onClick={()=>sendNative(true)}>Skip</button>}{!user&&<button onClick={()=>{setDemoQi(Math.min(demoQi+1,questions.length-1));setAnswer('')}}>Skip</button>}</div></>:<div className="center"><div className="thinking">{session?.generation?.state==='generating'?'iXo is preparing your next question…':'No question is available yet.'}</div></div>}</>}</div><Map model={model} highlight={changed}/></section>}

    {stage==='memory'&&memory&&<MemoryInspector memory={memory} setMemory={m=>{setMemory(m);setNativeContext(null)}} onClose={()=>setStage('hero')}/>}
    {stage==='today'&&memory&&<TodayView memory={memory as any} question={question?{id:question.id,text:question.text,reason:question.reason}:null} onMirror={()=>openView('mirror')} onDecide={()=>openView('decide')}/>}
    {stage==='mirror'&&memory&&<MirrorView memory={memory as any} nativeContext={nativeContext} onMemory={()=>openView('memory')} onDecide={()=>openView('decide')}/>}
    {stage==='decide'&&<DecisionLab/>}
    {stage==='ask'&&<AskIxoView/>}
    {stage==='timeline'&&memory&&<TimelineView memory={memory as any}/>}

    {stage==='done'&&<section className="finish"><Map model={model} highlight={changed}/><div className="eyebrow">{user?'iXo BRIEFING COMPLETE':'PERSONAL MAP UPDATED'}</div><h2>{user?'Your iXo has a clearer picture of you.':'Your iXo knows more than it did 10 minutes ago.'}</h2><p>{user?(session?.completion_summary||'Your Personal Map will keep evolving as iXo learns from future conversations and connected context.'):'One continuously evolving understanding of you.'}</p><button className="primary" onClick={()=>setStage('hero')}>Return to My iXo →</button>{!user&&<button onClick={resetDemo}>Reset demo</button>}</section>}

    {stage==='connect'&&<section className="panel connect"><div className="eyebrow">CONNECT MY iXo</div>{user?<><h2>Connected to your iXo</h2><p className="connectedAs">{user.full_name||user.email}</p><p>Your credentials are not stored in this browser. The connection uses secure, HttpOnly session cookies and automatically refreshes your iXo session when needed.</p><div className="actions"><button className="primary" onClick={()=>setStage('hero')}>Use My Personal Map →</button><button onClick={disconnect}>Disconnect</button></div></>:<><h2>Sign in to your iXo</h2><p>Use the same email and password you use for iXo. Your password is sent server-to-server to iXo for authentication and is not stored by this site.</p><div className="loginForm"><label>iXo email<input type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="username"/></label><label>iXo password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password"/></label>{connectError&&<div className="connectError">{connectError}</div>}<button className="primary" disabled={connecting||!email||!password} onClick={connect}>{connecting?'Connecting…':'Connect My iXo →'}</button></div><p className="securityNote">We never ask for API keys, browser cookies, or bearer tokens.</p><button onClick={()=>setStage('hero')}>← Back</button></>}</section>}

    {(['hero','demo','done'].includes(stage))&&<section className="how"><div className="eyebrow">THE INTELLIGENCE LOOP</div><h2>One conversation. A clearer picture.</h2><div className="steps">{[['01','Adaptive questioning','iXo chooses the next high-information question from your current context.'],['02','Context & memory','Your answer is saved into iXo’s revisioned personal context.'],['03','Personal Map update','The app waits for iXo to finish indexing before refreshing the map.'],['04','Living Personal Map','The map evolves as you do. It is never a life score.']].map(x=><div key={x[0]}><span>{x[0]}</span><h3>{x[1]}</h3><p>{x[2]}</p></div>)}</div></section>}
    <footer>{user?'MY iXo · Personal Intelligence Operating System':'MY iXo · Executive prototype · Synthetic demo data only'}</footer>
  </div></main>
}
