# OA 系统开发计划

## 1. 项目概述

构建一个企业办公自动化（OA）系统，核心围绕**审批工作流**展开。第一阶段覆盖请假、报销、加班申请等高频场景，后续逐步扩展资产领用、采购申请、用车申请等模块。

系统的核心设计目标是：**流程可配置、表单可定制、权限可管控**。

## 2. 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| 后端 | Python + FastAPI | 异步高性能 API |
| ORM | SQLAlchemy 2.0 (async) | 数据库交互 |
| 数据库 | PostgreSQL 15+ | 主数据库，支持 JSONB 存储动态表单 |
| 迁移 | Alembic | 数据库版本管理 |
| 缓存 | Redis | Session、锁、热点数据缓存 |
| 前端 | React 18 + TypeScript | 用户界面 |
| UI 库 | Tailwind CSS + shadcn/ui | 样式 + 无头组件 |
| 状态管理 | Zustand | 轻量全局状态 |
| 路由 | React Router v6 | 前端路由 |
| 构建 | Vite | 前端构建工具 |
| 实时通信 | WebSocket | 审批通知、待办推送 |

## 3. 项目结构

```
oa-v1/
├── backend/                 # FastAPI 后端
│   ├── app/
│   │   ├── api/             # API 路由层 (v1/)
│   │   ├── core/            # 配置、安全、事件、异常处理
│   │   ├── models/          # SQLAlchemy ORM 模型
│   │   ├── schemas/         # Pydantic 序列化/校验模型
│   │   ├── services/        # 业务逻辑层
│   │   ├── repositories/    # 数据访问层
│   │   ├── db/              # 数据库连接、会话管理
│   │   ├── utils/           # 通用工具
│   │   └── main.py          # 应用入口
│   ├── alembic/             # 迁移脚本
│   ├── tests/               # 后端测试
│   └── requirements.txt / pyproject.toml
├── frontend/                # React 前端
│   ├── src/
│   │   ├── api/             # Axios 封装、API 请求
│   │   ├── components/      # 公共组件
│   │   ├── pages/           # 页面级组件
│   │   ├── stores/          # Zustand 状态管理
│   │   ├── router/          # 路由配置
│   │   ├── types/           # TypeScript 类型定义
│   │   ├── utils/           # 工具函数
│   │   └── main.tsx         # 入口
│   └── package.json
└── docker-compose.yml       # 本地开发环境编排
```

## 4. 数据库核心设计

### 4.1 用户与权限 (RBAC)

```
users                 # 用户基础信息
roles                 # 角色定义 (员工、部门经理、HR、财务、管理员)
permissions           # 权限点
role_permissions      # 角色-权限关联
user_roles            # 用户-角色关联
departments           # 部门组织架构
```

### 4.2 工作流引擎 (核心)

```
workflow_defs         # 流程定义 (请假流程、报销流程...)
workflow_nodes        # 流程节点定义 (提交->直属经理审批->HR审批)
workflow_transitions  # 节点流转规则 (同意/驳回/转交)
workflow_instances    # 流程实例 (张三的请假单)
workflow_tasks        # 待办任务 (待李四审批)
workflow_history      # 审批历史记录
```

**关键设计**：流程定义采用预配置模式（非拖拽式），通过 JSON 描述节点和流转规则，存储于 `workflow_defs.definition` 字段。

### 4.3 表单系统

```
form_templates        # 表单模板定义 (字段结构、校验规则)
form_instances        # 表单实例数据 (JSONB 存储用户填写的值)
```

### 4.4 业务模块

```
leave_requests        # 请假申请 (关联 workflow_instance)
expense_reports       # 报销申请 (关联 workflow_instance)
overtime_requests     # 加班申请 (关联 workflow_instance)
attachments           # 附件管理 (报销发票、加班截图等)
notifications         # 消息通知
```

## 5. 后端架构 (FastAPI)

### 5.1 分层设计

- **API 层** (`api/`): 只负责路由定义、依赖注入、参数校验、响应组装，不包含业务逻辑。
- **Service 层** (`services/`): 核心业务逻辑。工作流引擎的核心代码位于 `services/workflow/`。
- **Repository 层** (`repositories/`): 数据库 CRUD 封装，按模型划分。

