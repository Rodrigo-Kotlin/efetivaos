// Local synthetic files only. No Supabase/session or deployed application access.
import assert from 'node:assert/strict'
import{readFileSync,writeFileSync,mkdirSync}from'node:fs'
import path from'node:path'
import{build,preview}from'vite'
import{chromium}from'@playwright/test'
import * as XLSX from'xlsx'

const out=process.env.CC22_EVIDENCE_DIR
assert(out&&path.isAbsolute(out),'Explicit local evidence directory required')
mkdirSync(out,{recursive:true})
const dist='C:/Users/1cori/AppData/Local/Temp/opencode/efetivaos-cc22-browser-dist'
await build({configFile:false,root:process.cwd(),logLevel:'warn',build:{outDir:dist,emptyOutDir:false,rollupOptions:{input:'e2e/importer-22.html'}}})
const server=await preview({configFile:false,root:process.cwd(),build:{outDir:dist},preview:{host:'127.0.0.1',port:4192,strictPort:true}})
const browser=await chromium.launch({headless:true}),results=[],external=[],workers=[]
const page=await browser.newPage()
page.on('worker',worker=>workers.push(worker.url()))
await page.route('**/*',async route=>{const url=new URL(route.request().url());if(url.origin!=='http://127.0.0.1:4192'){external.push(url.origin);await route.abort()}else await route.continue()})
async function check(name,fn){try{await fn();results.push({name,status:'PASS'})}catch(error){results.push({name,status:'FAIL',error:error.message})}}
try{
 await page.goto('http://127.0.0.1:4192/e2e/importer-22.html')
 await page.waitForFunction(()=>Boolean(window.CC22))
 async function parse(bytes,name){return page.evaluate(async({base64,name})=>{
  const bytes=Uint8Array.from(atob(base64),c=>c.charCodeAt(0))
  try{const result=await window.CC22.parseFile(new File([bytes],name));const preview=window.CC22.generatePreview(result.headers,result.rows,window.CC22.guessColumnMapping(result.headers),'CC22-local-only');return{result,preview}}
  catch(error){return{error:error.message}}
 },{base64:Buffer.from(bytes).toString('base64'),name})}
 for(const extension of['xls','xlsx','biff5'])await check(`real emitted worker imports legacy ${extension} without financial drift`,async()=>{const file=extension==='biff5'?'e2e/fixtures/finance-cc22-legacy-biff5.xls':`e2e/fixtures/finance-cc22-legacy.${extension}`;const r=await parse(readFileSync(file),'fixture.'+(extension==='biff5'?'xls':extension));assert(!r.error,r.error);assert.equal(r.result.rows[0].Valor,1234.56);assert.equal(r.preview.rows[0].mapped.transaction_date,'2026-01-01');assert.equal(r.preview.rows[0].valid,true);if(extension!=='biff5')assert.equal(r.preview.rows[1].valid,false)})
 await check('CSV preserves BRL and rejects dangerous properties through real worker',async()=>{const r=await parse(Buffer.from('Data;Descrição;Valor;Tipo\n01/01/2026;CC22;1.234,56;AJUSTE'),'fixture.csv');assert(!r.error,r.error);assert.equal(r.preview.rows[0].mapped.amount,1234.56);const bad=await parse(Buffer.from('__proto__;Valor\npolluted;1'),'hostile.csv');assert.match(bad.error,/Cabeçalho inseguro/);assert.equal(await page.evaluate(()=>Object.prototype.polluted),undefined)})
 await check('corrupt workbook rejects and subsequent valid import succeeds',async()=>{assert.match((await parse(Buffer.from([1,2,3]),'corrupt.xlsx')).error,/inválido ou corrompido/);assert(!(await parse(Buffer.from('Valor\n1'),'retry.csv')).error)})
 await check('bounded 10000-row import keeps main thread responsive',async()=>{const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([['Data','Descrição','Valor','Tipo'],...Array.from({length:10000},()=>[46023,'CC22 local',10,'AJUSTE'])]),'Dados');const buffer=XLSX.write(wb,{type:'buffer',bookType:'xlsx',compression:true});await page.evaluate(()=>{window.CC22Ticks=0;window.CC22Timer=setInterval(()=>window.CC22Ticks++,5)});const r=await parse(buffer,'maximum.xlsx');const ticks=await page.evaluate(()=>{clearInterval(window.CC22Timer);return window.CC22Ticks});assert(!r.error,r.error);assert.equal(r.result.rows.length,10000);assert(ticks>0,'Main thread did not tick during parsing')})
 await check('no nonlocal requests and workers are emitted assets',async()=>{assert.deepEqual(external,[]);assert(workers.length>=8);assert(workers.every(url=>url.includes('/assets/import-file.worker-')&&url.endsWith('.js')))})
}finally{await browser.close();await new Promise(resolve=>server.httpServer.close(resolve));writeFileSync(path.join(out,'browser-security.json'),JSON.stringify({results,workers:workers.length,externalRequests:external,remoteDataAccess:false},null,2))}
console.log(JSON.stringify({browserChecks:results.filter(r=>r.status==='PASS').length,total:results.length,results},null,2))
if(results.some(r=>r.status!=='PASS'))process.exitCode=1
