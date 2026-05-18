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

# 种子数据（首次或需要重置时，创建默认角色和权限）
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
docker exec -it oa-v1-postgres-1 psql -U oa -d oa_db -c "UPDATE users SET is_superuser = true WHERE username = '你的用户名';"
```

然后给该用户分配 admin 角色：

```powershell
docker exec -it oa-v1-postgres-1 psql -U oa -d oa_db -c "INSERT INTO user_roles (user_id, role_id) SELECT u.id, r.id FROM users u, roles r WHERE u.username = '你的用户名' AND r.name = 'admin';"
```

---

## 方式二：PyCharm 中启动

### 1. 打开项目

File → Open → 选择 `E:\Projects\Python\oa-v1`

### 2. 配置 Python 解释器（使用 uv 虚拟环境）

File → Settings → Project: oa-v1 → Python Interpreter

- 点击齿轮图标 → Add...
- 选择 **Add Local Interpreter**
- 选择 **Virtualenv Environment** → **Existing**
- 路径填写：`E:\Projects\Python\oa-v1\backend\.venv\Scripts\python.exe`
- 点击 OK

如果没有 `.venv`，先在 PowerShell 中执行：
```powershell
cd backend
uv venv
```

### 3. 配置 Run Configurations

Run → Edit Configurations，添加以下配置：

**Backend - FastAPI：**

| 字段 | 值 |
|------|-----|
| Name | `Backend - FastAPI` |
| Module name | `uvicorn` |
| Parameters | `app.main:app --reload --port 8000` |
| Working directory | `E:\Projects\Python\oa-v1\backend` |

**Alembic - Upgrade：**

| 字段 | 值 |
|------|-----|
| Name | `Alembic - Upgrade` |
| Module name | `alembic` |
| Parameters | `upgrade head` |
| Working directory | `E:\Projects\Python\oa-v1\backend` |

**Seed Data：**

| 字段 | 值 |
|------|-----|
| Name | `Seed Data` |
| Module name | `app.core.seed` |
| Parameters | （空） |
| Working directory | `E:\Projects\Python\oa-v1\backend` |

**Frontend - Vite：**

| 字段 | 值 |
|------|-----|
| Name | `Frontend - Vite` |
| package.json | `E:\Projects\Python\oa-v1\frontend\package.json` |
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
- 检查 `.env` 中的 `DATABASE_URL` 端口是否为 `5432`
- 如果是首次启动，等待 5-10 秒让 PG 初始化完成

**问题：前端代理不生效**
- `vite.config.ts` 已配置 `/api` 代理到 `localhost:8000`
- 确保访问的是 `http://localhost:5173` 而不是 `127.0.0.1:5173`

**问题：访问管理后台提示权限不足**
- 确认已运行 `uv run python -m app.core.seed`
- 确认用户已被设为 superuser 或分配了 admin 角色
