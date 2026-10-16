import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const contract=JSON.parse(readFileSync(new URL('../contracts/brainbox-admin.v1.json',import.meta.url),'utf8'));
test('central BrainBox contract is a platform-wide control plane',()=>{
 assert.equal(contract.scope,'platform-administration');
 assert.equal(contract.student_tutor_is_separate,true);
 assert.deepEqual(contract.principal_roles,['student','support','moderator','admin','superadmin']);
});
test('owner safeguards prevent delegation of the superadmin role',()=>{
 assert.equal(contract.owner_bootstrap.self_promotion,false);
 assert.equal(contract.owner_bootstrap.staff_assignable_roles.includes('superadmin'),false);
 assert.equal(contract.permissions.superadmin.includes('roles'),true);
 assert.equal(contract.permissions.moderator.includes('roles'),false);
});
test('automation contract escalates risk and does not silently delete students posts',()=>{
 assert.match(contract.automation.implemented_in_github.community_triage,/never automatically delete/);
 assert.equal(contract.flags.maintenance_mode,false);
 assert.equal(contract.flags.ai_enabled,true);
});
