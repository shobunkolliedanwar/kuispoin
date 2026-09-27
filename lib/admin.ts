import { getServerSession } from 'next-auth';
import { authOptions } from './auth';
import { supabaseAdmin } from './supabase-admin';
export async function requireAdmin(){
  const session=await getServerSession(authOptions);
  if(!session?.user?.id || session.user.role!=='ADMIN') return null;
  const {data:user}=await supabaseAdmin.from('users').select('id,role,status').eq('id',session.user.id).single();
  if(!user || user.role!=='ADMIN' || user.status!=='ACTIVE') return null;
  return session;
}
export async function audit(adminId:string,action:string,entityType:string,entityId?:string,detail?:unknown){
  await supabaseAdmin.from('admin_audit_logs').insert({admin_id:adminId,action,entity_type:entityType,entity_id:entityId??null,detail:detail??null});
}
