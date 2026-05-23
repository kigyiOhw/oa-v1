import api from './client'

export interface AssetCategory {
  id: number
  name: string
  parent_id: number | null
  description: string | null
  sort_order: number
  created_at: string
  children: AssetCategory[]
}

export interface AssetItem {
  id: number
  name: string
  category_id: number
  asset_code: string
  status: string
  department_id: number | null
  current_user_id: number | null
  purchase_date: string | null
  purchase_price: number | null
  supplier: string | null
  specification: Record<string, unknown> | null
  description: string | null
  created_at: string
  updated_at: string
  category: AssetCategory | null
  department: Record<string, unknown> | null
}

export interface AssetDetail extends AssetItem {
  current_user: Record<string, unknown> | null
  assignments: AssetAssignment[]
}

export interface AssetAssignment {
  id: number
  asset_id: number
  user_id: number
  action: string
  action_date: string
  notes: string | null
  operator_id: number
  created_at: string
  user: Record<string, unknown> | null
  operator: Record<string, unknown> | null
}

export interface PaginatedAssets {
  items: AssetItem[]
  total: number
  page: number
  page_size: number
}

export const assetStatusLabel = (s: string) => {
  const map: Record<string, string> = {
    in_use: '使用中', idle: '闲置', scrapped: '已报废', repairing: '维修中',
  }
  return map[s] || s
}

export const assetStatusColor = (s: string) => {
  const map: Record<string, string> = {
    in_use: 'text-green-600', idle: 'text-gray-400', scrapped: 'text-red-500', repairing: 'text-yellow-600',
  }
  return map[s] || ''
}

export const assetApi = {
  listCategories: () => api.get<AssetCategory[]>('/asset-categories'),

  createCategory: (data: { name: string; parent_id?: number; description?: string; sort_order?: number }) =>
    api.post<AssetCategory>('/asset-categories', data),

  updateCategory: (id: number, data: Record<string, unknown>) =>
    api.put<AssetCategory>(`/asset-categories/${id}`, data),

  deleteCategory: (id: number) =>
    api.delete(`/asset-categories/${id}`),

  list: (params?: Record<string, unknown>) =>
    api.get<PaginatedAssets>('/assets', { params }),

  listMy: () =>
    api.get<AssetItem[]>('/assets/my'),

  getById: (id: number) =>
    api.get<AssetDetail>(`/assets/${id}`),

  create: (data: Record<string, unknown>) =>
    api.post<AssetItem>('/assets', data),

  update: (id: number, data: Record<string, unknown>) =>
    api.put<AssetItem>(`/assets/${id}`, data),

  delete: (id: number) =>
    api.delete(`/assets/${id}`),

  assign: (id: number, userId: number) =>
    api.post<AssetDetail>(`/assets/${id}/assign`, { user_id: userId }),

  return: (id: number) =>
    api.post<AssetDetail>(`/assets/${id}/return`),
}
