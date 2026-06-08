# OA 系统开发计划

## 1. 项目概述

构建一个企业办公自动化（OA）系统，核心围绕**审批工作流**展开。覆盖请假、报销、加班、资产、考勤、通知等高频场景。

系统的核心设计目标是：**流程可配置、表单可定制、权限可管控**。

## 2. 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| 后端 | Python + FastAPI | 异步高性能 API |
| ORM | SQLAlchemy 2.0 (async) | 数据库交互 |
| 数据库 | PostgreSQL 16 | 主数据库，支持 JSONB |
| 迁移 | Alembic | 数据库版本管理 |
| 缓存 | Redis | Session、锁、热点数据缓存 |
| 前端 | React 18 + TypeScript | 用户界面 |
| UI 库 | Tailwind CSS + shadcn/ui | 样式 + 组件库 |
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
│   │   ├── core/            # 配置、安全、权限
│   │   ├── models/          # SQLAlchemy ORM 模型
│   │   ├── schemas/         # Pydantic 校验模型
│   │   ├── services/        # 业务逻辑层
│   │   ├── repositories/    # 数据访问层
│   │   └── db/              # 数据库连接、会话管理
│   ├── alembic/             # 迁移脚本
│   └── tests/               # 后端测试
├── frontend/                # React 前端
│   ├── src/
│   │   ├── api/             # Axios 封装
│   │   ├── components/      # 公共组件 + ui/（shadcn）
│   │   ├── pages/           # 页面组件
│   │   ├── stores/          # Zustand 状态
│   │   └── lib/             # 工具函数（cn() 等）
│   └── package.json
└── docker-compose.yml       # 本地开发环境
```

## 4. 开发阶段规划

### 已完成 Phase（1-14）

| Phase | 内容 | 详见 |
|:--:|------|------|
| 1 | 基础骨架：Docker Compose + FastAPI + React + JWT 认证 | — |
| 2 | RBAC 与组织架构：角色/权限模型 + 部门 CRUD | — |
| 3 | 工作流引擎核心：流程定义 → 实例 → 任务 → 审批流转 | — |
| 4 | 公司门户首页：公告、媒体库、公司配置、快捷入口、Dashboard | — |
| 5 | 请假模块端到端：表单 → 审批 → WebSocket 通知 | — |
| 6 | 员工管理：员工档案、入职填写、离职交接 | `docs/phase6-plan.md` |
| 7 | 办公用品管理：资产分类/领用/归还、耗材库存/出入库 | `docs/phase7-plan.md` |
| 8 | 管理员层级体系：super_admin / module_admin / dept_admin / user | `docs/phase8-plan.md` |
| 9 | 考勤管理：打卡、考勤状态、月度汇总、请假联动 | `docs/phase9-plan.md` |
| 10 | 通知中心 + 通讯录：持久化通知、WebSocket 推送、部门树浏览 | — |
| 11 | 报销 + 加班模块：复用工作流引擎、i18n 全覆盖 | — |
| 12 | 审计日志：SQLAlchemy 事件自动捕获、零侵入 | `docs/phase12-plan.md` |
| 13 | 数据看板：单一聚合 API、角色感知统计、Dashboard UI 优化 | `docs/phase13-plan.md` |
| 14 | UI 基础设施：shadcn/ui 集成 + 品牌色系 + Lucide 图标替换 + Inter 字体 | `docs/phase14-plan.md` |

### Phase 15: 组件重设计 — 侧边栏 + 表格 + 表单 (Week 15) ✅ 已完成
- [✓] 侧边栏深色重设计（bg-slate-900 + Lucide 图标 + 折叠动画）
- [✓] AdminLayout 全局导航栏升级（13 个导航项图标 + localStorage 持久化折叠状态）
- [✓] 表格全部迁移为 shadcn Table（21 个表 → 16 个文件）
- [✓] 表单组件统一为 shadcn Input/Select/Textarea（~25 个文件）
- [✓] 按钮标准化为 shadcn Button（41 个文件，8 种 variant）
- [✓] 考勤页面 i18n 修复（3 个文件）

详见 `docs/plan/phase15-plan.md`

### Phase 16: 体验打磨 — 加载态 + 空状态 + 动效 (Week 16) ✅ 已完成
- [✓] 骨架屏 Skeleton：Dashboard 统计卡片、列表页（7个）、详情页（10个）加载时展示
- [✓] 空状态统一设计：EmptyState 组件（图标 + 引导文案 + CTA 按钮）
- [✓] 按钮/卡片微交互：Card hover 阴影过渡、Button active:scale-95 点击反馈
- [✓] 深色模式支持：Tailwind dark: class + shadcn/ui CSS 变量暗色调色板 + Zustand 持久化
- [✓] Dashboard 数据可视化：recharts PieChart（请假类型/资产状态）+ BarChart（部门人数/考勤概览）
- [ ] 页面切换过渡动画（可选，跳过 — 降低复杂度）

详见 `docs/plan/phase16-plan.md`

### Phase 17: 内部消息 + 细节完善 (Week 17-20) ✅ 已完成
- [✓] 点对点站内信（messages 表 + 6 个 API + inbox/sent/compose/detail 页面 + WebSocket 推送）
- [✓] 消息已读回执（read_at + WS message_read 事件 + 发送者可见已读状态）
- [✓] 流程图可视化（React Flow + dagre 自动布局 + 节点状态颜色编码）
- [✓] 表单字段校验增强（FormField 内联错误 + ConfirmDialog 替换 22 个 confirm() + useFormValidation hook）
- [✓] 全面单元测试覆盖（12 个后端测试模块 + 3 个前端组件测试 + CI GitHub Actions）
- [✓] 修复 backlog 高优先级 bug（#2 请假天数后端重算、#9 测试 DB URL 环境变量、auth lazy-load MissingGreenlet）

详见 `docs/plan/phase17-plan.md`

## 5. QoL Improvements (2026-05-23) ✅ 已完成
- [✓] 全局返回首页链接
- [✓] AdminLayout 侧边栏首页导航项
- [✓] 主题/背景自定义：FAB 画笔按钮，纯色/渐变/背景图，localStorage 持久化

---

### Phase 18: 安全加固 + 架构偿还 + UX 打磨 (Week 18-20) ✅ 已完成
- [✓] 安全修复：通知越权校验、费用金额上限
- [✓] 架构偿还：工作流引擎去硬编码（注册制回调）
- [✓] UX 打磨：i18n 硬编码清理、Dashboard EmptyState 迁移、通知删除端点
- [✓] 功能补充：请假半日支持、加班实际时间、媒体 PDF/DOCX 支持

详见 `docs/plan/phase18-plan.md`

### Phase 19: 服务去重 + Toast + 杂项完善 (Week 21-22) ✅ 已完成
- [✓] 审批服务去重：DraftWorkflowService 基类，leave (81行) / expense (45行) / overtime (107行) 继承（backlog #11）
- [✓] Toast 组件：Zustand store + ToastContainer + 替换 7 个文件的 8 处 alert() 调用
- [✓] 角色类型标签 i18n、员工离职资产自动归还、资产类别 code_prefix 精确匹配（backlog #6, #7, #15）

详见 `docs/plan/phase19-plan.md`

### Phase 20: 审批引擎升级 — 多级审批 + 条件路由 + 可视化编辑器 📋 规划中
- [ ] 多级审批链：支持组长→经理→总监等多节点串联审批
- [ ] 条件路由：按金额/部门等字段自动选择审批分支
- [ ] 流程可视化编辑器：拖拽节点连线，替代裸 JSON 编辑

详见 `docs/plan/phase20-plan.md`

### Phase 21: 业务增强 — 密码修改 + 休假余额 + 类型配置 + 面包屑 📋 规划中
- [ ] 自助密码修改（旧密码 → 新密码）
- [ ] 休假余额：年假额度 + 审批通过自动扣减
- [ ] 请假/报销类型管理页（管理员自定义，替代硬编码）
- [ ] 面包屑导航组件 + 详情页集成
- [ ] 数据库 commit 一致性修复 (backlog #8)

详见 `docs/plan/phase21-plan.md`

### Phase 22: 体验优化 — 移动端 + 搜索 + Excel + 日历 + 大图 📋 规划中
- [ ] 移动端响应式适配：汉堡菜单 + 表格→卡片回退
- [ ] 全站搜索：顶部搜索栏 + 跨模块聚合 API
- [ ] Excel 导入导出：员工/资产/耗材批量操作
- [ ] 考勤日历视图：月历显示每日打卡状态
- [ ] 媒体大图预览：点击放大 + 左右翻页

详见 `docs/plan/phase22-plan.md`

### Phase 23: 长期完善 — 审计增强 + 薪资条 + 登录追踪 📋 规划中
- [ ] 审计日志增强：user_agent、session_id
- [ ] 批量通知删除：一键清除已读
- [ ] 用户最后登录时间追踪
- [ ] 薪资条模块：管理员导入 + 员工查看

详见 `docs/plan/phase23-plan.md`

---

**已知问题 & 待办**: 详见 `docs/audit/issues-and-backlog-20260606_v1.md`。
