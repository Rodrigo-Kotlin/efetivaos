import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { assertDisposableTarget, denyLegacyOperation, PRODUCTION_PROJECT_REF } from './operational-policy.mjs'
import { assertMigrationPlanSafe, inspectProvisioningTree, normalizeContent, sqlFingerprint } from './provisioning-policy.mjs'

const root = new URL('../../', import.meta.url)
const manifest = JSON.parse(readFileSync(new URL('supabase/quarantine/legacy-operations.json', root), 'utf8'))
const read = path => readFileSync(new URL(path, root), 'utf8')
const digest = source => createHash('sha256').update(normalizeContent(source)).digest('hex')
const disposableRef = 'abcdefghijklmnopqrst'
const disposableEnv = () => ({
  EFETIVAOS_TARGET_PROJECT_REF: disposableRef,
  EFETIVAOS_TARGET_SUPABASE_URL: `https://${disposableRef}.supabase.co`,
  EFETIVAOS_DISPOSABLE_CONFIRMATION: `DISPOSABLE:${disposableRef}`,
})
const code = expected => error => error.code === expected

test('default environment denies without consulting ambient selectors', () => {
  assert.throws(() => assertDisposableTarget(), code('PROJECT_REF_REQUIRED'))
  assert.throws(() => assertDisposableTarget({ SUPABASE_PROJECT_REF: disposableRef }), code('PROJECT_REF_REQUIRED'))
  assert.throws(() => assertDisposableTarget(null), code('INVALID_ENVIRONMENT'))
})

for (const ref of [PRODUCTION_PROJECT_REF, PRODUCTION_PROJECT_REF.toUpperCase(), ` ${PRODUCTION_PROJECT_REF} `]) {
  test(`production is unconditionally forbidden: ${JSON.stringify(ref)}`, () => {
    assert.throws(() => denyLegacyOperation('march-2026-runtime-test', {
      ...disposableEnv(), EFETIVAOS_TARGET_PROJECT_REF: ref,
      ALLOW_PRODUCTION: 'true', FORCE: 'true',
    }), code('PRODUCTION_FORBIDDEN'))
  })
}

for (const marker of ['CI', 'GITHUB_ACTIONS', 'GITLAB_CI', 'TF_BUILD', 'JENKINS_URL', 'BUILD_BUILDID', 'TEAMCITY_VERSION', 'CIRCLECI', 'TRAVIS', 'BUILDKITE']) {
  test(`${marker} presence blocks automatic execution even when false/empty`, () => {
    for (const value of ['', 'false', '0', 'true']) {
      assert.throws(() => assertDisposableTarget({ ...disposableEnv(), [marker]: value }), code('CI_FORBIDDEN'))
    }
  })
}

test('Project Ref rejects URLs, whitespace and shell arguments', () => {
  for (const ref of ['abc', `https://${disposableRef}.supabase.co`, `${disposableRef};reset`, ` ${disposableRef}`]) {
    assert.throws(() => assertDisposableTarget({ ...disposableEnv(), EFETIVAOS_TARGET_PROJECT_REF: ref }), code('PROJECT_REF_INVALID'))
  }
})

test('explicit URL must match exactly, without userinfo or another target', () => {
  for (const url of [undefined, '', `https://${PRODUCTION_PROJECT_REF}.supabase.co`, `https://${disposableRef}.supabase.co@evil.invalid`]) {
    assert.throws(() => assertDisposableTarget({ ...disposableEnv(), EFETIVAOS_TARGET_SUPABASE_URL: url }), code('TARGET_URL_MISMATCH'))
  }
})

test('inherited ref and URL conflicts fail closed', () => {
  for (const key of ['SUPABASE_PROJECT_REF', 'E2E_PROJECT_REF', 'HML_EXPECTED_PROJECT_REF']) {
    assert.throws(() => assertDisposableTarget({ ...disposableEnv(), [key]: PRODUCTION_PROJECT_REF }), code('CONFLICTING_TARGET'))
  }
  for (const key of ['SUPABASE_URL', 'VITE_SUPABASE_URL', 'HML_SUPABASE_URL']) {
    assert.throws(() => assertDisposableTarget({ ...disposableEnv(), [key]: `https://${PRODUCTION_PROJECT_REF}.supabase.co` }), code('CONFLICTING_TARGET'))
  }
})

test('disposable declaration is mandatory and bound to the exact ref', () => {
  for (const confirmation of [undefined, 'true', `DISPOSABLE:${PRODUCTION_PROJECT_REF}`]) {
    assert.throws(() => assertDisposableTarget({ ...disposableEnv(), EFETIVAOS_DISPOSABLE_CONFIRMATION: confirmation }), code('DISPOSABLE_CONFIRMATION_REQUIRED'))
  }
  assert.equal(assertDisposableTarget(disposableEnv()), disposableRef)
})

test('all legacy operations remain disabled after valid disposable declarations', () => {
  for (const operation of ['march-2026-runtime-test', 'reset-operational-data']) {
    assert.throws(() => denyLegacyOperation(operation, disposableEnv()), code('LEGACY_OPERATION_DISABLED'))
  }
})

test('production and CI are rejected before any plan reader/connection adapter can run', () => {
  let called = false
  const forbiddenAdapter = () => { called = true; throw new Error('must never be reached') }
  for (const env of [{}, { ...disposableEnv(), CI: 'true' }, { ...disposableEnv(), EFETIVAOS_TARGET_PROJECT_REF: PRODUCTION_PROJECT_REF }]) {
    assert.throws(() => inspectProvisioningTree(env, forbiddenAdapter))
    assert.equal(called, false)
  }
})

