import { Handle, Position } from '@xyflow/react'

function BaseNode({
  label,
  color,
  children,
}: {
  label: string
  color: string
  children?: React.ReactNode
}) {
  return (
    <div
      style={{
        padding: '8px 14px',
        borderRadius: 6,
        border: `2px solid ${color}`,
        background: '#fff',
        color,
        fontSize: 12,
        fontWeight: 600,
        minWidth: 120,
        textAlign: 'center',
        position: 'relative',
      }}
    >
      <Handle type="target" position={Position.Top} style={{ width: 8, height: 8, background: color }} />
      {label}
      {children}
      <Handle type="source" position={Position.Bottom} style={{ width: 8, height: 8, background: color }} />
    </div>
  )
}

export function StartNode({ data }: any) {
  return (
    <BaseNode label={data?.label || 'Start'} color="#22c55e">
      <div style={{ fontSize: 10, fontWeight: 400, color: '#6b7280', marginTop: 2 }}>start</div>
    </BaseNode>
  )
}

export function ApprovalNode({ data }: any) {
  const atype = data?.assignee_type || 'manager'
  return (
    <BaseNode label={data?.label || 'Approval'} color="#3b82f6">
      <div style={{ fontSize: 10, fontWeight: 400, color: '#6b7280', marginTop: 2 }}>
        {atype === 'chain' ? 'chain' : atype}
      </div>
    </BaseNode>
  )
}

export function ConditionNode({ data }: any) {
  return (
    <div
      style={{
        width: 100,
        height: 60,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#fef9c3',
        border: '2px solid #eab308',
        transform: 'rotate(45deg)',
        borderRadius: 4,
        position: 'relative',
      }}
    >
      <Handle type="target" position={Position.Top} style={{ width: 8, height: 8, background: '#eab308' }} />
      <span
        style={{
          transform: 'rotate(-45deg)',
          fontSize: 11,
          fontWeight: 600,
          color: '#a16207',
          whiteSpace: 'nowrap',
        }}
      >
        {data?.label || 'Condition'}
      </span>
      <Handle type="source" position={Position.Bottom} style={{ width: 8, height: 8, background: '#eab308' }} />
    </div>
  )
}

export function EndNode({ data }: any) {
  return (
    <BaseNode label={data?.label || 'End'} color="#ef4444">
      <div style={{ fontSize: 10, fontWeight: 400, color: '#6b7280', marginTop: 2 }}>
        {data?.outcome || 'end'}
      </div>
    </BaseNode>
  )
}