### 5.2 核心机制

- **依赖注入**: FastAPI 原生 DI，用于获取 DB Session、当前用户、权限校验。
- **统一异常**: 自定义 `OAException` -> 全局 Exception Handler -> 标准 JSON 响应。
- **认证**: JWT (access_token + refresh_token)，密码 bcrypt 加密。
- **授权**: RBAC 中间件，装饰器 `@require_permission("expense:approve")`。

### 5.3 工作流引擎逻辑 (伪代码)

```python
# 提交申请 -> 创建流程实例 -> 生成首个待办任务
async def submit_request(user, form_data, workflow_def_id):
    instance = await create_workflow_instance(user, workflow_def_id)
    task = await create_first_task(instance)
    await notify_user(task.assignee_id)

# 处理审批 -> 根据流转规则推进或结束
async def approve_task(user, task_id, action, comment):
    task = await get_task(task_id)
    # 权限校验：当前用户是否是 task 的 assignee
    next_node = workflow_engine.transition(task, action)
    if next_node.type == "end":
        await close_workflow_instance(task.instance_id, status="approved")
    else:
        await create_next_task(task.instance_id, next_node)
```

## 6. 前端架构 (React)

### 6.1 页面结构

- **工作台** (`/dashboard`): 我的待办、我已办、我发起的。
- **流程中心** (`/flows/*`): 各业务模块入口 (请假、报销...)。
- **审批页面** (`/approve/:taskId`): 通用审批界面，根据表单模板动态渲染。
- **管理后台** (`/admin/*`): 流程配置、表单设计、用户管理（管理员可见）。

### 6.2 动态表单渲染

前端根据后端返回的 `form_template.fields` 定义，动态渲染表单组件。支持字段类型：`input`, `textarea`, `number`, `date`, `datetime`, `select`, `file`, `user-select`。

### 6.3 API 封装

Axios 拦截器统一处理：Token 注入、401 跳转、错误提示、Loading 状态。

## 7. 开发阶段规划

### Phase 1: 基础骨架 (Week 1)
- [ ] Docker Compose 搭建 (PG + Redis + Backend + Frontend)
- [ ] FastAPI 项目初始化：目录结构、配置、数据库连接、Alembic
- [ ] React + Vite 项目初始化：路由、Axios、Tailwind CSS、Zustand
- [ ] 用户注册/登录/登出 API + 页面
- [ ] JWT 认证流程跑通

### Phase 2: RBAC 与组织架构 (Week 2)
- [ ] 角色、权限模型设计
- [ ] 部门树形结构 CRUD
- [ ] 用户管理后台页面
- [ ] 前端路由权限控制

### Phase 3: 工作流引擎核心 (Week 3)
- [ ] 流程定义数据结构 + 管理 API
- [ ] 流程实例创建、任务生成逻辑
- [ ] 审批流转 (同意/驳回) 核心逻辑
- [ ] 审批历史记录

### Phase 4: 请假模块端到端 (Week 4)
- [ ] 请假表单模板配置
- [ ] 请假申请提交 -> 审批 -> 完成全流程
- [ ] 我的待办/已办/我发起的 列表页面
- [ ] WebSocket 实时通知（新待办、审批结果推送）

### Phase 5: 报销与加班模块 (Week 5)
- [ ] 复用工作流引擎，配置报销、加班流程
- [ ] 报销单附件上传 (发票)
- [ ] 加班申请与请假联动校验

### Phase 6: 完善与优化 (Week 6+)
- [ ] 表单字段校验规则增强
- [ ] 流程图可视化展示
- [ ] 数据权限（部门隔离）
- [ ] 单元测试覆盖核心逻辑
- [ ] 消息已读、通知中心历史

## 8. 本地开发启动方式 (规划中)

```bash
# 启动基础设施
docker-compose up -d postgres redis

# 后端 (backend/)
cd backend
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --port 8000

# 前端 (frontend/)
cd frontend
npm install
npm run dev
```

---

**下一步**：确认以上规划后，将从 **Phase 1** 开始，先生成完整的目录结构和基础代码。
