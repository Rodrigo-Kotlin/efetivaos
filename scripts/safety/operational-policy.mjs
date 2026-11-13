export const PRODUCTION_PROJECT_REF = 'bxviuzluxcijbqqbpyzb'

const CI_MARKERS = [
  'CI', 'GITHUB_ACTIONS', 'GITLAB_CI', 'TF_BUILD', 'JENKINS_URL',
  'BUILD_BUILDID', 'TEAMCITY_VERSION', 'CIRCLECI', 'TRAVIS', 'BUILDKITE',
]

export class OperationBlockedError extends Error {
  constructor(code, message) {
    super(`${code}: ${message}`)
    this.name = 'OperationBlockedError'
    this.code = code
  }
}

function blocked(code, message) {
  throw new OperationBlockedError(code, message)
}

// Pure preconditions, not proof that a remote database is disposable and not
// authorization to connect. There is deliberately no production override.
export function assertDisposableTarget(env = {}) {
  if (!env || typeof env !== 'object' || Array.isArray(env)) {
    blocked('INVALID_ENVIRONMENT', 'Ambiente explicito invalido; negado por padrao.')
  }
  if (CI_MARKERS.some(marker => marker in env)) {
    blocked('CI_FORBIDDEN', 'Operacoes legadas/provisionamento proibidas em CI, inclusive com CI=false.')
  }

  const ref = env.EFETIVAOS_TARGET_PROJECT_REF
  if (typeof ref !== 'string' || !ref) {
    blocked('PROJECT_REF_REQUIRED', 'Informe explicitamente EFETIVAOS_TARGET_PROJECT_REF; --linked nao e permitido.')
  }
  if (ref.trim().toLowerCase() === PRODUCTION_PROJECT_REF) {
    blocked('PRODUCTION_FORBIDDEN', 'Operacao proibida no projeto publicado do EfetivaOS, sem bypass.')
  }
  if (!/^[a-z]{20}$/.test(ref)) {
    blocked('PROJECT_REF_INVALID', 'Project Ref deve conter exatamente 20 letras minusculas, sem URL ou argumentos.')
  }

  const expectedUrl = `https://${ref}.supabase.co`
  if (env.EFETIVAOS_TARGET_SUPABASE_URL !== expectedUrl) {
    blocked('TARGET_URL_MISMATCH', 'EFETIVAOS_TARGET_SUPABASE_URL deve corresponder exatamente ao Project Ref explicito.')
  }
  for (const key of ['SUPABASE_PROJECT_REF', 'E2E_PROJECT_REF', 'HML_EXPECTED_PROJECT_REF']) {
    if (key in env && env[key] !== ref) {
      blocked('CONFLICTING_TARGET', 'Seletor de projeto herdado diverge do destino explicito; nenhuma conexao permitida.')
    }
  }
  for (const key of ['SUPABASE_URL', 'VITE_SUPABASE_URL', 'HML_SUPABASE_URL']) {
    if (key in env && env[key] !== expectedUrl) {
      blocked('CONFLICTING_TARGET', 'URL herdada diverge do destino explicito; nenhuma conexao permitida.')
    }
  }
  if (env.EFETIVAOS_DISPOSABLE_CONFIRMATION !== `DISPOSABLE:${ref}`) {
    blocked('DISPOSABLE_CONFIRMATION_REQUIRED', 'Exige declaracao explicita DISPOSABLE:<Project Ref>; nao autoriza executar SQL.')
  }
  return ref
}

export function denyLegacyOperation(operation, env = {}) {
  assertDisposableTarget(env)
  blocked('LEGACY_OPERATION_DISABLED', `${operation}: rotina aposentada mesmo em ambiente declarado descartavel. Exige novo gate e nova implementacao revisada.`)
}
