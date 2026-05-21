# Windows 11 环境启动指南

## 前置条件

- Docker Desktop（已安装并运行）
- Python 3.11+
- Node.js 18+
- uv（Python 包管理器）

```powershell
# 安装 uv（如未安装）
powershell -c "irm https://astral.sh/uv/install.ps1 | iex"
```

---

## 方式一：PowerShell 命令行启动

### 1. 启动数据库和缓存

```powershell
# 在项目根目录
docker-compose up -d

# 验证容器状态
docker ps
```

### 2. 后端启动

```powershell
cd backend

# 首次：创建虚拟环境并安装依赖
uv venv
uv pip install -e ".[dev]"

# 复制环境变量（首次）
cp .env.example .env

# 执行数据库迁移
uv run alembic upgrade head

# 种子数据（首次或需要重置时，创建默认角色、权限、公司信息、公告、快捷链接）
uv run python -m app.core.seed

# 启动 FastAPI 开发服务器
uv run uvicorn app.main:app --reload --port 8000
```

后端服务验证：
- 健康检查：`curl http://localhost:8000/health`
- API 文档：`http://localhost:8000/docs`

### 3. 前端启动（另开一个 PowerShell）

```powershell
cd frontend

# 首次：安装依赖
npm install

# 启动开发服务器
npm run dev
```

前端地址：`http://localhost:5173`
管理后台：`http://localhost:5173/admin`

### 4. 初始化管理员账户

注册一个普通用户后，手动在数据库中将其设为超级管理员：

```powershell
docker exec -it oa-postgres psql -U oa -d oa_db -c "UPDATE users SET is_superuser = true WHERE username = '你的用户名';"
```

然后给该用户分配 admin 角色：

```powershell
docker exec -it oa-postgres psql -U oa -d oa_db -c "INSERT INTO user_roles (user_id, role_id) SELECT u.id, r.id FROM users u, roles r WHERE u.username = '你的用户名' AND r.name = 'admin';"
```

---

## 方式二：PyCharm 中启动

### 1. 打开项目

File → Open → 选择 `D:\Projects\Python\oa-v1`

### 2. 配置 Python 解释器（使用 uv 虚拟环境）

File → Settings → Python → Interpreter

- 右上角 **Add Interpreter** → **Add Local Interpreter**
- 弹出框中：Environment 选 **Select Existing**，Type 选 **Python**
- Python path 填：`D:\Projects\Python\oa-v1\backend\.venv\Scripts\python.exe`
- OK → Apply

如果没有 `.venv`，先在 PowerShell 中执行：
```powershell
cd backend
uv venv
```

### 3. 配置 Run Configurations

Run → Edit Configurations → 左上角 **+**，选择 **Python**，按以下配置：

> 注意：新版 PyCharm 中 Script 字段改为 `module` + `parameters` 两个字段，解释器在 `Run` 字段中选择。

**Backend - FastAPI：**

| 字段 | 值 |
|------|-----|
| Name | `Backend - FastAPI` |
| Run | 选择 `.venv` 的 Python（没有则点 Browse 选 `backend\.venv\Scripts\python.exe`） |
| module | `uvicorn` |
| parameters | `app.main:app --reload --port 8000` |
| Working directory | `D:\Projects\Python\oa-v1\backend` |
| Environment variables | （留空） |
| Path to ".env" files | （留空） |

**Alembic - Upgrade：**

| 字段 | 值 |
|------|-----|
| Name | `Alembic - Upgrade` |
| Run | 同上 |
| module | `alembic` |
| parameters | `upgrade head` |
| Working directory | `D:\Projects\Python\oa-v1\backend` |
| Environment variables | （留空） |

**Seed Data：**

| 字段 | 值 |
|------|-----|
| Name | `Seed Data` |
| Run | 同上 |
| module | `app.core.seed` |
| parameters | （留空） |
| Working directory | `D:\Projects\Python\oa-v1\backend` |
| Environment variables | （留空） |

**Frontend - Vite：**

