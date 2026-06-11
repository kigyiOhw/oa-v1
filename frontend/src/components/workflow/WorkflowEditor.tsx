import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type Connection,
  Panel,
  useReactFlow,
} from '@xyflow/react'
import dagre from 'dagre'
import '@xyflow/react/dist/style.css'

import { StartNode, ApprovalNode, ConditionNode, EndNode } from './nodes'
import type { FlowNodeData, FlowEdgeData, WorkflowDefinition, DefinitionNode, DefinitionTransition } from './types'

const nodeTypes = {
  startNode: StartNode,
  approvalNode: ApprovalNode,
  conditionNode: ConditionNode,
  endNode: EndNode,
}

const NODE_WIDTH = 160
const NODE_HEIGHT = 60

function definitionToFlow(def: WorkflowDefinition): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = def.nodes.map((n) => ({
    id: n.id,
    type: `${n.type}Node`,
    position: { x: 0, y: 0 },
    data: {
      label: n.label,
      assignee_type: n.assignee_type,
      assignee_value: n.assignee_value,
      assignee_chain: n.assignee_chain,
      outcome: n.outcome,
    } as unknown as FlowNodeData,
  }))

  const edges: Edge[] = def.transitions.map((t, i) => ({
    id: `e-${t.from}-${t.to}-${i}`,
    source: t.from,
    target: t.to,
    label: t.conditions && Array.isArray(t.conditions) && t.conditions.length > 0
      ? `${t.action} [${t.conditions.map((c: any) => `${c.field}${c.operator}${c.value}`).join(', ')}]`
      : t.action,
    data: { action: t.action, conditions: t.conditions } as unknown as FlowEdgeData,
    type: 'smoothstep',
    markerEnd: { type: 'arrowclosed' as any, width: 16, height: 16 },
  }))

  return { nodes, edges }
}

function flowToDefinition(nodes: Node[], edges: Edge[]): WorkflowDefinition {
  const defNodes: DefinitionNode[] = nodes.map((n) => {
    const data = n.data as unknown as FlowNodeData
    const base: DefinitionNode = {
      id: n.id,
      type: (n.type || 'approvalNode').replace('Node', ''),
      label: data.label || n.id,
    }
    if (base.type === 'approval' || base.type === 'task') {
      base.assignee_type = data.assignee_type
      base.assignee_value = data.assignee_value
      base.assignee_chain = data.assignee_chain
    }
    if (base.type === 'end') {
      base.outcome = data.outcome
    }
    return base
  })

  const defTransitions: DefinitionTransition[] = edges.map((e) => {
    const data = e.data as unknown as FlowEdgeData
    const base: DefinitionTransition = {
      from: e.source,
      action: data?.action || 'default',
      to: e.target,
    }
    if (data?.conditions && Array.isArray(data.conditions) && data.conditions.length > 0) {
      base.conditions = data.conditions
    }
    return base
  })

  return { nodes: defNodes, transitions: defTransitions }
}

function autoLayout(nodes: Node[], edges: Edge[]): Node[] {
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: 'TB', nodesep: 60, ranksep: 80 })

  nodes.forEach((n) => {
    g.setNode(n.id, { width: NODE_WIDTH, height: NODE_HEIGHT })
  })
  edges.forEach((e) => {
    g.setEdge(e.source, e.target)
  })

  dagre.layout(g)

  return nodes.map((n) => {
    const pos = g.node(n.id)
    return {
      ...n,
      position: { x: pos.x - NODE_WIDTH / 2, y: pos.y - NODE_HEIGHT / 2 },
    }
  })
}

interface WorkflowEditorProps {
  initialDefinition?: WorkflowDefinition
  onChange?: (definition: WorkflowDefinition) => void
  readOnly?: boolean
}

