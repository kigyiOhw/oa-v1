import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ReactFlow,
  Node,
  Edge,
  Background,
  Controls,
  MarkerType,
} from '@xyflow/react'
import dagre from 'dagre'
import '@xyflow/react/dist/style.css'
import type { TaskItem, HistoryItem } from '../api/workflow'

interface FlowchartProps {
  definition: Record<string, unknown> | null | undefined
  tasks?: TaskItem[] | null
  history?: HistoryItem[] | null
  currentNodeId?: string | null
  status?: string
}

interface FlowNode {
  id: string
  type: string
  label: string
  assignee_type?: string
  assignee_value?: string
}

interface FlowTransition {
  from: string
  action: string
  to: string
}

const NODE_WIDTH = 160
const NODE_HEIGHT = 52

function getLayoutedElements(
  nodes: FlowNode[],
  transitions: FlowTransition[],
  direction: 'TB' | 'LR' = 'TB',
) {
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: direction, nodesep: 40, ranksep: 60 })

  nodes.forEach((n) => {
    g.setNode(n.id, { width: NODE_WIDTH, height: NODE_HEIGHT })
  })
  transitions.forEach((t) => {
    g.setEdge(t.from, t.to)
  })

  dagre.layout(g)

  const layoutedNodes: Node[] = nodes.map((n) => {
    const pos = g.node(n.id)
    return {
      id: n.id,
      data: { label: n.label },
      position: { x: pos.x - NODE_WIDTH / 2, y: pos.y - NODE_HEIGHT / 2 },
      type: 'default',
      style: {},
    }
  })

  const layoutedEdges: Edge[] = transitions.map((t, i) => ({
    id: `e-${t.from}-${t.to}-${i}`,
    source: t.from,
    target: t.to,
    label: t.action,
    type: 'smoothstep',
    markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
  }))

  return { nodes: layoutedNodes, edges: layoutedEdges }
}

function getNodeStatusColor(
  nodeId: string,
  nodeType: string,
  tasks: TaskItem[],
  history: HistoryItem[],
  currentNodeId: string | null | undefined,
  instanceStatus: string | undefined,
): { bg: string; border: string; text: string } {
  // Check if this node is in history (visited)
  const visitedActions = new Set(
    history?.map((h) => h.node_id) || [],
  )

  // Check if this node has a current task
  const isCurrent =
    (nodeId === currentNodeId && instanceStatus === 'pending') ||
    tasks?.some((t) => t.node_id === nodeId && t.status === 'pending')

  const isVisited = visitedActions.has(nodeId)

  // End nodes
  if (nodeType === 'end') {
    if (instanceStatus === 'approved') {
      return { bg: '#dcfce7', border: '#22c55e', text: '#166534' }
    }
    if (instanceStatus === 'rejected') {
      return { bg: '#fee2e2', border: '#ef4444', text: '#991b1b' }
    }
    if (instanceStatus === 'cancelled') {
      return { bg: '#f3f4f6', border: '#9ca3af', text: '#4b5563' }
    }
    if (isVisited || instanceStatus === 'approved' || instanceStatus === 'rejected') {
      return { bg: '#f0fdf4', border: '#22c55e', text: '#166534' }
    }
    return { bg: '#f9fafb', border: '#d1d5db', text: '#9ca3af' }
  }

  // Start node
  if (nodeType === 'start') {
    return { bg: '#dcfce7', border: '#22c55e', text: '#166534' }
  }

  // Condition node
  if (nodeType === 'condition') {
    if (isVisited) {
      return { bg: '#fef9c3', border: '#eab308', text: '#854d0e' }
    }
    return { bg: '#fefce8', border: '#fde047', text: '#a16207' }
  }

  // Approval / task nodes
  if (isCurrent) {
    return { bg: '#eff6ff', border: '#3b82f6', text: '#1e40af' }
  }
  if (isVisited) {
    const nodeHistory = history?.filter((h) => h.node_id === nodeId) || []
    const lastAction = nodeHistory[nodeHistory.length - 1]?.action
    if (lastAction === 'approve') {
      return { bg: '#f0fdf4', border: '#22c55e', text: '#166534' }
    }
    if (lastAction === 'reject') {
      return { bg: '#fee2e2', border: '#ef4444', text: '#991b1b' }
    }
    return { bg: '#f0fdf4', border: '#22c55e', text: '#166534' }
  }

  // Not visited yet
  return { bg: '#f9fafb', border: '#d1d5db', text: '#9ca3af' }
}

export default function WorkflowFlowchart({
  definition,
  tasks,
  history,
  currentNodeId,
  status,
}: FlowchartProps) {
  const { t } = useTranslation()

  const { nodes, edges } = useMemo(() => {
    if (!definition) return { nodes: [], edges: [] }

    const flowNodes: FlowNode[] = (definition as any).nodes || []
    const flowTransitions: FlowTransition[] = (definition as any).transitions || []

    const tasksList = tasks || []
    const historyList = history || []

    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
      flowNodes,
      flowTransitions,
    )

    // Apply colors
    const coloredNodes = layoutedNodes.map((n) => {
      const flowNode = flowNodes.find((fn) => fn.id === n.id)
      const nodeType = flowNode?.type || 'approval'
      const colors = getNodeStatusColor(n.id, nodeType, tasksList, historyList, currentNodeId, status)

      const isCurrent =
        (n.id === currentNodeId && status === 'pending') ||
        tasksList.some((t) => t.node_id === n.id && t.status === 'pending')

      return {
        ...n,
        data: {
          ...n.data,
          label: (
            <div
              className="px-3 py-2 rounded-lg text-xs font-medium text-center border-2 shadow-sm"
              style={{
                backgroundColor: colors.bg,
                borderColor: colors.border,
                color: colors.text,
                minWidth: NODE_WIDTH,
                animation: isCurrent ? 'pulse 2s infinite' : undefined,
              }}
            >
              {flowNode?.label || n.id}
            </div>
          ),
        },
        style: {
          width: NODE_WIDTH,
          // ReactFlow renders the data.label as a child of the node wrapper
        },
      }
    })

    return { nodes: coloredNodes, edges: layoutedEdges }
  }, [definition, tasks, history, currentNodeId, status])

  if (!definition) {
    return (
      <div className="flex items-center justify-center h-48 bg-gray-50 rounded-lg border border-dashed border-gray-300">
        <p className="text-sm text-gray-400">{t('workflow.noDefinition')}</p>
      </div>
    )
  }

  return (
    <div className="w-full" style={{ height: 400 }}>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
      `}</style>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#f1f5f9" gap={16} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  )
}
