import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { userApi, UserItem } from '../../api/users'

export default function Users() {
  const { t } = useTranslation()
  const [users, setUsers] = useState<UserItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<UserItem | null>(null)

  const fetchUsers = async () => {
    const res = await userApi.list({ page, page_size: 20, search: search || undefined })
    setUsers(res.data.items)
    setTotal(res.data.total)
  }

  useEffect(() => {
    fetchUsers()
  }, [page, search])

  const handleDelete = async (id: number) => {
    if (!confirm(t('users.deleteConfirm'))) return
    await userApi.delete(id)
    fetchUsers()
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">{t('users.title')}</h1>
      <div className="mb-4">
        <input
          type="text"
          placeholder={t('users.searchPlaceholder')}
          className="border rounded px-3 py-1.5 text-sm w-64"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
        />
      </div>
      <table className="w-full text-sm border">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-3 py-2 text-left">ID</th>
            <th className="px-3 py-2 text-left">{t('users.username')}</th>
            <th className="px-3 py-2 text-left">{t('users.email')}</th>
            <th className="px-3 py-2 text-left">{t('users.roles')}</th>
            <th className="px-3 py-2 text-left">{t('users.status')}</th>
            <th className="px-3 py-2 text-left">{t('common.actions')}</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="border-t hover:bg-gray-50">
              <td className="px-3 py-2">{u.id}</td>
              <td className="px-3 py-2">{u.username}</td>
              <td className="px-3 py-2">{u.email}</td>
              <td className="px-3 py-2">{u.roles.map((r) => r.name).join(', ') || '-'}</td>
              <td className="px-3 py-2">
                {u.is_active ? (
                  <span className="text-green-600">{t('users.active')}</span>
                ) : (
                  <span className="text-red-500">{t('users.disabled')}</span>
                )}
                {u.is_superuser && <span className="ml-1 text-amber-600">· {t('users.admin')}</span>}
              </td>
              <td className="px-3 py-2 space-x-2">
                <button
                  className="text-blue-600 hover:underline text-xs"
                  onClick={() => setEditing(u)}
                >
                  {t('common.edit')}
                </button>
                <button
                  className="text-red-500 hover:underline text-xs"
                  onClick={() => handleDelete(u.id)}
                >
                  {t('common.delete')}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-4 flex items-center gap-4 text-sm text-gray-600">
        <span>{t('common.total')}: {total}</span>
        <button
          disabled={page <= 1}
          onClick={() => setPage(page - 1)}
          className="px-2 py-0.5 border rounded disabled:opacity-30"
        >
          {t('common.prev')}
        </button>
        <span>{t('common.page')} {page}</span>
        <button
          disabled={page * 20 >= total}
          onClick={() => setPage(page + 1)}
          className="px-2 py-0.5 border rounded disabled:opacity-30"
        >
          {t('common.next')}
        </button>
      </div>

      {editing && (
        <EditUserModal user={editing} onClose={() => setEditing(null)} onSaved={fetchUsers} />
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
        <label className="block mb-2 text-sm">
          {t('users.email')}
          <input
            className="block w-full border rounded px-2 py-1 mt-0.5"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="block mb-2 text-sm">
          {t('users.fullName')}
          <input
            className="block w-full border rounded px-2 py-1 mt-0.5"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
        </label>
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
          <button
            className="flex-1 bg-blue-600 text-white rounded py-1.5 text-sm disabled:opacity-50"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? t('common.saving') : t('common.save')}
          </button>
          <button className="flex-1 border rounded py-1.5 text-sm" onClick={onClose}>
            {t('common.cancel')}
          </button>
        </div>
      </div>
    </div>
  )
}
