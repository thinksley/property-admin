# 物业管理系统（Web 后台）

基于 **FastAPI + SQLAlchemy + MySQL + React + Ant Design** 的物业管理后台，覆盖基础档案、收费、报修、访客、停车、投诉、公告、物料、设施、巡检、权限、操作日志和财务报表等模块。

> 当前开发环境：Python 3.9.6、Node.js（Vite 5）、MySQL 8.0。
> 代码兼容 Python 3.9+，如果使用 3.10+ 也可以正常运行。

---

## 1. 功能概览

- **基础档案**：小区信息、楼栋、单元、房屋、业主、家庭成员、车位档案
- **收费管理**：收费项目、账单生成、线下收款、微信/支付宝线上缴清、滞纳金、欠费催缴、对账、CSV 导出
- **报修工单**：登记、派单、接单、处理、完工、关闭、业主评价
- **访客门禁**：访客预约、临时通行码、审核、入场/离场
- **停车管理**：车位档案、车辆出入场、临停计费、月卡续费
- **投诉建议**：登记、处理、回复、回访闭环
- **通知公告**：草稿、发布、模拟推送、停水停电/催缴分类
- **资产物料**：物料档案、入库/领用、库存预警、出入库流水
- **公共设施**：设施台账、状态、保养登记、保养记录
- **巡检管理**：巡检点、打卡、异常上报、巡检记录
- **权限角色**：超级管理员、物业经理、收费员、财务、维修工
- **操作日志**：自动记录所有写操作（POST/PUT/PATCH/DELETE）
- **财务报表**：营收统计、欠费台账、收费台账、收支汇总、CSV 导出

> 说明：线上支付、公告推送、门禁道闸/人脸设备目前是**模拟实现**，没有对接真实微信、支付宝、短信或硬件设备。

---

## 2. 技术栈

### 后端

- **FastAPI 0.115**：Web 框架，自动生成 OpenAPI 文档
- **Uvicorn 0.30**：ASGI 服务器，开发时使用 `--reload`
- **SQLAlchemy 2.0**：ORM，使用 `Mapped` / `mapped_column` 新式写法
- **PyMySQL 1.1**：MySQL 驱动
- **Pydantic 2.9**：请求体校验与序列化
- **PyJWT 2.9**：登录 Token
- **bcrypt 4.2**：密码哈希
- **python-multipart**：解析登录表单

### 前端

- **React 18 + TypeScript**
- **Vite 5**：开发服务器与构建
- **Ant Design 5**：表格、表单、弹窗、菜单、统计卡片
- **Axios**：HTTP 请求
- **React Router 6**：前端路由

---

## 3. 目录结构

```text
property-admin/
├── backend/
│   ├── app/
│   │   ├── main.py           # FastAPI 入口、认证、房屋/账单/工单/总览、路由注册、操作日志中间件
│   │   ├── database.py       # 数据库连接、SessionLocal、Base、get_db
│   │   ├── models.py         # SQLAlchemy 模型（23 张表）
│   │   ├── schema.py         # 启动时幂等补列（create_all 不会修改已有表）
│   │   ├── security.py       # RBAC、bcrypt、JWT、current_user / require
│   │   ├── serializers.py    # 统一 JSON 序列化、CSV 导出
│   │   └── routers/
│   │       ├── archive.py    # 小区/楼栋/单元/房屋/业主/家庭成员/车位
│   │       ├── fee.py        # 收费项目/缴费/滞纳金/催缴/对账/导出
│   │       ├── parking.py    # 车辆出入场/临停计费/月卡续费
│   │       ├── service.py    # 访客/投诉/公告/报修评价
│   │       ├── asset.py      # 物料/设施/巡检
│   │       ├── system.py     # 用户/角色/操作日志
│   │       └── report.py     # 财务报表
│   ├── seed.py               # 初始化示例数据（可重复执行）
│   ├── requirements.txt
│   └── .venv/                # Python 虚拟环境
├── frontend/
│   ├── src/
│   │   ├── App.tsx           # 路由、分组菜单、登录页
│   │   ├── pages.tsx         # 总览/房屋/业主/账单/报修
│   │   ├── pages_archive.tsx # 小区/楼栋单元/家庭成员/车位
│   │   ├── pages_fee.tsx     # 收费项目/缴费记录
│   │   ├── pages_service.tsx # 访客/投诉/公告
│   │   ├── pages_parking.tsx # 停车记录
│   │   ├── pages_asset.tsx   # 物料/设施/巡检
│   │   ├── pages_system.tsx  # 用户角色/操作日志
│   │   ├── pages_report.tsx  # 营收统计/欠费台账
│   │   ├── api.ts            # Axios 实例、类型定义、枚举、CSV 下载
│   │   ├── auth.tsx          # 登录态、前端权限
│   │   ├── main.tsx
│   │   └── index.css
│   ├── package.json
│   └── vite.config.ts        # /api 代理到 127.0.0.1:8000
└── README.md
```

