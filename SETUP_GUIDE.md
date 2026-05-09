# Windows 11 环境启动指南

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
# 进入后端目录
cd backend

# 创建虚拟环境并安装依赖
uv venv
uv pip install -e ".[dev]"

# 复制环境变量
cp .env.example .env

# 执行数据库迁移
uv run alembic upgrade head

# 启动 FastAPI 开发服务器
uv run uvicorn app.main:app --reload --port 8000
```

后端服务验证：
- 健康检查：`curl http://localhost:8000/health`
- API 文档：`http://localhost:8000/docs`

### 3. 前端启动（另开一个 PowerShell）

```powershell
# 进入前端目录
cd frontend

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

前端地址：`http://localhost:5173`

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

### 3. 配置后端运行（FastAPI）

Run → Edit Configurations → 点击 **+** 号 → **Python**

填写以下参数：

| 字段 | 值 |
|------|-----|
| Name | `Backend - FastAPI` |
| Script path | `E:\Projects\Python\oa-v1\backend\.venv\Scripts\uvicorn.exe` |
| Parameters | `app.main:app --reload --port 8000` |
| Working directory | `E:\Projects\Python\oa-v1\backend` |
| Environment variables | 点击右侧图标添加：`DATABASE_URL=postgresql+asyncpg://oa:oa_secret@localhost:5432/oa_db;REDIS_URL=redis://localhost:6379/0;SECRET_KEY=dev-secret-key` |

> **注意**：Script path 也可以指向 `python.exe`，Parameters 写成 `uvicorn app.main:app --reload --port 8000`

### 4. 配置前端运行

Run → Edit Configurations → 点击 **+** 号 → **npm**

填写以下参数：

| 字段 | 值 |
|------|-----|
| Name | `Frontend - Vite` |
| package.json | `E:\Projects\Python\oa-v1\frontend\package.json` |
| Command | `run` |
| Scripts | `dev` |
| Node interpreter | 选择你的 Node.js 路径（如 `C:\Program Files\nodejs\node.exe`） |

### 5. 配置 Alembic 迁移（可选）

Run → Edit Configurations → 点击 **+** 号 → **Python**

| 字段 | 值 |
|------|-----|
| Name | `Alembic - Upgrade` |
| Script path | `E:\Projects\Python\oa-v1\backend\.venv\Scripts\alembic.exe` |
| Parameters | `upgrade head` |
| Working directory | `E:\Projects\Python\oa-v1\backend` |
| Environment variables | 同上添加 DATABASE_URL 等 |

### 6. 启动顺序

1. 确保 Docker Desktop 正在运行
2. 在 PowerShell 执行 `docker-compose up -d`
3. 点击 PyCharm 右上角运行 `Alembic - Upgrade`（首次或模型变更后）
4. 点击运行 `Backend - FastAPI`
5. 点击运行 `Frontend - Vite`

### 7. 常见问题

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
