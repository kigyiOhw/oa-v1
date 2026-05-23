import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { roleApi, RoleItem, RoleTypeItem, PermissionItem } from '../../api/roles'

const TYPE_ICONS: Record<string, string> = {
  super_admin: '👑',
  module_admin: '⚙️',
  dept_admin: '🏢',
  user: '👤',
}

export default function Roles() {
  const { t } = useTranslation()
  const [roles, setRoles] = useState<RoleItem[]>([])
  const [permissions, setPermissions] = useState<PermissionItem[]>([])
  const [roleTypes, setRoleTypes] = useState<RoleTypeItem[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [editing, setEditing] = useState<RoleItem | null>(null)

  const fetchRoles = async () => {
    const [r, p, rt] = await Promise.all([
      roleApi.list(),
      roleApi.listPermissions(),
      roleApi.listTypes().catch(() => ({ data: [] as RoleTypeItem[] })),
    ])
    setRoles(r.data)
    setPermissions(p.data)
    if (rt.data.length > 0) setRoleTypes(rt.data)
  }

  useEffect(() => {
    fetchRoles()
  }, [])

  const handleDelete = async (id: number) => {
    if (!confirm(t('roles.deleteConfirm'))) return
    await roleApi.delete(id)
    fetchRoles()
  }

  const typeLabel = (roleType: string) => {
    if (roleTypes.length > 0) {
      const found = roleTypes.find((rt) => rt.value === roleType)
      if (found) return found.label
    }
    const defaults: Record<string, string> = {
      super_admin: 'Super Admin', module_admin: 'Module Admin', dept_admin: 'Dept Admin', user: 'User',
    }
    return defaults[roleType] || roleType
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">{t('roles.title')}</h1>
        <button
          className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm"
          onClick={() => setShowCreate(true)}
        >
          {t('roles.createRole')}
        </button>
      </div>
      <table className="w-full text-sm border">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-3 py-2 text-left">ID</th>
            <th className="px-3 py-2 text-left">{t('roles.name')}</th>
            <th className="px-3 py-2 text-left">{t('roles.description')}</th>
            <th className="px-3 py-2 text-left">{t('roles.type')}</th>
            <th className="px-3 py-2 text-left">{t('common.actions')}</th>
          </tr>
        </thead>
        <tbody>
          {roles.map((r) => (
            <tr key={r.id} className="border-t hover:bg-gray-50">
              <td className="px-3 py-2">{r.id}</td>
              <td className="px-3 py-2 font-medium">{r.name}</td>
              <td className="px-3 py-2">{r.description || '-'}</td>
              <td className="px-3 py-2 text-xs">
                <span className="inline-block bg-gray-100 rounded px-2 py-0.5">
                  {TYPE_ICONS[r.role_type] || ''} {typeLabel(r.role_type)}
                  {r.admin_scope && (
                    <span className="text-gray-400 ml-1">({r.admin_scope})</span>
                  )}
                </span>
              </td>
              <td className="px-3 py-2 space-x-2">
                <button
                  className="text-blue-600 hover:underline text-xs"
                  onClick={() => setEditing(r)}
                >
                  {t('roles.permissions')}
                </button>
                <button
                  className="text-red-500 hover:underline text-xs"
                  onClick={() => handleDelete(r.id)}
                >
                  {t('common.delete')}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {showCreate && (
        <RoleWizardModal
          permissions={permissions}
          roleTypes={roleTypes}
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

// ── Wizard Modal ──

function RoleWizardModal({
  permissions,
  roleTypes,
  onClose,
  onSaved,
}: {
  permissions: PermissionItem[]
  roleTypes: RoleTypeItem[]
  onClose: () => void
  onSaved: () => void
}) {
  const { t } = useTranslation()
  const [step, setStep] = useState(0)
  const [roleType, setRoleType] = useState('user')
  const [adminScope, setAdminScope] = useState<string | null>(null)
  const [selected, setSelected] = useState<number[]>([])
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)

  const types = roleTypes.length > 0
    ? roleTypes
    : [
        { value: 'super_admin', label: 'Super Admin', description: 'Full access to all modules and departments' },
        { value: 'module_admin', label: 'Module Admin', description: 'Manage specific modules, global or department scope' },
        { value: 'dept_admin', label: 'Dept Admin', description: 'Manage own department: employees, assets, consumables' },
        { value: 'user', label: 'User', description: 'Personal data and self-service only' },
      ]

  const grouped: Record<string, PermissionItem[]> = {}
  for (const p of permissions) {
    const group = p.code.split(':')[0]
    if (!grouped[group]) grouped[group] = []
    grouped[group].push(p)
  }

  const toggleGroup = (_group: string, perms: PermissionItem[]) => {
    const ids = perms.map((p) => p.id)
    const allSelected = ids.every((id) => selected.includes(id))
    if (allSelected) {
      setSelected((prev) => prev.filter((id) => !ids.includes(id)))
    } else {
      setSelected((prev) => [...new Set([...prev, ...ids])])
    }
  }

  const handleTypeChange = (value: string) => {
    setRoleType(value)
    if (value === 'super_admin') {
      setSelected(permissions.map((p) => p.id))
      setAdminScope('global')
    } else if (value === 'dept_admin') {
      setAdminScope('department')
      const deptPermCodes = ['employee:read', 'employee:update', 'asset:read', 'asset:update', 'consumable:read', 'consumable:update', 'dept:read', 'user:read', 'leave:read', 'announcement:read', 'media:read', 'media:upload']
      setSelected(permissions.filter((p) => deptPermCodes.includes(p.code)).map((p) => p.id))
    } else {
      setAdminScope(null)
      setSelected([])
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await roleApi.create({
        name,
        description: description || null,
        role_type: roleType,
        admin_scope: adminScope,
      })
      if (selected.length > 0) {
        await roleApi.assignPermissions(res.data.id, selected)
      }
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  const canNext = () => {
    if (step === 0) return true
    if (step === 1 && roleType === 'module_admin') return true
    if (step === 2) return name.trim().length > 0
    return true
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-[500px] max-h-[80vh] overflow-auto">
        <h2 className="text-lg font-bold mb-1">{t('roles.createRole')}</h2>
        <div className="flex gap-2 mb-4 text-xs text-gray-500">
          {[t('roles.stepType'), roleType === 'module_admin' ? t('roles.stepScope') : null, t('roles.stepName')]
            .filter(Boolean)
            .map((label, i) => (
              <span key={i} className={`px-2 py-0.5 rounded ${i === step ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}>
                {i + 1}. {label}
              </span>
            ))}
        </div>

        {/* Step 0: Select type */}
        {step === 0 && (
          <div className="space-y-2">
            {types.map((rt) => (
              <label
                key={rt.value}
                className={`flex items-start gap-3 p-3 rounded border cursor-pointer ${
                  roleType === rt.value ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <input
                  type="radio"
                  name="roleType"
                  value={rt.value}
                  checked={roleType === rt.value}
                  onChange={(e) => handleTypeChange(e.target.value)}
                  className="mt-0.5"
                />
                <div>
                  <div className="text-sm font-medium">{TYPE_ICONS[rt.value] || ''} {rt.label}</div>
                  <div className="text-xs text-gray-500">{rt.description}</div>
                </div>
              </label>
            ))}
          </div>
        )}

        {/* Step 1: Permissions (skip for super_admin, show scope for module_admin) */}
        {step === 1 && (
          <>
            {roleType === 'module_admin' && (
              <div className="mb-4">
                <span className="text-sm font-medium">{t('roles.dataScope')}</span>
                <div className="flex gap-3 mt-2">
                  <label className={`flex-1 p-3 rounded border cursor-pointer text-center text-sm ${
                    adminScope === 'global' ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                  }`}>
                    <input type="radio" name="scope" value="global" checked={adminScope === 'global'}
                      onChange={() => setAdminScope('global')} className="sr-only" />
                    Global
                  </label>
                  <label className={`flex-1 p-3 rounded border cursor-pointer text-center text-sm ${
                    adminScope === 'department' ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                  }`}>
                    <input type="radio" name="scope" value="department" checked={adminScope === 'department'}
                      onChange={() => setAdminScope('department')} className="sr-only" />
                    Department
                  </label>
                </div>
              </div>
            )}
            <div>
              <span className="text-sm font-medium">{t('roles.permissions')}</span>
              {Object.entries(grouped).map(([group, perms]) => (
                <div key={group} className="mt-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={perms.every((p) => selected.includes(p.id))}
                      onChange={() => toggleGroup(group, perms)}
                    />
                    <span className="text-xs text-gray-500 uppercase font-medium">{group}</span>
                  </label>
                  <div className="ml-6">
                    {perms.map((p) => (
                      <label key={p.id} className="flex items-center gap-2 text-sm py-0.5">
                        <input
                          type="checkbox"
                          checked={selected.includes(p.id)}
                          disabled={roleType === 'super_admin'}
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
                </div>
              ))}
            </div>
          </>
        )}

        {/* Step 2: Name & create */}
        {step === 2 && (
          <div>
            <label className="block mb-3 text-sm">
              {t('roles.name')}
              <input
                className="block w-full border rounded px-2 py-1.5 mt-0.5"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. HR Admin"
                autoFocus
              />
            </label>
            <label className="block text-sm">
              {t('roles.description')}
              <input
                className="block w-full border rounded px-2 py-1.5 mt-0.5"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description"
              />
            </label>
          </div>
        )}

        <div className="flex gap-2 mt-6">
          {step > 0 && (
            <button className="border rounded py-1.5 px-4 text-sm" onClick={() => setStep((s) => s - 1)}>
              {t('common.back')}
            </button>
          )}
          {step < 2 ? (
            <button
              className="flex-1 bg-blue-600 text-white rounded py-1.5 text-sm disabled:opacity-50"
              onClick={() => setStep((s) => s + 1)}
              disabled={!canNext()}
            >
              {t('common.next') || 'Next'}
            </button>
          ) : (
            <button
              className="flex-1 bg-blue-600 text-white rounded py-1.5 text-sm disabled:opacity-50"
              onClick={handleSave}
              disabled={saving || !name.trim()}
            >
              {saving ? t('common.saving') : t('common.create')}
            </button>
          )}
          <button className="border rounded py-1.5 px-4 text-sm" onClick={onClose}>
            {t('common.cancel')}
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
  const { t } = useTranslation()
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
        <h2 className="text-lg font-bold mb-4">{t('roles.assignPermissions')}: {role.name}</h2>
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
            {t('common.save')}
          </button>
          <button className="flex-1 border rounded py-1.5 text-sm" onClick={onClose}>
            {t('common.cancel')}
          </button>
        </div>
      </div>
    </div>
  )
}
