/** Minimal server-side OIDC authorization-code + PKCE integration. No OAuth client secrets in the browser. */
const enc = new TextEncoder();
const hex = b => [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('');
const digest = async s=>hex(await crypto.subtle.digest('SHA-256',enc.encode(s)));
const b64url = bytes => btoa(String.fromCharCode(...bytes)).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
const random = (len=32) => b64url(crypto.getRandomValues(new Uint8Array(len)));
const challenge = async verifier => b64url(new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(verifier))));
const providers = {
 google: {auth:'https://accounts.google.com/o/oauth2/v2/auth',token:'https://oauth2.googleapis.com/token', userinfo:'https://openidconnect.googleapis.com/v1/userinfo'},
 microsoft: {auth:'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',token:'https://login.microsoftonline.com/common/oauth2/v2.0/token', userinfo:'https://graph.microsoft.com/oidc/userinfo'}
};
const configurations = (env,p)=> p==='google'?{id:env.GOOGLE_CLIENT_ID,secret:env.GOOGLE_CLIENT_SECRET}:{id:env.MICROSOFT_CLIENT_ID,secret:env.MICROSOFT_CLIENT_SECRET};
const cookie=(v,age)=>`cc_oauth=${v}; Path=/api/oauth; HttpOnly; Secure; SameSite=Lax; Max-Age=${age}`;
const getCookie=req=>req.headers.get('cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith('cc_oauth='))?.slice(9)||'';
const db=(env,s,...args)=>env.DB.prepare(s).bind(...args);
const j=(v,s=200)=>new Response(JSON.stringify(v),{status:s,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
const redirect=(url,cookieValue)=>new Response(null,{status:302,headers:{Location:url,'Cache-Control':'no-store',...(cookieValue?{'Set-Cookie':cookieValue}:{})}});
const errorPath=(base,reason)=>`${base}/?auth_error=${encodeURIComponent(reason)}`;
export async function handleOAuth(req,env,currentUser=null){
 const url=new URL(req.url),path=url.pathname,base=url.origin;
 if(path==='/api/auth/providers')return j({google:Boolean(configurations(env,'google').id&&configurations(env,'google').secret),microsoft:Boolean(configurations(env,'microsoft').id&&configurations(env,'microsoft').secret)});
 const start=path.match(/^\/api\/oauth\/(google|microsoft)\/start$/);
 if(start&&req.method==='GET'){
  const provider=start[1],cfg=configurations(env,provider),endpoints=providers[provider];
  if(!cfg.id||!cfg.secret)return redirect(errorPath(base,provider+'_not_configured'));
  const linkUser=url.searchParams.get('mode')==='link'?currentUser?.id||null:null;
  if(url.searchParams.get('mode')==='link'&&!linkUser)return redirect(errorPath(base,'login_required_for_linking'));
  const state=random(32),verifier=random(40),nonce=random(24);
  await db(env,'INSERT INTO oauth_states(state_hash,provider,verifier,nonce,expires_at,link_user_id) VALUES(?,?,?,?,?,?)',await digest(state),provider,verifier,nonce,new Date(Date.now()+8*60*1000).toISOString(),linkUser).run();
  const params=new URLSearchParams({client_id:cfg.id,response_type:'code',redirect_uri:`${base}/api/oauth/${provider}/callback`,scope:'openid profile email',state,nonce,code_challenge:await challenge(verifier),code_challenge_method:'S256'});
  return redirect(endpoints.auth+'?'+params.toString(),cookie(state,480));
 }
 const callback=path.match(/^\/api\/oauth\/(google|microsoft)\/callback$/);
 if(callback&&req.method==='GET'){
  const provider=callback[1],state=url.searchParams.get('state')||'',code=url.searchParams.get('code')||'',stored=getCookie(req);
  const clear=cookie('',0),failure=reason=>redirect(errorPath(base,reason),clear);
  if(!state||!stored||state!==stored||!code||state.length>128)return failure('oauth_session_expired');
  const entry=await db(env,'SELECT provider,verifier,nonce,expires_at,link_user_id FROM oauth_states WHERE state_hash=?',await digest(state)).first();
  if(!entry||entry.provider!==provider||Date.parse(entry.expires_at)<=Date.now())return failure('oauth_session_expired');
  await db(env,'DELETE FROM oauth_states WHERE state_hash=?',await digest(state)).run();
  const config=configurations(env,provider);
  try{
   const form=new URLSearchParams({grant_type:'authorization_code',client_id:config.id,client_secret:config.secret,code,code_verifier:entry.verifier,redirect_uri:`${base}/api/oauth/${provider}/callback`});
   const tokenResp=await fetch(providers[provider].token,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:form});
   if(!tokenResp.ok)return failure('oauth_token_exchange_failed');
   const token=await tokenResp.json();
   if(!token.access_token)return failure('oauth_token_missing');
   const infoResp=await fetch(providers[provider].userinfo,{headers:{Authorization:'Bearer '+token.access_token}});
   if(!infoResp.ok)return failure('oauth_profile_unavailable');
   const info=await infoResp.json();
   const subject=String(info.sub||'').slice(0,250),email=String(info.email||'').toLowerCase().trim().slice(0,250),name=String(info.name||email.split('@')[0]||'Student').trim().slice(0,70);
   if(!subject||!email||!/^\S+@\S+\.\S+$/.test(email)||!name)return failure('oauth_email_required');
   if(provider==='google'&&info.email_verified!==true)return failure('oauth_unverified_email');
   let identity=await db(env,'SELECT user_id FROM oauth_identities WHERE provider=? AND subject=?',provider,subject).first();
   if(entry.link_user_id){
     if(!currentUser||currentUser.id!==entry.link_user_id)return failure('login_required_for_linking');
     if(identity&&identity.user_id!==currentUser.id)return failure('oauth_already_linked');
     if(!identity)await db(env,'INSERT INTO oauth_identities(provider,subject,user_id) VALUES(?,?,?)',provider,subject,currentUser.id).run();
     return redirect(base+'/?linked='+provider,clear);
   }
   let userId=identity?.user_id;
   if(!userId){
    // We explicitly do NOT merge based on email. A preexisting local account must be linked in a future authenticated flow.
    if(await db(env,'SELECT id FROM users WHERE email=?',email).first())return failure('existing_email_sign_in_with_original_method');
    userId=crypto.randomUUID();
    await env.DB.batch([
     db(env,'INSERT INTO users(id,email,name,password_hash,salt) VALUES(?,?,?,?,?)',userId,email,name,'',''),
     db(env,'INSERT INTO oauth_identities(provider,subject,user_id) VALUES(?,?,?)',provider,subject,userId)
    ]);
   }
   const access=hex(crypto.getRandomValues(new Uint8Array(32))),sessionHash=await digest(access);
   await db(env,'INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)',sessionHash,userId,new Date(Date.now()+14*86400000).toISOString()).run();
   const headers=new Headers({Location:base+'/?signed_in=1','Cache-Control':'no-store'});
   headers.append('Set-Cookie',`cc_session=${access}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${14*86400}`);
   headers.append('Set-Cookie',clear);
   return new Response(null,{status:302,headers});
  }catch(err){console.error('OAuth callback failed',provider,err);return failure('oauth_sign_in_failed')}
 }
 if(path.startsWith('/api/oauth/'))return j({error:'OAuth route unavailable'},404);
 return null;
}
