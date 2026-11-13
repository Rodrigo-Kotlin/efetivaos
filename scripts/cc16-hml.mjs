import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { query, cli, ref } from './cc15-hml.mjs'

export const migration = '20261112134840_control_client_contract_document_discard.sql'
if (process.argv[2] === 'apply') {
  assert.equal(process.env.CC16_AUTHORIZATION, ref)
  const source = readFileSync(`supabase/migrations/${migration}`, 'utf8')
  const version = migration.slice(0, 14)
  const old = query(`select statements from supabase_migrations.schema_migrations where version='${version}'`)
  if (old.length) assert.equal(old[0].statements[0], source, 'Applied migration drift')
  else {
    const body = source.replace(/^begin;\s*$/gmi, '').replace(/^commit;\s*$/gmi, '')
    query(`begin; ${body}\ninsert into supabase_migrations.schema_migrations(version,name,statements) values('${version}','control_client_contract_document_discard',array[$cc16_source$${source}$cc16_source$]); commit; select true as applied;`)
  }
  mkdirSync('artifacts/contracts-16', { recursive: true })
  writeFileSync('artifacts/contracts-16/migration.json', JSON.stringify({ project: ref, migration, sha256: createHash('sha256').update(source).digest('hex'), applied: true }, null, 2))
  console.log(`APPLIED ${migration} ON ${ref}`)
} else if (process.argv[2] === 'preflight') {
  mkdirSync('artifacts/contracts-16', { recursive: true })
  const advisors = cli(['db','advisors','--workdir','C:/Users/1cori/AppData/Local/Temp/opencode/efetivaos-cc15','--linked','--type','all','--level','warn','--output','json'])
  writeFileSync('artifacts/contracts-16/advisors-before.json', advisors)
  const state = query(`begin read only; select jsonb_build_object('documents',(select count(*) from public.client_contract_documents),'objects',(select count(*) from storage.objects),'users',(select count(*) from auth.users),'buckets',(select jsonb_agg(jsonb_build_object('id',id,'versioning_status',versioning_status,'public',public)) from storage.buckets),'policies',(select jsonb_agg(jsonb_build_object('table',tablename,'name',policyname,'cmd',cmd,'qual',qual,'check',with_check)) from pg_policies where (schemaname='storage' and tablename='objects') or tablename='client_contract_documents')) as preflight; rollback;`)
  writeFileSync('artifacts/contracts-16/preflight.json', JSON.stringify(state, null, 2))
  console.log(JSON.stringify(state))
} else throw new Error('Expected preflight or apply')
