# AGENTS.md — Fill Tool Project

> 面向 AI 编程代理的项目指南。阅读本文件可快速理解项目结构、架构约定和开发工作流。
> **最近一次重大重构**：单体 `app.py` 拆分为模块化蓝图包；前端从 Vite SPA 改为静态多页（无构建步骤）；移除所有内网穿透/隧道配置，仅本地运行。

## 1. 项目概述

**Fill Tool** — 一站式表单模板管理平台。支持 docx 模板自动解析、移动端填表、文档自动渲染、批量导出。

- **管理端**：静态多页（每个功能一个独立 `.html`，共享 `common.js` 核心模块），由 Flask 直接以静态文件服务。
- **用户端**：`frontend/user/fill.html` + `js/fill.js`，移动优先表单页。
- **后端**：Flask + SQLite + docxtpl + python-docx，模块化蓝图包（`backend/src/`）。
- **数据存储**：SQLite 数据库 + 本地文件目录，统一位于 `backend/data/`。
- **运行方式**：仅本地。`python app.py` 监听 `127.0.0.1:5000`，同时服务 API 与前端静态页。**无 Vite、无构建、无 node_modules、无内网穿透。**

## 2. 项目结构

```
D:\Fill Tool/
├── README.md                  # 用户面向项目文档
├── AGENTS.md                  # 本文件 (AI 开发代理指南)
├── backend/
│   ├── app.py                 # 入口：init_db() + app.run(host=0.0.0.0, port=5000)
│   ├── requirements.txt       # Python 依赖 (flask, flask-cors, docxtpl, python-docx, openpyxl)
│   ├── venv/                  # Python 虚拟环境 (managed 3.13.12)
│   ├── run.bat                # 一键启动后端
│   ├── activate.bat           # 激活虚拟环境
│   └── src/                   # 应用源码（包，绝对不写单体巨型文件）
│       ├── __init__.py
│       ├── app.py             # create_app() 工厂：注册蓝图、CORS、teardown_appcontext
│       ├── config.py          # 路径/地址集中管理
│       ├── db.py              # get_db / close_db / init_db / row_to_dict / gen_id
│       ├── utils.py           # infer_type / docx_to_type / 解析 / 表头检测 / 去重 / 命名
│       ├── render.py          # render_docx(docxtpl) / render_fill_html(兜底)
│       └── routes/            # 蓝图包（11 个，按业务域拆分）
│           ├── __init__.py    # register_routes(app) 注册全部蓝图
│           ├── templates.py   # /api/templates* 模板 CRUD/解析/发布/二维码/关联名单/进度
│           ├── submissions.py # /api/submissions* 提交/导出/下载/删除/批量删除(zip)
│           ├── roster.py      # /api/roster* 名单上传解析/详情/删除/验证/分发
│           ├── categories.py  # /api/categories*
│           ├── users.py       # /api/users*
│           ├── notifications.py # /api/notifications*
│           ├── recycle.py     # /api/recycle* 软删除回收站
│           ├── share.py       # /api/share* 分享/二维码
│           ├── settings.py    # /api/settings* site_url / retention
│           ├── fill.py        # /api/fill/<id> 用户端数据 + submit_fill 兜底
│           └── pages.py       # 页面路由: /、/admin、/admin/<path>、/fill/<tid>、/user/<path>、/api/health
└── frontend/
    ├── admin/                 # 管理端（静态多页）
    │   ├── index.html         # 仪表盘
    │   ├── templates.html submissions.html roster.html roster-categories.html
    │   ├── users.html notifications.html recycle.html settings.html
    │   ├── js/
    │   │   ├── common.js      # 核心模块: api / toast / Modal / confirmDialog / initShell / esc / fmtDate / inferFieldType / downloadBlob
    │   │   └── <page>.js      # 每个页面一个脚本（dashboard/templates/submissions/roster/roster-categories/users/notifications/recycle/settings）
    │   └── css/style.css      # 共享样式（侧边栏/顶栏/卡片/表格/按钮/Modal/Toast）
    └── user/                  # 用户端填写页
        ├── fill.html          # 加载 js/fill.js
        ├── js/fill.js         # renderForm / 身份验证 / 提交 / 下载
        └── css/style.css      # 移动优先样式
```

> **数据实际位置**：`backend/data/`（`config.DATA_DIR`）下含 `tool.db`、`templates_storage/`、`submissions_storage/`、`rosters_storage/`。`config.py` 在导入时自动创建这些目录。

