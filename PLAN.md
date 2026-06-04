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

### Phase 16: 体验打磨 — 加载态 + 空状态 + 动效 (Week 16)
- [ ] 骨架屏 Skeleton：Dashboard 统计卡片、列表页、详情页加载时展示
- [ ] 空状态统一设计：图标 + 引导文案 + 快捷操作按钮（替代裸灰字）
- [ ] 按钮/卡片微交互：hover 缩放/阴影过渡、点击反馈
- [ ] 页面切换过渡动画（可选，React Router + framer-motion）
- [ ] 深色模式支持（Tailwind dark: + shadcn/ui 原生支持）
- [ ] Dashboard 数据可视化：简单柱状图/饼图替代纯数字卡片（recharts）

### Phase 17: 内部消息 + 细节完善 (Week 17+)
- [ ] 点对点站内信（区别于系统通知）
- [ ] 消息已读回执
- [ ] 流程图可视化展示
- [ ] 表单字段校验规则增强
- [ ] 全面单元测试覆盖

## 5. QoL Improvements (2026-05-23) ✅ 已完成
- [✓] 全局返回首页链接
- [✓] AdminLayout 侧边栏首页导航项
- [✓] 主题/背景自定义：FAB 画笔按钮，纯色/渐变/背景图，localStorage 持久化

---

**下一步**：Phase 16 — 体验打磨（骨架屏 + 空状态 + 动效）。
