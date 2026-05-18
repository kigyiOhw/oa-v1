# Phase 2: RBAC 权限体系 + 组织架构

## Step 1 — 模型层（Permission + Department + 更新 User/Role）

- 新建 `backend/app/core/permissions.py` — 权限常量枚举（`StrEnum`），如 `user:read`、`role:create`、`dept:delete` 等
- 新建 `backend/app/models/department.py` — Department 模型，自引用 `parent_id` 构成树形结构
- 修改 `backend/app/models/user.py`：
  - 新增 `role_permissions` 关联表
  - 新增 `Permission` 模型（id、code、description）
  - Role 增加 `permissions` 多对多关系
  - User 增加 `department_id` 外键 + `department` 关系
  - User 增加 `permissions` 属性（从所有角色去重汇总）
- 生成 migration

## Step 2 — 权限检查依赖

修改 `backend/app/api/deps.py`：
- `require_permission("user:create")` — 工厂函数，返回 `Depends()`，通过 user_roles → role_permissions → permissions 联表查询，无权限则 403。superuser 直接放行
- `require_superuser` — 仅超管可用

## Step 3 — 后端 CRUD（Repository → Service → API）

新增 3 个 repository：`role.py`、`permission.py`、`department.py`
新增 3 个 service：`role.py`、`department.py`、`user_admin.py`
新增 3 个 schema：`role.py`、`department.py`（含树形结构）、`permission.py`
修改 `UserRepository`：增加分页列表、更新、删除方法
修改 `UserOut` schema：增加 roles、permissions、department_id 字段（默认空，不影响已有接口）

新增 4 个 API 路由：
| 路由 | 功能 | 所需权限 |
|------|------|----------|
| `/api/v1/departments` | 部门 CRUD + `/tree` | dept:* |
| `/api/v1/roles` | 角色 CRUD + 分配权限 | role:* |
| `/api/v1/permissions` | 权限列表 | permission:read |
| `/api/v1/users` | 用户管理（列表/编辑/删除） | user:* |

## Step 4 — 种子数据

新建 `backend/app/core/seed.py`：
- 根据枚举创建所有权限记录
- 创建 "admin" 角色（拥有全部权限）
- 创建 "user" 角色（仅基本读权限）
- 通过 `python -m app.core.seed` 运行

## Step 5 — 前端基础设施

修改 `stores/auth.ts`：User 增加 roles、permissions，新增 `hasPermission()` 方法

新增 3 个组件：
- `ProtectedRoute` — 未登录跳转 `/login`
- `AdminLayout` — 侧边栏（根据权限显示菜单项）+ 内容区
- `PermissionGuard` — 无权限时隐藏子组件

## Step 6 — 前端管理页面

新增 API 客户端：`api/users.ts`、`api/roles.ts`、`api/departments.ts`

新增 3 个管理页面：
- `pages/admin/Users.tsx` — 用户列表（搜索+分页），编辑弹窗（角色、部门、状态）
- `pages/admin/Roles.tsx` — 角色列表，创建/编辑弹窗（名称、权限复选框）
- `pages/admin/Departments.tsx` — 递归树形展示，增删改弹窗（名称、上级部门）

## Step 7 — 路由整合

修改 `App.tsx`：添加 `/admin/*` 路由组，外层 ProtectedRoute + AdminLayout，每个子路由用 PermissionGuard 包裹。

---

**总计约 27 个文件**（16 个新建，11 个修改），严格按 Step 1→7 的顺序执行，每步依赖前一步。