## 3. 前端架构（静态多页，无构建）

### 3.1 同源直接访问

每个管理页面是一个独立 `.html`，通过 `<script type="module">` 引入 `js/common.js` 与对应 `js/<page>.js`。
`common.js` 中 `apiBaseUrl = window.location.origin`，所有 `/api/*` 请求走同源相对路径，**无需 CORS 跨域、无需 Vite dev server**。

页面布局统一：`#sidebar`（由 `initShell(active)` 渲染）+ `#content`（页面注入区）+ 顶栏（含时钟）。
新增页面步骤：
1. 复制 `templates.html` 为 `xxx.html`，改 `<title>` 与页面标题；
2. 写 `js/xxx.js`，开头 `import { api, initShell, toast, esc } from './common.js';` 然后 `initShell('xxx');`；
3. 在 `common.js` 的 `NAV` 数组加一项（`{ key, label, ico, href }`）。

### 3.2 核心模块 common.js

| 成员 | 说明 |
|---|---|
| `api` | 所有接口封装。`_fetch(path, opts)` 内部 `path` 自动加 `/api` 前缀，返回 `res.json()` 的 `data` 字段（响应格式 `{code:0,data}`）。例如 `api.getTemplates()` → `GET /api/templates`。 |
| `toast(msg, type)` | 轻提示（ok/err/warn）。 |
| `Modal` | 模态框类。`new Modal({ title, bodyHtml, onConfirm, confirmText })`。`saveBtn`(`data-modal="save"`) 点击 → `await onConfirm(this)` → `close()`。**注意：close() 必须在 onConfirm 之后调用**（早期 bug 即源于此）。 |
| `confirmDialog(msg, onConfirm)` | 简易确认框。 |
| `initShell(active)` | 渲染侧边栏 + 顶栏时钟；`active` 高亮当前菜单。 |
| `esc(s)` | XSS 转义。 |
| `fmtDate(s)` | 日期格式化。 |
| `inferFieldType(name)` | 按字段名关键词推断类型（见 §5 表）。 |
| `downloadBlob(blob, name)` | 触发浏览器下载。 |

### 3.3 字段类型（TYPE_OPTIONS）

`templates.js` 定义 5 种类型，新增/编辑字段行渲染完整 `<option>`：
```js
const TYPE_OPTIONS = [
  { raw: 'text', label: '单行文本' },
  { raw: 'textarea', label: '多行文本' },
  { raw: 'number', label: '数字' },
  { raw: 'date', label: '日期选择' },
  { raw: 'select', label: '下拉选择' },
];
```
用户端 `fill.js` 对 `raw === 'select'` 从 `f.options`（逗号分隔）解析并渲染真实 `<select>`。

### 3.4 页面路由（后端 pages.py）

后端直接以静态文件服务前端目录，并做目录穿越防护（`_safe_path` 用 `os.path.normpath` 校验）：
- `/` 与 `/admin` → `ADMIN_DIR/index.html`
- `/admin/<path>` → `ADMIN_DIR/<path>`（缺省补 `.html`）
- `/fill/<tid>` → 优先 `USER_DIR/fill.html`，否则服务端 `render_fill_html` 兜底
- `/user/<path>` → `USER_DIR/<path>`
- `/api/health` → 健康检查

## 4. 后端架构（模块化蓝图）

### 4.1 约定

- **应用工厂**：`src/app.py` 的 `create_app()` 创建 `Flask(__name__, static_folder=None)`，注册 11 个蓝图，`teardown_appcontext(close_db)`。模块级 `app = create_app()`，`backend/app.py` 直接 `from src.app import app`。
- **数据库**：SQLite，`get_db()` 取连接（WAL，`check_same_thread=False`），`g` 回收。`init_db()` 建表并对旧库做兼容 ALTER。
- **响应格式**：统一 `{ code: 0, data: ... }`；错误 `{ code: <n>, message: "..." }`。**注意 `data` 可能是对象或数组**（列表接口返回 `data: [...]`）。
- **CORS**：仅允许同源（`localhost:5000` / `127.0.0.1:5000`）+ 可选环境变量 `CORS_ORIGINS`（逗号分隔额外来源）。**无 Vite dev(5173)、无静态服务器(8080)、无隧道来源。**
- **软删除**：`templates`/`submissions`/`roster` 等表含 `deleted` 字段（0/1）；删除 = `UPDATE ... SET deleted=1` + 写 `recycle` 表，永不直接 DELETE 业务数据。
- **路径集中**：所有存储/DB 路径经 `config.py` 暴露（`DB_PATH`/`TPL_DIR`/`SUB_DIR`/`RST_DIR`/`ADMIN_DIR`/`USER_DIR`）。**新增存储路径时务必走 config，不要硬编码。**

