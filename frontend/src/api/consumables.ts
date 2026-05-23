import api from './client'

export interface ConsumableItem {
  id: number
  name: string
  category_id: number
  unit: string
  current_stock: number
  safety_stock: number
  description: string | null
  created_at: string
  updated_at: string
  category: Record<string, unknown> | null
}

export interface ConsumableDetail extends ConsumableItem {
  records: ConsumableRecord[]
}

export interface ConsumableRecord {
  id: number
  consumable_id: number
  type: string
  quantity: number
  operator_id: number
  record_date: string
  notes: string | null
  created_at: string
  operator: Record<string, unknown> | null
}

export interface PaginatedConsumables {
  items: ConsumableItem[]
  total: number
  page: number
  page_size: number
}

export const consumableApi = {
  list: (params?: Record<string, unknown>) =>
    api.get<PaginatedConsumables>('/consumables', { params }),

  getById: (id: number) =>
    api.get<ConsumableDetail>(`/consumables/${id}`),

  create: (data: Record<string, unknown>) =>
    api.post<ConsumableItem>('/consumables', data),

  update: (id: number, data: Record<string, unknown>) =>
    api.put<ConsumableItem>(`/consumables/${id}`, data),

  delete: (id: number) =>
    api.delete(`/consumables/${id}`),

  stockIn: (id: number, quantity: number, notes?: string) =>
    api.post<ConsumableDetail>(`/consumables/${id}/stock-in`, { quantity, notes }),

  stockOut: (id: number, quantity: number, notes?: string) =>
    api.post<ConsumableDetail>(`/consumables/${id}/stock-out`, { quantity, notes }),
}
