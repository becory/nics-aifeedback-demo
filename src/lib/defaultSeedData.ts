import defaultOrganizationsJson from '../data/defaultOrganizations.json'
import defaultServicesJson from '../data/defaultServices.json'
import type { Organization, Service } from '../types'

export function createDefaultOrganizations(): Organization[] {
  return defaultOrganizationsJson as Organization[]
}

export function createDefaultServices(): Service[] {
  return (defaultServicesJson as Service[]).map((service) => ({
    ...service,
    host: service.host ?? '',
  }))
}

export function getDefaultAdminOrganizationIds(): string[] {
  return createDefaultOrganizations().map((org) => org.id)
}

export function getDefaultFeedbackFallbackOrgId(organizations: Organization[]): string {
  const nics = organizations.find((org) => org.code.toLowerCase() === 'nics')
  return nics?.id ?? organizations[0]?.id ?? ''
}
