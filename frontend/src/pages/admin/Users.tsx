import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { userApi, UserItem } from '../../api/users'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import ConfirmDialog from '@/components/ui/confirm-dialog'
import { useToastStore } from '@/stores/toast'

export default function Users() {
  const { t } = useTranslation()
  const [users, setUsers] = useState<UserItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<UserItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [confirmState, setConfirmState] = useState<{open: boolean; title: string; message: string; onConfirm: () => void} | null>(null)

  const fetchUsers = async () => {
    try {
      const res = await userApi.list({ page, page_size: 20, search: search || undefined })
      setUsers(res.data.items)
      setTotal(res.data.total)
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }

  useEffect(() => {
    fetchUsers()
  }, [page, search])

  const handleDelete = (id: number) => {
    setConfirmState({
      open: true,
      title: t('common.confirm'),
      message: t('users.deleteConfirm'),
      onConfirm: async () => {
        try {
          await userApi.delete(id)
          fetchUsers()
        } catch (e: any) {
          useToastStore.getState().addToast('error', e.response?.data?.detail || t('common.saveFailed'))
        }
      },
    })
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">{t('users.title')}</h1>
      <div className="mb-4">
        <Input
          type="text"
          placeholder={t('users.searchPlaceholder')}
          className="w-64"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
        />
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>ID</TableHead>
            <TableHead>{t('users.username')}</TableHead>
            <TableHead>{t('users.email')}</TableHead>
            <TableHead>{t('users.roles')}</TableHead>
            <TableHead>{t('users.status')}</TableHead>
            <TableHead>{t('common.actions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
              </TableRow>
            ))
          ) : users.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6}>
                <EmptyState title={t('common.noData')} />
              </TableCell>
            </TableRow>
          ) : (
            users.map((u) => (
            <TableRow key={u.id}>
              <TableCell>{u.id}</TableCell>
              <TableCell>{u.username}</TableCell>
              <TableCell>{u.email}</TableCell>
              <TableCell>{u.roles.map((r) => r.name).join(', ') || '-'}</TableCell>
              <TableCell>
                {u.is_active ? (
                  <span className="text-green-600">{t('users.active')}</span>
                ) : (
                  <span className="text-red-500">{t('users.disabled')}</span>
                )}
                {u.is_superuser && <span className="ml-1 text-amber-600">· {t('users.admin')}</span>}
              </TableCell>
              <TableCell className="space-x-2">
                <Button variant="link" size="sm" className="h-auto p-0" onClick={() => setEditing(u)}>
                  {t('common.edit')}
                </Button>
                <Button variant="link" size="sm" className="h-auto p-0 text-red-500" onClick={() => handleDelete(u.id)}>
                  {t('common.delete')}
                </Button>
              </TableCell>
            </TableRow>
          )))}
        </TableBody>
      </Table>
      <div className="mt-4 flex items-center gap-4 text-sm text-muted-foreground">
        <span>{t('common.total')}: {total}</span>
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
          {t('common.prev')}
        </Button>
        <span>{t('common.page')} {page}</span>
        <Button variant="outline" size="sm" disabled={page * 20 >= total} onClick={() => setPage(page + 1)}>
          {t('common.next')}
        </Button>
      </div>

      {editing && (
        <EditUserModal user={editing} onClose={() => setEditing(null)} onSaved={fetchUsers} />
      )}
      {confirmState && (
        <ConfirmDialog
          open={confirmState.open}
          title={confirmState.title}
          message={confirmState.message}
          variant="destructive"
          onConfirm={() => { confirmState.onConfirm(); setConfirmState(null) }}
          onCancel={() => setConfirmState(null)}
        />
      )}
    </div>
  )
}

function EditUserModal({
  user,
  onClose,
  onSaved,
}: {
  user: UserItem
  onClose: () => void
  onSaved: () => void
}) {
  const { t } = useTranslation()
  const [email, setEmail] = useState(user.email)
  const [fullName, setFullName] = useState(user.full_name || '')
  const [isActive, setIsActive] = useState(user.is_active)
  const [isSuperuser, setIsSuperuser] = useState(user.is_superuser)
  const [roleIds, setRoleIds] = useState<number[]>(user.roles.map((r) => r.id))
  const [allRoles, setAllRoles] = useState<{ id: number; name: string }[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    import('../../api/roles').then((m) => m.roleApi.list().then((r) => setAllRoles(r.data)))
  }, [])

  const handleSave = async () => {
    setSaving(true)
    await userApi.update(user.id, {
      email,
      full_name: fullName || null,
      is_active: isActive,
      is_superuser: isSuperuser,
      role_ids: roleIds,
    })
    setSaving(false)
    onSaved()
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-96 max-h-[80vh] overflow-auto">
        <h2 className="text-lg font-bold mb-4">{t('users.editUser')}: {user.username}</h2>
        <div className="mb-2">
          <label className="block text-sm mb-1">{t('users.email')}</label>
          <Input value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="mb-2">
          <label className="block text-sm mb-1">{t('users.fullName')}</label>
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>
        <label className="flex items-center gap-2 mb-2 text-sm">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
          />
          {t('users.active')}
        </label>
        <label className="flex items-center gap-2 mb-2 text-sm">
          <input
            type="checkbox"
            checked={isSuperuser}
            onChange={(e) => setIsSuperuser(e.target.checked)}
          />
          {t('users.superuser')}
        </label>
        <div className="mb-4">
          <span className="text-sm font-medium">{t('users.roles')}</span>
          <div className="max-h-32 overflow-auto border rounded p-2 mt-1">
            {allRoles.map((r) => (
              <label key={r.id} className="flex items-center gap-2 text-sm py-0.5">
                <input
                  type="checkbox"
                  checked={roleIds.includes(r.id)}
                  onChange={() =>
                    setRoleIds((prev) =>
                      prev.includes(r.id) ? prev.filter((id) => id !== r.id) : [...prev, r.id]
                    )
                  }
                />
                {r.name}
              </label>
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          <Button className="flex-1" onClick={handleSave} disabled={saving}>
            {saving ? t('common.saving') : t('common.save')}
          </Button>
          <Button variant="outline" className="flex-1" onClick={onClose}>
            {t('common.cancel')}
          </Button>
        </div>
      </div>
    </div>
  )
}
