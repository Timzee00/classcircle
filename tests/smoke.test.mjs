import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker/index.js';
const env={ASSETS:{fetch:async()=>new Response('Asset served',{status:200})},DB:{prepare(){throw Error('DB must not be invoked for unauthenticated requests')}}};
test('public app health is available',async()=>{
 const r=await worker.fetch(new Request('https://example.workers.dev/api/health'),env);
 assert.equal(r.status,200);assert.deepEqual(await r.json(),{ok:true,app:'ClassCircle Open'});
});
test('not logged in returns null profile',async()=>{
 const r=await worker.fetch(new Request('https://example.workers.dev/api/me'),env);
 assert.equal(r.status,200);assert.deepEqual(await r.json(),{user:null});
});
test('private bootstrap requires a session',async()=>{
 const r=await worker.fetch(new Request('https://example.workers.dev/api/bootstrap'),env);
 assert.equal(r.status,401);
});
test('rejects cross-site mutation',async()=>{
 const r=await worker.fetch(new Request('https://example.workers.dev/api/login',{method:'POST',headers:{Origin:'https://evil.example','Content-Type':'application/json'},body:'{}'}),env);
 assert.equal(r.status,403);
});
test('rejects non-json mutations',async()=>{
 const r=await worker.fetch(new Request('https://example.workers.dev/api/logout',{method:'POST',headers:{'Content-Type':'text/plain'},body:'hi'}),env);
 assert.equal(r.status,415);
});
test('serves static site via ASSETS',async()=>{
 const r=await worker.fetch(new Request('https://example.workers.dev/'),env);
 assert.equal(r.status,200);assert.equal(await r.text(),'Asset served');
});
