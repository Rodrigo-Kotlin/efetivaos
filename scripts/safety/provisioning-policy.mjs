import { createHash } from 'node:crypto'
import { lstatSync, readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { assertDisposableTarget, OperationBlockedError } from './operational-policy.mjs'

const repositoryRoot = new URL('../../', import.meta.url)
const quarantine = JSON.parse(readFileSync(new URL('supabase/quarantine/legacy-operations.json', repositoryRoot), 'utf8'))

/**
 * Canonical, line-ending independent fingerprint.
 *
 * The repository is checked out with different line endings depending on the
 * platform and on `core.autocrlf`. A fingerprint over raw bytes would therefore
 * only match the exact byte sequence recorded from one checkout, and a renamed
 * copy of a quarantined migration could escape detection. Normalising CRLF and
 * lone CR to LF (and stripping a leading BOM) makes the fingerprint describe the
 * content instead of the checkout.
 */
export function normalizeContent(source) {
  return source.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
}

export function sqlFingerprint(source) {
  return createHash('sha256').update(normalizeContent(source), 'utf8').digest('hex')
}

// A passed content check is not permission to provision. No execution adapter
// exists here. Match names AND contents so renaming a historical file is denied.
export function assertMigrationPlanSafe(files) {
  if (!Array.isArray(files) || files.length === 0) {
    throw new OperationBlockedError('EMPTY_PROVISIONING_PLAN', 'Plano vazio ou ausente; negado por padrao.')
  }
  for (const file of files) {
    if (!file || typeof file.path !== 'string' || !file.path.trim() || typeof file.source !== 'string' || !file.source.trim()) {
      throw new OperationBlockedError('INVALID_PROVISIONING_PLAN', 'Plano deve conter caminho e conteudo SQL verificavel.')
    }
    const name = file.path.replace(/\\/g, '/').split('/').pop().toLowerCase()
    const fingerprint = sqlFingerprint(file.source)
    if (quarantine.historicalMigrations.some(entry =>
      entry.path.split('/').pop().toLowerCase() === name || entry.normalizedSha256 === fingerprint)) {
      throw new OperationBlockedError('HISTORICAL_MIGRATION_REPLAY_FORBIDDEN', 'Plano inclui migration historica em quarentena. Nao aplicar, filtrar silenciosamente ou reparar o ledger.')
    }
  }
}

export function readMigrationPlan() {
  const files = []
  function visit(directory) {
    if (lstatSync(directory).isSymbolicLink()) {
      throw new OperationBlockedError('SYMLINK_FORBIDDEN', 'Diretorio de migrations nao pode redirecionar para outra arvore.')
    }
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const child = new URL(encodeURIComponent(entry.name) + (entry.isDirectory() ? '/' : ''), directory)
      if (entry.isSymbolicLink()) {
        throw new OperationBlockedError('SYMLINK_FORBIDDEN', 'Links de migrations nao sao aceitos no plano.')
      }
      if (entry.isDirectory()) visit(child)
      else if (entry.name.toLowerCase().endsWith('.sql')) files.push({ path: fileURLToPath(child), source: readFileSync(child, 'utf8') })
    }
  }
  visit(new URL('supabase/migrations/', repositoryRoot))
  return files
}

export function inspectProvisioningTree(env = {}, readPlan = readMigrationPlan) {
  const projectRef = assertDisposableTarget(env)
  const files = readPlan()
  assertMigrationPlanSafe(files)
  return { projectRef, filesChecked: files.length, sqlExecuted: false, authorizationGranted: false }
}
