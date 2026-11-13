import assert from 'node:assert/strict'
import { randomUUID, randomBytes, createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync, readdirSync, existsSync, copyFileSync } from 'node:fs'
import { execFileSync, spawn } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'
import { jsPDF } from 'jspdf'
import { credentials, query, url, ref } from './cc15-hml.mjs'
import { startDiscardServer } from './cc16-backend-server.mjs'

assert.equal(process.env.CC16_AUTHORIZATION, ref, 'Explicit HML authorization required')
const keys = credentials()
const client = (key) => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
const service = client(keys.service)
const anonymous = client(keys.anon)
const ok = (r) => { if (r.error) throw new Error(`${r.error.code ?? ''}: ${r.error.message}`); return r.data }
const reject = (r) => assert(r.error, 'Unauthorized action succeeded')
const users = []; const docs = []; const contractIds = []; const results = []
const run = randomUUID(); const pdf = Buffer.from(new jsPDF().output('arraybuffer'))
const hash = (b) => createHash('sha256').update(b).digest('hex')
let clientId; let host; let fault = ''; let e2e = null; let cleanup = false
mkdirSync('artifacts/contracts-16', { recursive: true })
if (existsSync('artifacts/contracts-16/runtime.json')) copyFileSync('artifacts/contracts-16/runtime.json', `artifacts/contracts-16/runtime-before-${run}.json`)
if (existsSync('artifacts/contracts-16/playwright.json')) copyFileSync('artifacts/contracts-16/playwright.json', `artifacts/contracts-16/playwright-before-${run}.json`)
async function check(name, action) {
  try { await action(); results.push({ name, status: 'PASS' }); console.log(`PASS ${name}`) }
  catch (error) { results.push({ name, status: 'FAIL', error: error.message }); console.log(`FAIL ${name}: ${error.message}`) }
}
async function document(actor, { status = 'pending', object = false, contract = contractIds[0] } = {}) {
  const id = randomUUID(); const path = `${contract}/${id}.pdf`
  const d = { id, path, contract }; docs.push(d)
  ok(await service.from('client_contract_documents').insert({ id, contract_id: contract, name: `CC16-${run}-${id}.pdf`, document_type: 'main', storage_path: path, size_bytes: pdf.length, created_by: actor.id }))
  if (object) ok(await actor.db.storage.from('client-contracts').upload(path, pdf, { contentType: 'application/pdf', upsert: false }))
  if (status === 'failed') ok(await actor.db.rpc('mark_client_contract_document_failed', { p_document_id: id, p_reason: 'CC16 simulated failure' }))
  if (status === 'ready') ok(await actor.db.rpc('finalize_client_contract_document', { p_document_id: id }))
  return d
}
async function exists(d) { return ok(await service.storage.from('client-contracts').list(d.contract, { search: `${d.id}.pdf` })).some((o) => o.name === `${d.id}.pdf`) }
async function row(d) { return ok(await service.from('client_contract_documents').select('*').eq('id', d.id)) }
async function job(d) { return ok(await service.from('client_contract_document_discards').select('*').eq('document_id', d.id).single()) }
async function discard(actor, d, overrides = {}) {
  const response = await fetch(host.endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(actor ? { Authorization: `Bearer ${actor.token}` } : {}) }, body: JSON.stringify({ contract_id: d.contract, document_id: d.id, ...overrides }) })
  return { status: response.status, body: await response.json() }
}
async function absent(d) {
  assert.equal((await row(d)).length, 0); assert(!(await exists(d)))
  const response = await fetch(`${url}/storage/v1/object/authenticated/client-contracts/${d.path}?cc16=${randomUUID()}`, { headers: { Authorization: `Bearer ${keys.service}`, apikey: keys.service, 'Cache-Control': 'no-cache' }, cache: 'no-store' })
  const body = await response.json(); assert.equal(String(body.statusCode), '404'); assert([400,404].includes(response.status))
  assert.equal((await job(d)).state, 'api_absent')
}
function sanitize(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const file = `${dir}/${entry.name}`
    if (entry.isDirectory()) sanitize(file)
    else if (/\.(json|md)$/.test(file)) {
      let text = readFileSync(file, 'utf8').replace(/Cc16![A-Za-z0-9_-]+/g, '[REDACTED_TEMPORARY_PASSWORD]')
      for (const secret of [keys.service, keys.anon, ...users.flatMap((u) => [u.password,u.token])]) if (secret) text = text.replaceAll(secret, '[REDACTED]')
      writeFileSync(file, text)
    }
  }
}
try {
  assert.equal(ok(await service.auth.admin.listUsers({ perPage: 1 })).users.length, 0, 'Existing Auth users; stop')
  for (const table of ['clients','client_contracts','client_contract_documents']) {
    const r = await service.from(table).select('id', { count: 'exact', head: true }); ok(r); assert.equal(r.count,0,`Existing ${table}; stop`)
  }
  for (const [role,active] of [['admin',true],['equipe',true],['equipe',true],['equipe',false]]) {
    const email = `cc16-${randomUUID()}@example.invalid`; const password = `Cc16!${randomBytes(24).toString('base64url')}`
    const { user } = ok(await service.auth.admin.createUser({ email,password,email_confirm:true }))
    const u = { id:user.id,email,password,db:client(keys.anon) }; users.push(u)
    ok(await service.from('profiles').update({ role,active }).eq('id',u.id))
    u.token = ok(await u.db.auth.signInWithPassword({ email,password })).session.access_token
  }
  const [admin,a,b,inactive] = users
  clientId=randomUUID()
  ok(await admin.db.from('clients').insert({ id:clientId,legal_name:`CC16 FICTICIO ${run}`,tax_id:'52998224725',client_type:'individual' }))
  for(let i=0;i<2;i++) { const id=randomUUID(); contractIds.push(id); ok(await admin.db.from('client_contracts').insert({ id,client_id:clientId,contract_number:`CC16-${i}-${run}`,title:'Contrato ficticio CC16',contract_type:'SST',modality:'one_off',starts_at:'2026-11-12' })) }
  const installed=query("select version from supabase_migrations.schema_migrations where version='20261112134840'").length>0
  if(!installed) {
    const d=await document(a,{status:'failed',object:true})
    const before=Buffer.from(await ok(await service.storage.from('client-contracts').download(d.path)).arrayBuffer())
    const removal=await a.db.storage.from('client-contracts').remove([d.path])
    const visibility=query(`begin; set local role authenticated; select set_config('request.jwt.claim.sub','${a.id}',true); select set_config('request.jwt.claims','{"sub":"${a.id}","role":"authenticated"}',true); select jsonb_build_object('own_document_visible',(select count(*) from public.client_contract_documents where id='${d.id}'),'storage_visible',(select count(*) from storage.objects where bucket_id='client-contracts' and name='${d.path}')) as visibility; rollback;`)[0].visibility
    const after=Buffer.from(await ok(await service.storage.from('client-contracts').download(d.path)).arrayBuffer())
    assert.equal(removal.error,null); assert.deepEqual(removal.data,[]); assert(await exists(d)); assert.equal(hash(before),hash(after))
    const deleted=ok(await a.db.from('client_contract_documents').delete().eq('id',d.id).select())
    assert.equal(deleted.length,1); assert(await exists(d))
    writeFileSync('artifacts/contracts-16/root-cause.json',JSON.stringify({ project:ref,removeError:null,removeData:removal.data,visibility,objectStillExists:true,bytesHashBefore:hash(before),bytesHashAfter:hash(after),metadataDeleted:deleted.length,orphanReproduced:true },null,2))
    ok(await service.storage.from('client-contracts').remove([d.path]))
    execFileSync(process.execPath,['scripts/cc16-hml.mjs','apply'],{env:{...process.env,CC16_AUTHORIZATION:ref},stdio:'inherit',timeout:180000})
  }
  host=await startDiscardServer(keys,async(input,init)=>{
    if(fault==='storage' && String(input).includes('/storage/v1/object/client-contracts') && init?.method==='DELETE') return new Response('{"statusCode":"503","message":"injected transport fault"}',{status:503,headers:{'Content-Type':'application/json'}})
    if(fault==='verification' && String(input).includes('/storage/v1/object/authenticated/')) return new Response('{"statusCode":"403"}',{status:403,headers:{'Content-Type':'application/json'}})
    return fetch(input,init)
  })
  await check('SQL ACL, owner, RLS and storage guard catalogs',()=>{query(readFileSync('supabase/tests/client_contracts_16_security.sql','utf8')); query(readFileSync('supabase/tests/client_contracts_14_acl.sql','utf8'))})
  for(const actor of [admin,a]) for(const status of ['pending','failed']) {
    await check(`${actor===admin?'Admin':'Equipe'} discard ${status} with bytes; verify API, metadata, audit`,async()=>{
      const d=await document(actor,{status,object:true}); const r=await discard(actor,d)
      assert.equal(r.status,200); assert.equal(r.body.confirmation,'storage_api_absent'); assert.equal(r.body.physical_erasure_verified,false); await absent(d)
    })
  }
  await check('failure before object creation and interrupted pending with no bytes',async()=>{
    const d=await document(a); assert(!(await exists(d))); assert.equal((await discard(a,d)).status,200); await absent(d)
  })
  await check('direct document DELETE denied even without object; direct Storage remove cannot orphan metadata',async()=>{
    const d=await document(a,{object:true})
    for(const actor of [a,admin]) { reject(await actor.db.from('client_contract_documents').delete().eq('id',d.id).select()); await actor.db.storage.from('client-contracts').remove([d.path]); assert(await exists(d)); assert.equal((await row(d)).length,1) }
    assert.equal((await discard(a,d)).status,200); await absent(d)
  })
  await check('duplicate discard idempotent and immutable tombstone prevents UUID reuse',async()=>{
    const d=await document(a,{object:true}); const first=await discard(a,d); assert.equal(first.status,200)
    const op=(await job(d)).operation_id; assert.equal((await discard(a,d)).status,200); assert.equal((await job(d)).operation_id,op)
    await absent(d)
    reject(await a.db.from('client_contract_documents').insert({id:d.id,contract_id:d.contract,name:'reused.pdf',document_type:'main',storage_path:d.path,size_bytes:pdf.length,created_by:a.id}))
    reject(await a.db.storage.from('client-contracts').upload(d.path,pdf,{contentType:'application/pdf'}))
  })
  await check('anonymous, invalid JWT, inactive and foreign creator denied before removal',async()=>{
    const d=await document(a,{object:true})
    assert.equal((await discard(null,d)).status,401); assert.equal((await discard({token:'forged'},d)).status,401)
    assert.equal((await discard(inactive,d)).status,403)
    for(const actor of [b,admin]) assert.equal((await discard(actor,d)).status,404)
    assert(await exists(d)); assert.equal((await row(d))[0].discard_started_at,null)
    reject(await anonymous.rpc('begin_client_contract_document_discard',{p_actor:a.id,p_contract_id:d.contract,p_document_id:d.id,p_attempt_id:randomUUID()}))
  })
  await check('arbitrary paths, buckets, actor and wrong contract denied; other document untouched',async()=>{
    const d=await document(a,{object:true}); const other=await document(a,{object:true,contract:contractIds[1]})
    for(const key of ['path','bucket','actor','operation_id']) assert.equal((await discard(a,d,{[key]:other.path})).status,400)
    assert.equal((await discard(a,d,{contract_id:contractIds[1]})).status,404)
    assert(await exists(d)); assert(await exists(other)); assert.equal((await row(other))[0].discard_started_at,null)
  })
  await check('privileged begin/finish RPC not executable by authenticated or anon',async()=>{
    for(const actor of [admin,a,b,inactive]) {
      reject(await actor.db.rpc('begin_client_contract_document_discard',{p_actor:a.id,p_contract_id:contractIds[0],p_document_id:randomUUID(),p_attempt_id:randomUUID()}))
      reject(await actor.db.rpc('finish_client_contract_document_discard',{p_actor:a.id,p_document_id:randomUUID(),p_operation_id:randomUUID(),p_attempt_id:randomUUID(),p_error_code:null}))
    }
  })
  await check('ready immutable: discard, DELETE, UPDATE, overwrite and MOVE/COPY denied; bytes unchanged',async()=>{
    const d=await document(a,{status:'ready',object:true})
    for(const actor of [a,admin,b]) {
      assert([404,409].includes((await discard(actor,d)).status))
      reject(await actor.db.from('client_contract_documents').delete().eq('id',d.id))
      reject(await actor.db.from('client_contract_documents').update({name:'forged'}).eq('id',d.id))
      reject(await actor.db.storage.from('client-contracts').upload(d.path,pdf,{contentType:'application/pdf',upsert:true}))
      reject(await actor.db.storage.from('client-contracts').move(d.path,`${d.contract}/${randomUUID()}.pdf`))
      reject(await actor.db.storage.from('client-contracts').copy(d.path,`${d.contract}/${randomUUID()}.pdf`))
    }
    assert.equal(hash(Buffer.from(await ok(await a.db.storage.from('client-contracts').download(d.path)).arrayBuffer())),hash(pdf))
    assert.equal((await row(d))[0].upload_status,'ready')
  })
  await check('temporary Storage failure retained, audited and reconciled by retry',async()=>{
    const d=await document(a,{object:true}); fault='storage'
    const r=await discard(a,d); fault=''; assert.equal(r.status,503); assert(await exists(d)); assert.equal((await row(d)).length,1)
    assert.equal((await job(d)).last_error,'storage_api_failed'); assert.equal((await discard(a,d)).status,200); await absent(d)
    const attempts=ok(await service.from('client_contract_document_discard_attempts').select('*').eq('document_id',d.id)); assert(attempts.some((x)=>x.outcome==='retry_required')); assert(attempts.some((x)=>x.outcome==='api_absent'))
  })
  await check('403 during absence verification is NOT absence; retry reconciles missing object',async()=>{
    const d=await document(a,{object:true}); fault='verification'; const r=await discard(a,d); fault=''
    assert.equal(r.status,503); assert.equal((await row(d)).length,1); assert(!(await exists(d)))
    assert.equal((await job(d)).state,'discarding'); assert.equal((await discard(a,d)).status,200); await absent(d)
  })
  await check('interruption after reservation blocks finalize/upload then retry resumes',async()=>{
    const d=await document(a,{object:true}); const attempt=randomUUID()
    ok(await service.rpc('begin_client_contract_document_discard',{p_actor:a.id,p_contract_id:d.contract,p_document_id:d.id,p_attempt_id:attempt}))
    reject(await a.db.rpc('finalize_client_contract_document',{p_document_id:d.id}))
    reject(await a.db.rpc('mark_client_contract_document_failed',{p_document_id:d.id,p_reason:'forged'}))
    assert((await row(d))[0].discard_started_at); assert.equal((await discard(a,d)).status,200); await absent(d)
    const attempts=ok(await service.from('client_contract_document_discard_attempts').select('*').eq('id',attempt)); assert.equal(attempts[0].outcome,'started')
  })
  await check('interruption after Storage delete but before DB finish remains recoverable',async()=>{
    const d=await document(a,{object:true}); ok(await service.rpc('begin_client_contract_document_discard',{p_actor:a.id,p_contract_id:d.contract,p_document_id:d.id,p_attempt_id:randomUUID()}))
    ok(await service.storage.from('client-contracts').remove([d.path])); assert(!(await exists(d))); assert.equal((await row(d)).length,1)
    assert.equal((await discard(a,d)).status,200); await absent(d)
  })
  await check('concurrent finalize vs discard: ready survives OR discard wins, never both',async()=>{
    for(let i=0;i<5;i++) {
      const d=await document(a,{object:true}); const [f,r]=await Promise.all([a.db.rpc('finalize_client_contract_document',{p_document_id:d.id}),discard(a,d)])
      if(!f.error) { assert.equal(r.status,409); assert.equal((await row(d))[0].upload_status,'ready'); assert(await exists(d)) }
      else { assert.equal(r.status,200); await absent(d) }
    }
  })
  await check('simultaneous duplicate discard requests converge',async()=>{
    const d=await document(a,{object:true}); const results=await Promise.all([discard(a,d),discard(a,d)])
    results.forEach((r)=>assert.equal(r.status,200)); await absent(d); assert.equal((await job(d)).attempts,2)
  })
  await check('in-flight real upload vs discard cannot create a Storage metadata orphan',async()=>{
    for(let i=0;i<3;i++) {
      const d=await document(a); const [upload,r]=await Promise.all([a.db.storage.from('client-contracts').upload(d.path,pdf,{contentType:'application/pdf'}),discard(a,d)])
      assert.equal(r.status,200); void upload; await absent(d)
    }
  })
  await check('SQL reservation and completion refuse wrong operation and existing Storage metadata',async()=>{
    const d=await document(a,{object:true}); const attempt=randomUUID(); const j=ok(await service.rpc('begin_client_contract_document_discard',{p_actor:a.id,p_contract_id:d.contract,p_document_id:d.id,p_attempt_id:attempt}))
    reject(await service.rpc('finish_client_contract_document_discard',{p_actor:a.id,p_document_id:d.id,p_operation_id:randomUUID(),p_attempt_id:attempt,p_error_code:null}))
    reject(await service.rpc('finish_client_contract_document_discard',{p_actor:a.id,p_document_id:d.id,p_operation_id:j.operation_id,p_attempt_id:attempt,p_error_code:null}))
    assert(await exists(d)); assert.equal((await row(d)).length,1); assert.equal((await discard(a,d)).status,200); await absent(d)
  })
  console.log('Starting isolated E2E with LOCAL backend only, real HML Auth/DB/Storage')
  e2e=await new Promise((resolve,reject)=>{
    const child=spawn('powershell.exe',['-NoProfile','-Command','& npx playwright test --config playwright.cc16.config.ts; exit $LASTEXITCODE'],{env:{...process.env,VITE_SUPABASE_URL:url,VITE_SUPABASE_ANON_KEY:keys.anon,HML_SERVICE_ROLE_KEY:keys.service,CC16_BACKEND_URL:'http://127.0.0.1:4196',CC15_FIXTURE:JSON.stringify({clientId,users:users.map(({id,email,password})=>({id,email,password}))})}})
    child.stdout.on('data',(data)=>process.stdout.write(data)); child.stderr.on('data',(data)=>process.stderr.write(data)); child.on('error',reject); child.on('close',resolve)
  })
} catch(error) { results.push({name:'orchestration',status:'FAIL',error:error.message}); console.error(`ORCHESTRATION_FAIL ${error.message}`) }
finally {
  fault=''
  if(host) await host.close()
  try {
    const ids=clientId?ok(await service.from('client_contracts').select('id').eq('client_id',clientId)).map((c)=>c.id):[]
    const remaining=ids.length?ok(await service.from('client_contract_documents').select('id,storage_path').in('contract_id',ids)):[]
    const jobs=ids.length && query("select to_regclass('public.client_contract_document_discards') as t")[0].t?ok(await service.from('client_contract_document_discards').select('document_id,storage_path').in('contract_id',ids)):[]
    const paths=[...new Set([...docs.map((d)=>d.path),...remaining.map((d)=>d.storage_path),...jobs.map((j)=>j.storage_path)])]
    if(paths.length) ok(await service.storage.from('client-contracts').remove(paths))
    if(jobs.length) { ok(await service.from('client_contract_document_discard_attempts').delete().in('document_id',jobs.map((j)=>j.document_id))); ok(await service.from('client_contract_document_discards').delete().in('document_id',jobs.map((j)=>j.document_id))) }
    if(ids.length) { ok(await service.from('client_contract_documents').delete().in('contract_id',ids)); ok(await service.from('client_contract_events').delete().in('contract_id',ids)); ok(await service.from('client_contracts').delete().in('id',ids)) }
    if(clientId) ok(await service.from('clients').delete().eq('id',clientId))
    for(const user of users) { await service.auth.admin.signOut(user.token,'global'); ok(await service.auth.admin.deleteUser(user.id)) }
    const counts=query("select jsonb_build_object('users',(select count(*) from auth.users),'profiles',(select count(*) from public.profiles),'clients',(select count(*) from public.clients),'contracts',(select count(*) from public.client_contracts),'documents',(select count(*) from public.client_contract_documents),'events',(select count(*) from public.client_contract_events),'objects',(select count(*) from storage.objects),'discards',(select count(*) from public.client_contract_document_discards),'attempts',(select count(*) from public.client_contract_document_discard_attempts)) as counts")[0].counts
    assert(Object.values(counts).every((n)=>n===0),'Residual fixtures'); cleanup=true; console.log(`CLEANUP_PASS ${JSON.stringify(counts)}`)
  } catch(error) { results.push({name:'cleanup',status:'FAIL',error:error.message}); console.error(`CLEANUP_FAIL ${error.message}`) }
  writeFileSync('artifacts/contracts-16/runtime.json',JSON.stringify({project:ref,run,timestamp:new Date().toISOString(),backend:'loopback only; no deploy',physicalErasureVerified:false,results,e2e,cleanup},null,2)); sanitize('artifacts/contracts-16')
  console.log(`API_SQL=${results.filter((r)=>r.status==='PASS').length}/${results.length}; E2E_EXIT=${e2e}; CLEANUP=${cleanup}`)
}
if(results.some((r)=>r.status==='FAIL')||e2e!==0||!cleanup) process.exitCode=1
