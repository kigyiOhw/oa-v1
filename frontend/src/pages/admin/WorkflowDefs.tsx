import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { workflowDefApi, DefinitionItem } from '../../api/workflow'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

export default function WorkflowDefs() {
  const { t } = useTranslation()
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
    if (!confirm(t('workflowDefs.deleteConfirm'))) return
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
        <h1 className="text-2xl font-bold">{t('workflowDefs.title')}</h1>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          {t('workflowDefs.createDefinition')}
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>ID</TableHead>
            <TableHead>{t('workflowDefs.name')}</TableHead>
            <TableHead>{t('workflowDefs.description')}</TableHead>
            <TableHead>{t('workflowDefs.version')}</TableHead>
            <TableHead>{t('workflowDefs.active')}</TableHead>
            <TableHead>{t('common.actions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {defs.map((d) => (
            <TableRow key={d.id}>
              <TableCell>{d.id}</TableCell>
              <TableCell className="font-medium">{d.name}</TableCell>
              <TableCell>{d.description || '-'}</TableCell>
              <TableCell>v{d.version}</TableCell>
              <TableCell>
                <span className={d.is_active ? 'text-green-600' : 'text-gray-400'}>
                  {d.is_active ? t('common.yes') : t('common.no')}
                </span>
              </TableCell>
              <TableCell className="space-x-2">
                <Button variant="link" size="sm" className="h-auto p-0" onClick={() => setEditing(d)}>
                  {t('common.edit')}
                </Button>
                <Button variant="link" size="sm" className="h-auto p-0 text-red-500" onClick={() => handleDelete(d.id)}>
                  {t('common.delete')}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

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
  const { t } = useTranslation()
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
      setError(t('workflowDefs.invalidJson'))
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

  const title = def ? t('workflowDefs.editDefinition') : t('workflowDefs.createDefinition')

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-[600px] max-h-[85vh] overflow-auto">
        <h2 className="text-lg font-bold mb-4">{title}</h2>
        {error && <div className="mb-3 text-sm text-red-600 bg-red-50 rounded px-3 py-2">{error}</div>}
        <label className="block mb-2 text-sm">
          {t('workflowDefs.name')}
          <Input className="mt-0.5" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="block mb-2 text-sm">
          {t('workflowDefs.description')}
          <Input className="mt-0.5" value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
        <label className="block mb-2 text-sm">
          {t('workflowDefs.icon')}
          <Input className="mt-0.5" value={icon} onChange={(e) => setIcon(e.target.value)} />
        </label>
        {def && (
          <label className="flex items-center gap-2 mb-2 text-sm">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            {t('workflowDefs.active')}
          </label>
        )}
        <label className="block mb-4 text-sm">
          {t('workflowDefs.definition')}
          <Textarea className="mt-0.5 font-mono text-xs" rows={14} value={definitionStr} onChange={(e) => setDefinitionStr(e.target.value)} />
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
