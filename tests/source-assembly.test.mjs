import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, copyFile, readFile, writeFile, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
const input = process.env.OFFICE_RAW_ENGINE_DIRECTORY;
assert.ok(input, 'Set OFFICE_RAW_ENGINE_DIRECTORY to the pinned four raw outputs.');
const root = new URL('../', import.meta.url);
const run = (...args) => spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8' });
const names = ['soffice.js', 'soffice.wasm', 'soffice.data', 'soffice.data.js.metadata'];
async function fixture() { const dir = await mkdtemp(path.join(tmpdir(), 'office-source-test-')); for (const n of names) await copyFile(path.join(input, n), path.join(dir, n)); return dir; }
test('actual pinned outputs create a completed-build manifest without claiming a fresh build', async () => {
 const dir = await fixture(); try {
  const result=run('create-engine-manifest.mjs',dir); assert.equal(result.status,0,result.stderr);
  const m=JSON.parse(await readFile(path.join(dir,'source-engine-manifest.json'),'utf8'));
  assert.equal(m.assets.length,4);assert.equal(m.sourceBuildReceipt.exit,0);assert.equal(m.sourceBuildReceipt.elapsedSeconds,716);
  assert.equal(m.assets.find(a=>a.name==='soffice.wasm').sha256,'2e4a486ff76336b40a1a97c53a10c71e4cdebb3ef344a875c19fe37d0ef4b84d');
  const repeat=run('create-engine-manifest.mjs',dir);assert.notEqual(repeat.status,0);assert.equal(JSON.parse(await readFile(path.join(dir,'source-engine-manifest.json'),'utf8')).sourceBuildReceipt.elapsedSeconds,716);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('changed raw bytes refuse manifest creation', async () => {const dir=await fixture();try{await writeFile(path.join(dir,'soffice.js'),'untrusted replacement');const r=run('create-engine-manifest.mjs',dir);assert.notEqual(r.status,0);await assert.rejects(access(path.join(dir,'source-engine-manifest.json')));}finally{await rm(dir,{recursive:true,force:true});}});
test('missing output refuses manifest creation', async()=>{const dir=await fixture();try{await rm(path.join(dir,'soffice.data.js.metadata'));assert.notEqual(run('create-engine-manifest.mjs',dir).status,0);await assert.rejects(access(path.join(dir,'source-engine-manifest.json')));}finally{await rm(dir,{recursive:true,force:true});}});
test('actual assembly includes all 30 files, source notices and unchanged engine pins; existing destination survives', async()=>{
 const dir=await fixture(); const out=dir+'-static';try{
  assert.equal(run('create-engine-manifest.mjs',dir).status,0);
  const r=run('package-runtime.mjs',dir,out);assert.equal(r.status,0,r.stderr);
  const { readdir }=await import('node:fs/promises');assert.equal((await readdir(path.join(out,'arvo-office'))).length,29);
  const sha=await import('node:crypto');const hash=b=>sha.createHash('sha256').update(b).digest('hex');
  for(const n of ['NOTICE','COPYING','LibreOffice-LICENSE.html','SOURCE.md','about.html','about.css'])assert.deepEqual(await readFile(path.join(out,'arvo-office',n)),await readFile(new URL(n,root)));
  assert.equal(hash(await readFile(path.join(out,'arvo-office','soffice.js'))),'a774682240edbe50ab2ae32d10c00627350a48c69327d396b74ede6082e0a00b');
  const parts=JSON.parse(await readFile(path.join(out,'arvo-office','wasm-parts.json'),'utf8'));assert.equal(parts.sha256,'2e4a486ff76336b40a1a97c53a10c71e4cdebb3ef344a875c19fe37d0ef4b84d');assert.equal(parts.parts.length,10);
  const before=await readFile(path.join(out,'arvo-office','runtime.js'));assert.notEqual(run('package-runtime.mjs',dir,out).status,0);assert.deepEqual(await readFile(path.join(out,'arvo-office','runtime.js')),before);
 }finally{await rm(dir,{recursive:true,force:true});await rm(out,{recursive:true,force:true});}
});
