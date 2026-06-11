export interface FlowNodeData extends Record<string, unknown> {
  label: string
  assignee_type?: string
  assignee_value?: string
  assignee_chain?: Array<{ type: string; value?: string; label?: string }>
  outcome?: string
}

export interface ConditionRule {
  field: string
  operator: '==' | '!=' | '>' | '<' | '>=' | '<=' | 'in' | 'contains'
  value: unknown
}

export interface ConditionGroup {
  operator: 'AND' | 'OR'
  rules: (ConditionRule | ConditionGroup)[]
}

export interface FlowEdgeData extends Record<string, unknown> {
  action: string
  conditions?: ConditionRule[] | ConditionGroup
}

export interface DefinitionNode {
  id: string
  type: string
  label: string
  assignee_type?: string
  assignee_value?: string
  assignee_chain?: Array<{ type: string; value?: string; label?: string }>
  outcome?: string
}

export interface DefinitionTransition {
  from: string
  action: string
  to: string
  conditions?: ConditionRule[] | ConditionGroup
}

export interface WorkflowDefinition {
  nodes: DefinitionNode[]
  transitions: DefinitionTransition[]
}