点 **+** → 选 **npm**，按以下配置：

| 字段 | 值 |
|------|-----|
| Name | `Frontend - Vite` |
| package.json | `D:\Projects\Python\oa-v1\frontend\package.json` |
| Command | `run` |
| Scripts | `dev` |
| Node interpreter | Node.js 路径（如 `C:\Program Files\nodejs\node.exe`） |

### 4. 启动顺序

1. 确保 Docker Desktop 正在运行
2. 在 PowerShell 执行 `docker-compose up -d`
3. 运行 `Alembic - Upgrade`（首次或模型变更后）
4. 运行 `Seed Data`（首次或需要重置权限数据时）
5. 运行 `Backend - FastAPI`
6. 运行 `Frontend - Vite`

### 5. 常见问题

**问题：uv 命令找不到**
- 安装 uv：`powershell -c "irm https://astral.sh/uv/install.ps1 | iex"`
- 重启 PowerShell

**问题：PowerShell 执行策略限制**
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

**问题：PyCharm 中 import 报错**
- 确保 Python Interpreter 指向的是 `backend\.venv` 而不是系统 Python
- 如果 `app` 包标红，右键 `backend` 目录 → Mark Directory as → Sources Root

**问题：数据库连接失败**
- 检查 Docker 容器是否运行：`docker ps`
- 检查 `.env` 中的 `DATABASE_URL` 端口是否为 `5433`
- 如果是首次启动，等待 5-10 秒让 PG 初始化完成

**问题：前端代理不生效**
- `vite.config.ts` 已配置 `/api` 代理到 `localhost:8000`
- 确保访问的是 `http://localhost:5173` 而不是 `127.0.0.1:5173`

**问题：访问管理后台提示权限不足**
- 确认已运行 `uv run python -m app.core.seed`
- 确认用户已被设为 superuser 或分配了 admin 角色

---

## Phase 3: 工作流引擎使用指南

### 前置准备：为用户设置直属经理

工作流中的 `manager` 审批人策略依赖用户的 `manager_id` 字段。测试前先给用户指定经理：

```powershell
# 创建一个经理账号后，将员工 A 的经理设为经理 B
docker exec -it oa-postgres psql -U oa -d oa_db -c "UPDATE users SET manager_id = (SELECT id FROM users WHERE username = '经理B的用户名') WHERE username = '员工A的用户名';"
```

### 创建流程定义

1. 以管理员身份登录，访问管理后台 → 流程定义
2. 点击"新建"，输入名称和 JSON 定义
3. 示例请假流程：

```json
{
  "nodes": [
    {"id": "start", "type": "start", "label": "提交申请"},
    {"id": "manager_approve", "type": "approval", "label": "经理审批", "assignee_type": "manager"},
    {"id": "end_approved", "type": "end", "label": "通过", "outcome": "approved"},
    {"id": "end_rejected", "type": "end", "label": "驳回", "outcome": "rejected"}
  ],
  "transitions": [
    {"from": "start", "action": "submit", "to": "manager_approve"},
    {"from": "manager_approve", "action": "approve", "to": "end_approved"},
    {"from": "manager_approve", "action": "reject", "to": "end_rejected"}
  ]
}
```

**审批人类型说明：**

| 类型 | 写法 | 说明 |
|------|------|------|
| 发起人自己 | `"assignee_type": "initiator"` | 任务分配给发起人 |
| 直属经理 | `"assignee_type": "manager"` | 自动查找发起人的 manager_id |
| 按角色分配 | `"assignee_type": "role", "assignee_value": "hr_admin"` | 自动从拥有该角色的用户中选待办最少的 |
| 指定用户 | `"assignee_type": "user", "assignee_value": "3"` | 直接指定用户 ID |

### 发起和审批流程

1. 用普通用户登录，访问"我发起的"页面
2. 点击"发起流程"，选择流程定义，填写标题和表单数据
3. 用审批人（如经理）登录，在"我的待办"中看到待审批任务
4. 点击任务，填写备注，点击"同意"或"驳回"
5. 驳回后实例状态变为 `rejected`，同意后根据流程定义推进到下一节点
6. 在实例详情页可查看完整的审批历史时间线

