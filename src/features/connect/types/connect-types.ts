import type {
  ConnectDataClassification,
  ConnectOrganization,
  ConnectOrganizationMember,
  ConnectProfileSector,
  ConnectSector,
  Profile,
} from '@/types/database'

export type ConnectOrganizationSummary = ConnectOrganization

export type ConnectFoundationSector = ConnectSector

export type ConnectOperator = ConnectOrganizationMember & {
  profile: Pick<Profile, 'id' | 'full_name' | 'role' | 'active'>
  sector_permissions: ConnectProfileSector[]
}

export type ConnectFoundationData = {
  organization: ConnectOrganizationSummary | null
  sectors: ConnectFoundationSector[]
  operators: ConnectOperator[]
  profiles: Array<Pick<Profile, 'id' | 'full_name' | 'role' | 'active'>>
}

export type ConnectAccess = {
  organizationId: string | null
  canAccess: boolean
  isAdmin: boolean
}

export type ConnectProfileSectorInput = {
  organization_id: string
  profile_id: string
  sector_id: string
  can_view: boolean
  can_assign: boolean
  can_transfer: boolean
  can_manage: boolean
}

export const CONNECT_CLASSIFICATION_LABELS: Record<ConnectDataClassification, string> = {
  STANDARD: 'Padrão',
  SENSITIVE: 'Sensível',
}