function archive(path) {
  const source = read(path)
  const begin = '/* EFETIVAOS_LEGACY_ARCHIVE_BEGIN\n'
  const end = 'EFETIVAOS_LEGACY_ARCHIVE_END */'
  assert.equal(source.split(begin).length, 2)
  const [active, archived] = source.split(begin)
  assert.equal(archived.split(end).length, 2)
  const [original, after] = archived.split(end)
  assert.equal(after.trim(), '')
  assert.doesNotMatch(original, /\/\*|\*\//, 'historical body cannot break out of quarantine')
  return { active, original }
}

for (const entry of manifest.legacyEntrypoints) {
  test(`quarantine preserves the original source without an executable suffix: ${entry.path}`, () => {
    const { original } = archive(entry.path)
    assert.equal(digest(original), entry.originalNormalizedSha256)
  })
}

test('March wrapper has only a policy import and unconditional deny, never executed in this test', () => {
  const { active } = archive('scripts/finance/run-march-2026-runtime-test.mjs')
  const codeOnly = active.replace(/^\/\/[^\n]*$/gm, '').trim()
  assert.equal(codeOnly, "import { denyLegacyOperation } from '../safety/operational-policy.mjs'\n\ndenyLegacyOperation('march-2026-runtime-test', process.env)")
  assert.doesNotMatch(active, /execFile|spawn|fetch\(|writeFile|createClient|--linked/)
})

test('manual SQL entrypoint contains only a denial, including for clients continuing after errors', () => {
  const { active } = archive('supabase/scripts/reset_operational_data.sql')
  const codeOnly = active.replace(/^--[^\n]*$/gm, '').trim()
  assert.equal(codeOnly, [
    'DO $cleanup02_block$', 'BEGIN', '  RAISE EXCEPTION USING', "    ERRCODE = '42501',",
    "    MESSAGE = 'LEGACY_RESET_DISABLED: reset proibido, inclusive em bxviuzluxcijbqqbpyzb; exige novo gate e implementacao revisada.';",
    'END;', '$cleanup02_block$;',
  ].join('\n'))
  assert.doesNotMatch(codeOnly, /DELETE\s+FROM|TRUNCATE|DISABLE\s+TRIGGER|COMMIT\s*;/i)
})

for (const entry of manifest.historicalMigrations) {
  test(`applied migration preserved byte-for-byte: ${entry.path}`, () => {
    assert.equal(digest(read(entry.path)), entry.normalizedSha256)
  })
  test(`provisioning refuses historical name even with a replaced body: ${entry.path}`, () => {
    for (const path of [entry.path.replaceAll('/', '\\'), entry.path.toUpperCase()]) {
      assert.throws(() => assertMigrationPlanSafe([{ path, source: 'SELECT 1;' }]), code('HISTORICAL_MIGRATION_REPLAY_FORBIDDEN'))
    }
  })
  test(`provisioning refuses renamed historical contents and CRLF copies: ${entry.path}`, () => {
    const original = read(entry.path)
    const lf = normalizeContent(original)
    const crlf = lf.replace(/\n/g, '\r\n')
    for (const source of [original, crlf, '\uFEFF' + crlf, lf.replace(/\n/g, '\r')]) {
      assert.throws(() => assertMigrationPlanSafe([{ path: 'renamed.sql', source }]), code('HISTORICAL_MIGRATION_REPLAY_FORBIDDEN'))
      assert.equal(sqlFingerprint(source), entry.normalizedSha256)
    }
  })
}

test('fingerprint is independent of the checkout line endings', () => {
  const lf = 'BEGIN;\nSELECT 1;\n'
  const crlf = lf.replace(/\n/g, '\r\n')
  const cr = lf.replace(/\n/g, '\r')
  assert.equal(sqlFingerprint(lf), sqlFingerprint(crlf))
  assert.equal(sqlFingerprint(lf), sqlFingerprint(cr))
  assert.equal(sqlFingerprint('\uFEFF' + lf), sqlFingerprint(lf))
  assert.notEqual(sqlFingerprint(lf), sqlFingerprint('BEGIN;\nSELECT 2;\n'))
})

test('absent, empty and malformed plans are refused', () => {
  for (const plan of [undefined, []]) assert.throws(() => assertMigrationPlanSafe(plan), code('EMPTY_PROVISIONING_PLAN'))
  for (const file of [null, {}, { path: 'foo.sql' }, { path: '', source: 'SELECT 1;' }, { path: 'foo.sql', source: '' }]) {
    assert.throws(() => assertMigrationPlanSafe([file]), code('INVALID_PROVISIONING_PLAN'))
  }
})

test('the actual full migration tree is blocked offline even for a declared disposable target', () => {
  assert.throws(() => inspectProvisioningTree(disposableEnv()), code('HISTORICAL_MIGRATION_REPLAY_FORBIDDEN'))
})

test('a content-only pass never claims SQL execution or grants authorization', () => {
  const result = inspectProvisioningTree(disposableEnv(), () => [{ path: 'future-reviewed.sql', source: 'SELECT 1;' }])
  assert.deepEqual(result, { projectRef: disposableRef, filesChecked: 1, sqlExecuted: false, authorizationGranted: false })
})

test('safety modules contain no SQL/SDK execution adapter', () => {
  for (const file of ['operational-policy.mjs', 'provisioning-policy.mjs', 'check-provisioning.mjs']) {
    const source = read(`scripts/safety/${file}`)
    assert.doesNotMatch(source, /from ['"](?:node:child_process|node:https?|@supabase\/)|\b(?:execFileSync|spawnSync|writeFileSync|fetch|createClient)\s*\(/)
  }
})
