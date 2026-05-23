# OA 系统开发计划

## 1. 项目概述

构建一个企业办公自动化（OA）系统，核心围绕**审批工作流**展开。第一阶段覆盖请假、报销、加班申请等高频场景，后续逐步扩展资产领用、采购申请、用车申请等模块。

系统的核心设计目标是：**流程可配置、表单可定制、权限可管控**。

## 2. 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| 后端 | Python + FastAPI | 异步高性能 API |
| ORM | SQLAlchemy 2.0 (async) | 数据库交互 |
| 数据库 | PostgreSQL 16 | 主数据库，支持 JSONB 存储动态表单 |
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
workflow_defs         # 流程定义，节点和流转规则存于 definition(JSONB)
workflow_instances    # 流程实例 (张三的请假单)
workflow_tasks        # 待办任务 (待李四审批)
workflow_history      # 审批历史记录
```

**关键设计**：流程定义采用预配置模式（非拖拽式），节点和流转规则通过 JSON 描述，存储于 `workflow_defs.definition` 字段。不创建独立的 `workflow_nodes` 和 `workflow_transitions` 表，解析在应用层完成。

### 4.3 公司门户

```
announcements         # 公告（Markdown 内容，支持发布/置顶）
media_files           # 媒体文件（图片/视频，文件路径 + 类型）
settings              # 键值对配置（公司信息、内网快捷链接等）
```

**设计要点：**
- 媒体存储采用策略模式（`StorageBackend` 抽象），测试环境用本地磁盘，生产可切换 OSS/S3/文件服务器
- 快捷入口（请假/报销/审批/通知）由前端按用户权限硬编码显示，无需额外后端接口
- 内网导航链接存于 `settings` 表（`key="quick_links"`，值为 JSON 数组），管理员可在后台配置

### 4.3 表单系统

```
form_templates        # 表单模板定义 (字段结构、校验规则)
form_instances        # 表单实例数据 (JSONB 存储用户填写的值)
```

### 4.4 业务模块

```
employee_profiles     # 员工档案 (与 users 1:1，含联系方式、入职信息、就职状态)
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

### Phase 1: 基础骨架 (Week 1) ✅ 已完成
- [✓] Docker Compose 搭建 (PG + Redis + Backend + Frontend)
- [✓] FastAPI 项目初始化：目录结构、配置、数据库连接、Alembic
- [✓] React + Vite 项目初始化：路由、Axios、Tailwind CSS、Zustand
- [✓] 用户注册/登录/登出 API + 页面
- [✓] JWT 认证流程跑通

### Phase 2: RBAC 与组织架构 (Week 2) ✅ 已完成
- [✓] 角色、权限模型设计
- [✓] 部门树形结构 CRUD
- [✓] 用户管理后台页面
- [✓] 前端路由权限控制

### Phase 3: 工作流引擎核心 (Week 3) ✅ 已完成
- [✓] 流程定义数据结构 + 管理 API
- [✓] 流程实例创建、任务生成逻辑
- [✓] 审批流转 (同意/驳回) 核心逻辑
- [✓] 审批历史记录
- [✓] 审批人解析策略 (initiator / manager / role / user)
- [✓] 前端页面 (流程定义管理、我的待办、我发起的、实例详情)
- [✓] 后端测试 (18 个测试用例全部通过)

### Phase 4: 公司门户首页 (Week 4) ✅ 已完成
- [✓] 公告系统（Markdown 内容，发布/置顶，管理 CRUD）
- [✓] 媒体库（图片/视频上传，可插拔存储后端：本地/云存储/文件服务器）
- [✓] 存储抽象层（StorageBackend 策略模式，LocalStorage 默认实现）
- [✓] 公司信息配置（键值对 settings 表，名称/Logo/简介）
- [✓] 快捷入口区（请假/报销/审批/通知等常用功能图标，登录后才可进入）
- [✓] 内网导航链接（管理员可配置的外部系统 URL）
- [✓] Dashboard 重设计：**首页公开**（无需登录），登录后额外显示个人统计卡片
- [✓] 管理后台（公告管理、媒体管理、公司设置、快捷链接配置）
- [✓] 后端测试（17 个测试用例全部通过）

### Phase 5: 请假模块端到端 (Week 5) ✅ 已完成
- [✓] 请假表单模板配置
- [✓] 请假申请提交 -> 审批 -> 完成全流程
- [✓] WebSocket 实时通知（新待办、审批结果推送）

