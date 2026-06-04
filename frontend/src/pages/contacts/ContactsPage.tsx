import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ChevronDown, ChevronRight, Mail, Phone, Search } from 'lucide-react'
import { contactsApi, type ContactItem, type DepartmentTreeNode } from '../../api/contacts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

function TreeNode({
  node,
  selected,
  onSelect,
}: {
  node: DepartmentTreeNode
  selected: number | null
  onSelect: (id: number | null) => void
}) {
  const [expanded, setExpanded] = useState(true)

  return (
    <div>
      <button
        onClick={() => {
          setExpanded(!expanded)
          onSelect(selected === node.id ? null : node.id)
        }}
        className={`w-full flex items-center gap-1 px-3 py-1.5 text-sm rounded-md hover:bg-gray-100 transition-colors ${
          selected === node.id ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
        }`}
      >
        {node.children.length > 0 ? (
          expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />
        ) : (
          <span className="w-[14px]" />
        )}
        <span className="flex-1 text-left truncate">{node.name}</span>
        <span className="text-xs text-gray-400">{node.employee_count}</span>
      </button>
      {expanded && node.children.length > 0 && (
        <div className="ml-3">
          {node.children.map((child) => (
            <TreeNode key={child.id} node={child} selected={selected} onSelect={onSelect} />
          ))}
        </div>
      )}
    </div>
  )
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

export default function ContactsPage() {
  const { t } = useTranslation()
  const [tree, setTree] = useState<DepartmentTreeNode[]>([])
  const [contacts, setContacts] = useState<ContactItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [deptId, setDeptId] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const pageSize = 12

  const debouncedSearch = useDebounce(search, 300)

  useEffect(() => {
    contactsApi.tree().then((res) => setTree(res.data)).catch(() => {})
  }, [])

  const fetchContacts = useCallback(async () => {
    setLoading(true)
    try {
      const res = await contactsApi.list({
        page,
        page_size: pageSize,
        search: debouncedSearch || undefined,
        department_id: deptId ?? undefined,
      })
      setContacts(res.data.items)
      setTotal(res.data.total)
    } finally {
      setLoading(false)
    }
  }, [page, debouncedSearch, deptId])

  useEffect(() => {
    fetchContacts()
  }, [fetchContacts])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, deptId])

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-6xl px-4 py-6">
        <Link to="/" className="text-blue-600 hover:underline text-sm mb-4 inline-block">{t('common.backToHome')}</Link>
        <h1 className="text-xl font-bold text-gray-900 mb-4">{t('contacts.title')}</h1>

        <div className="flex gap-6">
          {/* Department Tree Sidebar */}
          <aside className="w-64 shrink-0">
            <div className="rounded-lg bg-white shadow-sm p-3">
              <h2 className="text-sm font-semibold text-gray-700 mb-2 px-3">{t('contacts.departmentTree')}</h2>
              <button
                onClick={() => setDeptId(null)}
                className={`w-full text-left px-3 py-1.5 text-sm rounded-md mb-1 ${
                  deptId === null ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                {t('common.all')}
              </button>
              {tree.map((node) => (
                <TreeNode
                  key={node.id}
                  node={node}
                  selected={deptId}
                  onSelect={(id) => setDeptId(id)}
                />
              ))}
            </div>
          </aside>

          {/* Contacts Grid */}
          <div className="flex-1 min-w-0">
            <div className="relative mb-4">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('contacts.searchPlaceholder')}
                className="pl-10"
              />
            </div>

            {loading ? (
              <div className="text-center py-12 text-gray-400">{t('common.loading')}</div>
            ) : contacts.length === 0 ? (
              <div className="text-center py-12 text-gray-400">{t('contacts.noContacts')}</div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {contacts.map((c) => (
                    <div key={c.id} className="rounded-lg bg-white p-4 shadow-sm">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold text-sm shrink-0">
                          {(c.full_name || c.username)[0].toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">
                            {c.full_name || c.username}
                          </p>
                          <p className="text-xs text-gray-400 truncate">{c.department_name || '-'}</p>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <Mail size={12} />
                          <span className="truncate">{c.email}</span>
                        </div>
                        {c.phone && (
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <Phone size={12} />
                            <span>{c.phone}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-6">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => setPage(page - 1)}
                    >
                      {t('common.prev')}
                    </Button>
                    <span className="text-sm text-gray-500">{page} / {totalPages}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= totalPages}
                      onClick={() => setPage(page + 1)}
                    >
                      {t('common.next')}
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
