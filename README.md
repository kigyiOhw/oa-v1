# OA System

企业办公自动化系统，支持请假、报销、加班申请等审批工作流。

## 技术栈

- **后端**: Python 3.11+ / FastAPI / SQLAlchemy 2.0 (async) / PostgreSQL 16 / Redis 7
- **前端**: React 18 / TypeScript / Vite / Tailwind CSS / Zustand / React Router v6
- **实时通信**: WebSocket

## 环境要求

- [Python 3.11+](https://www.python.org/)
- [Node.js 20+](https://nodejs.org/)
- [Docker](https://www.docker.com/)
- [uv](https://github.com/astral-sh/uv) (Python 包管理器)

## 快速开始

### 1. 启动基础设施

```bash
docker-compose up -d
```

这会启动 PostgreSQL 和 Redis。

### 2. 后端 setup

```bash
cd backend

# 创建虚拟环境并安装依赖 (使用 uv)
uv venv
uv pip install -e ".[dev]"

# 或同步现有环境
uv pip sync requirements.txt   # 如果有的话

# 复制环境变量
cp .env.example .env

# 执行数据库迁移
uv run alembic upgrade head

# 启动开发服务器
uv run uvicorn app.main:app --reload --port 8000
```

> `uv` 会自动读取 `pyproject.toml` 中的依赖。`uv run` 会在虚拟环境中执行命令，无需手动激活。

### 3. 前端 setup

```bash
cd frontend

npm install
npm run dev
```

前端运行在 `http://localhost:5173`，后端 API 在 `http://localhost:8000`。

## 常用命令

### 后端 (backend/)

| 命令 | 说明 |
|------|------|
| `uv run uvicorn app.main:app --reload --port 8000` | 启动开发服务器 |
| `uv run alembic revision --autogenerate -m "描述"` | 生成数据库迁移 |
| `uv run alembic upgrade head` | 执行迁移 |
| `uv run alembic downgrade -1` | 回退一次迁移 |
| `uv run pytest` | 运行测试 |
| `uv run ruff check .` | 代码检查 |
| `uv run ruff format .` | 代码格式化 |
| `uv run mypy app` | 类型检查 |

### 前端 (frontend/)

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动开发服务器 |
| `npm run build` | 生产构建 |
| `npm run lint` | ESLint 检查 |

## 项目结构

```
oa-v1/
├── backend/
│   ├── app/
│   │   ├── api/v1/          # API 路由
│   │   ├── core/            # 配置、安全
│   │   ├── db/              # 数据库连接
│   │   ├── models/          # ORM 模型
│   │   ├── schemas/         # Pydantic 模型
│   │   ├── services/        # 业务逻辑
│   │   ├── repositories/    # 数据访问
│   │   └── utils/           # 工具函数
│   ├── alembic/             # 数据库迁移
│   └── pyproject.toml       # 依赖配置
├── frontend/
│   ├── src/
│   │   ├── api/             # Axios 封装
│   │   ├── pages/           # 页面组件
│   │   ├── stores/          # Zustand 状态
│   │   └── router/          # 路由配置
│   └── package.json
└── docker-compose.yml
```

## API 文档

启动后端后访问：

- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## 开发计划

详见 [PLAN.md](./PLAN.md)。