export default function WorkflowEditor({ initialDefinition, onChange, readOnly = false }: WorkflowEditorProps) {
  const defaultDef: WorkflowDefinition = useMemo(() => ({
    nodes: [
      { id: 'start', type: 'start', label: 'Submit' },
      { id: 'approve', type: 'approval', label: 'Approval', assignee_type: 'manager' },
      { id: 'end_approved', type: 'end', label: 'Approved', outcome: 'approved' },
      { id: 'end_rejected', type: 'end', label: 'Rejected', outcome: 'rejected' },
    ],
    transitions: [
      { from: 'start', action: 'submit', to: 'approve' },
      { from: 'approve', action: 'approve', to: 'end_approved' },
      { from: 'approve', action: 'reject', to: 'end_rejected' },
    ],
  }), [])

  const defToUse = initialDefinition || defaultDef
  const initial = useMemo(() => {
    const { nodes, edges } = definitionToFlow(defToUse)
    return { nodes: autoLayout(nodes, edges), edges }
  }, [defToUse])

  const [nodes, setNodes, onNodesChange] = useNodesState(initial.nodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initial.edges)
  const [selectedNode, setSelectedNode] = useState<Node | null>(null)
  const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null)

  const { fitView } = useReactFlow()

  const emitChange = useCallback((nextNodes: Node[], nextEdges: Edge[]) => {
    if (onChange) {
      onChange(flowToDefinition(nextNodes, nextEdges))
    }
  }, [onChange])

  const onConnect = useCallback(
    (connection: Connection) => {
      const edge: Edge = {
        id: `e-${connection.source}-${connection.target}-${Date.now()}`,
        source: connection.source!,
        target: connection.target!,
        label: 'default',
        data: { action: 'default' } as unknown as FlowEdgeData,
        type: 'smoothstep',
        markerEnd: { type: 'arrowclosed' as any, width: 16, height: 16 },
      }
      const nextEdges = addEdge(edge, edges)
      setEdges(nextEdges)
      emitChange(nodes, nextEdges)
    },
    [nodes, edges, setEdges, emitChange]
  )

  const onNodeClick = useCallback((_: any, node: Node) => {
    setSelectedNode(node)
    setSelectedEdge(null)
  }, [])

  const onEdgeClick = useCallback((_: any, edge: Edge) => {
    setSelectedEdge(edge)
    setSelectedNode(null)
  }, [])

  const onPaneClick = useCallback(() => {
    setSelectedNode(null)
    setSelectedEdge(null)
  }, [])

  const addNode = useCallback((type: string) => {
    const id = `${type}_${Date.now()}`
    const newNode: Node = {
      id,
      type: `${type}Node`,
      position: { x: 100 + Math.random() * 200, y: 100 + Math.random() * 200 },
      data: {
        label: type === 'start' ? 'Submit' : type === 'end' ? 'End' : type === 'condition' ? 'Condition' : 'Approval',
        ...(type === 'approval' ? { assignee_type: 'manager' } : {}),
        ...(type === 'end' ? { outcome: 'approved' } : {}),
      } as unknown as FlowNodeData,
    }
    const nextNodes = [...nodes, newNode]
    setNodes(nextNodes)
    emitChange(nextNodes, edges)
  }, [nodes, edges, setNodes, emitChange])

  const deleteSelected = useCallback(() => {
    if (selectedNode) {
      const nextNodes = nodes.filter((n) => n.id !== selectedNode.id)
      const nextEdges = edges.filter((e) => e.source !== selectedNode.id && e.target !== selectedNode.id)
      setNodes(nextNodes)
      setEdges(nextEdges)
      setSelectedNode(null)
      emitChange(nextNodes, nextEdges)
    } else if (selectedEdge) {
      const nextEdges = edges.filter((e) => e.id !== selectedEdge.id)
      setEdges(nextEdges)
      setSelectedEdge(null)
      emitChange(nodes, nextEdges)
    }
  }, [selectedNode, selectedEdge, nodes, edges, setNodes, setEdges, emitChange])

  const updateNodeData = useCallback(
    (key: string, value: any) => {
      if (!selectedNode) return
      const nextNodes = nodes.map((n) =>
        n.id === selectedNode.id ? { ...n, data: { ...n.data, [key]: value } } : n
      )
      setNodes(nextNodes)
      setSelectedNode({ ...selectedNode, data: { ...selectedNode.data, [key]: value } })
      emitChange(nextNodes, edges)
    },
    [selectedNode, nodes, edges, setNodes, emitChange]
  )

  const updateEdgeData = useCallback(
    (key: string, value: any) => {
      if (!selectedEdge) return
      const nextEdges = edges.map((e) =>
        e.id === selectedEdge.id ? { ...e, data: { ...e.data, [key]: value } } : e
      )
      setEdges(nextEdges)
      setSelectedEdge({ ...selectedEdge, data: { ...selectedEdge.data, [key]: value } })
      emitChange(nodes, nextEdges)
    },
    [selectedEdge, nodes, edges, setEdges, emitChange]
  )

  const handleLayout = useCallback(() => {
    const layouted = autoLayout(nodes, edges)
    setNodes(layouted)
    setTimeout(() => fitView({ padding: 0.2 }), 50)
  }, [nodes, edges, setNodes, fitView])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && !readOnly) {
        deleteSelected()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [deleteSelected, readOnly])

  const nodeType = selectedNode ? (selectedNode.type || '').replace('Node', '') : null

  return (
    <div style={{ display: 'flex', height: 500, border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
      {/* Left palette */}
      {!readOnly && (
        <div style={{ width: 140, borderRight: '1px solid #e5e7eb', padding: 12, background: '#f9fafb' }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: '#374151' }}>Nodes</div>
          {[
            { type: 'start', label: 'Start', color: '#22c55e' },
            { type: 'approval', label: 'Approval', color: '#3b82f6' },
            { type: 'condition', label: 'Condition', color: '#eab308' },
            { type: 'end', label: 'End', color: '#ef4444' },
          ].map((item) => (
            <button
              key={item.type}
              onClick={() => addNode(item.type)}
              style={{
                display: 'block',
                width: '100%',
                padding: '8px 12px',
                marginBottom: 6,
                fontSize: 12,
                border: `1px solid ${item.color}`,
                borderRadius: 6,
                background: '#fff',
                color: item.color,
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              + {item.label}
            </button>
          ))}
        </div>
      )}

      {/* Canvas */}
      <div style={{ flex: 1, position: 'relative' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={readOnly ? undefined : onConnect}
          onNodeClick={onNodeClick}
          onEdgeClick={onEdgeClick}
          onPaneClick={onPaneClick}
          nodeTypes={nodeTypes}
          fitView
          nodesDraggable={!readOnly}
          nodesConnectable={!readOnly}
          elementsSelectable={!readOnly}
          proOptions={{ hideAttribution: true }}
        >
          <Background color="#f1f5f9" gap={16} />
          <Controls showInteractive={false} />
          <MiniMap style={{ height: 80, width: 120 }} zoomable pannable />
          {!readOnly && (
            <Panel position="top-right">
              <button
                onClick={handleLayout}
                style={{
                  padding: '4px 10px',
                  fontSize: 11,
                  border: '1px solid #d1d5db',
                  borderRadius: 4,
                  background: '#fff',
                  cursor: 'pointer',
                }}
              >
                Auto Layout
              </button>
            </Panel>
          )}
        </ReactFlow>
      </div>

      {/* Right property panel */}
      {!readOnly && (
        <div style={{ width: 220, borderLeft: '1px solid #e5e7eb', padding: 12, background: '#f9fafb', overflow: 'auto' }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: '#374151' }}>Properties</div>

          {selectedNode && nodeType && (
            <div>
              <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>Node: {selectedNode.id}</div>
              <div style={{ marginBottom: 8 }}>
                <label style={{ fontSize: 11, display: 'block', marginBottom: 2 }}>Label</label>
                <input
                  type="text"
                  value={(selectedNode.data as unknown as FlowNodeData).label || ''}
                  onChange={(e) => updateNodeData('label', e.target.value)}
                  style={{ width: '100%', padding: '4px 6px', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 4 }}
                />
              </div>

              {(nodeType === 'approval' || nodeType === 'task') && (
                <>
                  <div style={{ marginBottom: 8 }}>
                    <label style={{ fontSize: 11, display: 'block', marginBottom: 2 }}>Assignee Type</label>
                    <select
                      value={(selectedNode.data as unknown as FlowNodeData).assignee_type || 'manager'}
                      onChange={(e) => updateNodeData('assignee_type', e.target.value)}
                      style={{ width: '100%', padding: '4px 6px', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 4 }}
                    >
                      <option value="manager">Manager</option>
                      <option value="initiator">Initiator</option>
                      <option value="role">Role</option>
                      <option value="user">User</option>
                      <option value="chain">Chain</option>
                    </select>
                  </div>
                  {(selectedNode.data as unknown as FlowNodeData).assignee_type === 'role' && (
                    <div style={{ marginBottom: 8 }}>
                      <label style={{ fontSize: 11, display: 'block', marginBottom: 2 }}>Role Name</label>
                      <input
                        type="text"
                        value={(selectedNode.data as unknown as FlowNodeData).assignee_value || ''}
                        onChange={(e) => updateNodeData('assignee_value', e.target.value)}
                        style={{ width: '100%', padding: '4px 6px', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 4 }}
                      />
                    </div>
                  )}
                  {(selectedNode.data as unknown as FlowNodeData).assignee_type === 'user' && (
                    <div style={{ marginBottom: 8 }}>
                      <label style={{ fontSize: 11, display: 'block', marginBottom: 2 }}>User ID</label>
                      <input
                        type="number"
                        value={(selectedNode.data as unknown as FlowNodeData).assignee_value || ''}
                        onChange={(e) => updateNodeData('assignee_value', e.target.value)}
                        style={{ width: '100%', padding: '4px 6px', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 4 }}
                      />
                    </div>
                  )}
                  {(selectedNode.data as unknown as FlowNodeData).assignee_type === 'chain' && (
                    <div style={{ marginBottom: 8 }}>
                      <label style={{ fontSize: 11, display: 'block', marginBottom: 2 }}>Chain JSON</label>
                      <textarea
                        rows={4}
                        value={JSON.stringify((selectedNode.data as unknown as FlowNodeData).assignee_chain || [{ type: 'manager' }], null, 2)}
                        onChange={(e) => {
                          try {
                            const parsed = JSON.parse(e.target.value)
                            updateNodeData('assignee_chain', parsed)
                          } catch { /* ignore invalid json */ }
                        }}
                        style={{ width: '100%', padding: '4px 6px', fontSize: 11, border: '1px solid #d1d5db', borderRadius: 4, fontFamily: 'monospace' }}
                      />
                    </div>
                  )}
                </>
              )}

              {nodeType === 'end' && (
                <div style={{ marginBottom: 8 }}>
                  <label style={{ fontSize: 11, display: 'block', marginBottom: 2 }}>Outcome</label>
                  <select
                    value={(selectedNode.data as unknown as FlowNodeData).outcome || 'approved'}
                    onChange={(e) => updateNodeData('outcome', e.target.value)}
                    style={{ width: '100%', padding: '4px 6px', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 4 }}
                  >
                    <option value="approved">approved</option>
                    <option value="rejected">rejected</option>
                  </select>
                </div>
              )}

              <button
                onClick={deleteSelected}
                style={{
                  width: '100%',
                  padding: '6px',
                  fontSize: 11,
                  border: '1px solid #ef4444',
                  borderRadius: 4,
                  background: '#fef2f2',
                  color: '#dc2626',
                  cursor: 'pointer',
                }}
              >
                Delete Node
              </button>
            </div>
          )}

          {selectedEdge && (
            <div>
              <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>Edge</div>
              <div style={{ marginBottom: 8 }}>
                <label style={{ fontSize: 11, display: 'block', marginBottom: 2 }}>Action</label>
                <select
                  value={(selectedEdge.data as unknown as FlowEdgeData)?.action || 'default'}
                  onChange={(e) => {
                    const action = e.target.value
                    updateEdgeData('action', action)
                    const nextEdges = edges.map((ed) =>
                      ed.id === selectedEdge.id
                        ? { ...ed, label: action, data: { ...(ed.data as unknown as FlowEdgeData), action } }
                        : ed
                    )
                    setEdges(nextEdges)
                  }}
                  style={{ width: '100%', padding: '4px 6px', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 4 }}
                >
                  <option value="default">default</option>
                  <option value="submit">submit</option>
                  <option value="approve">approve</option>
                  <option value="reject">reject</option>
                </select>
              </div>
              <div style={{ marginBottom: 8 }}>
                <label style={{ fontSize: 11, display: 'block', marginBottom: 2 }}>Conditions JSON</label>
                <textarea
                  rows={4}
                  value={JSON.stringify((selectedEdge.data as unknown as FlowEdgeData)?.conditions || [], null, 2)}
                  onChange={(e) => {
                    try {
                      const parsed = JSON.parse(e.target.value)
                      updateEdgeData('conditions', parsed)
                      const nextEdges = edges.map((ed) =>
                        ed.id === selectedEdge.id
                          ? {
                              ...ed,
                              label:
                                parsed && parsed.length > 0
                                  ? `${(ed.data as unknown as FlowEdgeData)?.action || 'default'} [${parsed.map((c: any) => `${c.field}${c.operator}${c.value}`).join(', ')}]`
                                  : (ed.data as unknown as FlowEdgeData)?.action || 'default',
                              data: { ...(ed.data as unknown as FlowEdgeData), conditions: parsed },
                            }
                          : ed
                      )
                      setEdges(nextEdges)
                    } catch { /* ignore invalid json */ }
                  }}
                  style={{ width: '100%', padding: '4px 6px', fontSize: 11, border: '1px solid #d1d5db', borderRadius: 4, fontFamily: 'monospace' }}
                />
              </div>
              <button
                onClick={deleteSelected}
                style={{
                  width: '100%',
                  padding: '6px',
                  fontSize: 11,
                  border: '1px solid #ef4444',
                  borderRadius: 4,
                  background: '#fef2f2',
                  color: '#dc2626',
                  cursor: 'pointer',
                }}
              >
                Delete Edge
              </button>
            </div>
          )}

          {!selectedNode && !selectedEdge && (
            <div style={{ fontSize: 11, color: '#9ca3af', textAlign: 'center', marginTop: 40 }}>
              Select a node or edge to edit properties
            </div>
          )}
        </div>
      )}
    </div>
  )
}
