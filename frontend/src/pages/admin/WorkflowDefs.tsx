import { useEffect, useState } from 'react'
import { workflowDefApi, DefinitionItem } from '../../api/workflow'

export default function WorkflowDefs() {
  const [defs, setDefs] = useState<DefinitionItem[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [editing, setEditing] = useState<DefinitionItem | null>(null)

  const fetchDefs = async () => {
    const res = await workflowDefApi.list()
    setDefs(res.data)
  }

  useEffect(() => {
    fetchDefs()
  }, [])

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this workflow definition?')) return
    try {
      await workflowDefApi.delete(id)
      fetchDefs()
    } catch (e: any) {
      alert(e.response?.data?.detail || 'Delete failed')
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Workflow Definitions</h1>
        <button
          className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm"
          onClick={() => setShowCreate(true)}
        >
          Create Definition
        </button>
      </div>
      <table className="w-full text-sm border">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-3 py-2 text-left">ID</th>
            <th className="px-3 py-2 text-left">Name</th>
            <th className="px-3 py-2 text-left">Description</th>
            <th className="px-3 py-2 text-left">Version</th>
            <th className="px-3 py-2 text-left">Active</th>
            <th className="px-3 py-2 text-left">Actions</th>
          </tr>
        </thead>
        <tbody>
          {defs.map((d) => (
            <tr key={d.id} className="border-t hover:bg-gray-50">
              <td className="px-3 py-2">{d.id}</td>
              <td className="px-3 py-2 font-medium">{d.name}</td>
              <td className="px-3 py-2">{d.description || '-'}</td>
              <td className="px-3 py-2">v{d.version}</td>
              <td className="px-3 py-2">
                <span className={d.is_active ? 'text-green-600' : 'text-gray-400'}>
                  {d.is_active ? 'Yes' : 'No'}
                </span>
              </td>
              <td className="px-3 py-2 space-x-2">
                <button
                  className="text-blue-600 hover:underline text-xs"
                  onClick={() => setEditing(d)}
                >
                  Edit
                </button>
                <button
                  className="text-red-500 hover:underline text-xs"
                  onClick={() => handleDelete(d.id)}
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {showCreate && (
        <DefFormModal
          onClose={() => setShowCreate(false)}
          onSaved={() => { setShowCreate(false); fetchDefs() }}
        />
      )}
      {editing && (
        <DefFormModal
          def={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); fetchDefs() }}
        />
      )}
    </div>
  )
}

function DefFormModal({
  def,
  onClose,
  onSaved,
}: {
  def?: DefinitionItem
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState(def?.name || '')
  const [description, setDescription] = useState(def?.description || '')
  const [icon, setIcon] = useState(def?.icon || '')
  const [definitionStr, setDefinitionStr] = useState(
    def ? JSON.stringify(def.definition, null, 2) : JSON.stringify(defaultDefinition(), null, 2)
  )
  const [isActive, setIsActive] = useState(def?.is_active ?? true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSave = async () => {
    setError('')
    let definition: Record<string, unknown>
    try {
      definition = JSON.parse(definitionStr)
    } catch {
      setError('Invalid JSON')
      return
    }
    setSaving(true)
    try {
      if (def) {
        await workflowDefApi.update(def.id, {
          name: name || undefined,
          description: description || null,
          icon: icon || null,
          definition,
          is_active: isActive,
        })
      } else {
        await workflowDefApi.create({
          name,
          description: description || null,
          icon: icon || null,
          definition,
        })
      }
      setSaving(false)
      onSaved()
    } catch (e: any) {
      setSaving(false)
      setError(e.response?.data?.detail || 'Save failed')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-[600px] max-h-[85vh] overflow-auto">
        <h2 className="text-lg font-bold mb-4">{def ? 'Edit Definition' : 'Create Definition'}</h2>
        {error && <div className="mb-3 text-sm text-red-600 bg-red-50 rounded px-3 py-2">{error}</div>}
        <label className="block mb-2 text-sm">
          Name
          <input
            className="block w-full border rounded px-2 py-1 mt-0.5"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="block mb-2 text-sm">
          Description
          <input
            className="block w-full border rounded px-2 py-1 mt-0.5"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <label className="block mb-2 text-sm">
          Icon
          <input
            className="block w-full border rounded px-2 py-1 mt-0.5"
            value={icon}
            onChange={(e) => setIcon(e.target.value)}
          />
        </label>
        {def && (
          <label className="flex items-center gap-2 mb-2 text-sm">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            Active
          </label>
        )}
        <label className="block mb-4 text-sm">
          Definition (JSON)
          <textarea
            className="block w-full border rounded px-2 py-1 mt-0.5 font-mono text-xs"
            rows={14}
            value={definitionStr}
            onChange={(e) => setDefinitionStr(e.target.value)}
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

function defaultDefinition() {
  return {
    nodes: [
      { id: 'start', type: 'start', label: 'Submit' },
      { id: 'approve', type: 'approval', label: 'Manager Approval', assignee_type: 'manager' },
      { id: 'end_approved', type: 'end', label: 'Approved', outcome: 'approved' },
      { id: 'end_rejected', type: 'end', label: 'Rejected', outcome: 'rejected' },
    ],
    transitions: [
      { from: 'start', action: 'submit', to: 'approve' },
      { from: 'approve', action: 'approve', to: 'end_approved' },
      { from: 'approve', action: 'reject', to: 'end_rejected' },
    ],
  }
}
