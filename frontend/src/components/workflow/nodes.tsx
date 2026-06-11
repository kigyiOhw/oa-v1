import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { FlowNodeData } from './types'

const baseStyle = {
  padding: '10px 16px',
  borderRadius: '8px',
  fontSize: '12px',
  fontWeight: 500,
  minWidth: 120,
  textAlign: 'center' as const,
  border: '2px solid',
  backgroundColor: '#fff',
  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
}

export const StartNode = memo(function StartNode(props: NodeProps) {
  const { data, selected } = props
  const d = data as FlowNodeData
  return (
    <div
      style={{
        ...baseStyle,
        borderColor: selected ? '#16a34a' : '#86efac',
        backgroundColor: '#f0fdf4',
        color: '#166534',
        borderRadius: '50%',
        width: 72,
        height: 72,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 4,
      }}
    >
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <span>{d.label}</span>
      <Handle type="source" position={Position.Bottom} style={{ background: '#16a34a' }} />
    </div>
  )
})

export const ApprovalNode = memo(function ApprovalNode(props: NodeProps) {
  const { data, selected } = props
  const d = data as FlowNodeData
  const typeLabel = d.assignee_type === 'chain'
    ? `Chain (${d.assignee_chain?.length || 0})`
    : d.assignee_type || '-'
  return (
    <div
      style={{
        ...baseStyle,
        borderColor: selected ? '#2563eb' : '#93c5fd',
        backgroundColor: '#eff6ff',
        color: '#1e40af',
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: '#2563eb' }} />
      <div>{d.label}</div>
      <div style={{ fontSize: 10, opacity: 0.7, marginTop: 2 }}>{typeLabel}</div>
      <Handle type="source" position={Position.Bottom} style={{ background: '#2563eb' }} />
    </div>
  )
})

export const ConditionNode = memo(function ConditionNode(props: NodeProps) {
  const { data, selected } = props
  const d = data as FlowNodeData
  return (
    <div
      style={{
        width: 80,
        height: 80,
        transform: 'rotate(45deg)',
        border: `2px solid ${selected ? '#ca8a04' : '#fde047'}`,
        backgroundColor: '#fefce8',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      }}
    >
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <span
        style={{
          transform: 'rotate(-45deg)',
          fontSize: 11,
          fontWeight: 500,
          color: '#854d0e',
          textAlign: 'center',
          lineHeight: 1.2,
        }}
      >
        {d.label}
      </span>
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Left} style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
    </div>
  )
})

export const EndNode = memo(function EndNode(props: NodeProps) {
  const { data, selected } = props
  const d = data as FlowNodeData
  return (
    <div
      style={{
        ...baseStyle,
        borderColor: selected ? '#dc2626' : '#fca5a5',
        backgroundColor: '#fef2f2',
        color: '#991b1b',
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: '#dc2626' }} />
      <div>{d.label}</div>
      <div style={{ fontSize: 10, opacity: 0.7, marginTop: 2 }}>{d.outcome || '-'}</div>
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
    </div>
  )
})