### 撤销流程

发起人可在实例详情页点击"撤销"（仅限 pending 状态的实例）。撤销后所有待办任务自动取消。

### 通过 Swagger 调试

后端 API 文档 `http://localhost:8000/docs` 中可直接测试所有工作流接口：

- `POST /api/v1/workflow-defs` — 创建流程定义（需 admin）
- `POST /api/v1/workflow/instances` — 发起流程
- `GET /api/v1/workflow/tasks` — 我的待办
- `POST /api/v1/workflow/tasks/{id}/approve` — 同意
- `POST /api/v1/workflow/tasks/{id}/reject` — 驳回

---

## Phase 4: 公司门户首页使用指南

### 首页公开访问

首页 `/` 无需登录即可访问，包含以下内容：

1. **顶部导航** — 公司名称 + 登录/注册（未登录时显示）
2. **公司横幅** — 公司名称、Logo、简介（管理员可在后台配置）
3. **快捷入口** — 请假/报销/审批/通知/通讯录/我的待办，点击需登录的功能会跳转到登录页
4. **媒体轮播** — 已上传的图片/视频自动轮播展示
5. **公告栏** — 最新 5 条已发布公告，支持 Markdown 渲染，置顶公告优先显示
6. **内网导航** — 可配置的外部系统链接（如 HR 系统、OA 门户等）

登录后，首页额外显示：
7. **个人统计卡片** — 待办任务数、已处理数、发起的流程数

> **提示**：运行 `uv run python -m app.core.seed` 会预填默认的公司信息、一条欢迎公告和 5 个内网导航占位链接，确保首页首次加载时各模块均可见。未配置数据的模块会显示空态提示文字，而不是整块隐藏。

### 管理后台配置

以管理员身份登录后，访问 `/admin` 可看到新增的管理菜单：

#### 公告管理 (`/admin/announcements`)

- 新建公告：Markdown 格式编辑，支持预览
- 置顶：勾选后该公告始终排在列表最前
- 发布：新建的公告默认为草稿状态，点击发布后才会在首页展示
- 编辑/删除：列表中直接操作

#### 媒体管理 (`/admin/media`)

- 上传：支持 jpg/png/gif/webp/mp4/webm/mov 格式，最大 50MB
- 展示：图片缩略图 + 视频占位图标网格布局
- 删除：悬停显示删除按钮

#### 公司设置 (`/admin/settings`)

- **公司信息**：公司名称、Logo URL、简介、地址、联系方式
- **快捷链接**：动态添加/删除内网导航链接（名称 + URL + 图标）
- 每个设置区域独立保存

### 媒体存储配置

默认使用本地磁盘存储（`backend/uploads/` 目录）。如需切换云存储：

1. 实现 `app.core.storage.base.StorageBackend` 抽象类
2. 在 `app.core.config.py` 中修改 `STORAGE_BACKEND` 配置项
3. 重启后端服务

### 通过 Swagger 调试

- `GET /api/v1/announcements` — 已发布公告列表（公开）
- `POST /api/v1/announcements` — 创建公告（需 announcement:create）
- `PUT /api/v1/announcements/{id}` — 更新/发布公告（需 announcement:update）
- `DELETE /api/v1/announcements/{id}` — 删除公告（需 announcement:delete）
- `POST /api/v1/media/upload` — 上传媒体文件（需 media:upload）
- `GET /api/v1/media` — 媒体列表（公开）
- `DELETE /api/v1/media/{id}` — 删除媒体（需 media:delete）
- `GET /api/v1/settings/company-info` — 公司信息（公开）
- `PUT /api/v1/settings/company-info` — 更新公司信息（需 announcement:update）
- `GET /api/v1/settings/quick-links` — 快捷链接（公开）
- `PUT /api/v1/settings/quick-links` — 更新快捷链接（需 announcement:update）