---

## 4. 快速开始

### 4.1 环境要求

- Python **3.9+**（当前使用 3.9.6）
- Node.js 18+（建议 20 LTS）
- MySQL 8.x（当前示例库：`mySecond`）
- 可用端口：后端 `8000`，前端 `5173`

### 4.2 准备 MySQL

先创建数据库（字符集必须是 `utf8mb4`，否则中文和 emoji 会乱码）：

```sql
CREATE DATABASE IF NOT EXISTS mySecond
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;
```

默认连接信息写在 `backend/app/database.py`：

```text
mysql+pymysql://root:123456@127.0.0.1:3306/mySecond?charset=utf8mb4
```

如果本机密码不同，用环境变量覆盖，不要改代码：

```bash
export DATABASE_URL="mysql+pymysql://root:你的密码@127.0.0.1:3306/mySecond?charset=utf8mb4"
export SECRET_KEY="请换成随机长字符串"
```

### 4.3 启动后端（Python 详细步骤）

```bash
cd backend

# 1. 创建虚拟环境（只需一次）
python3 -m venv .venv

# 2. 激活虚拟环境
source .venv/bin/activate          # macOS / Linux
# Windows: .venv\Scripts\activate

# 3. 确认使用的是虚拟环境里的 Python（应为 3.9+）
python -V
which python

# 4. 安装依赖
pip install -r requirements.txt

# 5. 初始化表和示例数据（可重复执行，不会覆盖已有用户）
python seed.py

# 6. 启动开发服务器
python -m uvicorn app.main:app --reload --port 8000
```

启动成功后：

- 接口文档：<http://127.0.0.1:8000/docs>
- OpenAPI JSON：<http://127.0.0.1:8000/openapi.json>
- 健康检查：直接访问 `/docs` 能打开即可

也可以直接使用虚拟环境里的 uvicorn：

```bash
.venv/bin/uvicorn app.main:app --reload --port 8000
```

> **注意**：命令必须在 `backend/` 目录执行。如果在项目根目录执行，会报 `ModuleNotFoundError: No module named 'app'`。

