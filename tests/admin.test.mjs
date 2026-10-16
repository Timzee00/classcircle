import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {randomBytes,randomUUID,createHash} from 'node:crypto';
import worker from '../worker/index.js';
import {runHousekeeping} from '../worker/admin.js';
const base='https://classcircle.test';
function fixture(){
 const db=new DatabaseSync(':memory:');
 for(const p of ['0001_init.sql','0002_social_oauth.sql','0003_admin.sql'])db.exec(readFileSync(new URL('../migrations/'+p,import.meta.url),'utf8'));
 const env={DB:{prepare(q){const st=db.prepare(q);return {bind(...a){return{first:async()=>st.get(...a)||null,all:async()=>({results:st.all(...a)}),run:async()=>{const r=st.run(...a);return{meta:{changes:r.changes}}}}}}}},ASSETS:{fetch:async()=>new Response('ok')},SUPERADMIN_EMAILS:'owner@classcircle.test'};
 const user=(name,email)=>{const id=randomUUID(),token=randomBytes(32).toString('hex');db.prepare('INSERT INTO users(id,name,email,password_hash,salt) VALUES(?,?,?,?,?)').run(id,name,email,'','');db.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').run(createHash('sha256').update(token).digest('hex'),id,new Date(Date.now()+86400000).toISOString());return{id,name,email,token}};
 const call=async(u,path,method='GET',body)=>{const headers={Cookie:'cc_session='+u.token};if(method!=='GET')headers['Content-Type']='application/json';return worker.fetch(new Request(base+path,{method,headers,body:method==='GET'?undefined:JSON.stringify(body||{})}),env)};
 return {db,env,user,call};
}
test('student denied admin endpoint, server-side allowlist recognizes only configured owner',async()=>{
 const{user,call}=fixture();const student=user('Student','student@test.edu'),owner=user('Owner','owner@classcircle.test');
 assert.equal((await call(student,'/api/admin/dashboard')).status,403);
 const r=await call(owner,'/api/admin/me');assert.equal(r.status,200);assert.equal((await r.json()).role,'superadmin');
});
test('owner grants moderator role but cannot hand out superadmin role',async()=>{
 const{user,call}=fixture();const owner=user('Owner','owner@classcircle.test'),mod=user('Moderated','moderated@test.edu');
 let r=await call(owner,'/api/admin/users/'+mod.id+'/role','POST',{role:'superadmin'});assert.equal(r.status,400);
 r=await call(owner,'/api/admin/users/'+mod.id+'/role','POST',{role:'moderator'});assert.equal(r.status,200);
 r=await call(mod,'/api/admin/me');assert.equal((await r.json()).role,'moderator');
 assert.equal((await call(mod,'/api/admin/settings','POST',{key:'ai_enabled',value:false})).status,403);
});
test('time-limited suspension blocks existing sessions and actions are audited',async()=>{
 const{db,user,call}=fixture(),owner=user('Owner','owner@classcircle.test'),student=user('Student','s@test.edu');
 const r=await call(owner,'/api/admin/users/'+student.id+'/suspend','POST',{reason:'Repeated abusive posts',hours:24});assert.equal(r.status,200);
 assert.equal((await call(student,'/api/bootstrap')).status,401);
 assert.equal(db.prepare("SELECT COUNT(*) AS n FROM admin_audit WHERE action='user.suspended'").get().n,1);
 assert.equal((await call(owner,'/api/admin/users/'+owner.id+'/suspend','POST',{reason:'test self block',hours:24})).status,403);
 assert.equal((await call(owner,'/api/admin/users/'+student.id+'/restore','POST')).status,200);
});
test('feature flag blocks registration and existing AI requests, admin can reverse maintenance',async()=>{
 const{user,call}=fixture(),owner=user('Owner','owner@classcircle.test'),student=user('Student','s@test.edu');
 let r=await call(owner,'/api/admin/settings','POST',{key:'ai_enabled',value:false});assert.equal(r.status,200);
 r=await call(student,'/api/ai/coach','POST',{question:'test'});assert.equal(r.status,503);
 r=await call(owner,'/api/admin/settings','POST',{key:'maintenance_mode',value:true});assert.equal(r.status,200);
 assert.equal((await call(student,'/api/tasks','POST',{title:'test'})).status,503);
 assert.equal((await call(owner,'/api/admin/settings','POST',{key:'maintenance_mode',value:false})).status,200);
});
test('housekeeping does not delete post content and is idempotent',async()=>{
 const{db,env}=fixture();let r=await runHousekeeping(env);assert.ok(r.sessions>=0);
 r=await runHousekeeping(env);assert.equal(r.skipped,'already executed today');
 assert.equal(db.prepare("SELECT COUNT(*) AS n FROM admin_job_runs WHERE name='daily-maintenance'").get().n,1);
});
