import { supabase } from '@/lib/supabase'
import type { ConnectOrganization, ConnectOrganizationMember, ConnectProfileSector, ConnectSector, Profile } from '@/types/database'
import type { ConnectAccess, ConnectOperator, ConnectProfileSectorInput } from '../types/connect-types'

const profileColumns = 'id, full_name, role, active'

export async function listConnectOrganizations(): Promise<ConnectOrganization[]> {
  const { data, error } = await supabase
    .from('connect_organizations')
    .select('*')
    .eq('active', true)
    .order('name')

  if (error) throw error
  return data
}

export async function listConnectSectors(organizationId: string): Promise<ConnectSector[]> {
  const { data, error } = await supabase
    .from('connect_sectors')
    .select('*')
    .eq('organization_id', organizationId)
    .order('sort_order')

  if (error) throw error
  return data
}

export async function listConnectOrganizationMembers(organizationId: string): Promise<ConnectOrganizationMember[]> {
  const { data, error } = await supabase
    .from('connect_organization_members')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('active', true)

  if (error) throw error
  return data
}

export async function listConnectProfiles(profileIds: string[]): Promise<Array<Pick<Profile, 'id' | 'full_name' | 'role' | 'active'>>> {
  if (profileIds.length === 0) return []
  const { data, error } = await supabase
    .from('profiles')
    .select(profileColumns)
    .in('id', profileIds)
    .order('full_name')

  if (error) throw error
  return data
}

export async function listConnectProfileSectors(organizationId: string): Promise<ConnectProfileSector[]> {
  const { data, error } = await supabase
    .from('connect_profile_sectors')
    .select('*')
    .eq('organization_id', organizationId)

  if (error) throw error
  return data
}

export async function listConnectFoundation(organizationId: string): Promise<{
  sectors: ConnectSector[]
  operators: ConnectOperator[]
  profiles: Array<Pick<Profile, 'id' | 'full_name' | 'role' | 'active'>>
}> {
  const [sectors, members, profileSectors] = await Promise.all([
    listConnectSectors(organizationId),
    listConnectOrganizationMembers(organizationId),
    listConnectProfileSectors(organizationId),
  ])
  const profiles = await listConnectProfiles(members.map(member => member.profile_id))
  const profileMap = new Map(profiles.map(profile => [profile.id, profile]))
  const permissionsByProfile = new Map<string, ConnectProfileSector[]>()

  for (const permission of profileSectors) {
    const current = permissionsByProfile.get(permission.profile_id) ?? []
    current.push(permission)
    permissionsByProfile.set(permission.profile_id, current)
  }

  return {
    sectors,
    profiles,
    operators: members.flatMap(member => {
      const profile = profileMap.get(member.profile_id)
      if (!profile) return []
      return [{ ...member, profile, sector_permissions: permissionsByProfile.get(member.profile_id) ?? [] }]
    }),
  }
}

export async function getConnectAccess(profileId: string, profileRole: Profile['role']): Promise<ConnectAccess> {
  const { data: memberships, error: membershipsError } = await supabase
    .from('connect_organization_members')
    .select('organization_id, profile_id, active')
    .eq('profile_id', profileId)
    .eq('active', true)

  if (membershipsError) throw membershipsError
  const membership = memberships[0]
  if (!membership) return { organizationId: null, canAccess: false, isAdmin: false }
  if (profileRole === 'admin') return { organizationId: membership.organization_id, canAccess: true, isAdmin: true }

  const { data: sectors, error: sectorsError } = await supabase
    .from('connect_profile_sectors')
    .select('can_view')
    .eq('organization_id', membership.organization_id)
    .eq('profile_id', profileId)
    .eq('can_view', true)
    .limit(1)

  if (sectorsError) throw sectorsError
  return { organizationId: membership.organization_id, canAccess: sectors.length > 0, isAdmin: false }
}

export async function upsertConnectProfileSector(input: ConnectProfileSectorInput): Promise<ConnectProfileSector> {
  const { data, error } = await supabase
    .from('connect_profile_sectors')
    .upsert(input, { onConflict: 'profile_id,sector_id' })
    .select('*')
    .single()

  if (error) throw error
  return data
}