### Phase 6: 员工管理 (Week 6) ✅ 已完成
- [✓] 员工档案模型 `employee_profiles`（与用户 1:1，联系方式 + 身份信息 + 就职状态）
- [✓] 注册时自动创建档案
- [✓] 自助档案页 `/profile`：入职填写（一次性锁定身份字段）+ 联系信息持续可编辑
- [✓] 管理员员工管理 `/admin/employees`：列表搜索/过滤 + 详情编辑
- [✓] 离职交接流程：下属转移 → 待办任务转交 → 资产归还 → 状态变更
- [✓] 请假状态实时查询
- [✓] 后端测试覆盖（16/16 通过）

详见 `docs/phase6-plan.md`

### Phase 7: 办公用品管理 (Week 7) ✅ 已完成
- [✓] 资产分类树（电子设备/办公家具/耗材/生活设备）
- [✓] 固定资产管理（电脑、打印机、桌椅、饮水机等）— 编号自动生成/状态/领用/归还/领用历史
- [✓] 耗材管理（纸张、墨盒、文具等）— 库存/入库/出库/低库存预警
- [✓] 我的资产自助查看
- [✓] 后端测试覆盖（27 个测试用例）
- [✓] 前端管理页面（资产列表/创建编辑/详情/分类管理，耗材列表/创建编辑/详情含出入库）

详见 `docs/phase7-plan.md`

### Phase 8: 管理员层级体系 (Week 8) ✅ 已完成
- [✓] 超级管理员 / 模块管理员 / 部门管理员 角色分层
- [✓] 部门数据隔离（部门管理员只能看到本部门数据）
- [✓] 管理角色创建向导（UI 简化自定义角色创建）
- [✓] 后端测试覆盖（13 个新测试用例全部通过）

详见 `docs/phase8-plan.md`

### Phase 9: 考勤管理 (Week 9) 🔄 进行中
- [ ] 打卡为可选功能（公司可配置是否开启强制打卡）
- [ ] 考勤状态：正常 / 迟到 / 早退 / 旷工 / 请假（自动同步）/ 出差
- [ ] 月度出勤汇总（出勤天数、请假天数、迟到次数）
- [ ] 与请假模块联动：审批通过后自动同步到考勤
- [ ] 上级查看下级：考勤状态、个人信息、请假记录（基于现有 User.manager_id）

### Phase 10: 通知中心 + 通讯录 (Week 10)
- [ ] 通知持久化（`notifications` 表），已读/未读状态，分页历史
- [ ] 通知类型：审批结果、新待办、系统公告、资产分配
- [ ] 通讯录：按部门树浏览员工，搜索姓名/用户名
- [ ] 查看同事基本信息（部门、手机号、邮箱，不暴露敏感字段）

### Phase 11: 报销 + 加班模块 (Week 11)
- [ ] 复用工作流引擎，配置报销、加班流程
- [ ] 报销单附件上传（发票）
- [ ] 加班申请与请假联动校验

### Phase 12: 审计日志 (Week 12)
- [ ] `audit_logs` 表：操作人、操作类型、目标资源、详情、IP、时间
- [ ] 审计范围：用户创建/删除、权限变更、离职操作、资产分配/归还、敏感数据修改
- [ ] 只读查询页面（管理员可见），支持按操作类型和时间范围过滤

### Phase 13: 数据看板 (Week 13)
- [ ] 首页仪表盘接入真实统计数据
- [ ] 各部门人数统计、本月请假统计（按类型）
- [ ] 资产总览（在用/闲置/报废数量）
- [ ] 我的考勤概览（本月出勤、请假、迟到）

### Phase 14: 内部消息 + 细节完善 (Week 14+)
- [ ] 点对点站内信（区别于系统通知）
- [ ] 消息已读回执
- [ ] 流程图可视化展示
- [ ] 表单字段校验规则增强
- [ ] 全面单元测试覆盖

## 8. 本地开发启动方式

```bash
# 启动基础设施
docker-compose up -d

# 后端 (backend/)
cd backend
uv pip install -e ".[dev]"      # 首次
uv run alembic upgrade head     # 执行迁移
uv run python -m app.core.seed  # 种子数据（首次）
uv run uvicorn app.main:app --reload --port 8000

# 前端 (frontend/)
cd frontend
npm install                     # 首次
npm run dev
```

详细说明见 `SETUP_GUIDE.md`。

### QoL Improvements (2026-05-23) ✅ 已完成
- [✓] 全局返回首页链接：所有非首页页面（Login/Register/Workflow/Leaves/Profile/Admin/NotFound）均添加 `← 返回首页` 链接
- [✓] AdminLayout 侧边栏顶部添加首页导航项
- [✓] 主题/背景自定义：右下角浮动画笔按钮，支持纯色（14 种预设 + 自定义取色器）、渐变（8 种预设）、自定义背景图 URL
- [✓] 主题设置持久化至 localStorage，刷新不丢失

---

**下一步**：Phase 9 — 考勤管理（详见 `docs/phase9-plan.md`）。
