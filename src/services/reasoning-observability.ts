export type FailureCode='run_failed'|'result_missing'|'result_representation_invalid'|'result_schema_invalid'|'render_failed';
export type FailureTelemetry={mode:string;source:string;code:FailureCode;run_id:string;terminal_status:string|null;result_present:boolean|null;result_type:string|null;duration_ms:number|null};
const codes=new Set<FailureCode>(['run_failed','result_missing','result_representation_invalid','result_schema_invalid','render_failed']);
export function failureCode(err:any):FailureCode{return codes.has(err?.code)?err.code:'render_failed'}
export function buildFailureTelemetry(job:{run_id:string},mode:string,source:string,err:any,meta:{terminal_status?:string;result_present?:boolean;result_type?:string;duration_ms?:number}={}):FailureTelemetry{
 return {mode,source,code:failureCode(err),run_id:job.run_id,terminal_status:meta.terminal_status||null,result_present:typeof meta.result_present==='boolean'?meta.result_present:null,result_type:meta.result_type||null,duration_ms:Number.isFinite(meta.duration_ms)?Number(meta.duration_ms):null};
}
