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

# 种子数据（首次或需要重置时，创建默认角色、权限、公司信息、公告、快捷链接、请假审批流程）
uv run python -m app.core.seed

# 测试/演示数据（可选，插入 25 用户、部门、工作流实例、请假记录、公告等测试数据）
uv run python -m app.core.seed_test_data

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

注册一个普通用户后，手动在数据库中将其设为超级管理员并分配 super_admin 角色：

```powershell
# 设为超级管理员
docker exec -it oa-postgres psql -U oa -d oa_db -c "UPDATE users SET is_superuser = true WHERE username = '你的用户名';"

# 分配 super_admin 角色
docker exec -it oa-postgres psql -U oa -d oa_db -c "INSERT INTO user_roles (user_id, role_id) SELECT u.id, r.id FROM users u, roles r WHERE u.username = '你的用户名' AND r.name = 'super_admin';"
```

若还需分配部门管理员角色（数据范围限定本部门）：
```powershell
docker exec -it oa-postgres psql -U oa -d oa_db -c "INSERT INTO user_roles (user_id, role_id) SELECT u.id, r.id FROM users u, roles r WHERE u.username = '你的用户名' AND r.name = 'dept_admin';"
```

---

## 后台运行与关闭

### 一键启动（后台运行）

```powershell
# 1. 启动数据库（后台常驻）
docker-compose up -d

# 2. 启动后端（隐藏窗口，后台运行）
Start-Process -WindowStyle Hidden -FilePath "uv" `
  -ArgumentList "run","uvicorn","app.main:app","--reload","--port","8000" `
  -WorkingDirectory "$PWD\backend"

# 3. 启动前端（隐藏窗口，后台运行）
Start-Process -WindowStyle Hidden -FilePath "npm" `
  -ArgumentList "run","dev" `
  -WorkingDirectory "$PWD\frontend"
```

或者开新窗口（方便查看日志）：

```powershell
Start-Process powershell -ArgumentList "-NoExit","-Command","cd $PWD\backend; uv run uvicorn app.main:app --reload --port 8000"
Start-Process powershell -ArgumentList "-NoExit","-Command","cd $PWD\frontend; npm run dev"
```

### 一键关闭

```powershell
# 关闭后端（杀死 8000 端口进程）
$pid = (Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue).OwningProcess
if ($pid) { Stop-Process -Id $pid -Force; Write-Host "Backend stopped (PID $pid)" }
else { Write-Host "Backend not running" }

# 关闭前端（杀死 5173 端口进程）
$pid = (Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue).OwningProcess
if ($pid) { Stop-Process -Id $pid -Force; Write-Host "Frontend stopped (PID $pid)" }
else { Write-Host "Frontend not running" }

# 关闭数据库（保留数据）
docker-compose down

# 如需同时清除数据库数据：
# docker-compose down -v
```

### 查看运行状态

```powershell
# 容器状态
docker ps

# 端口占用
netstat -ano | findstr "8000 5173"
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

## 各 Phase 使用指南

详细的功能说明、API 端点、前端页面和使用示例已移至 `docs/` 目录：

| Phase | 文档 | 内容 |
|-------|------|------|
| Phase 1 | [docs/phase1.md](docs/phase1.md) | 基础骨架：认证、项目脚手架 |
| Phase 2 | [docs/phase2.md](docs/phase2.md) | RBAC 权限 + 部门组织架构 |
| Phase 3 | [docs/phase3.md](docs/phase3.md) | 工作流引擎：流程定义、审批流转 |
| Phase 4 | [docs/phase4.md](docs/phase4.md) | 公司门户：公告、媒体、公司设置 |
| Phase 5 | [docs/phase5-plan.md](docs/phase5-plan.md) | 请假模块：端到端流程 + WebSocket |
| Phase 6 | [docs/phase6-plan.md](docs/phase6-plan.md) | 员工管理：档案、入职、离职交接 |
| Phase 7 | [docs/phase7-plan.md](docs/phase7-plan.md) | 办公用品：固定资产 + 耗材管理 |
| Phase 8 | [docs/phase8-plan.md](docs/phase8-plan.md) | 管理员层级体系：角色分层 + 部门数据隔离 |
| Phase 9 | [docs/phase9-plan.md](docs/phase9-plan.md) | 考勤管理：打卡、月度汇总、请假联动、团队视图 |