### 4.2 主要 API 端点（共 56 条路由）

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/templates` | 模板列表（软删除筛选） |
| POST | `/api/templates` | 创建模板（携带 docx base64 或字段） |
| GET | `/api/templates/<id>` | 模板详情（含 `fields`） |
| PUT | `/api/templates/<id>` | 更新模板 |
| DELETE | `/api/templates/<id>` | 软删除（移入回收站） |
| POST | `/api/templates/<id>/publish` | 发布 |
| POST | `/api/templates/parse` | 服务端 docx 解析（备用） |
| GET | `/api/templates/<id>/roster-progress` | 提交进度（已/未提交） |
| GET | `/api/templates/<id>/qrcode` | 分享二维码（base64） |
| POST | `/api/templates/<id>/link-roster` | 关联名单 |
| GET | `/api/templates/<tid>/roster` | 模板关联名单 |
| GET | `/api/submissions?template_id=` | 提交列表 |
| POST | `/api/submissions` | 创建提交（含去重） |
| GET | `/api/submissions/<id>/download` | 下载渲染 docx |
| POST | `/api/submissions/export` | 批量导出（zip，支持 `splitField` 分文件夹） |
| GET | `/api/submissions/export-fields?template_id=` | 导出字段列表 |
| DELETE | `/api/submissions/<id>` | 单条删除（级联 docx） |
| DELETE | `/api/submissions/batch` | 批量删除（ids / template_id / 清空） |
| GET | `/api/roster` | 名单列表 |
| GET | `/api/roster/<id>` | 名单详情 |
| POST | `/api/roster/upload` | 上传名单（Excel/CSV 表头自动检测） |
| DELETE | `/api/roster/<id>` | 删除名单 |
| POST | `/api/roster/verify` | 校验名单字段匹配 |
| POST | `/api/roster/dispatch` | 分发名单（多奖项合并去重） |
| GET/POST | `/api/categories` `/api/users` `/api/notifications` | 分类/用户/通知 |
| GET | `/api/recycle` | 回收站列表 |
| POST | `/api/recycle/<id>/restore` `/api/recycle/restore-all` | 还原 |
| DELETE | `/api/recycle/<id>` `/api/recycle` | 永久删除 / 清空 |
| GET/POST | `/api/settings` | 系统设置 |
| GET/PUT | `/api/settings/site-url` `/api/settings/retention` | 公网地址 / 保留天数 |
| GET | `/api/fill/<id>` | 用户端字段 + 名单验证信息 |
| GET | `/fill/<id>` | 用户端 HTML（兜底） |

## 5. 用户端表单（fill.js）约定

- **加载流程**：`init()` → 拉取 `/api/fill/<tid>` → 解析 `fields` → `renderForm()`。
- **模板 ID 获取**：从 `/fill/<tid>` 路径提取 `tid`。
- **字段渲染**：`raw` 决定控件——`text/textarea/number/date` 渲染对应 input；`select` 从 `options` 逗号分隔渲染 `<select>`。
- **表单校验**：必填、pattern（手机号 11 位、身份证 18 位、邮箱、学号 4-20 位）、错误高亮。
- **提交去重**：按 `template_id + submitter` 去重，已存在则 UPDATE 非 INSERT。
- **身份验证流程**：模板关联名单时先显示验证步骤（学号+姓名）→ 通过预填 → 显示表单；已提交过则进入「修改信息」模式。

字段类型推断（`inferFieldType` / `utils.infer_type`）关键词表：

| 关键词 | 类型 | 校验/选项 |
|---|---|---|
| 性别 / sex | 下拉 | 男, 女 |
| 生日 / 出生日期 | 日期 | - |
| 手机号 / 电话 / mobile / phone | 文本 | `^1\d{10}$` |
| 身份证 / idcard | 文本 | `^\d{17}[\dXx]$` |
| 邮箱 / email / mail | 文本 | 邮箱格式 |
| 学号 / 工号 / 编号 / no / id | 文本 | `^[a-zA-Z0-9]{4,20}$` |
| 年龄 / age | 数字 | - |
| 金额 / 价格 / price / amount / money | 数字 | 最多两位小数 |
| 理由 / 说明 / 备注 / 原因 / desc | 多行 | - |
| 班级 / 年级 / 部门 / class / grade | 文本 | - |
| 其他 | 文本 | - |

## 6. 开发工作流

### 6.1 启动后端

```bash
# 便捷脚本
D:\Fill Tool\backend\run.bat

