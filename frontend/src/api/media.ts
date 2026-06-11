import api from './client'

export interface MediaFile {
  id: number
  title: string
  file_path: string
  file_type: 'image' | 'video' | 'document'
  file_size: number
  mime_type: string
  uploaded_by: number
  created_at: string
}

export interface PaginatedMediaFiles {
  items: MediaFile[]
  total: number
  page: number
  page_size: number
}

export const mediaApi = {
  list: (page = 1, pageSize = 20) =>
    api.get<PaginatedMediaFiles>('/media', { params: { page, page_size: pageSize } }),

  upload: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return api.post<MediaFile>('/media/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },

  delete: (id: number) =>
    api.delete(`/media/${id}`),
}
