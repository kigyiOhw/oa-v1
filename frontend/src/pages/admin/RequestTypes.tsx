import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { requestTypeApi, type RequestTypeItem } from '../../api/requestTypes'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import ConfirmDialog from '@/components/ui/confirm-dialog'

export default function RequestTypes() {
  const { t } = useTranslation()
  const [items, setItems] = useState<RequestTypeItem[]>([])
  const [loading, setLoading] = useState(true)
  const [moduleTab, setModuleTab] = useState<'leave' | 'expense'>('leave')
  const [editing, setEditing] = useState<RequestTypeItem | null>(null)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ code: '', name: '', sort_order: 0, is_active: true })
  const [confirmId, setConfirmId] = useState<number | null>(null)

  const fetchItems = async () => {
    setLoading(true)
    try {
      const res = await requestTypeApi.list()
      setItems(res.data)
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }

  useEffect(() => {
    fetchItems()
  }, [])

  const filtered = items.filter((i) => i.module === moduleTab)

  const resetForm = () => {
    setForm({ code: '', name: '', sort_order: 0, is_active: true })
    setEditing(null)
    setCreating(false)
  }

  const handleSave = async () => {
    try {
      if (editing) {
        await requestTypeApi.update(editing.id, {
          name: form.name,
          sort_order: form.sort_order,
          is_active: form.is_active,
        })
      } else {
        await requestTypeApi.create({
          module: moduleTab,
          code: form.code,
          name: form.name,
          sort_order: form.sort_order,
          is_active: form.is_active,
        })
      }
      resetForm()
      fetchItems()
    } catch { /* handled by interceptor */ }
  }

  const handleDelete = async (id: number) => {
    try {
      await requestTypeApi.delete(id)
      setConfirmId(null)
      fetchItems()
    } catch { /* handled by interceptor */ }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('admin.requestTypes')}</h1>
        <Button onClick={() => { resetForm(); setCreating(true) }}>+ {t('common.create')}</Button>
      </div>

      <div className="flex gap-2">
        <Button
          variant={moduleTab === 'leave' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setModuleTab('leave')}
        >
          {t('leave.myLeaves')}
        </Button>
        <Button
          variant={moduleTab === 'expense' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setModuleTab('expense')}
        >
          {t('expense.myExpenses')}
        </Button>
      </div>

      {(creating || editing) && (
        <div className="rounded-lg border bg-white p-4 space-y-3">
          <h2 className="text-lg font-semibold">
            {editing ? t('common.edit') : t('common.create')}
          </h2>
          {!editing && (
            <div>
              <label className="mb-1 block text-sm font-medium">Code</label>
              <Input
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                placeholder="e.g. annual"
              />
            </div>
          )}
          <div>
            <label className="mb-1 block text-sm font-medium">{t('requestTypes.name')}</label>
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder={t('requestTypes.namePlaceholder')}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">{t('requestTypes.sortOrder')}</label>
            <Input
              type="number"
              value={form.sort_order}
              onChange={(e) => setForm((f) => ({ ...f, sort_order: Number(e.target.value) }))}
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_active"
              checked={form.is_active}
              onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
            />
            <label htmlFor="is_active" className="text-sm">{t('common.active')}</label>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleSave}>{t('common.save')}</Button>
            <Button variant="secondary" onClick={resetForm}>{t('common.cancel')}</Button>
          </div>
        </div>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Code</TableHead>
            <TableHead>{t('requestTypes.name')}</TableHead>
            <TableHead>{t('requestTypes.sortOrder')}</TableHead>
            <TableHead>{t('common.status')}</TableHead>
            <TableHead>{t('common.actions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
              </TableRow>
            ))
          ) : filtered.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5}>
                <EmptyState title={t('admin.requestTypes')} />
              </TableCell>
            </TableRow>
          ) : (
            filtered.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-mono text-sm">{item.code}</TableCell>
                <TableCell>{item.name}</TableCell>
                <TableCell>{item.sort_order}</TableCell>
                <TableCell>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${item.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {item.is_active ? t('common.active') : t('common.disabled')}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button
                      variant="link"
                      size="sm"
                      className="h-auto p-0"
                      onClick={() => {
                        setEditing(item)
                        setForm({ code: item.code, name: item.name, sort_order: item.sort_order, is_active: item.is_active })
                        setCreating(false)
                      }}
                    >
                      {t('common.edit')}
                    </Button>
                    <Button
                      variant="link"
                      size="sm"
                      className="h-auto p-0 text-red-500"
                      onClick={() => setConfirmId(item.id)}
                    >
                      {t('common.delete')}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {confirmId && (
        <ConfirmDialog
          open
          title={t('common.confirm')}
          message={t('requestTypes.deleteConfirm')}
          variant="destructive"
          onConfirm={() => handleDelete(confirmId)}
          onCancel={() => setConfirmId(null)}
        />
      )}
    </div>
  )
}
