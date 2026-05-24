import api from './client'

export interface ContactItem {
  id: number
  username: string
  email: string
  full_name: string | null
  department_name: string | null
  phone: string | null
}

export interface DepartmentTreeNode {
  id: number
  name: string
  children: DepartmentTreeNode[]
  employee_count: number
}

export interface PaginatedContacts {
  items: ContactItem[]
  total: number
  page: number
  page_size: number
}

export const contactsApi = {
  list: (params?: { search?: string; department_id?: number; page?: number; page_size?: number }) =>
    api.get<PaginatedContacts>('/contacts', { params }),

  tree: () =>
    api.get<DepartmentTreeNode[]>('/contacts/tree'),
}
