// Hard target: never falls back to the repository's linked project or .env files.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import path from 'node:path'

export const ref = 'xktbqykxmfuuzepfnjns'
export const workdir = 'C:/Users/1cori/AppData/Local/Temp/opencode/efetivaos-cc15'
export const url = `https://${ref}.supabase.co`
export function cli(args) {
  assert.equal(readFileSync(`${workdir}/supabase/.temp/project-ref`, 'utf8').trim(), ref)
  const quote = (s) => `'${s.replaceAll("'", "''")}'`
  return execFileSync('powershell.exe', ['-NoProfile', '-Command', `& supabase ${args.map(quote).join(' ')}; exit $LASTEXITCODE`], { encoding: 'utf8', timeout: 180000, maxBuffer: 8 * 1024 * 1024 })
}
export function query(sql) {
  const file = `${workdir}/query.sql`
  writeFileSync(file, sql, 'utf8')
  const result = JSON.parse(cli(['db', 'query', '--workdir', workdir, '--linked', '--file', file, '--output', 'json']))
  return result.rows ?? result
}
export function credentials() {
  const result = JSON.parse(cli(['projects', 'api-keys', '--project-ref', ref, '--output', 'json']))
  const keys = Array.isArray(result) ? result : result.api_keys
  const anon = keys.find((k) => k.name === 'anon')?.api_key
  const service = keys.find((k) => k.name === 'service_role')?.api_key
  assert(anon && service, 'HML legacy API keys not available')
  // Do not log or persist these values.
  return { anon, service }
}
export const base = [
  '20260823000100_create_profiles_and_roles.sql',
  '20260823000200_create_pricing_schema.sql',
  '20260824000130_fix_is_admin_null_authorization.sql',
  '20260824000200_create_crm_light_schema.sql',
  '20261110000100_create_client_contracts.sql',
  '20261110000200_fix_client_contract_storage_policies.sql',
  '20261111000300_secure_client_contract_event_rpc.sql',
]
export const target = '20261111000400_harden_client_contract_document_upload.sql'
export function apply(files) {
  query('create schema if not exists supabase_migrations; create table if not exists supabase_migrations.schema_migrations (version text primary key, statements text[], name text); select 1 as migration_ledger_ready;')
  for (const file of files) {
    assert([...base, target].includes(file), 'Migration not allowlisted')
    const version = file.split('_')[0]
    const source = readFileSync(path.resolve('supabase/migrations', file), 'utf8')
    const hash = createHash('sha256').update(source).digest('hex')
    const exists = query(`select version, statements from supabase_migrations.schema_migrations where version = '${version}'`)
    if (exists.length) {
      assert.equal(exists[0].statements?.[0], source, 'Applied migration source drift')
      console.log(`ALREADY_APPLIED ${file} sha256=${hash}`)
      continue
    }
    // Rewrap outer transaction only; function bodies are unchanged.
    const body = source.replace(/^begin;\s*$/gmi, '').replace(/^commit;\s*$/gmi, '')
    const tag = `$source_${hash.slice(0, 12)}$`
    query(`begin; ${body}\ninsert into supabase_migrations.schema_migrations(version, name, statements) values ('${version}', '${file.slice(15, -4)}', array[${tag}${source}${tag}]); commit; select '${version}' as applied;`)
    console.log(`APPLIED ${file} sha256=${hash}`)
  }
}
if (process.argv[1]?.endsWith('cc15-hml.mjs')) {
  if (process.argv[2] === 'bootstrap') apply(base)
  else if (process.argv[2] === 'target') apply([target])
  else if (process.argv[2] === 'sql') {
    const file = process.argv[3]
    assert(file?.startsWith('supabase/tests/client_contracts'), 'Only contract SQL tests allowed')
    console.log(JSON.stringify(query(readFileSync(file, 'utf8'))))
  } else throw new Error('Expected bootstrap, target or sql <contract-test-file>')
}
