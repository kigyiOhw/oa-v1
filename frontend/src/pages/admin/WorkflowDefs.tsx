import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ReactFlowProvider } from '@xyflow/react'
import { useToast } from '@/components/ui/toast'
import { workflowDefApi, DefinitionItem } from '../../api/workflow'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import ConfirmDialog from '@/components/ui/confirm-dialog'
import WorkflowEditor from '@/components/workflow/WorkflowEditor'
import type { WorkflowDefinition } from '@/components/workflow/types'

export default function WorkflowDefs() {
  const { t } = useTranslation()
  const toast = useToast()
  const [defs, setDefs] = useState<DefinitionItem[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [editing, setEditing] = useState<DefinitionItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [confirmState, setConfirmState] = useState<{open: boolean; title: string; message: string; onConfirm: () => void} | null>(null)

  const fetchDefs = async () => {
    try {
      const res = await workflowDefApi.list()
      setDefs(res.data)
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }

  useEffect(() => {
    fetchDefs()
  }, [])

  const handleDelete = (id: number) => {
    setConfirmState({
      open: true,
      title: t('common.confirm'),
      message: t('workflowDefs.deleteConfirm'),
      onConfirm: async () => {
        try {
          await workflowDefApi.delete(id)
          fetchDefs()
        } catch (e: any) {
          toast.error(e.response?.data?.detail || 'Delete failed')
        }
      },
    })
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
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
              </TableRow>
            ))
          ) : defs.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6}>
                <EmptyState title={t('common.noData')} />
              </TableCell>
            </TableRow>
          ) : (
            defs.map((d) => (
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
          )))}
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
  const toast = useToast()
  const [name, setName] = useState(def?.name || '')
  const [description, setDescription] = useState(def?.description || '')
  const [icon, setIcon] = useState(def?.icon || '')
  const [definition, setDefinition] = useState<WorkflowDefinition>(
    (def?.definition as unknown as WorkflowDefinition) || defaultDefinition()
  )
  const [isActive, setIsActive] = useState(def?.is_active ?? true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showSource, setShowSource] = useState(false)

  const handleValidate = async () => {
    setError('')
    try {
      const res = await workflowDefApi.validate(definition as unknown as Record<string, unknown>)
      if (res.data.valid) {
        toast.success('Definition is valid')
      } else {
        setError(res.data.errors.join('; '))
      }
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Validation failed')
    }
  }

  const handleSave = async () => {
    setError('')
    setSaving(true)
    try {
      if (def) {
        await workflowDefApi.update(def.id, {
          name: name || undefined,
          description: description || null,
          icon: icon || null,
          definition: definition as unknown as Record<string, unknown>,
          is_active: isActive,
        })
      } else {
        await workflowDefApi.create({
          name,
          description: description || null,
          icon: icon || null,
          definition: definition as unknown as Record<string, unknown>,
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
      <div className="bg-white rounded-lg p-6 w-[960px] max-w-[95vw] max-h-[90vh] overflow-auto flex flex-col">
        <h2 className="text-lg font-bold mb-4">{title}</h2>
        {error && <div className="mb-3 text-sm text-red-600 bg-red-50 rounded px-3 py-2">{error}</div>}
        <div className="grid grid-cols-3 gap-4 mb-4">
          <label className="block text-sm">
            {t('workflowDefs.name')}
            <Input className="mt-0.5" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="block text-sm">
            {t('workflowDefs.description')}
            <Input className="mt-0.5" value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>
          <label className="block text-sm">
            {t('workflowDefs.icon')}
            <Input className="mt-0.5" value={icon} onChange={(e) => setIcon(e.target.value)} />
          </label>
        </div>
        {def && (
          <label className="flex items-center gap-2 mb-3 text-sm">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            {t('workflowDefs.active')}
          </label>
        )}
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-medium">{t('workflowDefs.definition')}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleValidate}>Validate</Button>
            <Button variant="ghost" size="sm" onClick={() => setShowSource((v) => !v)}>
              {showSource ? 'Hide Source' : 'View Source'}
            </Button>
          </div>
        </div>
        {showSource && (
          <Textarea
            className="mb-3 font-mono text-xs"
            rows={8}
            value={JSON.stringify(definition, null, 2)}
            onChange={(e) => {
              try {
                setDefinition(JSON.parse(e.target.value))
              } catch { /* ignore invalid json */ }
            }}
          />
        )}
        <div className="flex-1 min-h-[400px] mb-4">
          <ReactFlowProvider>
            <WorkflowEditor
              initialDefinition={definition}
              onChange={setDefinition}
            />
          </ReactFlowProvider>
        </div>
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
