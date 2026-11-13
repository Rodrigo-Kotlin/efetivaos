// Real hosted Edge Function tests. No local handler/proxy, migrations or production access.
import assert from 'node:assert/strict'
import { randomUUID, randomBytes, createHash } from 'node:crypto'
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, copyFileSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'
import { jsPDF } from 'jspdf'
import { credentials, query, cli, ref, url } from './cc15-hml.mjs'

assert.equal(process.env.CC19_AUTHORIZATION, ref, 'Explicit HML authorization required')
const endpoint = `${url}/functions/v1/discard-client-contract-document`
assert.equal(new URL(endpoint).hostname, 'xktbqykxmfuuzepfnjns.supabase.co')
const origin = 'http://127.0.0.1:4185'
const keys = credentials()
const connect = (key) => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
const service = connect(keys.service)
const ok = (r) => { if (r.error) throw new Error(`${r.error.code ?? ''}: ${r.error.message}`); return r.data }
const users = [], docs = [], contracts = [], results = [], exchanges = [], transportFailures = []
const run = randomUUID(), pdf = Buffer.from(new jsPDF().output('arraybuffer'))
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex')
let clientId, cleanup = false, e2e = null
mkdirSync('artifacts/contracts-19', { recursive: true })
for (const file of ['runtime','playwright']) if (existsSync(`artifacts/contracts-19/${file}.json`)) copyFileSync(`artifacts/contracts-19/${file}.json`, `artifacts/contracts-19/${file}-before-${run}.json`)
async function check(name, action) {
  try { await action(); results.push({ name, status: 'PASS' }); console.log(`PASS ${name}`) }
  catch (error) { results.push({ name, status: 'FAIL', error: error.message }); console.log(`FAIL ${name}: ${error.message}`) }
}
async function request(actor, d, { method = 'POST', requestOrigin = origin, extraBody = {}, rawBody, headers: extraHeaders = {}, apiKey = true, bearer = true, safeTransportRetry = false } = {}) {
  const headers = { ...(apiKey ? { apikey: keys.anon } : {}), ...(actor && bearer ? { Authorization: `Bearer ${actor.token}` } : {}), ...(requestOrigin ? { Origin: requestOrigin } : {}), 'Content-Type': 'application/json', ...extraHeaders }
  let response, text
  for (let attempt=1;attempt<=(safeTransportRetry?2:1);attempt++) {
    try {
      response = await fetch(endpoint, { method, headers, body: ['GET','HEAD','OPTIONS'].includes(method) ? undefined : rawBody ?? JSON.stringify({ contract_id: d.contract, document_id: d.id, ...extraBody }), signal: AbortSignal.timeout(60000) })
      text = await response.text(); break
    } catch (error) {
      transportFailures.push({ method, origin: requestOrigin, attempt, error_type: error.name, retry_safe: safeTransportRetry })
      if (!safeTransportRetry || attempt===2) throw error
    }
  }
  let body
  try { body = text ? JSON.parse(text) : null } catch { body = { non_json: true } }
  assert(!text.includes(keys.service), 'Privileged key exposed in hosted response')
  for (const u of users) assert(!text.includes(u.token), 'User token exposed in response')
  const safeHeaders = Object.fromEntries(['access-control-allow-origin','access-control-allow-headers','access-control-allow-methods','vary','cache-control','sb-request-id','x-deno-execution-id'].map((name) => [name, response.headers.get(name)]))
  exchanges.push({ method, origin: requestOrigin, status: response.status, headers: safeHeaders, body })
  return { status: response.status, headers: response.headers, body }
}
async function document(actor, { status = 'pending', object = true, contract = contracts[0] } = {}) {
  const id = randomUUID(), path = `${contract}/${id}.pdf`, d = { id, path, contract }; docs.push(d)
  ok(await service.from('client_contract_documents').insert({ id, contract_id: contract, document_type: 'main', name: `CC19-${run}-${id}.pdf`, storage_path: path, size_bytes: pdf.length, created_by: actor.id }))
  if (object) ok(await actor.db.storage.from('client-contracts').upload(path, pdf, { contentType: 'application/pdf', upsert: false }))
  if (status === 'failed') ok(await actor.db.rpc('mark_client_contract_document_failed', { p_document_id: id, p_reason: 'CC19 simulated interruption' }))
  if (status === 'ready') ok(await actor.db.rpc('finalize_client_contract_document', { p_document_id: id }))
  return d
}
const row = async (d) => ok(await service.from('client_contract_documents').select('*').eq('id', d.id))
const exists = async (d) => ok(await service.storage.from('client-contracts').list(d.contract, { search: `${d.id}.pdf` })).some((o) => o.name === `${d.id}.pdf`)
async function absent(d) {
  assert.equal((await row(d)).length, 0); assert(!(await exists(d)))
  const metadata = query(`select count(*) as n from storage.objects where bucket_id='client-contracts' and name='${d.path}'`)[0]
  assert.equal(metadata.n, 0)
  const response = await fetch(`${url}/storage/v1/object/authenticated/client-contracts/${d.path}?cc19=${randomUUID()}`, { headers: { apikey: keys.service, Authorization: `Bearer ${keys.service}`, 'Cache-Control': 'no-cache' }, cache: 'no-store' })
  const body = await response.json(); assert([400,404].includes(response.status)); assert.equal(String(body.statusCode), '404')
  const job = ok(await service.from('client_contract_document_discards').select('*').eq('document_id', d.id).single())
  assert.equal(job.state, 'api_absent'); assert(job.api_absence_confirmed_at)
}
try {
  const deployed = JSON.parse(cli(['functions','list','--project-ref',ref,'--output','json'])).find((fn) => fn.slug === 'discard-client-contract-document' || fn.name === 'discard-client-contract-document')
  assert(deployed, 'Hosted function missing'); assert.equal(deployed.verify_jwt, true)
  writeFileSync('artifacts/contracts-19/deployment.json', JSON.stringify({ project: ref, name: deployed.name, id: deployed.id, version: deployed.version, status: deployed.status, verify_jwt: deployed.verify_jwt, deployed_from_package: 'CC18', allowed_origins: [origin] }, null, 2))
  const preflight = query("select jsonb_build_object('users',(select count(*) from auth.users),'clients',(select count(*) from public.clients),'documents',(select count(*) from public.client_contract_documents),'objects',(select count(*) from storage.objects),'migration',(select count(*) from supabase_migrations.schema_migrations where version='20261112134840')) as p")[0].p
  assert.equal(preflight.migration,1); assert.equal(preflight.users,0); assert.equal(preflight.clients,0); assert.equal(preflight.documents,0); assert.equal(preflight.objects,0)
  for (const [role, active] of [['admin',true],['equipe',true],['equipe',true],['equipe',false]]) {
    const email = `cc19-${randomUUID()}@example.invalid`, password = `Cc19!${randomBytes(24).toString('base64url')}`
    const { user } = ok(await service.auth.admin.createUser({ email, password, email_confirm: true }))
    const u = { id: user.id, email, password, db: connect(keys.anon) }; users.push(u)
    ok(await service.from('profiles').update({ role, active }).eq('id', u.id))
    u.token = ok(await u.db.auth.signInWithPassword({ email, password })).session.access_token
  }
  const [admin, a, b, inactive] = users
  clientId = randomUUID()
  ok(await admin.db.from('clients').insert({ id: clientId, legal_name: `CC19 FICTICIO ${run}`, tax_id: '52998224725', client_type: 'individual' }))
  for (let i=0;i<2;i++) { const id=randomUUID();contracts.push(id);ok(await admin.db.from('client_contracts').insert({id,client_id:clientId,contract_number:`CC19-${i}-${run}`,title:'Contrato ficticio CC19',contract_type:'SST',modality:'one_off',starts_at:'2026-11-12'})) }
  const dummy = { id: randomUUID(), contract: contracts[0] }
  await check('OPTIONS real sem bearer: origem explicita, metodos e headers limitados', async () => {
    const r = await request(null, dummy, { method:'OPTIONS', headers:{'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'authorization,apikey,content-type,x-client-info'},apiKey:false })
    assert.equal(r.status,204);assert.equal(r.headers.get('access-control-allow-origin'),origin)
    assert(r.headers.get('vary').split(',').map(s=>s.trim().toLowerCase()).includes('origin'))
    const methods=r.headers.get('access-control-allow-methods').split(',').map(s=>s.trim());assert.deepEqual(methods,['POST','OPTIONS'])
    const allowed=r.headers.get('access-control-allow-headers').split(',').map(s=>s.trim().toLowerCase());assert.deepEqual(allowed,['authorization','apikey','content-type','x-client-info']);assert(!allowed.includes('*'))
  })
  await check('origens arbitrarias, null, dominio produtivo e localhost nao configurado rejeitados', async () => {
    for (const denied of ['https://evil.example','null','https://efetivaos.pages.dev','http://localhost:4185']) {
      // Only this fixture-free rejection matrix may recheck a transport failure.
      // No document has been created yet, and dummy.id is not an existing row.
      // HTTP/status/security assertion failures are never retried or ignored.
      const r=await request(admin,dummy,{requestOrigin:denied,safeTransportRetry:true});assert.equal(r.status,403);assert.equal(r.body.error,'origin_denied');assert.equal(r.headers.get('access-control-allow-origin'),null)
      const pre=await request(null,dummy,{method:'OPTIONS',requestOrigin:denied,apiKey:false,safeTransportRetry:true,headers:{'Access-Control-Request-Method':'POST'}});assert.equal(pre.status,403);assert.equal(pre.headers.get('access-control-allow-origin'),null)
    }
  })
  await check('OPTIONS nao concede headers extras nem metodos destrutivos', async () => {
    const r=await request(null,dummy,{method:'OPTIONS',apiKey:false,headers:{'Access-Control-Request-Method':'DELETE','Access-Control-Request-Headers':'authorization,x-arbitrary-header'}})
    assert.equal(r.status,204);assert(!r.headers.get('access-control-allow-methods').includes('DELETE'));assert(!r.headers.get('access-control-allow-headers').includes('x-arbitrary-header'))
  })
  await check('GET PUT PATCH DELETE autenticados retornam 405', async () => {
    for(const method of ['GET','PUT','PATCH','DELETE']) assert.equal((await request(admin,dummy,{method})).status,405)
  })
  await check('sem token, apikey isolada, anon JWT e JWT forjado nao autenticam usuario', async () => {
    assert.equal((await request(null,dummy,{apiKey:false})).status,401)
    assert.equal((await request(null,dummy)).status,401)
    assert.equal((await request({token:keys.anon},dummy)).status,401)
    assert.equal((await request({token:'invalid-jwt'},dummy)).status,401)
  })
  await check('payload JSON, UUIDs e limite de tamanho validados no runtime hospedado', async () => {
    assert.equal((await request(admin,dummy,{rawBody:'{invalid'})).status,400)
    assert.equal((await request(admin,dummy,{extraBody:{document_id:'not-a-uuid'}})).status,400)
    assert.equal((await request(admin,dummy,{headers:{'Content-Type':'application/octet-stream'}})).status,415)
    assert.equal((await request(admin,dummy,{extraBody:{padding:'x'.repeat(3000)}})).status,413)
  })
  for (const actor of [admin,a]) for (const state of ['pending','failed']) {
    await check(`${actor===admin?'Admin':'Equipe'}: hosted discard ${state}, SQL + API ausencia confirmada`,async()=>{
      const d=await document(actor,{status:state});const r=await request(actor,d)
      assert.equal(r.status,200);assert.equal(r.body.confirmation,'storage_api_absent');assert.equal(r.body.physical_erasure_verified,false);assert.equal(r.headers.get('access-control-allow-origin'),origin);assert.equal(r.headers.get('cache-control'),'no-store');await absent(d)
    })
  }
  await check('documento sem objeto descartado e nao recriado por retry',async()=>{
    const d=await document(a,{object:false});assert.equal((await request(a,d)).status,200);await absent(d);assert.equal((await request(a,d)).status,200);await absent(d)
  })
  await check('inativo bloqueado; outro criador inclusive Admin bloqueado',async()=>{
    const d=await document(a);assert.equal((await request(inactive,d)).status,403)
    for(const u of [b,admin])assert.equal((await request(u,d)).status,404)
    assert(await exists(d));assert.equal((await row(d))[0].discard_started_at,null)
  })
  await check('outro contrato e paths/buckets/atores arbitrarios bloqueados',async()=>{
    const d=await document(a);assert.equal((await request(a,d,{extraBody:{contract_id:contracts[1]}})).status,404)
    for(const key of ['path','bucket','actor','operation_id'])assert.equal((await request(a,d,{extraBody:{[key]:'forged'}})).status,400)
    assert(await exists(d));assert.equal((await row(d))[0].discard_started_at,null)
  })
  await check('ready nao descartavel nem mutavel; bytes e registro preservados',async()=>{
    const d=await document(a,{status:'ready'});const before=sha(Buffer.from(await ok(await service.storage.from('client-contracts').download(d.path)).arrayBuffer()))
    assert.equal((await request(a,d)).status,409);assert.equal((await request(admin,d)).status,404)
    assert((await a.db.from('client_contract_documents').delete().eq('id',d.id)).error)
    assert((await a.db.from('client_contract_documents').update({name:'forged'}).eq('id',d.id)).error)
    assert.equal((await row(d))[0].upload_status,'ready');assert(await exists(d));assert.equal(sha(Buffer.from(await ok(await service.storage.from('client-contracts').download(d.path)).arrayBuffer())),before)
  })
  await check('duplicatas sequenciais e simultaneas convergem em tombstone unico',async()=>{
    const d=await document(a,{status:'failed'});const responses=await Promise.all([request(a,d),request(a,d)]);responses.forEach(r=>assert.equal(r.status,200));assert.equal((await request(a,d)).status,200);await absent(d)
    const j=ok(await service.from('client_contract_document_discards').select('*').eq('document_id',d.id).single());assert.equal(j.attempts,3)
  })
  await check('finalize versus endpoint hospedado preserva ready OU conclui descarte',async()=>{
    for(let i=0;i<4;i++){
      const d=await document(a);const [f,r]=await Promise.all([a.db.rpc('finalize_client_contract_document',{p_document_id:d.id}),request(a,d)])
      if(!f.error){assert.equal(r.status,409);assert.equal((await row(d))[0].upload_status,'ready');assert(await exists(d))}else{assert.equal(r.status,200);await absent(d)}
    }
  })
  await check('upload em andamento versus funcao hospedada nao deixa metadado orfao',async()=>{
    const d=await document(a,{object:false});const [upload,r]=await Promise.all([a.db.storage.from('client-contracts').upload(d.path,pdf,{contentType:'application/pdf'}),request(a,d)]);void upload;assert.equal(r.status,200);await absent(d)
  })
  await check('retomada hospedada apos interrupcao entre Storage e finish SQL',async()=>{
    const d=await document(a);ok(await service.rpc('begin_client_contract_document_discard',{p_actor:a.id,p_contract_id:d.contract,p_document_id:d.id,p_attempt_id:randomUUID()}));ok(await service.storage.from('client-contracts').remove([d.path]));assert.equal((await row(d)).length,1);assert.equal((await request(a,d)).status,200);await absent(d)
  })
  await check('SQL/RLS/ACLs continuam restritos apos deploy',()=>{query(readFileSync('supabase/tests/client_contracts_16_security.sql','utf8'));query(readFileSync('supabase/tests/client_contracts_14_acl.sql','utf8'))})
  // Start local frontend only. Requests to the function use the hosted HTTPS URL.
  e2e=await new Promise((resolve,reject)=>{
    const child=spawn('powershell.exe',['-NoProfile','-Command','& npx playwright test --config playwright.cc19.config.ts; exit $LASTEXITCODE'],{env:{...process.env,VITE_SUPABASE_URL:url,VITE_SUPABASE_ANON_KEY:keys.anon,HML_SERVICE_ROLE_KEY:keys.service,CC19_FIXTURE:JSON.stringify({clientId,users:users.map(({id,email,password})=>({id,email,password}))})}})
    child.stdout.on('data',d=>process.stdout.write(d));child.stderr.on('data',d=>process.stderr.write(d));child.on('error',reject);child.on('close',resolve)
  })
}catch(error){results.push({name:'orchestration',status:'FAIL',error:error.message});console.error(`ORCHESTRATION_FAIL ${error.message}`)}
finally{
  try{
    const ids=clientId?ok(await service.from('client_contracts').select('id').eq('client_id',clientId)).map(c=>c.id):[]
    const remaining=ids.length?ok(await service.from('client_contract_documents').select('storage_path').in('contract_id',ids)):[]
    const jobs=ids.length?ok(await service.from('client_contract_document_discards').select('document_id,storage_path').in('contract_id',ids)):[]
    const paths=[...new Set([...docs.map(d=>d.path),...remaining.map(d=>d.storage_path),...jobs.map(d=>d.storage_path)])]
    if(paths.length)ok(await service.storage.from('client-contracts').remove(paths))
    if(jobs.length){ok(await service.from('client_contract_document_discard_attempts').delete().in('document_id',jobs.map(j=>j.document_id)));ok(await service.from('client_contract_document_discards').delete().in('document_id',jobs.map(j=>j.document_id)))}
    if(ids.length){ok(await service.from('client_contract_documents').delete().in('contract_id',ids));ok(await service.from('client_contract_events').delete().in('contract_id',ids));ok(await service.from('client_contracts').delete().in('id',ids))}
    if(clientId)ok(await service.from('clients').delete().eq('id',clientId))
    for(const u of users){await service.auth.admin.signOut(u.token,'global');ok(await service.auth.admin.deleteUser(u.id))}
    const postflight=query("select jsonb_build_object('users',(select count(*) from auth.users),'profiles',(select count(*) from public.profiles),'clients',(select count(*) from public.clients),'contracts',(select count(*) from public.client_contracts),'documents',(select count(*) from public.client_contract_documents),'events',(select count(*) from public.client_contract_events),'objects',(select count(*) from storage.objects),'discards',(select count(*) from public.client_contract_document_discards),'attempts',(select count(*) from public.client_contract_document_discard_attempts),'orphan_contract_objects',(select count(*) from storage.objects o where o.bucket_id='client-contracts' and not exists(select 1 from public.client_contract_documents d where d.storage_bucket=o.bucket_id and d.storage_path=o.name))) as counts")[0].counts
    assert(Object.values(postflight).every(v=>v===0));cleanup=true;writeFileSync('artifacts/contracts-19/postflight.json',JSON.stringify(postflight,null,2));console.log(`CLEANUP_PASS ${JSON.stringify(postflight)}`)
  }catch(error){results.push({name:'cleanup',status:'FAIL',error:error.message});console.error(`CLEANUP_FAIL ${error.message}`)}
  writeFileSync('artifacts/contracts-19/runtime.json',JSON.stringify({project:ref,endpoint,run,timestamp:new Date().toISOString(),hosted:true,local_proxy:false,results,exchanges,transportFailures,e2e,cleanup,physical_erasure_verified:false},null,2))
  function sanitize(dir){for(const entry of readdirSync(dir,{withFileTypes:true})){const file=`${dir}/${entry.name}`;if(entry.isDirectory())sanitize(file);else if(/\.(json|md)$/.test(file)){let text=readFileSync(file,'utf8').replace(/Cc19![A-Za-z0-9_-]+/g,'[REDACTED_TEMPORARY_PASSWORD]');for(const secret of [keys.service,keys.anon,...users.flatMap(u=>[u.password,u.token])])if(secret)text=text.replaceAll(secret,'[REDACTED]');writeFileSync(file,text)}}}
  sanitize('artifacts/contracts-19');console.log(`HOSTED_CHECKS=${results.filter(r=>r.status==='PASS').length}/${results.length}; E2E_EXIT=${e2e}; CLEANUP=${cleanup}`)
}
if(results.some(r=>r.status==='FAIL')||e2e!==0||!cleanup)process.exitCode=1