### 4.4 启动前端

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173
```

生产构建：

```bash
npm run build      # 先 tsc --noEmit 检查类型，再 vite build
npm run preview
```

Vite 已配置代理，前端请求 `/api/*` 会转发到 `http://127.0.0.1:8000`，所以本地开发不需要处理跨域。

### 4.5 默认账号

| 账号 | 密码 | 角色 | 说明 |
| --- | --- | --- | --- |
| admin | 123456 | 超级管理员 | 全部权限 |
| manager | 123456 | 物业经理 | 除系统管理外的大部分业务 |
| cashier | 123456 | 收费员 | 档案只读、收费、停车、报表 |
| finance | 123456 | 财务 | 账单/收费项目/报表只读 |
| repair01 | 123456 | 维修工 | 自己的工单、巡检、物料查看 |

> 上线前必须修改所有默认密码和 `SECRET_KEY`。

---

## 5. Python 后端详解

### 5.1 依赖说明（`requirements.txt`）

```text
fastapi==0.115.0          # Web 框架
uvicorn[standard]==0.30.6 # ASGI 服务器，包含 watchfiles、websockets 等
SQLAlchemy==2.0.35        # ORM
pydantic==2.9.2           # 请求体校验
PyJWT==2.9.0              # JWT 签发与校验
bcrypt==4.2.0             # 密码哈希
python-multipart==0.0.9   # OAuth2 表单登录
pymysql==1.1.1            # MySQL 驱动
```

`uvicorn[standard]` 会附带 `python-dotenv`，但项目**不会自动读取 `.env`**。如果需要使用 `.env`，启动时显式指定：

```bash
python -m uvicorn app.main:app --reload --env-file .env
```

### 5.2 配置项

| 环境变量 | 默认值 | 说明 |
| --- | --- | --- |
| `DATABASE_URL` | `mysql+pymysql://root:123456@127.0.0.1:3306/mySecond?charset=utf8mb4` | 数据库连接串 |
| `SECRET_KEY` | `dev-only-change-me` | JWT 签名密钥，生产必须修改 |

`backend/app/database.py` 中还定义了：

- `engine`：SQLAlchemy 引擎；SQLite 时会加 `check_same_thread=False`
- `SessionLocal`：会话工厂，`autoflush=False`、`expire_on_commit=False`
- `Base`：所有模型的基类
- `get_db()`：FastAPI 依赖，请求结束自动关闭 Session

### 5.3 应用启动流程

`app/main.py` 使用 `lifespan`：

1. `Base.metadata.create_all(engine)`：创建**不存在**的表。
2. `ensure_columns()`：给**已存在**的表补充新增列（MySQL 专用、幂等）。

请求处理大致经过：

```text
浏览器 / Axios
  → CORS 中间件
  → 路由依赖 require("xxx:read") / current_user
  → JWT 解码得到 user_id
  → get_db() 提供 Session
  → SQLAlchemy 查询/写入
  → serializers.py 拼装 JSON 或 CSV
  → 响应
  → operation_log 中间件记录写操作
```

> `create_all` **不会**修改已有表的列。新增字段时请同步修改 `app/schema.py` 的 `NEW_COLUMNS`，或者在正式项目中改用 Alembic。

### 5.4 代码分层

- `models.py`：只放数据库模型和关系，不写业务逻辑。
- `serializers.py`：统一输出格式，避免各路由重复拼字段。
- `security.py`：认证、密码、RBAC，不放业务代码。
- `routers/*.py`：按业务模块拆分路由，统一 `prefix="/api"`。
- `main.py`：应用装配、认证、少量核心业务（房屋/账单/报修/总览）、路由注册。

### 5.5 Python 3.9 语法注意事项（重点）

当前虚拟环境是 **Python 3.9.6**，以下写法会直接报错：

```python
# ❌ Python 3.9 不支持
id_card: Mapped[str | None] = mapped_column(String(30))
room_id: int | None = None
```

报错类似：

```text
TypeError: unsupported operand type(s) for |: 'type' and 'NoneType'
```

请使用 `typing.Optional`：

```python
from typing import Optional

# ✅ Python 3.9 可用
id_card: Mapped[Optional[str]] = mapped_column(String(30))
room_id: Optional[int] = None
```

其他说明：

- Python 3.9 **支持**内置泛型：`list[str]`、`dict[str, int]`、`set[str]`。
- Pydantic 模型和 SQLAlchemy `Mapped[...]` 的注解会在运行时被解析，所以不能只靠类型检查器“看起来没问题”。
- 如果以后升级到 Python 3.10+，可以使用 `X | None`，但建议全项目统一风格。
- 如果确实要在 3.9 中使用新语法，可加 `from __future__ import annotations`，但 SQLAlchemy/Pydantic 解析字符串注解时仍可能出问题，**本项目统一使用 `Optional`**。
- 代码中没有使用 `match`、`zoneinfo`、`ExceptionGroup` 等 3.10+ 特性。

### 5.6 认证与权限模型

**密码**：使用 `bcrypt.hashpw` / `bcrypt.checkpw`，数据库中只存哈希。

**Token**：`PyJWT` 签发 HS256 JWT，默认 12 小时过期：

```python
{"sub": str(user.id), "exp": ...}
```

**依赖注入**：

- `current_user`：解析 `Authorization: Bearer <token>`，查用户并校验 `is_active`
- `require("perm")`：在当前用户基础上校验权限，失败返回 `403`

**角色权限**（`app/security.py` 的 `ROLE_PERMS`）：

| 角色 | 权限点 |
| --- | --- |
| admin | `*`（全部） |
| manager | 档案、房屋、收费、报修、访客、停车、投诉、公告、资产、巡检、报表 |
| cashier | 档案只读、收费读写、停车、访客/投诉/公告只读、报表 |
| finance | 档案只读、账单只读、收费项目只读、报表 |
| repair01 | 报修处理、巡检、物料查看 |

权限点命名：

```text
dashboard:read
house:read / house:write
bill:read / bill:write
repair:read / repair:write / repair:handle
archive:read / archive:write
fee:read / fee:write
visitor:read / visitor:write
parking:read / parking:write
complaint:read / complaint:write
notice:read / notice:write
asset:read / asset:write
inspection:read / inspection:write
report:read
system:read / system:write
```

> `frontend/src/auth.tsx` 里有一份同样的权限表，只用于隐藏菜单和按钮。**真正的权限校验必须在后端**，修改角色后两边要同步。

### 5.7 新增一个 Python 模块的完整步骤

以“合同管理”为例：

**第 1 步：在 `app/models.py` 加模型**

```python
class Contract(Base):
    __tablename__ = "contracts"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    party_a: Mapped[Optional[str]] = mapped_column(String(100), default=None)
    amount_cents: Mapped[int] = mapped_column(Integer, default=0)
    start_date: Mapped[Optional[datetime]] = mapped_column(DateTime, default=None)
    end_date: Mapped[Optional[datetime]] = mapped_column(DateTime, default=None)
```

- 新表：重启应用后 `create_all` 会自动创建。
- 已有表加字段：在 `app/schema.py` 的 `NEW_COLUMNS` 里加 `(列名, MySQL 定义)`。

**第 2 步：新建 `app/routers/contract.py`**

```python
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from .. import models as m
from ..database import get_db
from ..security import require

router = APIRouter(prefix="/api", tags=["contract"])

class ContractIn(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    party_a: Optional[str] = None
    amount_cents: int = Field(0, ge=0)

@router.get("/contracts")
def list_contracts(_=Depends(require("contract:read")), db: Session = Depends(get_db)):
    return [{"id": x.id, "name": x.name, "amount_cents": x.amount_cents}
            for x in db.query(m.Contract).order_by(m.Contract.id.desc())]

@router.post("/contracts", status_code=201)
def create_contract(body: ContractIn, _=Depends(require("contract:write")),
                    db: Session = Depends(get_db)):
    x = m.Contract(**body.model_dump())
    db.add(x)
    db.commit()
    return {"id": x.id}
```

**第 3 步：在 `app/main.py` 注册路由**

```python
from .routers import contract

app.include_router(contract.router)
```

**第 4 步：加权限点**

```python
ROLE_PERMS["manager"].update({"contract:read", "contract:write"})
```

同时同步 `frontend/src/auth.tsx` 的 `PERMS`。

**第 5 步：加前端菜单、路由和页面**

- `frontend/src/App.tsx` 的 `NAV` 加菜单项，`Routes` 加路由
- 新建 `frontend/src/pages_contract.tsx`
- 在 `api.ts` 加 TypeScript 接口

**第 6 步：初始化数据**

在 `seed.py` 中按“表为空才插入”的方式补充示例数据，保证脚本可重复执行。

### 5.8 数据约定

- **金额统一用整数分**：字段名以 `_cents` 结尾，例如 `amount_cents=20585` 表示 205.85 元。前端用 `yuan()` 转换，避免浮点误差。
- **日期时间**：数据库用 `DATETIME`，接口返回 `YYYY-MM-DD HH:MM` 或 `YYYY-MM-DD` 字符串。
- **房子面积**：`Float`，单位 ㎡。
- **账单状态**：由 `paid_cents`、`amount_cents`、`late_fee_cents` 动态计算，不单独存状态字段。
- **报修状态流转**：

```text
pending（待派单）
  → assigned（已派单）
  → processing（处理中）
  → done（已完工）
  → closed（已关闭）
```

- **错误返回**：统一 `raise HTTPException(status_code, "中文提示")`。
  - `400` 参数/业务错误
  - `401` 未登录或 Token 失效
  - `403` 无权限
  - `404` 资源不存在
  - `409` 重复数据

### 5.9 数据库表（23 张）

| 分组 | 表 |
| --- | --- |
| 用户权限 | `users`、`operation_logs` |
| 小区房产 | `communities`、`buildings`、`units`、`rooms`、`owners`、`family_members` |
| 收费 | `fee_items`、`bills`、`payments` |
| 报修 | `repair_orders` |
| 访客/社区 | `visitors`、`complaints`、`announcements` |
| 停车 | `parking_spaces`、`parking_records` |
| 资产 | `materials`、`stock_records`、`facilities`、`maintenance_records` |
| 巡检 | `inspection_points`、`inspection_records` |

### 5.10 主要接口清单

所有接口前缀为 `/api`，完整参数以 `/docs` 为准。

**认证**

- `POST /auth/login`：表单登录（`username`、`password`）
- `GET /auth/me`：当前用户

**总览与档案**

- `GET /dashboard/summary`
- `GET/PUT /community`
- `GET/POST/PATCH/DELETE /buildings`
- `GET/POST/PATCH/DELETE /units`
- `GET/POST/PATCH/DELETE /rooms`
- `GET/POST/PATCH/DELETE /owners`
- `GET/POST/PATCH/DELETE /family-members`
- `GET/POST/PATCH/DELETE /parking-spaces`

**收费**

- `GET/POST/PATCH/DELETE /fee-items`
- `POST /bills/generate`：按收费项目生成账单
- `GET /bills`：账单列表
- `POST /bills/{id}/payments`：线下收款
- `POST /bills/{id}/online-pay`：微信/支付宝模拟缴清
- `POST /bills/apply-late-fee`：计算滞纳金
- `POST /bills/remind`：生成催缴通知
- `GET /bills/reconcile`：对账汇总
- `GET /bills/export`：导出账单 CSV
- `GET /payments`、`GET /payments/export`

**报修**

- `GET/POST /repairs`
- `POST /repairs/{id}/status`：状态流转
- `POST /repairs/{id}/review`：业主评价

**访客/投诉/公告**

- `GET/POST /visitors`、`POST /visitors/{id}/status`
- `GET/POST /complaints`、`POST /complaints/{id}/handle`
- `GET/POST/PATCH /announcements`、`POST /announcements/{id}/publish`

**停车**

- `GET/POST /parking-records`
- `POST /parking-records/{id}/exit`：出场结算
- `POST /parking-spaces/{id}/renew`：月卡续费

**资产/巡检**

- `GET/POST/PATCH/DELETE /materials`
- `POST /materials/{id}/stock`：入库/出库
- `GET /stock-records`
- `GET/POST/PATCH/DELETE /facilities`
- `POST /facilities/{id}/maintain`
- `GET /maintenance-records`
- `GET/POST/PATCH/DELETE /inspection-points`
- `GET/POST /inspection-records`

**系统/报表**

- `GET/POST/PATCH/DELETE /users`
- `GET /roles`
- `GET/DELETE /logs`
- `GET /reports/overview`
- `GET /reports/revenue`
- `GET /reports/arrears`
- `GET /reports/ledger`
- `GET /reports/income-expense`
- `GET /reports/arrears/export`
- `GET /reports/ledger/export`

### 5.11 Python 调试建议

```bash
# 只检查能否导入（不启动服务）
cd backend
.venv/bin/python -c "import app.main; print('import ok')"

# 带详细日志启动
.venv/bin/python -m uvicorn app.main:app --reload --log-level debug --port 8000

# 查看端口占用
lsof -nP -iTCP:8000 -sTCP:LISTEN
```

VS Code 调试配置（`.vscode/launch.json`）：

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "FastAPI",
      "type": "debugpy",
      "request": "launch",
      "module": "uvicorn",
      "args": ["app.main:app", "--reload", "--port", "8000"],
      "cwd": "${workspaceFolder}/backend",
      "jinja": true
    }
  ]
}
```

代码中可以直接使用 `breakpoint()`（Python 3.7+）打断点。

---

## 6. 前端说明

### 6.1 路由与菜单

- `App.tsx` 的 `NAV` 是菜单配置，支持 `children` 分组和 `perm` 权限点。
- 菜单会根据当前用户权限自动过滤。
- 默认只展开第一个分组「基础档案」，其他分组收起。
- 根路径 `/` 会显示总览；维修工没有总览权限时会自动跳到 `/repairs`。

### 6.2 权限同步

前端权限表在 `auth.tsx` 的 `PERMS` 中，仅用于界面显示控制：

```ts
const PERMS = {
  admin: ["*"],
  manager: [...],
  cashier: [...],
  finance: [...],
  repairman: [...],
};
```

后端权限表在 `backend/app/security.py` 的 `ROLE_PERMS` 中。**新增角色或权限点时，两边都要改**，否则会出现“菜单看不见”或“按钮点了 403”的问题。

### 6.3 构建与代理

`vite.config.ts`：

```ts
server: {
  port: 5173,
  proxy: { "/api": { target: "http://127.0.0.1:8000", changeOrigin: true } },
}
```

生产部署时把 `npm run build` 生成的 `dist/` 交给 Nginx，并将 `/api` 反向代理到 FastAPI。

---

## 7. 常见问题（Python 重点）

### 7.1 `TypeError: unsupported operand type(s) for |`

**原因**：Python 3.9 不支持 `str | None`。

**处理**：改成 `Optional[str]`，并 `from typing import Optional`。

### 7.2 `ModuleNotFoundError: No module named 'app'`

**原因**：没有在 `backend/` 目录启动。

**处理**：

```bash
cd backend
python -m uvicorn app.main:app --reload --port 8000
```

### 7.3 `ModuleNotFoundError: No module named 'pymysql'`

**原因**：没有激活 `.venv`，或依赖装到了系统 Python。

**处理**：

```bash
cd backend
source .venv/bin/activate
pip install -r requirements.txt
which python   # 应指向 backend/.venv/bin/python
```

### 7.4 `Access denied for user 'root'@'localhost'`

**原因**：数据库密码不对。

**处理**：用环境变量覆盖，不要改代码：

```bash
export DATABASE_URL="mysql+pymysql://root:你的密码@127.0.0.1:3306/mySecond?charset=utf8mb4"
```

### 7.5 `Unknown database 'mySecond'`

**处理**：

```sql
CREATE DATABASE mySecond DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 7.6 MySQL 8 认证插件报错

如果出现 `caching_sha2_password` / `cryptography` 相关错误：

```bash
pip install cryptography
```

或让 DBA 将账号认证方式调整为 `mysql_native_password`（不推荐在生产中使用）。

### 7.7 中文乱码

- 数据库、表、连接串都要使用 `utf8mb4`。
- 连接串必须带 `?charset=utf8mb4`。
- CSV 导出已写入 UTF-8 BOM，Excel 可直接打开。

### 7.8 端口被占用

```bash
lsof -nP -iTCP:8000 -sTCP:LISTEN
lsof -nP -iTCP:5173 -sTCP:LISTEN
```

结束旧进程后重启，或者换端口：

```bash
python -m uvicorn app.main:app --reload --port 8001
```

记得同步修改 `vite.config.ts` 的代理地址。

### 7.9 登录返回 401 / 接口返回 403

- `401`：未登录、Token 过期（默认 12 小时）或用户被停用。
- `403`：已登录但当前角色没有对应权限点。

### 7.10 修改表结构后字段没生效

`Base.metadata.create_all()` 不会给已有表加列。处理方式：

1. 在 `app/schema.py` 的 `NEW_COLUMNS` 中添加列定义，重启后自动补列；
2. 或手动执行 `ALTER TABLE`；
3. 正式项目建议引入 Alembic 做版本化迁移。

### 7.11 `bcrypt` 相关报错

项目直接使用 `bcrypt`，没有经过 `passlib`，因此不存在 `passlib` 与新版 `bcrypt` 的兼容问题。如果安装失败，确认使用的是虚拟环境，并升级 pip：

```bash
python -m pip install --upgrade pip
pip install -r requirements.txt
```

---

## 8. 启动后自检

### 8.1 后端接口

```bash
curl -X POST http://127.0.0.1:8000/api/auth/login \
  -d 'username=admin&password=123456' \
  -H 'Content-Type: application/x-www-form-urlencoded'
```

返回包含 `access_token` 即表示数据库、密码校验和 JWT 都正常。

### 8.2 前端页面

- <http://localhost:5173> 能打开登录页
- 使用 `admin / 123456` 登录
- 侧边栏能看到「总览 / 基础档案 / 收费管理 / 报修工单 / 社区服务 / 停车管理 / 资产巡检 / 财务报表 / 系统管理」

### 8.3 数据库

```bash
mysql -uroot -p123456 mySecond -e "SHOW TABLES;"
```

应能看到 23 张表。

---

## 9. 生产化建议与未实现项

上线前至少处理：

- 修改 `SECRET_KEY` 和所有默认密码
- 用环境变量/密钥管理服务保存数据库密码
- 使用 Alembic 管理表结构，而不是依赖 `create_all` + `ensure_columns`
- 使用 Nginx + HTTPS，后端用 Gunicorn/Uvicorn 多 worker
- 增加登录限流、刷新 Token、审计日志保留策略
- 数据库定期备份

当前未实现或仅为模拟：

- 微信/支付宝真实支付回调
- 短信、公众号模板消息真实推送
- 门禁、道闸、人脸设备对接
- 文件上传、报修图片、合同附件
- 多小区/多租户数据隔离
- 会计期间锁账、发票税务对接
- 前端代码拆分（当前构建产物约 1.1 MB，Vite 会提示 chunk 过大）

---

## 10. 常用命令速查

```bash
# 后端
cd backend
source .venv/bin/activate
python seed.py
python -m uvicorn app.main:app --reload --port 8000

# 前端
cd frontend
npm run dev
npm run build

# 检查 Python 导入
cd backend && .venv/bin/python -c "import app.main; print('ok')"

# 检查前端类型并构建
cd frontend && npm run build
```
