import api from './client'

export interface RequestTypeItem {
  id: number
  module: string
  code: string
  name: string
  sort_order: number
  is_active: boolean
}

export interface RequestTypeCreate {
  module: string
  code: string
  name: string
  sort_order?: number
  is_active?: boolean
}

export interface RequestTypeUpdate {
  name?: string
  sort_order?: number
  is_active?: boolean
}

export const requestTypeApi = {
  list: (module?: string) =>
    api.get<RequestTypeItem[]>('/request-types', { params: module ? { module } : undefined }),

  create: (data: RequestTypeCreate) =>
    api.post<RequestTypeItem>('/request-types', data),

  update: (id: number, data: RequestTypeUpdate) =>
    api.put<RequestTypeItem>(`/request-types/${id}`, data),

  delete: (id: number) =>
    api.delete(`/request-types/${id}`),
}
