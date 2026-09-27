import { supabaseAdmin } from './supabase-admin';
export async function allowAction(key:string, limit:number, windowSeconds:number){
  const {data,error}=await supabaseAdmin.rpc('consume_rate_limit',{p_key:key,p_limit:limit,p_window_seconds:windowSeconds});
  if(error){console.error('rate_limit',error.message);return false}
  return data===true;
}
