import { useEffect, useState } from 'react'
import { roleApi, RoleItem, PermissionItem } from '../../api/roles'

export default function Roles() {
  const [roles, setRoles] = useState<RoleItem[]>([])
  const [permissions, setPermissions] = useState<PermissionItem[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [editing, setEditing] = useState<RoleItem | null>(null)

  const fetchRoles = async () => {
    const [r, p] = await Promise.all([roleApi.list(), roleApi.listPermissions()])
    setRoles(r.data)
    setPermissions(p.data)
  }

  useEffect(() => {
    fetchRoles()
  }, [])

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this role?')) return
    await roleApi.delete(id)
    fetchRoles()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Roles</h1>
        <button
          className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm"
          onClick={() => setShowCreate(true)}
        >
          Create Role
        </button>
      </div>
      <table className="w-full text-sm border">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-3 py-2 text-left">ID</th>
            <th className="px-3 py-2 text-left">Name</th>
            <th className="px-3 py-2 text-left">Description</th>
            <th className="px-3 py-2 text-left">Actions</th>
          </tr>
        </thead>
        <tbody>
          {roles.map((r) => (
            <tr key={r.id} className="border-t hover:bg-gray-50">
              <td className="px-3 py-2">{r.id}</td>
              <td className="px-3 py-2 font-medium">{r.name}</td>
              <td className="px-3 py-2">{r.description || '-'}</td>
              <td className="px-3 py-2 space-x-2">
                <button
                  className="text-blue-600 hover:underline text-xs"
                  onClick={() => setEditing(r)}
                >
                  Permissions
                </button>
                <button
                  className="text-red-500 hover:underline text-xs"
                  onClick={() => handleDelete(r.id)}
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {showCreate && (
        <RoleFormModal
          permissions={permissions}
          onClose={() => setShowCreate(false)}
          onSaved={() => { setShowCreate(false); fetchRoles() }}
        />
      )}
      {editing && (
        <PermissionModal
          role={editing}
          allPermissions={permissions}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); fetchRoles() }}
        />
      )}
    </div>
  )
}

function RoleFormModal({
  permissions,
  onClose,
  onSaved,
}: {
  permissions: PermissionItem[]
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [selected, setSelected] = useState<number[]>([])
  const [saving, setSaving] = useState(false)

  const grouped: Record<string, PermissionItem[]> = {}
  for (const p of permissions) {
    const group = p.code.split(':')[0]
    if (!grouped[group]) grouped[group] = []
    grouped[group].push(p)
  }

  const handleSave = async () => {
    setSaving(true)
    const res = await roleApi.create({ name, description: description || null })
    if (selected.length > 0) {
      await roleApi.assignPermissions(res.data.id, selected)
    }
    setSaving(false)
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-96 max-h-[80vh] overflow-auto">
        <h2 className="text-lg font-bold mb-4">Create Role</h2>
        <label className="block mb-2 text-sm">
          Name
          <input
            className="block w-full border rounded px-2 py-1 mt-0.5"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="block mb-4 text-sm">
          Description
          <input
            className="block w-full border rounded px-2 py-1 mt-0.5"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <div className="mb-4">
          <span className="text-sm font-medium">Permissions</span>
          {Object.entries(grouped).map(([group, perms]) => (
            <div key={group} className="mt-2">
              <div className="text-xs text-gray-500 uppercase">{group}</div>
              {perms.map((p) => (
                <label key={p.id} className="flex items-center gap-2 text-sm py-0.5">
                  <input
                    type="checkbox"
                    checked={selected.includes(p.id)}
                    onChange={() =>
                      setSelected((prev) =>
                        prev.includes(p.id) ? prev.filter((id) => id !== p.id) : [...prev, p.id]
                      )
                    }
                  />
                  {p.code}
                </label>
              ))}
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <button
            className="flex-1 bg-blue-600 text-white rounded py-1.5 text-sm disabled:opacity-50"
            onClick={handleSave}
            disabled={saving || !name.trim()}
          >
            {saving ? 'Saving...' : 'Create'}
          </button>
          <button className="flex-1 border rounded py-1.5 text-sm" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

function PermissionModal({
  role,
  allPermissions,
  onClose,
  onSaved,
}: {
  role: RoleItem
  allPermissions: PermissionItem[]
  onClose: () => void
  onSaved: () => void
}) {
  const [selected, setSelected] = useState<number[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    roleApi.getPermissions(role.id).then((res) => {
      setSelected(res.data.map((p) => p.id))
      setLoading(false)
    })
  }, [role.id])

  const grouped: Record<string, PermissionItem[]> = {}
  for (const p of allPermissions) {
    const group = p.code.split(':')[0]
    if (!grouped[group]) grouped[group] = []
    grouped[group].push(p)
  }

  const handleSave = async () => {
    await roleApi.assignPermissions(role.id, selected)
    onSaved()
  }

  if (loading) return null

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-96 max-h-[80vh] overflow-auto">
        <h2 className="text-lg font-bold mb-4">Permissions: {role.name}</h2>
        {Object.entries(grouped).map(([group, perms]) => (
          <div key={group} className="mb-3">
            <div className="text-xs text-gray-500 uppercase mb-1">{group}</div>
            {perms.map((p) => (
              <label key={p.id} className="flex items-center gap-2 text-sm py-0.5">
                <input
                  type="checkbox"
                  checked={selected.includes(p.id)}
                  onChange={() =>
                    setSelected((prev) =>
                      prev.includes(p.id) ? prev.filter((id) => id !== p.id) : [...prev, p.id]
                    )
                  }
                />
                {p.code}
              </label>
            ))}
          </div>
        ))}
        <div className="flex gap-2 mt-4">
          <button
            className="flex-1 bg-blue-600 text-white rounded py-1.5 text-sm"
            onClick={handleSave}
          >
            Save
          </button>
          <button className="flex-1 border rounded py-1.5 text-sm" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
