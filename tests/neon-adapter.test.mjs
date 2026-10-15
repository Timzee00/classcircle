import test from 'node:test';
import assert from 'node:assert/strict';
import { convertSqliteSql, createPostgresD1Adapter } from '../worker/neon-adapter.js';

test('converts SQLite bind placeholders into Postgres parameters', () => {
 assert.equal(convertSqliteSql('SELECT id FROM users WHERE email=? AND id=?'), 'SELECT id FROM users WHERE email=$1 AND id=$2');
});
test('preserves bound SQL values (prevents interpolation)', async () => {
 const calls=[];const client={async query(sql,params){calls.push([sql,params]);return {rows:[{name:'Student'}],rowCount:1}}};
 const db=createPostgresD1Adapter(client);
 const evil="' OR 1=1 --";
 const record=await db.prepare('SELECT name FROM users WHERE name=?').bind(evil).first();
 assert.deepEqual(record,{name:'Student'});
 assert.deepEqual(calls,[['SELECT name FROM users WHERE name=$1',[evil]]]);
});
test('converts INSERT OR IGNORE to conflict safe INSERT', () => {
 assert.equal(convertSqliteSql('INSERT OR IGNORE INTO follows(follower_id,followed_id) VALUES(?,?)'), 'INSERT INTO follows(follower_id,followed_id) VALUES($1,$2) ON CONFLICT DO NOTHING');
});
test('maps .all result shape for existing API', async () => {
 const db=createPostgresD1Adapter({query:async()=>({rows:[{id:1},{id:2}],rowCount:2})});
 assert.deepEqual(await db.prepare('SELECT id FROM users').bind().all(),{results:[{id:1},{id:2}]});
});
test('batch uses transaction and commits', async()=>{
 const cmds=[];const db=createPostgresD1Adapter({async query(sql,params){cmds.push(sql);return {rows:[],rowCount:1}}});
 const p1=db.prepare('INSERT INTO users(id) VALUES(?)').bind('123');
 const p2=db.prepare('DELETE FROM sessions WHERE user_id=?').bind('123');
 await db.batch([p1,p2]);
 assert.deepEqual(cmds,['BEGIN','INSERT INTO users(id) VALUES($1)','DELETE FROM sessions WHERE user_id=$1','COMMIT']);
});
test('batch rolls back if a statement fails', async()=>{
 const cmds=[];const db=createPostgresD1Adapter({async query(sql){cmds.push(sql);if(sql.startsWith('DELETE'))throw new Error('invalid')}});
 await assert.rejects(db.batch([db.prepare('INSERT INTO users VALUES(?)').bind('1'),db.prepare('DELETE FROM fails WHERE id=?').bind(1)]));
 assert.deepEqual(cmds.slice(-1),['ROLLBACK']);
});
