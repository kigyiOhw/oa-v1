import { useEffect, useState } from 'react'
import { deptApi, DepartmentTreeItem, DepartmentItem } from '../../api/departments'

export default function Departments() {
  const [tree, setTree] = useState<DepartmentTreeItem[]>([])
  const [flattened, setFlattened] = useState<DepartmentItem[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [editing, setEditing] = useState<DepartmentItem | null>(null)

  const fetchData = async () => {
    const [treeRes, listRes] = await Promise.all([deptApi.tree(), deptApi.list()])
    setTree(treeRes.data)
    setFlattened(listRes.data)
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this department? Child departments will not be deleted.')) return
    await deptApi.delete(id)
    fetchData()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Departments</h1>
        <button
          className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm"
          onClick={() => setShowCreate(true)}
        >
          Add Department
        </button>
      </div>

      <div className="border rounded p-4">
        {tree.length === 0 && <p className="text-gray-400 text-sm">No departments yet.</p>}
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
  return (
    <div>
      <div
        className="flex items-center gap-2 py-1.5 hover:bg-gray-50 rounded px-2"
        style={{ paddingLeft: depth * 24 + 8 }}
      >
        <span className="text-sm flex-1">
          {dept.children.length > 0 ? '📁' : '📄'} {dept.name}
          {dept.description && (
            <span className="text-gray-400 ml-2 text-xs">{dept.description}</span>
          )}
        </span>
        <button
          className="text-blue-600 hover:underline text-xs"
          onClick={() => onEdit(dept)}
        >
          Edit
        </button>
        <button
          className="text-red-500 hover:underline text-xs"
          onClick={() => onDelete(dept.id)}
        >
          Delete
        </button>
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
  const [name, setName] = useState(editing?.name || '')
  const [description, setDescription] = useState(editing?.description || '')
  const [parentId, setParentId] = useState<number | null>(
    editing?.parent_id ?? defaultParentId ?? null
  )
  const [sortOrder, setSortOrder] = useState(editing?.sort_order ?? 0)
  const [saving, setSaving] = useState(false)

  const isEdit = !!editing
  // Filter out self and descendants from parent options
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

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-96">
        <h2 className="text-lg font-bold mb-4">{isEdit ? 'Edit' : 'Add'} Department</h2>
        <label className="block mb-2 text-sm">
          Name
          <input
            className="block w-full border rounded px-2 py-1 mt-0.5"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="block mb-2 text-sm">
          Parent Department
          <select
            className="block w-full border rounded px-2 py-1 mt-0.5"
            value={parentId ?? ''}
            onChange={(e) => setParentId(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">None (root)</option>
            {validParents.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block mb-2 text-sm">
          Description
          <input
            className="block w-full border rounded px-2 py-1 mt-0.5"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <label className="block mb-4 text-sm">
          Sort Order
          <input
            type="number"
            className="block w-full border rounded px-2 py-1 mt-0.5"
            value={sortOrder}
            onChange={(e) => setSortOrder(Number(e.target.value))}
          />
        </label>
        <div className="flex gap-2">
          <button
            className="flex-1 bg-blue-600 text-white rounded py-1.5 text-sm disabled:opacity-50"
            onClick={handleSave}
            disabled={saving || !name.trim()}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button className="flex-1 border rounded py-1.5 text-sm" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
