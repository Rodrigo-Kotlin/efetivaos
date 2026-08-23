import { randomBytes } from 'node:crypto'
import { writeFile } from 'node:fs/promises'

import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL
const anonKey = process.env.SUPABASE_ANON_KEY
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !anonKey || !serviceRoleKey) {
  throw new Error('SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are required')
}

const adminEmail = 'admin.sprint0@example.com'
const teamEmail = 'equipe.sprint0@example.com'
const adminPassword = `Aa1!${randomBytes(18).toString('base64url')}`
const teamPassword = `Aa1!${randomBytes(18).toString('base64url')}`
const service = createClient(url, serviceRoleKey, { auth: { persistSession: false } })

const { data: existing, error: listError } = await service.auth.admin.listUsers({ perPage: 1000 })
if (listError) throw listError

for (const user of existing.users.filter((item) => [adminEmail, teamEmail].includes(item.email))) {
  const { error } = await service.auth.admin.deleteUser(user.id)
  if (error) throw error
}

async function createUser(email, password, fullName) {
  const { data, error } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  })
  if (error) throw error
  return data.user
}

const adminUser = await createUser(adminEmail, adminPassword, 'Admin Sprint 0')
const teamUser = await createUser(teamEmail, teamPassword, 'Equipe Sprint 0')

const { error: roleError } = await service.from('profiles').update({ role: 'admin' }).eq('id', adminUser.id)
if (roleError) throw roleError

const memory = new Map()
const storage = {
  getItem: (key) => memory.get(key) ?? null,
  setItem: (key, value) => memory.set(key, value),
  removeItem: (key) => memory.delete(key),
}

const admin = createClient(url, anonKey, { auth: { persistSession: true, storage } })
const team = createClient(url, anonKey, { auth: { persistSession: false } })
const anonymous = createClient(url, anonKey, { auth: { persistSession: false } })

const invalidLogin = await anonymous.auth.signInWithPassword({ email: adminEmail, password: 'invalid-password' })
if (!invalidLogin.error) throw new Error('Invalid login was accepted')

const adminLogin = await admin.auth.signInWithPassword({ email: adminEmail, password: adminPassword })
if (adminLogin.error) throw adminLogin.error

const restoredClient = createClient(url, anonKey, { auth: { persistSession: true, storage } })
const restored = await restoredClient.auth.getSession()
if (restored.data.session?.user.id !== adminUser.id) throw new Error('Session was not restored')

const adminProfiles = await admin.from('profiles').select('id, role')
if (adminProfiles.error || adminProfiles.data.length < 2) throw adminProfiles.error ?? new Error('Admin cannot list profiles')
const allowedRoleChange = await admin.rpc('set_user_role', { target_user_id: teamUser.id, new_role: 'equipe' })
if (allowedRoleChange.error) throw allowedRoleChange.error

const teamLogin = await team.auth.signInWithPassword({ email: teamEmail, password: teamPassword })
if (teamLogin.error) throw teamLogin.error
const teamProfiles = await team.from('profiles').select('id, role')
if (teamProfiles.error || teamProfiles.data.length !== 1 || teamProfiles.data[0].id !== teamUser.id) {
  throw teamProfiles.error ?? new Error('Equipe can access profiles outside its own row')
}

const forbiddenRoleChange = await team.rpc('set_user_role', { target_user_id: teamUser.id, new_role: 'admin' })
if (!forbiddenRoleChange.error) throw new Error('Equipe changed a role')

const anonymousProfiles = await anonymous.from('profiles').select('id')
if (!anonymousProfiles.error && anonymousProfiles.data.length > 0) throw new Error('Anonymous user accessed profiles')

const logout = await restoredClient.auth.signOut()
if (logout.error) throw logout.error
const afterLogout = await restoredClient.auth.getSession()
if (afterLogout.data.session) throw new Error('Logout did not clear the session')

await writeFile(
  '.env.test.local',
  `SPRINT0_ADMIN_EMAIL=${adminEmail}\nSPRINT0_ADMIN_PASSWORD=${adminPassword}\nSPRINT0_EQUIPE_EMAIL=${teamEmail}\nSPRINT0_EQUIPE_PASSWORD=${teamPassword}\n`,
  { encoding: 'utf8', mode: 0o600 },
)

console.log('Supabase verification passed: invalid login, persistence, logout, Admin, Equipe and anonymous RLS.')
