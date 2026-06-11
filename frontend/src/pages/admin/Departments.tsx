import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Folder, File } from 'lucide-react'
import { deptApi, DepartmentTreeItem, DepartmentItem } from '../../api/departments'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import ConfirmDialog from '@/components/ui/confirm-dialog'
import { useToastStore } from '@/stores/toast'

export default function Departments() {
  const { t } = useTranslation()
  const [tree, setTree] = useState<DepartmentTreeItem[]>([])
  const [flattened, setFlattened] = useState<DepartmentItem[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [editing, setEditing] = useState<DepartmentItem | null>(null)
  const [confirmState, setConfirmState] = useState<{open: boolean; title: string; message: string; onConfirm: () => void} | null>(null)

  const fetchData = async () => {
    const [treeRes, listRes] = await Promise.all([deptApi.tree(), deptApi.list()])
    setTree(treeRes.data)
    setFlattened(listRes.data)
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleDelete = (id: number) => {
    setConfirmState({
      open: true,
      title: t('common.confirm'),
      message: t('departments.deleteConfirm'),
      onConfirm: async () => {
        try {
          await deptApi.delete(id)
          fetchData()
        } catch (e: any) {
          useToastStore.getState().addToast('error', e.response?.data?.detail || t('common.saveFailed'))
        }
      },
    })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">{t('departments.title')}</h1>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          {t('departments.addDepartment')}
        </Button>
      </div>

      <div className="border rounded p-4">
        {tree.length === 0 && <p className="text-gray-400 text-sm">{t('departments.noDepartments')}</p>}
        {tree.map((dept) => (
          <DeptNode
            key={dept.id}
            dept={dept}
            depth={0}
            flattened={flattened}
            onEdit={setEditing}
            onDelete={handleDelete}
          />
        ))}
      </div>

      {showCreate && (
        <DeptFormModal
          parentId={null}
          flattened={flattened}
          onClose={() => setShowCreate(false)}
          onSaved={() => { setShowCreate(false); fetchData() }}
        />
      )}
      {editing && (
        <DeptFormModal
          editing={editing}
          flattened={flattened}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); fetchData() }}
        />
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

function DeptNode({
  dept,
  depth,
  flattened,
  onEdit,
  onDelete,
}: {
  dept: DepartmentTreeItem
  depth: number
  flattened: DepartmentItem[]
  onEdit: (d: DepartmentItem) => void
  onDelete: (id: number) => void
}) {
  const { t } = useTranslation()
  return (
    <div>
      <div
        className="flex items-center gap-2 py-1.5 hover:bg-gray-50 rounded px-2"
        style={{ paddingLeft: depth * 24 + 8 }}
      >
        <span className="text-sm flex-1">
          {dept.children.length > 0 ? <Folder size={16} className="inline mr-1" /> : <File size={16} className="inline mr-1" />} {dept.name}
          {dept.description && (
            <span className="text-gray-400 ml-2 text-xs">{dept.description}</span>
          )}
        </span>
        <Button variant="link" size="sm" className="h-auto p-0" onClick={() => onEdit(dept)}>
          {t('common.edit')}
        </Button>
        <Button variant="link" size="sm" className="h-auto p-0 text-red-500" onClick={() => onDelete(dept.id)}>
          {t('common.delete')}
        </Button>
      </div>
      {dept.children.map((child) => (
        <DeptNode
          key={child.id}
          dept={child}
          depth={depth + 1}
          flattened={flattened}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  )
}

function DeptFormModal({
  editing,
  parentId: defaultParentId,
  flattened,
  onClose,
  onSaved,
}: {
  editing?: DepartmentItem | null
  parentId?: number | null
  flattened: DepartmentItem[]
  onClose: () => void
  onSaved: () => void
}) {
  const { t } = useTranslation()
  const [name, setName] = useState(editing?.name || '')
  const [description, setDescription] = useState(editing?.description || '')
  const [parentId, setParentId] = useState<number | null>(
    editing?.parent_id ?? defaultParentId ?? null
  )
  const [sortOrder, setSortOrder] = useState(editing?.sort_order ?? 0)
  const [saving, setSaving] = useState(false)

  const isEdit = !!editing
  const validParents = flattened.filter(
    (d) => d.id !== editing?.id
  )

  const handleSave = async () => {
    setSaving(true)
    const payload = {
      name: name.trim(),
      description: description || null,
      parent_id: parentId,
      sort_order: sortOrder,
    }
    if (isEdit) {
      await deptApi.update(editing!.id, payload)
    } else {
      await deptApi.create(payload)
    }
    setSaving(false)
    onSaved()
  }

  const title = isEdit ? t('departments.editDepartment') : t('departments.addDepartment')

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-96">
        <h2 className="text-lg font-bold mb-4">{title}</h2>
        <label className="block mb-2 text-sm">
          {t('departments.name')}
          <Input className="mt-0.5" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="block mb-2 text-sm">
          {t('departments.parentDepartment')}
          <Select className="mt-0.5" value={parentId ?? ''} onChange={(e) => setParentId(e.target.value ? Number(e.target.value) : null)}>
            <option value="">{t('departments.noneRoot')}</option>
            {validParents.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
        </label>
        <label className="block mb-2 text-sm">
          {t('departments.description')}
          <Input className="mt-0.5" value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
        <label className="block mb-4 text-sm">
          {t('departments.sortOrder')}
          <Input type="number" className="mt-0.5" value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value))} />
        </label>
        <div className="flex gap-2">
          <Button className="flex-1" onClick={handleSave} disabled={saving || !name.trim()}>
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
