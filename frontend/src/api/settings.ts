import api from './client'

export interface CompanyInfo {
  name: string
  logo_url: string
  description: string
  address: string
  contact: string
}

export interface QuickLink {
  name: string
  url: string
  icon: string
}

export const settingsApi = {
  getCompanyInfo: () =>
    api.get<CompanyInfo>('/settings/company-info'),

  updateCompanyInfo: (data: CompanyInfo) =>
    api.put<CompanyInfo>('/settings/company-info', data),

  getQuickLinks: () =>
    api.get<QuickLink[]>('/settings/quick-links'),

  updateQuickLinks: (links: QuickLink[]) =>
    api.put<QuickLink[]>('/settings/quick-links', { links }),
}
