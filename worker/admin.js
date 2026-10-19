/**
 * BrainBox Control Plane - independent ClassCircle deployment.
 * All privileges are re-checked against the session and the server-side role table.
 * SUPERADMIN_EMAILS is a private Worker secret/var; there is no public bootstrap endpoint.
 */
const now = () => new Date().toISOString();
const uuid = () => crypto.randomUUID();
const json=(obj,status=200)=>new Response(JSON.stringify(obj),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const fail=(message,status=400)=>json({error:message},status);
const one=async(e,q,...args)=>e.DB.prepare(q).bind(...args).first();
const many=async(e,q,...args)=>(await e.DB.prepare(q).bind(...args).all()).results||[];
const run=async(e,q,...args)=>e.DB.prepare(q).bind(...args).run();
const parse=async req=>{const raw=await req.text();if(raw.length>10000)throw Object.assign(new Error('Request too large'),{status:413});try{return JSON.parse(raw)}catch{throw Object.assign(new Error('Invalid JSON'),{status:400})}};
const roles=['student','support','moderator','admin','superadmin'];
const permissions={student:[],support:['dashboard','users_read','audit_read'],moderator:['dashboard','users_read','reports','posts','audit_read'],admin:['dashboard','users_read','reports','posts','audit_read','suspend','settings','jobs'],superadmin:['dashboard','users_read','reports','posts','audit_read','suspend','settings','jobs','roles']};
function fromAllowlist(email,env){return String(env.SUPERADMIN_EMAILS||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean).includes(String(email||'').toLowerCase())}
export async function roleOf(e,user){if(!user)return 'student';if(fromAllowlist(user.email,e))return 'superadmin';const record=await one(e,'SELECT role FROM admin_roles WHERE user_id=?',user.id);return roles.includes(record?.role)?record.role:'student'}
export async function isSuspended(e,userId){if(!userId)return false;const r=await one(e,'SELECT suspended_until FROM admin_restrictions WHERE user_id=?',userId);return Boolean(r && (r.suspended_until===null||Date.parse(r.suspended_until)>Date.now()))}
export async function setting(e,key,otherwise='false'){const s=await one(e,'SELECT value FROM admin_settings WHERE key=?',key);return s?.value??otherwise}
const has=(role,p)=>permissions[role]?.includes(p);
async function audit(e,actor,verb,target='',detail={}){await run(e,'INSERT INTO admin_audit(id,actor_id,action,target_id,detail,created_at) VALUES(?,?,?,?,?,?)',uuid(),actor,verb,target,JSON.stringify(detail),now())}
export async function handleAdmin(req,e,user){
 const url=new URL(req.url),path=url.pathname;
 if(!path.startsWith('/api/admin/'))return null;
 if(!user)return fail('Authentication required',401);
 const role=await roleOf(e,user);
 if(role==='student')return fail('Administrator access required',403);
 const method=req.method;
 if(method==='GET'&&path==='/api/admin/me')return json({role,permissions:permissions[role]});
 if(method==='GET'&&path==='/api/admin/dashboard'){
  if(!has(role,'dashboard'))return fail('Forbidden',403);
  const stats=await one(e,`SELECT (SELECT COUNT(*) FROM users) AS users,(SELECT COUNT(*) FROM social_posts) AS posts,(SELECT COUNT(*) FROM social_reports WHERE status='pending') AS pending_reports,(SELECT COUNT(*) FROM admin_restrictions WHERE suspended_until IS NULL OR suspended_until>?) AS suspended,(SELECT COUNT(*) FROM ai_usage WHERE created_at>?) AS ai_calls_24h`,now(),new Date(Date.now()-86400000).toISOString());
  const reports=has(role,'reports')?await many(e,`SELECT r.id,r.post_id,r.comment_id,r.reporter_id,r.reason,r.created_at,r.status FROM social_reports r WHERE r.status='pending' ORDER BY r.created_at DESC LIMIT 35`):[];
  const flags=has(role,'settings')?await many(e,'SELECT key,value,updated_at FROM admin_settings ORDER BY key'):[];
  const jobs=has(role,'jobs')?await many(e,'SELECT id,name,period,status,summary,started_at FROM admin_job_runs ORDER BY started_at DESC LIMIT 15'):[];
  return json({role,permissions:permissions[role],stats,reports,flags,jobs});
 }
 if(method==='GET'&&path==='/api/admin/users'){
  if(!has(role,'users_read'))return fail('Forbidden',403);
  const query=String(url.searchParams.get('q')||'').trim().slice(0,70).replace(/[%_\\]/g,'').toLowerCase();
  if(query.length<2)return json({users:[]});
  const users=await many(e,`SELECT u.id,u.name,u.email,u.created_at,COALESCE(ar.role,'student') AS stored_role,r.suspended_until,r.reason AS suspension_reason FROM users u LEFT JOIN admin_roles ar ON ar.user_id=u.id LEFT JOIN admin_restrictions r ON r.user_id=u.id WHERE LOWER(u.email) LIKE ? OR LOWER(u.name) LIKE ? ORDER BY u.created_at DESC LIMIT 35`,'%'+query+'%','%'+query+'%');
  return json({users:users.map(x=>({...x,role:fromAllowlist(x.email,e)?'superadmin':x.stored_role}))});
 }
 if(method==='GET'&&path==='/api/admin/audit'){
  if(!has(role,'audit_read'))return fail('Forbidden',403);
  const logs=await many(e,'SELECT a.id,a.action,a.target_id,a.detail,a.created_at,u.name AS actor FROM admin_audit a LEFT JOIN users u ON u.id=a.actor_id ORDER BY a.created_at DESC LIMIT 80');
  return json({logs});
 }
 const suspend=path.match(/^\/api\/admin\/users\/([a-f0-9-]{36})\/(suspend|restore|role)$/);
 if(method==='POST'&&suspend){
  const targetId=suspend[1],action=suspend[2];
  const target=await one(e,'SELECT id,email FROM users WHERE id=?',targetId);
  if(!target)return fail('Account not found',404);
  if(target.id===user.id || fromAllowlist(target.email,e))return fail('Cannot modify your own account or a protected owner',403);
  const targetRole=await roleOf(e,target);
  if(roles.indexOf(targetRole)>=roles.indexOf(role))return fail('Only a higher-trust administrator may change this account',403);
  if(action==='role'){
   if(!has(role,'roles'))return fail('Only a super admin can assign roles',403);
   const body=await parse(req),next=body.role,reason=String(body.reason||'').trim();
   if(reason.length<8||reason.length>400)return fail('Explain the staff permission change (8–400 characters)',400);
   if(!roles.includes(next)||next==='superadmin')return fail('Only owner allowlist can grant superadmin',400);
   await run(e,'INSERT INTO admin_roles(user_id,role,granted_by,created_at) VALUES(?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET role=excluded.role,granted_by=excluded.granted_by,created_at=excluded.created_at',targetId,next,user.id,now());
   await run(e,'DELETE FROM sessions WHERE user_id=?',targetId);
   await audit(e,user.id,'user.role',targetId,{role:next,reason});return json({ok:true,role:next});
  }
  if(!has(role,'suspend'))return fail('Admin role required',403);
  if(action==='suspend'){
    const body=await parse(req),reason=String(body.reason||'').trim();
    if(reason.length<8||reason.length>350)return fail('Supply a reason (8–350 characters)',400);
    const hours=Number(body.hours);if(!Number.isInteger(hours)||hours<1||hours>24*90)return fail('Duration must be 1–2160 hours',400);
    const until=new Date(Date.now()+hours*3600000).toISOString();
    await run(e,'INSERT INTO admin_restrictions(user_id,suspended_until,reason,updated_by,created_at) VALUES(?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET suspended_until=excluded.suspended_until,reason=excluded.reason,updated_by=excluded.updated_by,created_at=excluded.created_at',targetId,until,reason,user.id,now());
    await run(e,'DELETE FROM sessions WHERE user_id=?',targetId);
    await audit(e,user.id,'user.suspended',targetId,{hours,reason});return json({ok:true,until});
  }
  const body=await parse(req),reason=String(body.reason||'').trim();
  if(reason.length<8||reason.length>400)return fail('Explain why the account is restored (8–400 characters)',400);
  await run(e,'DELETE FROM admin_restrictions WHERE user_id=?',targetId);
  await audit(e,user.id,'user.restored',targetId,{reason});return json({ok:true});
 }
 const reviews=path.match(/^\/api\/admin\/reports\/([a-f0-9-]{36})\/review$/);
 if(method==='POST'&&reviews){
  if(!has(role,'reports'))return fail('Only moderators can review reports',403);
  const body=await parse(req),reason=String(body.reason||'').trim();
  if(reason.length<8||reason.length>400)return fail('Record a review reason (8–400 characters)',400);
  const record=await one(e,'SELECT id,post_id,status FROM social_reports WHERE id=?',reviews[1]);
  if(!record)return fail('Report not found',404);
  if(record.status!=='pending')return fail('This report has already been reviewed',409);
  await run(e,'UPDATE social_reports SET status=? WHERE id=?','reviewed',reviews[1]);
  await audit(e,user.id,'report.reviewed',reviews[1],{reason,post_id:record.post_id});
  return json({ok:true});
 }
 const posts=path.match(/^\/api\/admin\/posts\/([a-f0-9-]{36})\/(hide|restore)$/);
 if(method==='POST'&&posts){
  if(!has(role,'posts'))return fail('Content review role required',403);
  const found=await one(e,'SELECT id FROM social_posts WHERE id=?',posts[1]);if(!found)return fail('Post not found',404);
  if(posts[2]==='hide'){
    const body=await parse(req),reason=String(body.reason||'').trim();if(reason.length<6||reason.length>350)return fail('Explain why the post must be hidden',400);
    await run(e,'INSERT INTO admin_hidden_posts(post_id,reason,hidden_by,hidden_at) VALUES(?,?,?,?) ON CONFLICT(post_id) DO UPDATE SET reason=excluded.reason,hidden_by=excluded.hidden_by,hidden_at=excluded.hidden_at',posts[1],reason,user.id,now());
    await audit(e,user.id,'post.hidden',posts[1],{reason});
  }else{const body=await parse(req),reason=String(body.reason||'').trim();if(reason.length<8||reason.length>400)return fail('Explain why this post is restored',400);await run(e,'DELETE FROM admin_hidden_posts WHERE post_id=?',posts[1]);await audit(e,user.id,'post.restored',posts[1],{reason})}
  return json({ok:true});
 }
 if(method==='POST'&&path==='/api/admin/settings'){
  if(!has(role,'settings'))return fail('Admin role required',403);
  const body=await parse(req),key=body.key,value=body.value,reason=String(body.reason||'').trim();
  if(reason.length<8||reason.length>400)return fail('Explain the platform-wide change (8–400 characters)',400);
  const allowed=['maintenance_mode','registration_enabled','ai_enabled','social_posting_enabled','automation_cleanup','automation_triage'];
  if(!allowed.includes(key)||typeof value!=='boolean')return fail('Unknown setting or value',400);
  await run(e,'INSERT INTO admin_settings(key,value,updated_at,updated_by) VALUES(?,?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at,updated_by=excluded.updated_by',key,String(value),now(),user.id);
  await audit(e,user.id,'setting.changed',key,{value,reason});return json({ok:true,key,value});
 }
 if(method==='POST'&&path==='/api/admin/jobs/run'){
  if(!has(role,'jobs'))return fail('Admin role required',403);
  const body=await parse(req),reason=String(body.reason||'').trim();
  if(reason.length<8||reason.length>400)return fail('Describe the reason for this manual run',400);
  const result=await runHousekeeping(e,{actor:user.id,manual:true});await audit(e,user.id,'automation.run','housekeeping',{...result,reason});return json({ok:true,result});
 }
 return fail('Unknown admin route',404);
}
/** Cron-safe, idempotent scheduled maintenance. Destructive content decisions remain human-reviewed. */
export async function runHousekeeping(e,{actor=null,manual=false}={}){
 const period=new Date().toISOString().slice(0,10),name=manual?'manual-maintenance':'daily-maintenance';
 if(!manual&&await setting(e,'automation_cleanup','true')==='false')return {skipped:'cleanup disabled'};
 const runId=uuid(),started=now();
 if(!manual){
  const insert=await run(e,'INSERT OR IGNORE INTO admin_job_runs(id,name,period,status,summary,started_at) VALUES(?,?,?,?,?,?)',runId,name,period,'running','',started);
  if(insert?.meta?.changes===0)return {skipped:'already executed today'};
 }else await run(e,'INSERT INTO admin_job_runs(id,name,period,status,summary,started_at) VALUES(?,?,?,?,?,?)',runId,name,period+':'+runId,'running','',started);
 const stats={sessions:0,oauth_states:0,ai_usage:0,expired_restrictions:0,flagged_reports:0};
 try{
  for(const [key,sql,params] of [
   ['sessions','DELETE FROM sessions WHERE expires_at<?',[now()]],
   ['oauth_states','DELETE FROM oauth_states WHERE expires_at<?',[now()]],
   ['ai_usage','DELETE FROM ai_usage WHERE created_at<?',[new Date(Date.now()-45*86400000).toISOString()]],
   ['expired_restrictions','DELETE FROM admin_restrictions WHERE suspended_until IS NOT NULL AND suspended_until<?',[now()]]
  ]){const res=await run(e,sql,...params);stats[key]=res.meta?.changes||0}
  if(await setting(e,'automation_triage','true')!=='false'){
   const posts=await many(e,"SELECT post_id,COUNT(*) AS n FROM social_reports WHERE status='pending' AND post_id IS NOT NULL GROUP BY post_id HAVING COUNT(*)>=3 LIMIT 50");
   for(const post of posts){await run(e,'INSERT OR IGNORE INTO admin_review_queue(id,post_id,reason,created_at) VALUES(?,?,?,?)',uuid(),post.post_id,'Multiple community reports. Human review required.',now());}
   stats.flagged_reports=posts.length;
  }
  await run(e,'UPDATE admin_job_runs SET status=?,summary=? WHERE id=?','completed',JSON.stringify(stats),runId);
  return stats;
 }catch(err){await run(e,'UPDATE admin_job_runs SET status=?,summary=? WHERE id=?','failed',String(err?.message||err).slice(0,400),runId);throw err}
}
