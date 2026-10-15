import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {randomBytes,createHash,randomUUID} from 'node:crypto';
import worker from '../worker/index.js';

const base='https://classcircle.example';
function fixture(){
 const db=new DatabaseSync(':memory:');
 db.exec(readFileSync(new URL('../migrations/0001_init.sql',import.meta.url),'utf8'));
 db.exec(readFileSync(new URL('../migrations/0002_social_oauth.sql',import.meta.url),'utf8'));
 const bin=new Map();
 const wrap=statement=>({
  bind(...args){return wrapParams(statement,args)},
  first(){return statement.get()||null},all(){return {results:statement.all()}},run(){return statement.run()}
 });
 const wrapParams=(stmt,args)=>({first:()=>stmt.get(...args)||null,all:()=>({results:stmt.all(...args)}),run:()=>stmt.run(...args),_stmt:stmt,_args:args});
 const D1={prepare(sql){const stmt=db.prepare(sql);return wrap(stmt)},async batch(statements){db.exec('BEGIN');try{const res=statements.map(st=>st.run());db.exec('COMMIT');return res}catch(e){db.exec('ROLLBACK');throw e}}};
 const MEDIA={async put(k,v){bin.set(k,v)},async get(k){const buf=bin.get(k);return buf?{body:new Blob([buf]).stream()}:null},async delete(k){bin.delete(k)}};
 const env={DB:D1,MEDIA,ASSETS:{fetch:async()=>new Response('ok')}};
 function user(name,email){const id=randomUUID(),token=randomBytes(32).toString('hex');db.prepare("INSERT INTO users(id,email,name,password_hash,salt) VALUES(?,?,?,?,?)").run(id,email,name,'','');db.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').run(createHash('sha256').update(token).digest('hex'),id,new Date(Date.now()+86400000).toISOString());return {id,name,email,token}}
 async function fetchAs(user,path,method='GET',data){const headers={Cookie:'cc_session='+user.token};let body;if(method!=='GET'){headers['Content-Type']='application/json';body=JSON.stringify(data||{})}return worker.fetch(new Request(base+'/api'+path,{method,headers,body}),env)}
 return {db,env,user,fetchAs};
}
test('auth provider discovery does not promise OAuth until credentials exist',async()=>{
 const {env}=fixture();const r=await worker.fetch(new Request(base+'/api/auth/providers'),env);assert.equal(r.status,200);assert.deepEqual(await r.json(),{google:false,microsoft:false});
});
test('OAuth start uses authorization code and PKCE with state cookie',async()=>{
 const {env}=fixture();env.GOOGLE_CLIENT_ID='test-google-id';env.GOOGLE_CLIENT_SECRET='test-google-secret';
 const r=await worker.fetch(new Request(base+'/api/oauth/google/start'),env);
 assert.equal(r.status,302);const loc=new URL(r.headers.get('location'));assert.equal(loc.searchParams.get('response_type'),'code');assert.equal(loc.searchParams.get('code_challenge_method'),'S256');assert.ok(loc.searchParams.get('state'));assert.ok(r.headers.get('set-cookie').includes('cc_oauth='));
});
test('community permissions: private follow requests and moderator approval',async()=>{
 const {env,user,fetchAs}=fixture();const alice=user('Alice','alice@example.edu'),bob=user('Bob','bob@example.edu'),charlie=user('Charlie','charlie@example.edu');
 let r=await fetchAs(alice,'/community/posts','POST',{body:'I wrote original CSC 201 revision notes about algorithms.',kind:'revision',tag:'CSC201'});assert.equal(r.status,201,await r.clone().text());const created=await r.json();
 r=await fetchAs(charlie,'/community/feed?tab=foryou');assert.equal((await r.json()).posts.length,1);
 r=await fetchAs(alice,'/community/me','PATCH',{is_private:true,school:'Lagos State University'});assert.equal(r.status,200);
 r=await fetchAs(charlie,'/community/feed?tab=foryou');assert.equal((await r.json()).posts.length,0);
 r=await fetchAs(bob,'/community/users/'+alice.id+'/follow','POST');assert.equal(r.status,200);assert.equal((await r.json()).requested,true);
 r=await fetchAs(bob,'/community/feed?tab=following');assert.equal((await r.json()).posts.length,0);
 r=await fetchAs(alice,'/community/me');const reqs=(await r.json()).requests;assert.equal(reqs.length,1);
 r=await fetchAs(alice,'/community/follow-requests/'+reqs[0].id+'/accept','POST');assert.equal(r.status,200);
 r=await fetchAs(bob,'/community/feed?tab=following');const visible=await r.json();assert.equal(visible.posts.length,1);assert.equal(visible.posts[0].id,created.id);
 r=await fetchAs(charlie,'/community/posts/'+created.id);assert.equal(r.status,403);
 r=await fetchAs(bob,'/community/posts/'+created.id+'/like','POST');assert.equal(r.status,200);assert.equal((await r.json()).enabled,true);
 r=await fetchAs(bob,'/community/posts/'+created.id+'/comments','POST',{body:'Could you explain the quicksort pivot choice?'});assert.equal(r.status,201);
 r=await fetchAs(bob,'/community/posts/'+created.id+'/comments');assert.equal((await r.json()).comments.length,1);
 r=await fetchAs(bob,'/community/chat/'+alice.id,'POST',{body:'Hello, could we revise together?'});assert.equal(r.status,201,await r.clone().text());
 r=await fetchAs(alice,'/community/chat/'+bob.id);assert.equal((await r.json()).messages.length,1);
 r=await fetchAs(charlie,'/community/chat/'+alice.id,'POST',{body:'Unsolicited message'});assert.equal(r.status,403);
 r=await fetchAs(alice,'/community/users/'+bob.id+'/block','POST');assert.equal(r.status,200);
 r=await fetchAs(bob,'/community/posts/'+created.id);assert.equal(r.status,404);
});
test('media upload is blocked without storage binding and without session',async()=>{
 const {env,user,fetchAs}=fixture();const u=user('Tomi','tomi@example.edu');env.MEDIA=undefined;
 let r=await fetchAs(u,'/community/media','POST',{body:'not real'});assert.equal(r.status,503);
 r=await worker.fetch(new Request(base+'/api/community/media',{method:'POST',headers:{'Content-Type':'image/png'},body:new Uint8Array([137,80,78,71,0,0,0,0,0,0,0,0,0,0,0,0])}),env);assert.equal(r.status,401);
});
test('community report queue is private to configured moderators',async()=>{
 const {env,user,fetchAs}=fixture();const alice=user('Alice','alice@example.edu'),moderator=user('Moderator','mod@example.edu');
 env.ADMIN_EMAILS='mod@example.edu';
 let r=await fetchAs(alice,'/community/moderation/reports');assert.equal(r.status,403);
 r=await fetchAs(moderator,'/community/moderation/reports');assert.equal(r.status,200);assert.deepEqual((await r.json()).reports,[]);
});

test('media signatures, ownership, post linkage, and reading permissions',async()=>{
 const {env,user,fetchAs}=fixture();const alice=user('Alice','alice2@example.edu'),bob=user('Bob','bob2@example.edu');
 const file=new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,0,0,0,0,0,9,8,7,6]);
 const upload=await worker.fetch(new Request(base+'/api/community/media',{method:'POST',headers:{Cookie:'cc_session='+alice.token,'Content-Type':'image/png','Content-Length':String(file.length)},body:file}),env);
 assert.equal(upload.status,200,await upload.clone().text());const media=(await upload.json()).id;
 let r=await fetchAs(bob,'/community/posts','POST',{body:'Trying to steal this upload',media_id:media});assert.equal(r.status,403);
 r=await worker.fetch(new Request(base+'/api/community/media/'+media,{headers:{Cookie:'cc_session='+alice.token}}),env);assert.equal(r.status,404,'unpublished files must not be readable');
 r=await fetchAs(alice,'/community/posts','POST',{body:'Original diagram of relational algebra',media_id:media,kind:'cheatsheet'});assert.equal(r.status,201);
 r=await worker.fetch(new Request(base+'/api/community/media/'+media,{headers:{Cookie:'cc_session='+bob.token}}),env);assert.equal(r.status,200);assert.equal(r.headers.get('content-type'),'image/png');
 r=await fetchAs(alice,'/community/me','PATCH',{is_private:true});assert.equal(r.status,200);
 r=await worker.fetch(new Request(base+'/api/community/media/'+media,{headers:{Cookie:'cc_session='+bob.token}}),env);assert.equal(r.status,404);
});
test('notifications and moderation of reported posts are account-scoped',async()=>{
 const {env,user,fetchAs}=fixture();const alice=user('Alice','a3@example.edu'),bob=user('Bob','b3@example.edu'),mod=user('Admin','admin@example.edu');env.ADMIN_EMAILS='admin@example.edu';
 let r=await fetchAs(alice,'/community/posts','POST',{body:'Study lesson with a mistake for moderation'});const post=(await r.json()).id;
 r=await fetchAs(bob,'/community/posts/'+post+'/like','POST');assert.equal(r.status,200);
 r=await fetchAs(alice,'/community/notifications');assert.equal((await r.json()).notifications.some(x=>x.kind==='like'),true);
 r=await fetchAs(bob,'/community/posts/'+post+'/report','POST',{reason:'This is a test of reporting a factual issue'});assert.equal(r.status,200);
 r=await fetchAs(mod,'/community/moderation/reports');const reports=(await r.json()).reports;assert.equal(reports.length,1);
 r=await fetchAs(alice,'/community/moderation/reports/'+reports[0].id+'/dismiss','POST');assert.equal(r.status,403);
 r=await fetchAs(mod,'/community/moderation/reports/'+reports[0].id+'/dismiss','POST');assert.equal(r.status,200);
 r=await fetchAs(mod,'/community/moderation/reports');assert.equal((await r.json()).reports.length,0);
});
test('Google OAuth callback creates a session using verified provider identity',async()=>{
 const {env,db}=fixture();env.GOOGLE_CLIENT_ID='client-id';env.GOOGLE_CLIENT_SECRET='client-secret';
 const start=await worker.fetch(new Request(base+'/api/oauth/google/start'),env);assert.equal(start.status,302);
 const authUrl=new URL(start.headers.get('location'));const state=authUrl.searchParams.get('state');const oauthCookie=start.headers.get('set-cookie').match(/cc_oauth=([^;]+)/)[1];
 const previous=globalThis.fetch;
 globalThis.fetch=async(url,opts)=>{
  if(String(url).includes('oauth2.googleapis.com/token')){assert.ok(String(opts.body).includes('code_verifier='));return Response.json({access_token:'verified-access'})}
  if(String(url).includes('openidconnect.googleapis.com/v1/userinfo'))return Response.json({sub:'google-subject-123',email:'student@example.edu',email_verified:true,name:'Student Tester'});
  throw Error('Unexpected OAuth URL: '+url);
 };
 try{
  const callback=await worker.fetch(new Request(base+'/api/oauth/google/callback?state='+encodeURIComponent(state)+'&code=one-time-code',{headers:{Cookie:'cc_oauth='+oauthCookie}}),env);
  assert.equal(callback.status,302,await callback.clone().text());
  const session=callback.headers.get('set-cookie').match(/cc_session=([0-9a-f]{64})/);
  assert.ok(session,'OAuth must establish a Secure application session');
  const me=await worker.fetch(new Request(base+'/api/me',{headers:{Cookie:'cc_session='+session[1]}}),env);
  const result=await me.json();assert.equal(result.user.email,'student@example.edu');
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM oauth_identities').get().n,1);
 }finally{globalThis.fetch=previous}
});
test('Microsoft sign-in can be linked to an existing signed-in user, never by email alone',async()=>{
 const {env,user,db,fetchAs}=fixture();const account=user('Dupe','dupe@example.edu');
 env.MICROSOFT_CLIENT_ID='ms-client';env.MICROSOFT_CLIENT_SECRET='ms-secret';
 const start=await worker.fetch(new Request(base+'/api/oauth/microsoft/start?mode=link',{headers:{Cookie:'cc_session='+account.token}}),env);
 assert.equal(start.status,302);const state=new URL(start.headers.get('location')).searchParams.get('state');const token=start.headers.get('set-cookie').match(/cc_oauth=([^;]+)/)[1];
 const old=globalThis.fetch;
 globalThis.fetch=async(url)=>{
  if(String(url).includes('login.microsoftonline.com/')&&String(url).includes('/token'))return Response.json({access_token:'mock-ms-token'});
  if(String(url).includes('graph.microsoft.com/oidc/userinfo'))return Response.json({sub:'ms-sub-123',email:'dupe@example.edu',name:'Dupe'});
  throw Error('Unexpected URL '+url);
 };
 try{
  const r=await worker.fetch(new Request(base+'/api/oauth/microsoft/callback?state='+encodeURIComponent(state)+'&code=one-use',{headers:{Cookie:'cc_session='+account.token+'; cc_oauth='+token}}),env);
  assert.equal(r.status,302);assert.equal(new URL(r.headers.get('location')).searchParams.get('linked'),'microsoft');
  assert.equal(db.prepare('SELECT user_id FROM oauth_identities WHERE provider=?').get('microsoft').user_id,account.id);
  const identities=await fetchAs(account,'/auth/identities');assert.deepEqual((await identities.json()).providers,['microsoft']);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM users').get().n,1);
 }finally{globalThis.fetch=old}
});
