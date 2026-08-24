import process from 'node:process'

const optionalEnvFiles = ['.env.local', '.env.test.local']

export function loadE2EEnv() {
  for (const path of optionalEnvFiles) {
    try {
      process.loadEnvFile(path)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
  }
}

export function requiredEnv(name: string) {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required E2E environment variable: ${name}`)
  return value
}

export function assertRemoteMutationAllowed() {
  if (requiredEnv('E2E_ALLOW_REMOTE_MUTATION') !== 'true') {
    throw new Error("E2E_ALLOW_REMOTE_MUTATION must be exactly 'true' before E2E database mutation")
  }

  const projectRef = requiredEnv('E2E_PROJECT_REF')
  const supabaseUrl = new URL(requiredEnv('VITE_SUPABASE_URL'))

  if (supabaseUrl.protocol !== 'https:' || supabaseUrl.hostname !== `${projectRef}.supabase.co`) {
    throw new Error('E2E_PROJECT_REF does not exactly match the VITE_SUPABASE_URL project host')
  }
}
