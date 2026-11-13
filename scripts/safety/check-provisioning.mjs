import { inspectProvisioningTree } from './provisioning-policy.mjs'

// Offline preflight only: never spawn Supabase/psql, connect, or execute SQL.
try {
  if (process.argv.length !== 2) throw new Error('Argumentos/overrides nao permitidos; esta verificacao e somente offline.')
  const result = inspectProvisioningTree(process.env)
  console.log(JSON.stringify(result))
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
}
