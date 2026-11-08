
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
import {changedAreas,demoPersonalMap,knowledgeDepth,labels,mapProgress,parseNativePersonalMap,questions,type CategoryId,type PersonalMapModel} from './ixo';
import {buildLearningPlan,learningDelta,type LearningPlan,type LearningDelta} from './learning';
import {generateAdaptiveQuestion,submitAdaptiveAnswer} from './services/adaptive-learning-native';

type Stage='hero'|'demo'|'done'|'connect'|'memory'|'today'|'mirror'|'decide'|'ask'|'timeline';
type User={email:string,full_name?:string|null,plan?:string|null};
type Option={id:string,label:string};
type BriefingQuestion={id:string,revision:number,state:string,type:string,text:string,options:Option[],allow_custom:boolean,allow_skip:boolean,reason:string};
type BriefingSession={id:string,kind:'onboarding'|'continuous',state:'in_progress'|'completed'|'paused',revision:number,progress:{answered:number,total:number|null},question:BriefingQuestion|null,generation?:{state:'ready'|'generating'|'failed',retryable:boolean},completion_summary?:string|null};
type ProcessStep=0|1|2|3;
type InitState='LOADING'|'READY'|'PARTIAL'|'AUTH_REQUIRED'|'ERROR';

const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));


type WorkRecord={id:string;workspace_id:string;kind:string;title:string;details:string;status:string;amount:number;specialist:string;due_at:string|null;revision:number};
type WorkSpace={id:string;name:string;objective:string};
function MyWorkHome({authenticated}:{authenticated:boolean}){
  const [remoteSpaces,setRemoteSpaces]=useState<WorkSpace[]>([]);
  const [activeSpace,setActiveSpace]=useState('');
  const activeSpaceRef=useRef('');
  activeSpaceRef.current=activeSpace;
  const [remoteItems,setRemoteItems]=useState<WorkRecord[]>([]);
  const [remoteStatus,setRemoteStatus]=useState<'loading'|'ready'|'signed-out'|'error'>('loading');
  const [remoteError,setRemoteError]=useState('');
  const [remoteBusy,setRemoteBusy]=useState(false);
  const [remoteLoadingItems,setRemoteLoadingItems]=useState(false);
  const [recordsComplete,setRecordsComplete]=useState(true);
  const [opportunityDue,setOpportunityDue]=useState('');
  const [decisionDue,setDecisionDue]=useState('');
  const [taskDue,setTaskDue]=useState('');
  const [dimensionStage,setDimensionStage]=useState(0);
  const [goal,setGoal]=useState('');
  const [projectTitle,setProjectTitle]=useState('');
  const [projectOutcome,setProjectOutcome]=useState('');
  const [projectDue,setProjectDue]=useState('');
  const [meetingTitle,setMeetingTitle]=useState('');
  const [meetingNotes,setMeetingNotes]=useState('');
  const [meetingDate,setMeetingDate]=useState('');
  const [workStarted,setWorkStarted]=useState(false);
  const workRequest=async(path:string,method='GET',body?:unknown)=>{
    const response=await fetch('/api/ixo/session?work=1&'+path.replace(/^\?/,''),{method,headers:{'content-type':'application/json'},body:body?JSON.stringify(body):undefined,cache:'no-store'});
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw Error(data.error||'Could not save My Work');
    return data;
  };
  const loadSpaces=async()=>{
    if(!authenticated){setRemoteSpaces([]);setActiveSpace('');setRemoteItems([]);setRemoteStatus('signed-out');return}
    setRemoteStatus('loading');
    try{const data=await workRequest('?resource=workspaces');setRemoteSpaces(data.items||[]);setActiveSpace(current=>data.items?.some((x:WorkSpace)=>x.id===current)?current:(data.items?.[0]?.id||''));setRemoteStatus('ready')}
    catch(e:any){setRemoteError(e.message);setRemoteStatus('error')}
  };
  useEffect(()=>{void loadSpaces()},[authenticated]);
  useEffect(()=>{if(!authenticated||!activeSpace){setRemoteItems([]);return}
    let live=true;setRemoteItems([]);setRemoteLoadingItems(true);(async()=>{const all:WorkRecord[]=[];let offset=0;let complete=false;for(let page=0;page<25;page++){const d=await workRequest('?resource=items&workspace='+encodeURIComponent(activeSpace)+'&offset='+offset);if(!live)return;all.push(...(d.items||[]));if(!d.has_more){complete=true;break}offset=d.next_offset;if(!Number.isInteger(offset)||offset<=0)break}if(live){setRemoteItems(all);setRecordsComplete(complete);setRemoteLoadingItems(false)}})().catch(e=>{if(live){setRemoteError(e.message);setRemoteLoadingItems(false)}});
    return()=>{live=false}
  },[activeSpace,authenticated]);
  const saveSpace=async()=>{
    if(!authenticated){setRemoteError('Sign in to My Life first to enable secure business storage.');return}
    if(!company.trim())return;
    setRemoteBusy(true);setRemoteError('');
    try{const d=await workRequest('?resource=workspaces','POST',{name:company,objective});setRemoteSpaces(xs=>[...xs,d.item]);setActiveSpace(d.item.id);setNotice('Business workspace saved securely. Next, build your Business Map.');setWorkspace('map')}
    catch(e:any){setRemoteError(e.message)}finally{setRemoteBusy(false)}
  };
  const saveRemoteItem=async(kind:string,title:string,amount=0,specialist='',due_at:string|null=null,details=''):Promise<boolean>=>{
    if(!activeSpace){setRemoteError('Create or select a business workspace first.');return false}
    setRemoteBusy(true);setRemoteError('');
    try{const scope=activeSpace;const d=await workRequest('?resource=items&workspace='+encodeURIComponent(scope),'POST',{workspace_id:scope,kind,title,amount,specialist,due_at,details});if(activeSpaceRef.current===scope)setRemoteItems(xs=>[d.item,...xs]);setNotice('Saved to your private business workspace.');return true}
    catch(e:any){setRemoteError(e.message);return false}finally{setRemoteBusy(false)}
  };
  const updateRemoteItem=async(item:WorkRecord,status:string)=>{
    setRemoteBusy(true);setRemoteError('');
    try{const d=await workRequest('?resource=items&workspace='+encodeURIComponent(item.workspace_id)+'&id='+item.id,'PATCH',{revision:item.revision,status,title:item.title,details:item.details,amount:item.amount,specialist:item.specialist,due_at:item.due_at});if(activeSpaceRef.current===item.workspace_id)setRemoteItems(xs=>xs.map(x=>x.id===item.id?d.item:x))}
    catch(e:any){setRemoteError(e.message)}finally{setRemoteBusy(false)}
  };
  const [revenue,setRevenue]=useState(2000000);
  const [margin,setMargin]=useState(20);
  const [lift,setLift]=useState(3);
  const [hours,setHours]=useState(5);
  const [hourValue,setHourValue]=useState(100);
  const [focus,setFocus]=useState<'revenue'|'pricing'|'operations'>('revenue');
  const [company,setCompany]=useState('');
  const [objective,setObjective]=useState('');
  const [opportunity,setOpportunity]=useState('');
  const [amount,setAmount]=useState('');
  const [opportunities,setOpportunities]=useState<Array<{id:number;name:string;value:number;done:boolean}>>([]);
  const [questionIndex,setQuestionIndex]=useState(0);
  const [questionAnswer,setQuestionAnswer]=useState('');
  const [dimensionSaving,setDimensionSaving]=useState(false);
  const businessDepartments=[
    {name:'Strategy',dimensions:['Direction','Priorities','Positioning']},
    {name:'Marketing',dimensions:['Audience','Acquisition','Brand']},
    {name:'Revenue',dimensions:['Pipeline','Conversion','Retention']},
    {name:'Finance',dimensions:['Cash flow','Profitability','Forecasting']},
    {name:'Operations',dimensions:['Processes','Efficiency','Delivery']},
    {name:'People',dimensions:['Leadership','Talent','Accountability']},
    {name:'Customers',dimensions:['Experience','Satisfaction','Loyalty']},
    {name:'Technology',dimensions:['Systems','Automation','Data']},
    {name:'Innovation',dimensions:['Products','Opportunities','Differentiation']},
    {name:'Risk & Governance',dimensions:['Compliance','Resilience','Controls']}
  ];
  const [selectedDepartment,setSelectedDepartment]=useState(0);
  const [selectedDimension,setSelectedDimension]=useState(0);
  const dimensionPrompt=(department:number,dimension:number,stage:number)=>{
    const area=businessDepartments[department],focus=area.dimensions[dimension].toLowerCase();
    return [
      'How does '+focus+' currently work in your '+area.name.toLowerCase()+' department? Describe what is actually happening.',
      'What is the biggest challenge, constraint or risk in '+focus+'? What evidence makes you think so?',
      'What outcome would you like to achieve for '+focus+', by when, and how will you measure success?'
    ][stage];
  };
  const segmentPath=(inner:number,outer:number,start:number,end:number)=>{
    const point=(radius:number,deg:number)=>{const a=(deg-90)*Math.PI/180;return [260+radius*Math.cos(a),260+radius*Math.sin(a)]};
    const [x1,y1]=point(outer,start+1),[x2,y2]=point(outer,end-1),[x3,y3]=point(inner,end-1),[x4,y4]=point(inner,start+1);
    return 'M '+x1+' '+y1+' A '+outer+' '+outer+' 0 0 1 '+x2+' '+y2+' L '+x3+' '+y3+' A '+inner+' '+inner+' 0 0 0 '+x4+' '+y4+' Z';
  };

  const businessQuestions=[
    {area:'Strategy',question:'What does a successful next 12 months look like for this business?',why:'Establishes desired outcomes before optimizing activity.'},
    {area:'Customers',question:'Who are your highest-value customers, and what makes them choose you?',why:'Separates real buyer evidence from assumptions.'},
    {area:'Revenue',question:'Where does most of your revenue come from, and where are opportunities being lost?',why:'Identifies concentration, friction and measurable growth levers.'},
    {area:'Operations',question:'Which recurring activities consume the most time without adding proportional value?',why:'Reveals possible efficiency and delegation opportunities.'},
    {area:'Decisions',question:'What important decision have you been postponing, and what information is missing?',why:'Makes unresolved tradeoffs visible.'},
    {area:'People',question:'Who owns your most important outcomes, and where are responsibilities unclear?',why:'Clarifies accountability and dependencies.'},
    {area:'Constraints',question:'What limits your ability to grow right now: time, cash, skills, systems or something else?',why:'Keeps recommendations grounded in reality.'},
    {area:'Measurement',question:'Which three indicators would tell you the business is getting healthier?',why:'Connects attention to measurable progress.'},
    {area:'Risk',question:'What assumption about your business would be most damaging if it were wrong?',why:'Surfaces uncertainties without inventing threats.'},
    {area:'Leadership',question:'What should your business make possible for you and the people depending on it?',why:'Links business priorities to human agency without importing private My Life memories.'}
  ];
  const [note,setNote]=useState('');
  const [notes,setNotes]=useState<Array<{id:number;title:string;done:boolean}>>([]);
  const [decision,setDecision]=useState('');
  const [decisionOptions,setDecisionOptions]=useState('');
  const [decisionEvidence,setDecisionEvidence]=useState('');
  const [decisions,setDecisions]=useState<Array<{id:number;question:string;resolved:boolean}>>([]);
  const [workspace,setWorkspace]=useState<'overview'|'opportunities'|'decisions'|'company'|'team'|'goals'|'notes'|'map'|'today'|'mirror'|'projects'|'meetings'>('overview');
  const [notice,setNotice]=useState('');
  const [workTasks,setWorkTasks]=useState<Array<{id:number;title:string;specialist:string;done:boolean}>>([]);
  const [taskText,setTaskText]=useState('');
  const [specialist,setSpecialist]=useState('Marketing');
  const [showSample,setShowSample]=useState(false);
  const [exportBusy,setExportBusy]=useState(false);
  const [specialistBrief,setSpecialistBrief]=useState('');
  const [workMode,setWorkMode]=useState<'brief'|'team'>('brief');
  const liveMode=authenticated&&!!activeSpace&&remoteStatus==='ready';
  const dimensionRecords=remoteItems.filter(x=>x.kind==='dimension');
  const dimensionKey=(department:string,dimension:string,stage:number)=>department+' | '+dimension+' | '+stage;
  const dimensionAnswers={get:(key:string)=>dimensionRecords.find(x=>x.title===key),has:(key:string)=>dimensionRecords.some(x=>x.title===key)};
  const completedDimensions=businessDepartments.reduce((count,d)=>count+d.dimensions.filter(x=>[0,1,2].every(stage=>dimensionAnswers.has(dimensionKey(d.name,x,stage)))).length,0);
  const startedDimensions=businessDepartments.reduce((count,d)=>count+d.dimensions.filter(x=>[0,1,2].some(stage=>dimensionAnswers.has(dimensionKey(d.name,x,stage)))).length,0);
  const currentDimensionKey=dimensionKey(businessDepartments[selectedDepartment].name,businessDepartments[selectedDepartment].dimensions[selectedDimension],dimensionStage);
  const currentDimensionRecord=dimensionAnswers.get(currentDimensionKey);
  const priorSituation=dimensionAnswers.get(dimensionKey(businessDepartments[selectedDepartment].name,businessDepartments[selectedDepartment].dimensions[selectedDimension],0))?.details||'';
  const priorChallenge=dimensionAnswers.get(dimensionKey(businessDepartments[selectedDepartment].name,businessDepartments[selectedDepartment].dimensions[selectedDimension],1))?.details||'';
  const contextualPrompt=dimensionStage===1&&priorSituation
    ?'You described the current situation as: “'+priorSituation.slice(0,240)+'”. What is the main obstacle or risk, and what evidence supports it?'
    :dimensionStage===2&&(priorChallenge||priorSituation)
      ?'Given '+(priorChallenge?'the obstacle you identified — “'+priorChallenge.slice(0,200)+'”':'your current situation')+', what measurable outcome would improve this area, by when, and who would own it?'
      :dimensionPrompt(selectedDepartment,selectedDimension,dimensionStage);

  const changeDimension=(dept:number,dim:number,stage=0)=>{setSelectedDepartment(dept);setSelectedDimension(dim);setDimensionStage(stage);setQuestionAnswer('')};
  const saveDimension=async()=>{
    if(!liveMode||dimensionSaving||!questionAnswer.trim())return;
    const scope=activeSpace,key=currentDimensionKey,answer=questionAnswer.trim();
    setDimensionSaving(true);setRemoteError('');
    try{
      const existing=dimensionAnswers.get(key);
      const data=existing
        ?await workRequest('?resource=items&workspace='+encodeURIComponent(scope)+'&id='+existing.id,'PATCH',{revision:existing.revision,title:key,details:answer,status:'open',amount:0,specialist:''})
        :await workRequest('?resource=items&workspace='+encodeURIComponent(scope),'POST',{workspace_id:scope,kind:'dimension',title:key,details:answer});
      if(activeSpaceRef.current!==scope)return;
      setRemoteItems(xs=>existing?xs.map(x=>x.id===existing.id?data.item:x):[data.item,...xs]);
      setQuestionAnswer('');
      if(dimensionStage<2)setDimensionStage(v=>v+1);
      else if(selectedDimension<2)changeDimension(selectedDepartment,selectedDimension+1);
      else if(selectedDepartment<9)changeDimension(selectedDepartment+1,0);
      setNotice('Business Map answer saved to your private company workspace.');
    }catch(e:any){setRemoteError(e.message)}
    finally{setDimensionSaving(false)}
  };

  const locked=authenticated&&!liveMode;
  const overdue=liveMode?remoteItems.filter(x=>x.status==='open'&&x.due_at&&x.due_at<new Date().toISOString().slice(0,10)):[];
  const upcoming=liveMode?remoteItems.filter(x=>x.status==='open'&&x.due_at&&x.due_at>=new Date().toISOString().slice(0,10)).sort((a,b)=>(a.due_at||'').localeCompare(b.due_at||'')):[];
  const openOpportunities=liveMode?remoteItems.filter(x=>x.kind==='opportunity'&&x.status==='open').map(x=>({id:x.id,name:x.title,value:Number(x.amount),done:false})):opportunities.filter(x=>!x.done);
  const openDecisions=liveMode?remoteItems.filter(x=>x.kind==='decision'&&x.status==='open').map(x=>({id:x.id,question:x.title,resolved:false})):decisions.filter(x=>!x.resolved);
  const pendingTasks=liveMode?remoteItems.filter(x=>x.kind==='task'&&x.status==='open').map(x=>({id:x.id,title:x.title,specialist:x.specialist,done:false})):workTasks.filter(x=>!x.done);
  const openPipeline=openOpportunities.reduce((sum,x)=>sum+x.value,0);
  const executivePriorities=liveMode?[
    ...overdue.map(x=>({id:x.id,kind:x.kind,title:x.title,reason:'Past due '+x.due_at,source:'Saved '+x.kind+' · '+x.id,section:x.kind==='opportunity'?'opportunities':x.kind==='decision'?'decisions':'team'})),
    ...remoteItems.filter(x=>x.kind==='decision'&&x.status==='open'&&!x.due_at).map(x=>({id:x.id,kind:x.kind,title:x.title,reason:'Decision has no review date',source:'Decision register · '+x.id,section:'decisions'})),
    ...remoteItems.filter(x=>x.kind==='opportunity'&&x.status==='open'&&!x.due_at).map(x=>({id:x.id,kind:x.kind,title:x.title,reason:'Opportunity has no follow-up date',source:'Opportunity register · '+x.id,section:'opportunities'}))
  ].slice(0,12):[];
  const prepareSpecialistBrief=()=>{
    if(!liveMode||!recordsComplete||remoteLoadingItems){setRemoteError('Load all records for this business before preparing a specialist brief.');return}
    const relevant:Record<string,string[]>={Marketing:['dimension','goal','project','note'],Revenue:['opportunity','decision','goal','dimension'],Operations:['project','task','meeting','dimension'],Research:['decision','note','dimension'],Finance:['opportunity','goal','decision','dimension'], 'Chief of Staff':['project','task','decision','meeting','goal']};
    const dept:Record<string,string>={Marketing:'Marketing',Revenue:'Revenue',Operations:'Operations',Research:'Innovation',Finance:'Finance','Chief of Staff':'Strategy'};
    const selected=remoteItems.filter(x=>relevant[specialist]?.includes(x.kind)&&(
      x.kind!=='dimension'||x.title.startsWith(dept[specialist]+' | ')
    )).slice(0,18);
    const gaps=businessDepartments.find(x=>x.name===dept[specialist])?.dimensions.filter(dim=>![0,1,2].every(stage=>dimensionAnswers.has(dimensionKey(dept[specialist],dim,stage))))||[];
    const brief=[
      'SPECIALIST REVIEW DRAFT — NOT AN AI EXECUTION',
      'Company: '+(remoteSpaces.find(x=>x.id===activeSpace)?.name||'Selected company'),
      'Specialist: '+specialist,
      'Scope: read-only analysis; no external writes, sending, spending, or delegation.',
      'Business context: '+(remoteSpaces.find(x=>x.id===activeSpace)?.objective||'No objective saved'),
      'Evidence to review:',
      ...selected.map(x=>'- ['+x.kind+' / '+x.id+'] '+x.title+'; '+(x.details||'no details')+'; status='+x.status+'; due='+(x.due_at||'unset')),
      'Missing business context: '+(gaps.length?gaps.join(', '):'No missing dimension stages detected in this department'),
      'Requested deliverable: Identify 3 prioritized actions, distinguish verified facts from hypotheses, cite the record IDs above, list missing information, and flag every action requiring owner approval.'
    ].join('\n');
    setSpecialistBrief(brief);
  };
  const addTask=async()=>{if(!taskText.trim()||locked||remoteBusy)return;if(liveMode){const saved=await saveRemoteItem('task',taskText,0,specialist,taskDue||null);if(saved){setTaskText('');setTaskDue('')}return}setWorkTasks(items=>[...items,{id:Date.now(),title:taskText.trim(),specialist,done:false}]);setTaskText('');setWorkMode('team')};
  const exportWorkspace=async()=>{if(authenticated){
    if(!liveMode||remoteLoadingItems||exportBusy){setNotice('Wait for the selected business to finish loading before exporting.');return}
    const scope=activeSpace;setExportBusy(true);setRemoteError('');
    try{
      const all:WorkRecord[]=[];let offset=0,complete=false;
      for(let page=0;page<100;page++){
        const d=await workRequest('?resource=items&workspace='+encodeURIComponent(scope)+'&offset='+offset);
        if(activeSpaceRef.current!==scope)throw Error('Business changed during export. Please retry.');
        all.push(...(d.items||[]));if(!d.has_more){complete=true;break}
        if(!Number.isSafeInteger(d.next_offset)||d.next_offset<=offset)throw Error('Invalid pagination response');
        offset=d.next_offset;
      }
      if(!complete)throw Error('Export exceeded the safe record limit. No partial export was created.');
      const selected=remoteSpaces.find(x=>x.id===scope);
      if(!selected||all.some(x=>x.workspace_id!==scope))throw Error('Company scope validation failed');
      const payload={format:'myixo-work-owner-export',version:1,exportedAt:new Date().toISOString(),workspace:selected,items:all};
      const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
      const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='myixo-business-'+scope+'.json';a.click();URL.revokeObjectURL(url);
      setNotice('Export prepared for this business only. Store the downloaded file securely; it contains confidential information.');
    }catch(e:any){setRemoteError(e.message)}finally{setExportBusy(false)}
    return
  }
    const data={version:1,company,objective,opportunities,decisions,workTasks,exportedAt:new Date().toISOString()};
    const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='myixo-work-session.json';a.click();URL.revokeObjectURL(url);
  };
  const importWorkspace=async(file:File|undefined)=>{
    if(!file)return;
    if(authenticated){setNotice('Import is disabled for authenticated business records.');return}
    try{
      if(file.size>200000)throw Error('File is too large');
      const d=JSON.parse(await file.text());
      if(d.version!==1||typeof d.company!=='string'||typeof d.objective!=='string'||!Array.isArray(d.opportunities)||!Array.isArray(d.decisions)||!Array.isArray(d.workTasks))throw Error('Invalid workspace file');
      if(d.opportunities.length>200||d.decisions.length>200||d.workTasks.length>200)throw Error('Too many records');
      setCompany(d.company.slice(0,200));setObjective(d.objective.slice(0,2000));
      setOpportunities(d.opportunities.filter((x:any)=>typeof x.id==='number'&&typeof x.name==='string'&&typeof x.value==='number'&&Number.isFinite(x.value)&&typeof x.done==='boolean').map((x:any)=>({...x,name:x.name.slice(0,500)})));
      setDecisions(d.decisions.filter((x:any)=>typeof x.id==='number'&&typeof x.question==='string'&&typeof x.resolved==='boolean').map((x:any)=>({...x,question:x.question.slice(0,500)})));
      setWorkTasks(d.workTasks.filter((x:any)=>typeof x.id==='number'&&typeof x.title==='string'&&typeof x.specialist==='string'&&typeof x.done==='boolean').map((x:any)=>({...x,title:x.title.slice(0,500),specialist:x.specialist.slice(0,100)})));
      setNotice('Workspace imported for this session. It is not synced to the cloud.');
    }catch{setNotice('Import failed. Choose a valid MY iXo workspace export.')}
  };
  const loadSample=()=>{if(authenticated){setNotice('Switch to an unsigned-in demonstration session to load fictional data.');return}
    setCompany('Northstar Growth Group');setObjective('Increase profitable growth while reducing executive workload');
    setOpportunities([{id:101,name:'Enterprise proposal · Meridian',value:42000,done:false},{id:102,name:'Renewal · Oakridge',value:27500,done:false},{id:103,name:'Agency partnership · Atlas',value:12500,done:false}]);
    setDecisions([{id:201,question:'Should we introduce a premium service tier?',resolved:false},{id:202,question:'Which reporting workflows should we automate first?',resolved:false}]);
    setWorkTasks([{id:301,title:'Review funnel conversion drop-off',specialist:'AI CRO',done:false},{id:302,title:'Prepare executive growth priorities',specialist:'AI CMO',done:false},{id:303,title:'Assess weekly reporting duplication',specialist:'Operations',done:false}]);
    setShowSample(true);setWorkspace('overview');setNotice('Illustrative demo loaded. All records are fictional.');
  };
  const addOpportunity=async()=>{if(locked||remoteBusy)return;if(liveMode){const saved=await saveRemoteItem('opportunity',opportunity,Number(amount),'',opportunityDue||null);if(saved){setOpportunity('');setAmount('');setOpportunityDue('')}return}const n=Number(amount);if(!opportunity.trim()||!Number.isFinite(n)||n<0)return;setOpportunities(items=>[...items,{id:Date.now(),name:opportunity.trim(),value:n,done:false}]);setOpportunity('');setAmount('')};
  const addDecision=async()=>{if(!decision.trim()||locked||remoteBusy)return;if(liveMode){const saved=await saveRemoteItem('decision',decision,0,'',decisionDue||null,JSON.stringify({options:decisionOptions,evidence:decisionEvidence}));if(saved){setDecision('');setDecisionDue('');setDecisionOptions('');setDecisionEvidence('')}return}setDecisions(items=>[...items,{id:Date.now(),question:decision.trim(),resolved:false}]);setDecision('')};
  const currency=(n:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(n);
  const contribution=revenue*lift/100*margin/100;
  const timeValue=hours*hourValue*52;
  const topics={revenue:'Recover overdue revenue opportunities',pricing:'Evaluate a pricing decision',operations:'Investigate duplicated reporting work'};
  const selectedBusiness=remoteSpaces.find(x=>x.id===activeSpace);
  const hasBusiness=remoteSpaces.length>0;
  const showBusinessWelcome=!workStarted&&!hasBusiness;
  return <section className="workHome" aria-label="My Work">
    {showBusinessWelcome&&<div className="workWelcome"><div className="eyebrow">BUILD YOUR BUSINESS INTELLIGENCE</div><h1>BUILD YOUR <span>Business iXo</span></h1><p>Give your iXo the context to understand your business, remember what matters, and help you make better decisions.</p><div className="workWelcomePanel"><div className="eyebrow">YOUR BUSINESS, UNDERSTOOD</div><h2>Your business iXo becomes more useful as it learns how your company works.</h2><p>Start with a few thoughtful questions about your business, customers, priorities and goals. Build your Business Map one answer at a time.</p><button className="primary" onClick={()=>{setWorkStarted(true);setWorkspace(authenticated?'company':'map')}}>Build My Business iXo →</button><p className="workMuted">Your personal My Life memory stays separate. Sign in to save business answers securely across devices.</p></div></div>}
    {!showBusinessWelcome&&<><div className="eyebrow">MY WORK · EXECUTIVE INTELLIGENCE</div>
    <h1>Clarity for your business.</h1>
    <p className="workIntro">A dedicated space for decisions, growth and the work that matters. Business integrations and personalized recommendations are being developed separately from your private My Life context.</p>
    <div className="workNavigation" aria-label="My Work sections">{([['overview','Overview'],['company','My Business'],['opportunities','Opportunities'],['goals','Goals'],['projects','Projects'],['meetings','Meetings'],['decisions','Decisions'],['notes','Memory'],['map','Business Map'],['today','Today'],['mirror','Mirror'],['team','My AI Team']] as const).map(([id,label])=><button key={id} className={workspace===id?'active':''} onClick={()=>setWorkspace(id)}>{label}</button>)}</div>
    <div className="workSessionNote">WORKSPACE STATUS · {showSample?'FICTIONAL DEMONSTRATION DATA':liveMode?'PRIVATE BUSINESS STORAGE ENABLED':remoteStatus==='signed-out'?'SIGN IN REQUIRED FOR CLOUD STORAGE':'DEMO / LOCAL PLANNING'} · {liveMode?'Your selected business workspace is stored separately from personal My Life records.':'Use fictional data for demos. Sign in and create a workspace for persistent records.'}</div>
    {locked&&<div className="workSessionNote" role="status">Secure storage is not ready. Editing is disabled until your business workspace loads. No changes will be silently stored only in this browser.</div>}
    {remoteLoadingItems&&<p role="status">Loading this company's records…</p>}
    {!recordsComplete&&<div className="connectError" role="alert">Some records could not be loaded. Summary totals may be incomplete. Please retry before relying on these figures. Do not rely on these figures for financial decisions.</div>}
    {remoteError&&<div className="connectError" role="alert">{remoteError}<button onClick={()=>setRemoteError('')}>Dismiss</button></div>}
    {authenticated&&remoteSpaces.length>0&&<label className="workField">Active business<select value={activeSpace} onChange={e=>{setRemoteItems([]);setActiveSpace(e.target.value);setShowSample(false);setNotice('');setCompany('');setObjective('');setQuestionAnswer('')}}>{remoteSpaces.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>}
    <div className="workToolbar"><button disabled={authenticated} onClick={loadSample}>Load executive demo</button><button onClick={()=>void exportWorkspace()} disabled={exportBusy||remoteLoadingItems||(authenticated&&!liveMode)}>{exportBusy?'Preparing export…':authenticated?'Export this business':'Export demo session'}</button><label className="workImport">Import demo session<input disabled={authenticated} type="file" accept="application/json,.json" onChange={e=>{void importWorkspace(e.target.files?.[0]);e.target.value=''}}/></label></div>
    {workspace==='overview'&&liveMode&&<div className="workCard"><div className="eyebrow">CEO COMMAND CENTER · SOURCE-BACKED ATTENTION</div><h2>What needs your attention?</h2><p className="workMuted">Prioritized by overdue dates, then missing review dates. These are transparent rules from your saved company records, not generated AI judgments.</p>{executivePriorities.map(x=><div className="workSelection" key={x.id}><strong>{x.title}</strong><p>{x.reason}</p><small>{x.source}</small><button onClick={()=>setWorkspace(x.section as 'opportunities'|'decisions'|'team')}>Review →</button></div>)}{executivePriorities.length===0&&<p className="workMuted">No overdue or undated decision/opportunity records detected. This does not imply the business has no risks.</p>}</div>}
    <div className="workStats"><div><small>Open pipeline</small><strong>{currency(openPipeline)}</strong><span>{openOpportunities.length} opportunities</span></div><div><small>Decisions pending</small><strong>{openDecisions.length}</strong><span>Awaiting review</span></div><div><small>Team assignments</small><strong>{pendingTasks.length}</strong><span>Active planning tasks</span></div></div>
    {workspace==='company'&&<div className="workCard"><div className="eyebrow">MY BUSINESS · WORKSPACE PROFILE</div><h2>Start with what matters.</h2><p className="workMuted">Set the context for this planning session. This is not yet connected to a company knowledge graph.</p><label className="workField">Company or project name<input value={company} onChange={e=>setCompany(e.target.value)} placeholder="Your company"/></label><label className="workField">Primary business objective<textarea value={objective} onChange={e=>setObjective(e.target.value)} placeholder="What are you trying to improve?"/></label><div className="workSelection">{company||'Unnamed business'} · {objective||'Add an objective to focus your work.'}</div><button className="primary" disabled={remoteBusy||!company.trim()||!authenticated} onClick={()=>void saveSpace()}>Create private business workspace</button>{remoteSpaces.length>0&&<p className="workMuted">Saved businesses: {remoteSpaces.map(x=>x.name).join(' · ')}</p>}</div>}
    {workspace==='projects'&&<div className="workCard"><div className="eyebrow">PROJECTS · EXECUTION & ACCOUNTABILITY</div><h2>Connect work to outcomes.</h2><p className="workMuted">Track company-scoped initiatives and their intended results. These are MY iXo records, not yet synchronized with external project-management systems.</p><label className="workField">Project or initiative<input value={projectTitle} onChange={e=>setProjectTitle(e.target.value)} placeholder="Launch new customer onboarding"/></label><label className="workField">Expected outcome, owner and dependencies<textarea value={projectOutcome} onChange={e=>setProjectOutcome(e.target.value)} placeholder="What success looks like, who owns it, and what could block progress"/></label><label className="workField">Target date<input type="date" value={projectDue} onChange={e=>setProjectDue(e.target.value)}/></label><button className="primary" disabled={!liveMode||remoteBusy||!projectTitle.trim()} onClick={()=>{void (async()=>{if(await saveRemoteItem('project',projectTitle,0,'',projectDue||null,projectOutcome)){setProjectTitle('');setProjectOutcome('');setProjectDue('')}})()}}>Save project</button><div className="workItems">{remoteItems.filter(x=>x.kind==='project').map(x=><article className="workSelection" key={x.id}><strong>{x.title}</strong><p>{x.details||'No outcome documented yet'}</p><small>{x.due_at?'Target '+x.due_at+' · ':''}{x.status} · Source: saved project {x.id}</small><button disabled={remoteBusy} onClick={()=>void updateRemoteItem(x,x.status==='done'?'open':'done')}>{x.status==='done'?'Reopen':'Mark complete'}</button></article>)}</div></div>}
    {workspace==='meetings'&&<div className="workCard"><div className="eyebrow">MEETING INTELLIGENCE · DECISIONS & FOLLOW-THROUGH</div><h2>Make meetings actionable.</h2><p className="workMuted">Record agendas, decisions, commitments and next steps. No recording, transcription or automatic calendar access is implied.</p><label className="workField">Meeting title<input value={meetingTitle} onChange={e=>setMeetingTitle(e.target.value)} placeholder="Weekly leadership review"/></label><label className="workField">Agenda, decisions and action owners<textarea value={meetingNotes} onChange={e=>setMeetingNotes(e.target.value)} placeholder="Agenda, evidence reviewed, decisions made, who will do what and by when"/></label><label className="workField">Meeting date<input type="date" value={meetingDate} onChange={e=>setMeetingDate(e.target.value)}/></label><button className="primary" disabled={!liveMode||remoteBusy||!meetingTitle.trim()} onClick={()=>{void (async()=>{if(await saveRemoteItem('meeting',meetingTitle,0,'',meetingDate||null,meetingNotes)){setMeetingTitle('');setMeetingNotes('');setMeetingDate('')}})()}}>Save meeting record</button><div className="workItems">{remoteItems.filter(x=>x.kind==='meeting').map(x=><article className="workSelection" key={x.id}><strong>{x.title}</strong><p>{x.details||'No notes saved'}</p><small>{x.due_at||'Date not set'} · Source: meeting {x.id}</small></article>)}</div></div>}
    {workspace==='goals'&&<div className="workCard"><div className="eyebrow">OBJECTIVES & GOALS</div><h2>Define the result, not just the activity.</h2><p className="workMuted">Company-scoped goals are saved as durable records. Quantified progress requires a measurable target and source data; this register does not invent a completion percentage.</p><div className="workEntry"><input aria-label="Business goal" value={goal} onChange={e=>setGoal(e.target.value)} placeholder="e.g. Increase gross margin to 35% by Q2"/><button className="primary" disabled={locked||remoteBusy||!goal.trim()} onClick={()=>{if(liveMode){void saveRemoteItem('goal',goal)}else{setNotice('Create a private business workspace to save goals.')}setGoal('')}}>Save goal</button></div>{remoteItems.filter(x=>x.kind==='goal').map(x=><div className="workSelection" key={x.id}><strong>{x.title}</strong> · {x.status}<button disabled={remoteBusy} onClick={()=>void updateRemoteItem(x,x.status==='done'?'open':'done')}>{x.status==='done'?'Reopen':'Mark achieved'}</button></div>)}</div>}
    {workspace==='opportunities'&&<div className="workCard"><div className="eyebrow">REVENUE OPPORTUNITIES</div><h2>Keep valuable follow-ups visible.</h2><p className="workMuted">Create and close opportunities in the selected business workspace. Values are potential contract value, not booked revenue.</p><div className="workEntry"><input aria-label="Opportunity name" value={opportunity} onChange={e=>setOpportunity(e.target.value)} placeholder="Opportunity or follow-up"/><input aria-label="Follow-up date" type="date" value={opportunityDue} onChange={e=>setOpportunityDue(e.target.value)}/><input aria-label="Potential value" type="number" min="0" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="Potential $"/><button className="primary" disabled={locked||remoteBusy||!opportunity.trim()||!amount||Number(amount)<0} onClick={addOpportunity}>Add opportunity</button></div><div className="workMetric">{currency(openOpportunities.reduce((sum,x)=>sum+x.value,0))}<small>Open potential contract value · {openOpportunities.length} opportunities</small></div><div className="workItems">{(liveMode?remoteItems.filter(x=>x.kind==='opportunity').map(x=>({id:x.id,name:x.title,value:Number(x.amount),done:x.status!=='open',remote:x})):opportunities.map(x=>({...x,remote:null}))).map(item=><label key={item.id}><input type="checkbox" checked={item.done} disabled={remoteBusy||remoteLoadingItems} onChange={e=>item.remote?void updateRemoteItem(item.remote,e.target.checked?'done':'open'):setOpportunities(items=>items.map(x=>x.id===item.id?{...x,done:e.target.checked}:x))}/><span className={item.done?'completed':''}>{item.name}</span><strong>{currency(item.value)}</strong>{!item.remote&&<button aria-label={'Remove '+item.name} onClick={()=>setOpportunities(items=>items.filter(x=>x.id!==item.id))}>Remove</button>}</label>)}</div>{(liveMode?remoteItems.filter(x=>x.kind==='opportunity').length===0:opportunities.length===0)&&<p className="workMuted">No opportunities added yet.</p>}</div>}
    {workspace==='decisions'&&<div className="workCard"><div className="eyebrow">BUSINESS DECISION REGISTER</div><h2>Decisions worth following through.</h2><p className="workMuted">Capture decisions and mark them resolved. Native business-scoped AI reasoning is not yet connected.</p><label className="workField">Options and trade-offs<textarea value={decisionOptions} onChange={e=>setDecisionOptions(e.target.value)} placeholder="Option A vs. option B; costs, benefits and reversibility"/></label><label className="workField">Evidence and unknowns<textarea value={decisionEvidence} onChange={e=>setDecisionEvidence(e.target.value)} placeholder="What is known, what is assumed, and what needs validation?"/></label><div className="workEntry"><input aria-label="Decision review date" type="date" value={decisionDue} onChange={e=>setDecisionDue(e.target.value)}/><input aria-label="Business decision" value={decision} onChange={e=>setDecision(e.target.value)} placeholder="What do you need to decide?"/><button className="primary" disabled={locked||remoteBusy||!decision.trim()} onClick={addDecision}>Save decision</button></div><div className="workItems">{(liveMode?remoteItems.filter(x=>x.kind==='decision').map(x=>({id:x.id,question:x.title,resolved:x.status!=='open',remote:x})):decisions.map(x=>({...x,remote:null}))).map(item=><label key={item.id}><input type="checkbox" checked={item.resolved} onChange={e=>item.remote?void updateRemoteItem(item.remote,e.target.checked?'done':'open'):setDecisions(items=>items.map(x=>x.id===item.id?{...x,resolved:e.target.checked}:x))}/><span className={item.resolved?'completed':''}>{item.question}{item.remote?.details&&(()=>{try{const d=JSON.parse(item.remote.details);return <small style={{display:'block',whiteSpace:'pre-wrap',opacity:.8}}>{d.options?'Options: '+d.options+' · ':''}{d.evidence?'Evidence / unknowns: '+d.evidence:''}</small>}catch{return <small style={{display:'block'}}>{item.remote.details}</small>}})()}</span>{!item.remote&&<button aria-label={'Remove '+item.question} onClick={()=>setDecisions(items=>items.filter(x=>x.id!==item.id))}>Remove</button>}</label>)}</div>{(liveMode?remoteItems.filter(x=>x.kind==='decision').length===0:decisions.length===0)&&<p className="workMuted">No decisions added yet.</p>}</div>}
    {workspace==='map'&&<div className="workCard"><div className="eyebrow">BUILD YOUR BUSINESS iXo · INTELLIGENCE MAP</div><h2>How well does iXo understand your business?</h2><p className="workMuted">Ten business departments. Thirty areas of understanding. Select any department to build its knowledge one question at a time.</p><div className="businessMapLayout"><div className="businessWheel" aria-label={completedDimensions+' of 30 business dimensions completed'}><svg viewBox="0 0 520 520" role="img" aria-label="Business intelligence map with ten departments and thirty dimensions">{businessDepartments.flatMap((dept,di)=>dept.dimensions.map((dimension,dj)=>{const count=[0,1,2].filter(stage=>dimensionAnswers.has(dimensionKey(dept.name,dimension,stage))).length;const done=count===3;const a=di*36+dj*12;return <path key={dept.name+dimension} d={segmentPath(80+dj*45,119+dj*45,a,a+12)} fill={done?'#d8ad4b':count>0?'#8b713d':selectedDepartment===di?'#62502b':'#292722'} stroke="#1a1916" strokeWidth="1.5"/>}))}<circle cx="260" cy="260" r="76" fill="#171612" stroke="#5c4c2d" strokeWidth="2"/><text x="260" y="255" textAnchor="middle" fill="#dfb44e" fontSize="34">{completedDimensions}/30</text><text x="260" y="281" textAnchor="middle" fill="#b6ad9e" fontSize="12">DIMENSIONS</text></svg>{businessDepartments.map((d,i)=>{const angle=(i*36+18-90)*Math.PI/180;return <button key={d.name} type="button" className={'businessWheelLabel'+(selectedDepartment===i?' active':'')} style={{left:(50+44*Math.cos(angle))+'%',top:(50+44*Math.sin(angle))+'%'}} onClick={()=>changeDimension(i,0)}>{d.name}</button>})}</div><div className="businessDimensionPanel"><div className="eyebrow">{businessDepartments[selectedDepartment].name.toUpperCase()}</div><h3>Build this department's intelligence</h3><div className="businessDimensionButtons">{businessDepartments[selectedDepartment].dimensions.map((dimension,i)=><button key={dimension} className={selectedDimension===i?'active':''} onClick={()=>changeDimension(selectedDepartment,i)}>{[0,1,2].every(stage=>dimensionAnswers.has(dimensionKey(businessDepartments[selectedDepartment].name,dimension,stage)))?'✓ ':''}{dimension}</button>)}</div><p className="workMuted">{startedDimensions} dimensions started · {completedDimensions} fully covered. Coverage is not a business health score.</p><div className="businessDimensionButtons">{['Current situation','Challenges & evidence','Goals & measures'].map((name,i)=><button key={name} className={dimensionStage===i?'active':''} onClick={()=>{setDimensionStage(i);setQuestionAnswer('')}}>{dimensionAnswers.has(dimensionKey(businessDepartments[selectedDepartment].name,businessDepartments[selectedDepartment].dimensions[selectedDimension],i))?'✓ ':''}{name}</button>)}</div><p className="workMuted">{contextualPrompt}</p>{currentDimensionRecord&&<p className="workMuted">Previously saved: {currentDimensionRecord.details} · Last updated {new Date((currentDimensionRecord as any).updated_at||Date.now()).toLocaleDateString()}</p>}<label className="workField">Your answer<textarea value={questionAnswer} onChange={e=>setQuestionAnswer(e.target.value)} placeholder="Include examples or measurable evidence when available..."/></label><button className="primary" disabled={!liveMode||dimensionSaving||!questionAnswer.trim()||remoteLoadingItems} onClick={()=>void saveDimension()}>{dimensionSaving?'Saving…':currentDimensionRecord?'Update answer & continue →':'Save answer & continue →'}</button><p className="workMuted">Each answer is saved independently to the selected company, with a revision. Saving must succeed before advancing. Review and correct answers at any time.</p></div></div></div>}
    {workspace==='notes'&&<div className="workCard"><div className="eyebrow">BUSINESS MEMORY</div><h2>What should iXo remember about this business?</h2><p className="workMuted">Save important operating facts and context in your selected private workspace. Notes are user-provided facts, not independently verified.</p><div className="workEntry"><input aria-label="Business note" value={note} onChange={e=>setNote(e.target.value)} placeholder="Key fact, constraint, customer insight or policy"/><button className="primary" disabled={locked||!note.trim()||remoteBusy} onClick={()=>{if(liveMode){void (async()=>{if(await saveRemoteItem('note',note))setNote('')})()}else{setNotes(xs=>[...xs,{id:Date.now(),title:note,done:false}]);setNote('')}}}>Remember</button></div><div className="workItems">{(liveMode?remoteItems.filter(x=>x.kind==='note').map(x=>({id:x.id,title:x.title})):notes).map(x=><article key={x.id} className="workSelection">{x.title}</article>)}</div></div>}
    {workspace==='today'&&<div className="workCard"><div className="eyebrow">TODAY · BUSINESS MISSION CONTROL</div><h2>What deserves attention?</h2><p className="workMuted">Evidence-linked operational summary from this business workspace. Not an autonomous AI reasoning run.</p>{openOpportunities.length>0&&<div className="workSelection"><strong>{currency(openPipeline)} potential pipeline</strong><p>{openOpportunities.length} open opportunities. Source: opportunity records in this workspace.</p><button onClick={()=>setWorkspace('opportunities')}>Review opportunities</button></div>}{openDecisions.length>0&&<div className="workSelection"><strong>{openDecisions.length} unresolved decisions</strong><p>Next: {openDecisions[0].question}</p><button onClick={()=>setWorkspace('decisions')}>Review decisions</button></div>}{pendingTasks.length>0&&<div className="workSelection"><strong>{pendingTasks.length} open assignments</strong><p>Next: {pendingTasks[0].title}</p><button onClick={()=>setWorkspace('team')}>Review assignments</button></div>}{!openOpportunities.length&&!openDecisions.length&&!pendingTasks.length&&<p className="workMuted">No open records. Add opportunities, decisions and tasks to create a meaningful briefing.</p>}</div>}
    {workspace==='mirror'&&<div className="workCard"><div className="eyebrow">MIRROR · BUSINESS BLIND SPOTS</div><h2>What might be missing?</h2><p className="workMuted">Transparent rule-based checks against saved business records. These are questions, not verified conclusions about your company.</p>{!activeSpace&&<div className="workSelection">UNKNOWN · No durable business workspace selected. What company should these findings concern?</div>}{activeSpace&&!remoteItems.some(x=>x.kind==='goal')&&<div className="workSelection">MISSING INFORMATION · No structured goals recorded. What measurable business result matters most?</div>}{activeSpace&&remoteItems.some(x=>x.kind==='opportunity'&&x.status==='open'&&!x.due_at)&&<div className="workSelection">LOOSE END · Some open opportunities have no follow-up date. When should they be reviewed?</div>}{activeSpace&&remoteItems.some(x=>x.kind==='decision'&&x.status==='open'&&!x.due_at)&&<div className="workSelection">STALE ASSUMPTION RISK · Open decisions without review dates could be forgotten. When should they be revisited?</div>}{activeSpace&&remoteItems.length===0&&<div className="workSelection">INSUFFICIENT CONTEXT · Add business records before drawing conclusions.</div>}<button onClick={()=>setWorkspace('notes')}>Add business context →</button></div>}
    {workspace==='team'&&<div className="workCard"><div className="eyebrow">MY AI EXECUTIVE TEAM</div><h2>Your specialists, working together.</h2><p className="workMuted">Assign planning tasks to a specialist. These are saved assignments for human review, not autonomous AI executions.</p><div className="workSpecialists">{[['Marketing','Marketing strategy & growth'],['Revenue','Conversion & revenue'],['Operations','Process & efficiency'],['Research','Market intelligence'],['Chief of Staff','Executive coordination'],['Finance','Margin & profitability']].map(([name,desc])=><button key={name} className={specialist===name?'active':''} onClick={()=>setSpecialist(name)}><strong>{name}</strong><small>{desc}</small></button>)}</div><div className="workEntry"><input aria-label="Assignment due date" type="date" value={taskDue} onChange={e=>setTaskDue(e.target.value)}/><input aria-label="Team task" value={taskText} onChange={e=>setTaskText(e.target.value)} placeholder="Describe an assignment"/><button className="primary" disabled={locked||remoteBusy||!taskText.trim()} onClick={addTask}>Assign to {specialist}</button></div><div className="workItems">{(liveMode?remoteItems.filter(x=>x.kind==='task').map(x=>({id:x.id,title:x.title,specialist:x.specialist,done:x.status!=='open',remote:x})):workTasks.map(x=>({...x,remote:null}))).map(item=><label key={item.id}><input type="checkbox" checked={item.done} onChange={e=>item.remote?void updateRemoteItem(item.remote,e.target.checked?'done':'open'):setWorkTasks(items=>items.map(x=>x.id===item.id?{...x,done:e.target.checked}:x))}/><span className={item.done?'completed':''}><strong>{item.specialist}</strong> · {item.title}</span>{!item.remote&&<button aria-label={'Remove '+item.title} onClick={()=>setWorkTasks(items=>items.filter(x=>x.id!==item.id))}>Remove</button>}</label>)}</div><div className="workCard"><div className="eyebrow">SPECIALIST WORKSPACE · REVIEW FIRST</div><h3>Prepare an evidence-based specialist brief</h3><p className="workMuted">Build a read-only briefing from this company's saved records. It does not invoke an autonomous agent or grant access to connected business systems. External actions require separate explicit approval.</p><button disabled={!liveMode||!recordsComplete||remoteLoadingItems} onClick={prepareSpecialistBrief}>Prepare {specialist} brief</button>{specialistBrief&&<><textarea aria-label="Specialist evidence brief" readOnly value={specialistBrief} rows={12}/><button onClick={()=>navigator.clipboard.writeText(specialistBrief).then(()=>setNotice('Brief copied for review.')).catch(()=>setRemoteError('Copy unavailable; select the text manually.'))}>Copy brief</button></>}</div>{(liveMode?remoteItems.filter(x=>x.kind==='task').length===0:!workTasks.length)&&<p className="workMuted">Select a specialist and create your first assignment.</p>}</div>}
    {liveMode&&<div className="workCard"><div className="eyebrow">DUE DATES · LIVE WORKSPACE</div><h2>Follow-ups and deadlines</h2><div className="workMetric">{overdue.length}<small>Overdue open records</small></div>{overdue.map(x=><div className="workSelection" key={x.id}>{x.due_at} · {x.title}</div>)}<h3>Upcoming</h3>{upcoming.slice(0,8).map(x=><div className="workSelection" key={x.id}>{x.due_at} · {x.title}</div>)}{!overdue.length&&!upcoming.length&&<p className="workMuted">No dated open records yet.</p>}</div>}
    <div className="workCard workBrief">
      <div className="eyebrow">EXECUTIVE BRIEF · {showSample?'FICTIONAL DEMO':'YOUR BUSINESS RECORDS'}</div>
      <h2>Good morning. Here's what matters.</h2>
      <p className="workMuted">{selectedBusiness?selectedBusiness.name+' · ':company?company+' · ':''}{selectedBusiness?.objective||objective||'Your priorities and next decisions in one place.'} This briefing is calculated from the selected workspace's recorded information, not from connected CRM or accounting systems.</p>
      <div className="workInsights">
        <article><strong>Revenue opportunity</strong><p>{openOpportunities.length?openOpportunities.length+' open opportunities represent '+currency(openPipeline)+' in potential contract value.':'No open opportunities recorded yet. Add your first prospect or deal.'}</p><small>{showSample?'Fictional demo opportunities':'Saved opportunity register'}</small><button onClick={()=>setWorkspace('opportunities')}>Review pipeline →</button></article>
        <article><strong>Decision waiting</strong><p>{openDecisions.length?openDecisions.length+' decisions are awaiting resolution. Next: '+openDecisions[0].question:'No open business decisions recorded. Capture a strategic question to revisit.'}</p><small>{showSample?'Fictional demo decision register':'Saved decision register'}</small><button onClick={()=>setWorkspace('decisions')}>Review decisions →</button></article>
        <article><strong>Executive team priorities</strong><p>{pendingTasks.length?pendingTasks.length+' assignments are active. Next: '+pendingTasks[0].title:'No team assignments yet. Choose a specialist and create a planning task.'}</p><small>{showSample?'Fictional demo assignments':'Saved assignment register'}</small><button onClick={()=>setWorkspace('team')}>Review AI team →</button></article>
      </div>
      <fieldset className="workFocus"><legend>What would you like to investigate first?</legend>
        {(Object.keys(topics) as Array<keyof typeof topics>).map(k=><label key={k}><input type="radio" name="work-focus" checked={focus===k} onChange={()=>setFocus(k)}/>{topics[k]}</label>)}
      </fieldset>
      <div className="workSelection">Selected: {topics[focus]}. The examples above are not connected to your company.</div><button className="workAction" onClick={()=>{if(focus==='revenue'){setWorkspace('opportunities');setOpportunity('Follow up with qualified prospects')}else if(focus==='pricing'){setWorkspace('decisions');setDecision('Should we adjust our pricing?')}else{setWorkspace('decisions');setDecision('How can we reduce duplicated reporting?')}setNotice('')}}>Create a planning item for this topic →</button>
    </div>
    <div className="workCard workCalculator">
      <div className="eyebrow">BUSINESS IMPROVEMENT CALCULATOR</div>
      <h2>What could better decisions be worth?</h2>
      <p className="workMuted">Illustrative economics only — not a forecast, guaranteed return, or measured MY iXo result.</p>
      {([
        ['Annual revenue',revenue,setRevenue,250000,10000000,250000,currency(revenue)],
        ['Incremental revenue contribution margin',margin,setMargin,5,60,5,margin+'%'],
        ['Hypothetical revenue increase',lift,setLift,0,10,1,lift+'%'],
        ['Executive hours recovered per week',hours,setHours,0,15,1,hours+' hours'],
        ['Value of an executive hour',hourValue,setHourValue,25,300,25,currency(hourValue)]
      ] as Array<[string,number,(n:number)=>void,number,number,number,string]>).map(([label,value,update,min,max,step,display])=><label className="workSlider" key={label}><span>{label}<strong>{display}</strong></span><input type="range" min={min} max={max} step={step} value={value} onChange={e=>update(Number(e.target.value))}/></label>)}
      <div className="workResults"><div><span>Additional contribution / year</span><strong>{currency(contribution)}</strong></div><div><span>Recovered time value / year</span><strong>{currency(timeValue)}</strong></div></div>
      <div className="workTotal"><span>Combined illustrative opportunity</span><strong>{currency(contribution+timeValue)}</strong></div>
      <p className="workMuted">Before implementation costs. Time value assumes productive redeployment; do not double-count when time savings drive the revenue gain.</p>
    </div>
    <div className="workCard"><div className="eyebrow">WORKSPACE TOOLS</div><h2>Your business intelligence workspace</h2><div className="workModules">{['My Business','Decisions','Opportunities','Marketing / Revenue','My AI Team','Business Memory'].map(x=><span key={x}>{x}</span>)}</div><p className="workMuted">Company-specific records, approvals and team access will remain isolated from personal memory and from other businesses.</p></div>
    {notice&&<p role="status">{notice}</p>}
  </>}
  </section>;
}

export default function App(){
  const [model,setModel]=useState<PersonalMapModel>(demoPersonalMap);
  const [mapReady,setMapReady]=useState(false);
  const [stage,setStage]=useState<Stage>('hero');
  const [world,setWorld]=useState<'life'|'work'>('life');
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
  const [learningPlan,setLearningPlan]=useState<LearningPlan|null>(null);
  const [lastLearning,setLastLearning]=useState<LearningDelta|null>(null);
  const [adaptiveQuestion,setAdaptiveQuestion]=useState('');
  const [adaptiveBusy,setAdaptiveBusy]=useState(false);
  const adaptiveStarted=useRef(false);
  const [learningSession,setLearningSession]=useState<{questions:number;meaningful:number;areas:CategoryId[];newAreas:number;stopped:boolean}>({questions:0,meaningful:0,areas:[],newAreas:0,stopped:false});
  const [rewardAreas,setRewardAreas]=useState<CategoryId[]>([]);
  const [coverageShift,setCoverageShift]=useState<{before:number;after:number}|null>(null);
  const [verifyOpen,setVerifyOpen]=useState(false);
  const [contactEmail,setContactEmail]=useState('');
  const [verifyStep,setVerifyStep]=useState<'email'|'code'>('email');
  const [verifyCode,setVerifyCode]=useState('');
  const [verifyBusy,setVerifyBusy]=useState(false);
  const [verifyError,setVerifyError]=useState('');
  const eventSource=useRef<EventSource|null>(null);

  const expireSession=()=>{
    eventSource.current?.close();
    setUser(null);setSession(null);setMemory(null);setNativeContext(null);setLearningPlan(null);setAdaptiveQuestion('');setAdaptiveBusy(false);adaptiveStarted.current=false;
    setLastLearning(null);setRewardAreas([]);setCoverageShift(null);setMapReady(false);setModel(demoPersonalMap());setInitState('AUTH_REQUIRED');setStage('connect');
    setConnectError('Your iXo session expired. Reconnect to continue learning.');
  };
  const isDisconnected=(e:any)=>/not connected|session expired|unauthor/i.test(String(e?.message||''));

  const progress=mapProgress(model);
  const depth=knowledgeDepth(model,memory);
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
    if(!r.ok){const e:any=new Error(data.error||'Could not load Personal Map');e.code=data.code||null;throw e}
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

  const startBriefing=async(topic?:string)=>{
    const r=await fetch('/api/ixo/briefing',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({topic:topic||'Build my Personal Map with the highest-value missing personal context.'})});
    const data=await r.json().catch(()=>({}));
    if(!r.ok){const e:any=new Error(data.error||'Could not start iXo briefing');e.code=data.code||null;throw e}
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

  const ensureBriefing=async(topic?:string)=>{
    setBriefingLoading(true);
    try{
      let current=await getBriefing();
      if(!current||current.state==='completed'||current.state==='paused')current=await startBriefing(topic);
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
        const restoredMap=await fetchMap();
        setInitState('READY');
        void loadMemoryData().then(async mem=>{
          const plan=buildLearningPlan(restoredMap,mem);
          setLearningPlan(plan);
          if(plan.next&&!adaptiveStarted.current){
            adaptiveStarted.current=true;setAdaptiveBusy(true);
            try{setAdaptiveQuestion(await generateAdaptiveQuestion(plan.topic))}
            catch(e:any){setConnectError(e.message||'iXo could not generate the next question')}
            finally{setAdaptiveBusy(false)}
          }
        }).catch(()=>{});
      }catch(e:any){
        setMapReady(false);
        setInitState('PARTIAL');
        if(e?.code==='verified_email_required'){setVerifyError('');setVerifyOpen(true)}
        return;
      }
      // Personal Map readiness must not wait on briefing availability.
      void getBriefing().then(current=>{if(current)setSession(current)}).catch(()=>{});
    }catch{
      setMapReady(false);
      setInitState(user?'ERROR':'AUTH_REQUIRED');
    }
  };

  const contactEmailValid=/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail.trim());
  const sendVerification=async()=>{
    if(!contactEmailValid){setVerifyError('Enter a valid contact email.');return}
    setVerifyBusy(true);setVerifyError('');
    try{const r=await fetch('/api/ixo/session',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'request_verified_email',email:contactEmail})});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'Could not send verification code');setVerifyStep('code')}
    catch(e:any){setVerifyError(e.message||'Could not send verification code')}finally{setVerifyBusy(false)}
  };
  const verificationCodeValid=/^[0-9]{6}$/.test(verifyCode.trim());
  const confirmVerification=async()=>{
    const code=verifyCode.trim();
    if(!/^[0-9]{6}$/.test(code)){setVerifyError('Enter the 6-digit verification code');return}
    setVerifyBusy(true);setVerifyError('');
    try{const r=await fetch('/api/ixo/session',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'confirm_verified_email',code})});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'Could not confirm contact email');if(!d.confirmed)throw new Error('Could not confirm contact email');setContactEmail('');setVerifyCode('');setVerifyStep('email');setVerifyOpen(false);try{await fetchMap();setInitState('READY')}catch(e:any){setMapReady(false);setInitState('PARTIAL');if(e?.code==='verified_email_required'){setVerifyError('Contact email was confirmed, but Personal Map still requires verified-email access.');setVerifyOpen(true)}}}
    catch(e:any){setVerifyError(e.message||'Could not confirm contact email')}finally{setVerifyBusy(false)}
  };

  const retryPersonalMap=async()=>{
    if(!user){setInitState('AUTH_REQUIRED');return}
    setInitState('LOADING');
    try{await fetchMap();setInitState('READY')}
    catch(e:any){setMapReady(false);setInitState('PARTIAL');if(e?.code==='verified_email_required'){setVerifyError('');setVerifyOpen(true)}}
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
      try{await fetchMap();setInitState('READY')}catch(e:any){setMapReady(false);setInitState('PARTIAL');if(e?.code==='verified_email_required'){setVerifyError('');setVerifyOpen(true)}return}
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
      if(!r.ok){const e:any=new Error(d.error||'Could not load iXo memory');e.status=r.status;throw e}
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
    setConnectError('');setAdaptiveBusy(true);
    try{
      const mem=await loadMemoryData();
      const plan=buildLearningPlan(model,mem,learningSession.areas);
      setLearningPlan(plan);
      if(!plan.next){setAdaptiveQuestion('');return}
      setAdaptiveQuestion(await generateAdaptiveQuestion(plan.topic));
      setAnswer('');setSelected([]);
    }catch(e:any){
      if(isDisconnected(e))expireSession();
      else setConnectError(e.message||'iXo could not prepare the next question');
    }finally{setAdaptiveBusy(false)}
  };

  const sendAdaptive=async()=>{
    const submitted=answer.trim();
    if(!submitted||adaptiveBusy)return;
    const before=model,memoryBefore=memory;
    setConnectError('');setAdaptiveBusy(true);
    try{
      await submitAdaptiveAnswer(submitted);
      const priorRevision=Number(memoryBefore?.profile_revision||0),started=Date.now();
      while(Date.now()-started<30000){
        await sleep(900);
        const sr=await fetch('/api/ixo/profile-status?ts='+Date.now(),{cache:'no-store'});
        const sd=await sr.json().catch(()=>({}));
        if(sr.ok&&Number(sd.profile_revision||0)>priorRevision&&!['pending','building','indexing','processing','queued','running'].includes(String(sd.index_status||'').toLowerCase()))break;
      }
      setMemory(null);setNativeContext(null);
      const after=await fetchMap();
      const refreshed=await loadMemoryData();
      const delta=learningDelta(memoryBefore,refreshed,submitted);
      const newAreas=changedAreas(before,after);
      const learned=delta.items.length>0||newAreas.length>0;
      const targetArea=learningPlan?.next?.area;
      const reward=Array.from(new Set<CategoryId>([...newAreas,...(learned&&targetArea?[targetArea]:[])]));
      setCoverageShift(before.mode==='areas'&&after.mode==='areas'&&before.covered.length!==after.covered.length?{before:before.covered.length,after:after.covered.length}:null);
      setLastLearning(delta);setChanged(newAreas);setRewardAreas(reward);
      const sessionAreas=[...learningSession.areas,...(learned&&targetArea?[targetArea]:[])];
      const plan=buildLearningPlan(after,refreshed,sessionAreas);setLearningPlan(plan);
      const nextQuestions=learningSession.questions+(learned?1:0);
      const nextMeaningful=learningSession.meaningful+(learned?1:0);
      const shouldStop=learned&&(nextMeaningful>=3||nextQuestions>=4||!plan.next);
      setLearningSession({
        questions:nextQuestions,
        meaningful:nextMeaningful,
        areas:Array.from(new Set<CategoryId>([...learningSession.areas,...reward])),
        newAreas:learningSession.newAreas+newAreas.length,
        stopped:shouldStop
      });
      setAnswer('');setAdaptiveQuestion('');
      if(!learned){
        setLastLearning(null);setRewardAreas([]);setConnectError('');
        const clarification='The user answered: '+JSON.stringify(submitted)+'. No new or revised durable memory became visible after processing. Ask one short, concrete clarification that would make the missing '+(learningPlan?.next?labels[learningPlan.next.area]+' / '+learningPlan.next.construct:'personal context')+' useful and durable. Stay on the same topic. Do not repeat the previous question, do not switch to work unless the topic itself is work, and ask only one question.';
        try{setAdaptiveQuestion(await generateAdaptiveQuestion(clarification))}catch(e:any){if(isDisconnected(e))expireSession();else setConnectError(e.message||'iXo needs a little more context before it can learn from that answer.')}
      } else if(!shouldStop&&plan.next)try{setAdaptiveQuestion(await generateAdaptiveQuestion(plan.topic))}catch(e:any){if(isDisconnected(e))expireSession();else setConnectError(e.message||'iXo could not generate the next question')}
    }catch(e:any){if(isDisconnected(e))expireSession();else setConnectError(e.message||'iXo could not learn from that answer')}
    finally{setAdaptiveBusy(false)}
  };

  const continueLearning=async()=>{
    if(!learningPlan?.next||adaptiveBusy)return;
    setLearningSession({questions:0,meaningful:0,areas:[],newAreas:0,stopped:false});
    setRewardAreas([]);setCoverageShift(null);setConnectError('');setAdaptiveBusy(true);
    try{setAdaptiveQuestion(await generateAdaptiveQuestion(learningPlan.topic))}
    catch(e:any){if(isDisconnected(e))expireSession();else setConnectError(e.message||'iXo could not generate the next question')}
    finally{setAdaptiveBusy(false)}
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
    const memoryBefore=memory;
    setPreviousLabel(mapProgress(before).label);
    setConnectError('');setPhase('thinking');setProcessStep(0);
    try{
      const inputMethod=skipped?'skip':custom?'text':'choice';
      const submittedAnswer=skipped?null:(custom||question.options.filter(o=>selected.includes(o.id)).map(o=>o.label).join('; ')||null);
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
      setNativeContext(null);
      const refreshed=await loadMemoryData().catch(()=>null);
      if(refreshed){setMemory(refreshed);setLearningPlan(buildLearningPlan(after,refreshed));setLastLearning(learningDelta(memoryBefore,refreshed,submittedAnswer))}
      else setMemory(null);
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
  const currentPlaceholder=user?'Tell iXo in your own words...':questions[demoQi]?.placeholder;
  const chips=user?(question?.options||[]):questions[demoQi].chips.map((label,i)=>({id:String(i),label}));
  const activeView:ProductView=stage==='memory'?'memory':stage==='today'?'today':stage==='mirror'?'mirror':stage==='decide'?'decide':stage==='ask'?'ask':stage==='timeline'?'timeline':'me';

  return <main><div className="veil"/><header><div className="logo"><span className="my">MY</span><span className="ixo">iXo</span></div><div className="demo">{user?'iXo CONNECTED':'EXECUTIVE DEMO'}</div></header><div className="wrap">
    <nav className="worldTabs" aria-label="Choose your MY iXo workspace"><button className={world==='life'?'active':''} aria-current={world==='life'?'page':undefined} onClick={()=>setWorld('life')}>My Life</button><button className={world==='work'?'active':''} aria-current={world==='work'?'page':undefined} onClick={()=>setWorld('work')}>My Work</button></nav>
    {world==='work'&&<MyWorkHome authenticated={!!user}/>}
    {world==='life'&&<>
    {user&&stage!=='connect'&&<ProductNav active={activeView} onNavigate={openView}/>}
    {memoryLoading&&<div className="contextLoading">Loading your iXo context...</div>}
    {stage==='hero'&&initState==='LOADING'&&<section className="hero loadingHero"><div><div className="eyebrow">PERSONAL INTELLIGENCE, MADE VISIBLE</div><h1>BUILD YOUR <em>iXo</em></h1><p className="lead">Syncing your real iXo context before showing your Personal Map.</p><div className="syncPill"><span/>Checking session {String.fromCodePoint(0x00B7)} loading native Personal Map</div></div><div className="mapLoading"><div className="mapLoadingCore">MY<br/><b>iXo</b></div><p>SYNCING PERSONAL MAP</p></div></section>}
    {stage==='hero'&&(initState==='PARTIAL'||initState==='ERROR')&&user&&<section className="hero"><div><div className="eyebrow">CONNECTED {String.fromCodePoint(0x00B7)} PERSONAL MAP UNAVAILABLE</div><h1>BUILD YOUR <em>iXo</em></h1><p className="lead">Connected to iXo, but the Personal Map couldn't be loaded.</p><div className="actions"><button className="primary" onClick={retryPersonalMap}>Retry Personal Map</button><button onClick={()=>setStage('connect')}>Connection</button></div><p className="note">Your native Personal Map is unavailable right now. Durable Memory is separate and is not being used as a replacement.</p></div></section>}
    {stage==='hero'&&(initState==='READY'||initState==='AUTH_REQUIRED')&&(!user||mapReady)&&<section className="meExperience"><div className="meIntro"><div><div className="eyebrow">PERSONAL INTELLIGENCE, MADE VISIBLE</div><h1>BUILD YOUR <em>iXo</em></h1><p className="lead">{user?'iXo learns who you are — so you don’t have to know what to ask.':'Connect your iXo to turn what it knows about you into an intelligent personal operating system.'}</p></div>{user&&<div className="mapSummary"><strong>{depth.overall}%</strong><span>MY iXo KNOWLEDGE DEPTH</span></div>}</div>{user?<>{connectError&&!connectError.includes('briefing')&&<div className="learningHomeError">{connectError}</div>}<div className="learningHome"><div className="nextLearning"><div className="eyebrow">iXo KNOWS WHAT IT SHOULD LEARN NEXT</div>{learningPlan?.next?<><div className="learningArea">{labels[learningPlan.next.area]} · {learningPlan.next.construct}</div><h2>One useful thing to understand next.</h2><p>{learningPlan.next.reason} The goal is to {learningPlan.next.questionIntent}.</p><div className="learningImpact"><span>WHY IT MATTERS</span><p>This can improve {labels[learningPlan.next.area]}{learningPlan.next.crossDomain.length?' + '+learningPlan.next.crossDomain.map(x=>labels[x]).join(' + '):''} context for later reasoning.</p></div>{lastLearning&&<div className="homeLearningReceipt"><span>{lastLearning.items.length?'iXo LEARNED SOMETHING NEW':'ANSWER PROCESSED'}</span><p>{lastLearning.items.length?lastLearning.items.map(x=>x.value).slice(0,2).join(' · '):'No new durable memory is visible from that answer yet.'}</p></div>}{learningSession.stopped?<div className="learningSessionDone"><span>THAT’S ENOUGH FOR NOW</span><h3>iXo understands you better than it did a few minutes ago.</h3><div className="sessionStats"><div><strong>{learningSession.meaningful}</strong><small>learning moments</small></div><div><strong>{learningSession.areas.length}</strong><small>areas strengthened</small></div><div><strong>{learningSession.newAreas}</strong><small>new areas discovered</small></div></div><p>Short sessions keep the questions useful instead of turning this into an interview.</p>{learningPlan?.next&&<button className="primary" disabled={adaptiveBusy} onClick={()=>void continueLearning()}>{adaptiveBusy?'Preparing...':'Continue learning '+String.fromCodePoint(0x2192)}</button>}</div>:question?<div className="homeQuestion"><span>NEXT QUESTION</span><h3>{question.text}</h3>{question.reason&&<p>{question.reason}</p>}<div className="chips">{question.options.map(o=><button key={o.id} onClick={()=>toggleOption(o.id)} className={selected.includes(o.id)?'selected':''}>{o.label}</button>)}</div>{question.allow_custom!==false&&<textarea value={answer} onChange={e=>setAnswer(e.target.value)} placeholder="Tell iXo in your own words..."/>}<div className="homeQuestionActions"><button className="primary" disabled={!answer.trim()&&!selected.length} onClick={()=>{setStage('demo');void sendNative(false)}}>Send to iXo {String.fromCodePoint(0x2192)}</button>{question.allow_skip&&<button onClick={()=>{setStage('demo');void sendNative(true)}}>Skip</button>}</div></div>:adaptiveQuestion?<div className="homeQuestion"><span>NEXT QUESTION · GENERATED BY iXo</span><h3>{adaptiveQuestion}</h3><textarea value={answer} onChange={e=>setAnswer(e.target.value)} placeholder="Tell iXo in your own words..."/><div className="homeQuestionActions"><button className="primary" disabled={!answer.trim()||adaptiveBusy} onClick={()=>void sendAdaptive()}>{adaptiveBusy?'iXo is learning...':'Send to iXo '+String.fromCodePoint(0x2192)}</button></div></div>:<div className="adaptivePreparing">{adaptiveBusy?'iXo is preparing your next question…':<button className="primary" onClick={()=>void begin()}>Prepare my next question {String.fromCodePoint(0x2192)}</button>}</div>}</>:<div className="learningContinueState"><h2>Finding the next useful thing to learn.</h2><p>iXo is comparing your Personal Map with durable Memory. It will ask only when there is a worthwhile gap.</p><button className="primary" disabled={briefingLoading} onClick={begin}>{briefingLoading?'Preparing the next question...':'Continue learning '+String.fromCodePoint(0x2192)}</button></div>}</div><div className="mapHome"><Map model={model} highlight={rewardAreas} depth={depth}/>{model.nativeAreas&&model.nativeAreas.length>0&&<details className="nativeAreas"><summary>Native iXo areas · {model.nativeAreas.length} reported</summary><p>These are the categories returned by native iXo. The circular MY iXo learning map retains its original ten broader themes until their correspondence is verified.</p><div className="nativeAreaGrid">{model.nativeAreas.map(a=><div key={a.id}><b>{a.label}</b><span>{a.factCount===null?(a.covered?'Context present':'No confirmed count'):a.factCount+' saved facts'}</span></div>)}</div></details>}<div className="mapHomeCopy">{rewardAreas.length>0?<><b className="mapReward">iXo UNDERSTANDS YOU BETTER</b><p>{lastLearning?.items.length?rewardAreas.map(x=>labels[x]).join(' + ')+' was strengthened by newly visible durable learning.':'Your answer was processed; the current native map is shown as iXo reports it.'}</p>{coverageShift&&<p className="coverageNote">Native map coverage recalculated {coverageShift.before}/10 → {coverageShift.after}/10. This is a current-context classification, not knowledge being erased.</p>}</>:<><b>MY iXo KNOWLEDGE DEPTH</b><p>Knowledge depth is MY iXo’s evidence-based view of how much durable, usable context it has across the 10 Personal Map areas. It is not a score of your life.</p></>}</div></div></div></>:<div className="learningHome connectLearningHome"><div className="nextLearning connectLearningCard"><div className="eyebrow">BUILD YOUR PERSONAL INTELLIGENCE</div><h2>Your iXo becomes more useful as it learns what matters about you.</h2><p>Connect your Personal Map and durable Memory. MY iXo will find the most useful thing to understand next — one question at a time.</p><button className="primary" onClick={begin}>Connect My iXo {String.fromCodePoint(0x2192)}</button></div><div className="mapHome"><Map model={model}/></div></div>}{user&&<div className="meUtilities"><button disabled={memoryLoading} onClick={openMemory}>{memoryLoading?'Loading...':'What iXo Knows'}</button></div>}</section>}

    {stage==='demo'&&<section className="flow"><div className="panel">{phase==='thinking'?<div className="center"><div className="eyebrow">LIVE iXo STATUS</div><div className="statusSteps">{liveStatuses.map((s,i)=><div key={s} className={i<processStep?'complete':i===processStep?'current':''}><span>{i<processStep?String.fromCodePoint(0x2713):i+1}</span><b>{s}</b></div>)}</div><div className="scan"/></div>:phase==='reveal'?<div className="center"><div className="eyebrow">PERSONAL MAP UPDATED</div><h2>{changed.length?('iXo added context to '+changed.length+' '+(changed.length===1?'area':'areas')):'Your answer added useful context to iXo'}</h2><div className="jump">{previousLabel} {String.fromCodePoint(0x2192)} {mapProgress(model).label}</div>{lastLearning&&<div className="learningReceipt"><div className="eyebrow">WHAT I LEARNED</div>{lastLearning.answer&&<div className="learningEvidence stated"><span>YOU SAID</span><p>{lastLearning.answer}</p></div>}{lastLearning.items.length?lastLearning.items.map(x=><div className={'learningEvidence '+x.kind} key={x.id}><span>{x.label.toUpperCase()} · {x.category.replace(/[_-]+/g,' ')}</span><p>{x.value}</p></div>):<p className="helper">Your answer was accepted, but iXo has not exposed a new or revised durable memory from it yet.</p>}<div className="learningMeta">Profile revision {lastLearning.profileRevision} · index {lastLearning.indexStatus}</div></div>}{changed.length>0?<div className="learned">{changed.map(c=><div key={c}><b>{labels[c]}</b> {String.fromCodePoint(0x00B7)} new saved context</div>)}</div>:<p className="helper">The answer was saved, but it did not create a newly covered Personal Map area. iXo can still use the context.</p>}<button className="primary" onClick={()=>setPhase('ask')}>Continue &rarr;</button></div>:<><div className="eyebrow">{questionLabel} {String.fromCodePoint(0x00B7)} {progress.label} {model.mode==='areas'?'AREAS':'DIMENSIONS'} UNDERSTOOD</div>{currentPrompt?<>{user&&learningPlan?.next&&<div className="learningTarget"><span>WHY THIS QUESTION</span><b>{labels[learningPlan.next.area]} · {learningPlan.next.construct}</b><p>{learningPlan.next.reason} The goal is to {learningPlan.next.questionIntent}.</p></div>}<h2>{currentPrompt}</h2><p className="helper">{currentHelper}</p><div className="chips">{chips.map(c=><button key={c.id} onClick={()=>user?toggleOption(c.id):setAnswer(c.label)} className={(user?selected.includes(c.id):answer===c.label)?'selected':''}>{c.label}</button>)}</div>{(!user||question?.allow_custom!==false)&&<textarea value={answer} onChange={e=>setAnswer(e.target.value)} placeholder={currentPlaceholder}/>} {connectError&&<div className="connectError">{connectError}</div>}<div className="actions"><button className="primary" onClick={()=>user?sendNative(false):sendDemo()}>Send to iXo &rarr;</button>{user&&question?.allow_skip&&<button onClick={()=>sendNative(true)}>Skip</button>}{!user&&<button onClick={()=>{setDemoQi(Math.min(demoQi+1,questions.length-1));setAnswer('')}}>Skip</button>}</div></>:<div className="center"><div className="thinking">{session?.generation?.state==='generating'?'iXo is preparing your next question...':'No question is available yet.'}</div></div>}</>}</div><Map model={model} highlight={changed}/></section>}

    {stage==='memory'&&memory&&<MemoryInspector memory={memory} setMemory={m=>{setMemory(m);setNativeContext(null)}} onClose={()=>setStage('hero')}/>}
    {stage==='today'&&memory&&<TodayView memory={memory as any} question={question?{id:question.id,text:question.text,reason:question.reason}:null} onMirror={()=>openView('mirror')} onDecide={()=>openView('decide')} onVerificationRequired={()=>{setVerifyError('');setVerifyOpen(true)}}/>}
    {stage==='mirror'&&memory&&<MirrorView memory={memory as any} nativeContext={nativeContext} onMemory={()=>openView('memory')} onDecide={()=>openView('decide')}/>}
    {stage==='decide'&&<DecisionLab/>}
    {stage==='ask'&&<AskIxoView/>}
    {stage==='timeline'&&memory&&<TimelineView memory={memory as any}/>}

    {stage==='done'&&<section className="finish"><Map model={model} highlight={changed}/><div className="eyebrow">{user?'iXo BRIEFING COMPLETE':'PERSONAL MAP UPDATED'}</div><h2>{user?'Your iXo has a clearer picture of you.':'Your iXo knows more than it did 10 minutes ago.'}</h2><p>{user?(session?.completion_summary||'Your Personal Map will keep evolving as iXo learns from future conversations and connected context.'):'One continuously evolving understanding of you.'}</p><button className="primary" onClick={()=>setStage('hero')}>Return to My iXo &rarr;</button>{!user&&<button onClick={resetDemo}>Reset demo</button>}</section>}

    {stage==='connect'&&<section className="panel connect"><div className="eyebrow">CONNECT MY iXo</div>{user?<><h2>Connected to your iXo</h2><p className="connectedAs">{user.full_name||user.email}</p><p>Your credentials are not stored in this browser. The connection uses secure, HttpOnly session cookies and automatically refreshes your iXo session when needed.</p><div className="actions"><button className="primary" onClick={()=>setStage('hero')}>Use My Personal Map &rarr;</button><button onClick={disconnect}>Disconnect</button></div></>:<><h2>Sign in to your iXo</h2><p>Use the same email and password you use for iXo. Your password is sent server-to-server to iXo for authentication and is not stored by this site.</p><div className="loginForm"><label>iXo email<input type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="username"/></label><label>iXo password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password"/></label>{connectError&&<div className="connectError">{connectError}</div>}<button className="primary" disabled={connecting||!email||!password} onClick={connect}>{connecting?'Connecting...':'Connect My iXo '+String.fromCodePoint(0x2192)}</button></div><p className="securityNote">We never ask for API keys, browser cookies, or bearer tokens.</p><button onClick={()=>setStage('hero')}>&larr; Back</button></>}</section>}

    {(['hero','demo','done'].includes(stage))&&<section className="how"><div className="eyebrow">THE INTELLIGENCE LOOP</div><h2>One conversation. A clearer picture.</h2><div className="steps">{[['01','Adaptive questioning','iXo chooses the next high-information question from your current context.'],['02','Context & memory',"Your answer is saved into iXo's revisioned personal context."],['03','Personal Map update','The app waits for iXo to finish indexing before refreshing the map.'],['04','Living Personal Map','The map evolves as you do. It is never a life score.']].map(x=><div key={x[0]}><span>{x[0]}</span><h3>{x[1]}</h3><p>{x[2]}</p></div>)}</div></section>}
    {verifyOpen&&<div className="verifyOverlay"><section className="panel verifyPanel"><div className="eyebrow">CONTACT VERIFICATION</div><h2>Confirm your contact email</h2><p>This email is used only to satisfy iXo's contact verification requirement. It does not change your iXo login.</p>{verifyStep==='email'?<form className="verifyForm" onSubmit={e=>{e.preventDefault();if(!verifyBusy&&contactEmailValid)void sendVerification()}}><label>Contact email<input type="email" placeholder="name@example.com" value={contactEmail} onChange={e=>{setContactEmail(e.target.value);if(verifyError)setVerifyError('')}} autoComplete="email"/></label></form>:<label className="verifyField">Enter the 6-digit code<input type="text" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={verifyCode} onChange={e=>{const next=e.target.value.trim();if(/^[0-9]*$/.test(next)&&next.length<=6){setVerifyCode(next);if(verifyError)setVerifyError('')}}} onKeyDown={e=>{if(e.key==='Enter'&&!verifyBusy&&verificationCodeValid){e.preventDefault();void confirmVerification()}}} autoComplete="one-time-code"/></label>}{verifyError&&<div className="connectError">{verifyError}</div>}<div className="actions">{verifyStep==='email'?<button className="primary" disabled={verifyBusy||!contactEmailValid} onClick={sendVerification}>{verifyBusy?'Sending...':'Send verification code'}</button>:<button className="primary" disabled={verifyBusy||!verificationCodeValid} onClick={confirmVerification}>{verifyBusy?'Confirming...':'Confirm code'}</button>}<button disabled={verifyBusy} onClick={()=>{setVerifyOpen(false);setVerifyError('');setVerifyCode('')}}>Not now</button></div></section></div>}
    </>}
    <footer>{user?'MY iXo · Personal Intelligence Operating System':'MY iXo · Executive prototype · Synthetic demo data only'}</footer>
  </div></main>
}
