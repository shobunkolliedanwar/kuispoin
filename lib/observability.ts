import { randomUUID } from 'node:crypto';
import { supabaseAdmin } from './supabase-admin';
import { sanitizeMetadata, type LogLevel } from './observability-core';
export { sanitizeMetadata } from './observability-core';
type Meta = Record<string, unknown>;
export function requestId(req?: Request) { const incoming=req?.headers.get('x-request-id')?.trim(); return incoming&&/^[a-zA-Z0-9._:-]{8,128}$/.test(incoming)?incoming:randomUUID(); }
export async function logEvent(input:{event:string;level?:LogLevel;requestId?:string;route?:string;userId?:string;entityType?:string;entityId?:string;statusCode?:number;durationMs?:number;metadata?:Meta}){
 const row={request_id:input.requestId??null,level:input.level??'INFO',event:input.event,route:input.route??null,user_id:input.userId??null,entity_type:input.entityType??null,entity_id:input.entityId??null,status_code:input.statusCode??null,duration_ms:input.durationMs==null?null:Math.max(0,Math.round(input.durationMs)),metadata:sanitizeMetadata(input.metadata??{})};
 const printable=JSON.stringify({ts:new Date().toISOString(),...row}); if(row.level==='ERROR')console.error(printable);else if(row.level==='WARN')console.warn(printable);else console.info(printable);
 try{await supabaseAdmin.from('operational_events').insert(row)}catch{/* observability must never break product flow */}
}