# 手动
cd "D:\Fill Tool\backend"
venv\Scripts\activate
python app.py
```

监听 `http://127.0.0.1:5000`，首次自动初始化数据库与目录。

> **Python 版本**：managed 3.13.12 (`C:\Users\zheng\.workbuddy\binaries\python\versions\3.13.12\python.exe`)。所有 pip 安装经 `backend/venv`，绝不全局安装。

### 6.2 没有前端构建步骤

前端是纯静态 HTML/JS/CSS，**无需 `npm`/`vite`/`node_modules`**。修改后刷新浏览器即可（Flask 直接服务文件）。如需本机外访问，在「系统设置 → 公开访问地址」填局域网 IP。

### 6.3 端到端自测（推荐用 test_client，避免污染 DB）

```bash
cd "D:\Fill Tool\backend"
venv\Scripts\python.exe -c "from src.app import app; from src.db import init_db; init_db(); c=app.test_client(); print(c.get('/api/health').status_code)"
```

注意：列表接口响应为 `{code:0, data:[...]}`，取 `.json()['data']`。

## 7. 关键模式（Patterns）

### 7.1 软删除 + 回收站
- 业务表：`deleted` 字段（0/1）。
- 删除：`UPDATE ... SET deleted=1` + 写 `recycle` 表（带 `expire_in`）。
- 还原：`UPDATE ... SET deleted=0` + 从 recycle 删除。
- 查询：`WHERE deleted = 0`。

### 7.2 提交去重
`POST /api/submissions` 按 `template_id + submitter` 去重：存在则 UPDATE，否则 INSERT（名单场景：同一人多奖项合并为一条）。

### 7.3 文件命名（build_filename_from_fields）
读取模板 `fields` 顺序，拼接所有非空字段值（用 `_` 分隔），超过 150 字符裁剪；无非空字段则用提交 ID。
示例：`测试奖_999_命名测试_男_汉_团员_计算机_3班_5_30.docx`

### 7.4 名单表头自动检测（detect_header_row）
扫描前 15 行，关键词评分（学号/姓名/序号/编号/班级/身份证/手机/金额/成绩等 28 词）找表头行；空列自动命名「列 N」。

### 7.5 名单去重（deduplicate_roster）
同一人多行合并为一行（按身份字段）。

### 7.6 表单校验
前端 `fill.js` 字段类型推断见 §5 表。

## 8. 代码风格约定

- **前端**：原生 ES Modules + Vanilla JS。`const`、`async/await`、`try/catch`。所有动态文本经 `esc()`。中文注释。页面脚本从 `common.js` 导入复用模块。
- **后端**：Flask 蓝图风格。所有存储/DB 路径经 `config.py`。`get_db()` 取连接，`jsonify` 返回统一格式。中文注释。
- **命名**：snake_case (Python) / camelCase (JS)。API 路径复数名词或 kebab-case。
- **分层**：后端按业务域拆蓝图；前端按页面拆脚本。**不要把所有逻辑塞进单体文件。**
- **所有写操作** 都必须有 API 方法，UI 与后端完全分离。

## 9. 常见调试

- **页面白屏**：看浏览器 Console。模块语法错误会使整个 `<script type="module">` 静默失败。`node --check frontend/admin/js/xxx.js` 可验语法。
- **API 连不上**：确认 `python app.py` 已启动且端口 5000。前端走同源 `window.location.origin`，无需额外配置。
- **数据库只读**：确保 `debug=False`，避免 reloader 子进程与 WAL 冲突。外部脚本不可直写 `tool.db`，必须经 Flask API。
- **端口被旧进程占用**：`netstat -ano | findstr :5000` 找到 PID，`Stop-Process -Id <pid> -Force` 释放。曾出现旧会话残留 Flask 进程导致接口 500。
- **目录穿越防护**：`pages.py` 的 `_safe_path` 用 `os.path.normpath` 校验，避免 `..` 越权访问。
