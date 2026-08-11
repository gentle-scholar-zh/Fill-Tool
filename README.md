# Fill Tool 后台管理系统

> 一站式表单模板管理平台：docx 模板自动解析、移动端填表、自动渲染、批量导出。
> **纯本地运行**，无需内网穿透/隧道。

## 项目结构

```
D:\Fill Tool\
├── backend/                后端服务（Flask + SQLite，模块化）
│   ├── app.py              入口：init_db() + app.run(port=5000)
│   ├── requirements.txt    Python 依赖（flask, flask-cors, docxtpl, python-docx, openpyxl）
│   ├── venv/               Python 虚拟环境
│   ├── run.bat             一键启动（激活 venv + 启动 app.py）
│   ├── activate.bat        激活虚拟环境进入命令行
│   └── src/                应用源码（包）
│       ├── app.py         create_app() 工厂：注册 11 个蓝图、CORS、teardown
│       ├── config.py       路径/地址集中管理（DATA_DIR, DB_PATH, ADMIN_DIR, USER_DIR…）
│       ├── db.py           get_db() / init_db() / row_to_dict() / gen_id()
│       ├── utils.py        字段推断、docx/xlsx 解析、表头检测、去重等
│       ├── render.py       docxtpl 渲染、服务端兜底填写页
│       └── routes/         蓝图包（按业务域拆分）
│           ├── templates.py   模板 CRUD/解析/发布/二维码/关联名单/进度
│           ├── submissions.py 提交列表/导出/下载/删除/批量删除(zip)
│           ├── roster.py      名单上传解析/详情/删除/验证/分发
│           ├── categories.py  名单分类
│           ├── users.py       用户
│           ├── notifications.py 通知
│           ├── recycle.py     回收站（软删除还原）
│           ├── share.py       分享/二维码
│           ├── settings.py    系统设置（site_url / retention）
│           ├── fill.py        用户端数据接口 + 传统表单兜底
│           └── pages.py       页面路由（/、/admin、/fill/<tid>、/user、/api/health）
├── frontend/               前端（静态多页，无需构建）
│   ├── admin/              管理端（9 个独立 HTML 页面）
│   │   ├── index.html templates.html submissions.html roster.html
│   │   ├── roster-categories.html users.html notifications.html
│   │   ├── recycle.html settings.html
│   │   ├── js/             common.js（核心 API/Modal/Toast/Shell）+ 各页 <page>.js
│   │   └── css/style.css   共享样式
│   └── user/               用户端填写页
│       ├── fill.html       加载 js/fill.js
│       ├── js/fill.js      字段渲染/身份验证/提交/下载
│       └── css/style.css   移动优先样式
├── data/                   由 backend 运行后生成（见 backend/data/ 实际位置）
└── .workbuddy/             项目记忆与设置
```

> 数据实际存放于 `backend/data/`：`tool.db`（SQLite）、`templates_storage/`、`submissions_storage/`、`rosters_storage/`。

## 启动

只需启动后端，前端由 Flask 以静态文件直接服务。

```bash
# 方式 1：一键启动
D:\Fill Tool\backend\run.bat

# 方式 2：手动
cd "D:\Fill Tool\backend"
venv\Scripts\activate
python app.py
```

后端监听 `http://127.0.0.1:5000`，首次启动自动初始化数据库与目录。

访问：
- 管理端：`http://127.0.0.1:5000/admin`
- 用户填写页：`http://127.0.0.1:5000/fill/<template_id>`

> 前端 `apiBaseUrl = window.location.origin`（同源），无需 CORS 跨域或 Vite 构建。
> 如需本机以外的浏览器/手机访问，在「系统设置 → 公开访问地址」填入局域网 IP（如 `http://192.168.1.100:5000`），手机连同一 WiFi 即可扫码填表。

## 核心特性

### 1. 模板自动解析（不写死字段）
上传 docx 模板，服务端用 docxtpl 提取 `{{字段名}}` 占位符，按字段名智能推断类型（同下）。

| 字段名包含 | 推断类型 | 校验规则 |
|---|---|---|
| 性别 / sex | 下拉选择 (男/女) | - |
| 生日 / 出生日期 | 日期选择 | - |
| 手机号 / 电话 | 单行文本 | `^1\d{10}$` 11 位 |
| 身份证 | 单行文本 | `^\d{17}[\dXx]$` 18 位 |
| 邮箱 | 单行文本 | 邮箱格式 |
| 学号 / 编号 | 单行文本 | 4-20 位字母数字 |
| 金额 / 价格 | 数字 | 最多两位小数 |
| 理由 / 说明 | 多行文本 | - |
| 班级 / 年级 | 单行文本 | - |
| 其他 | 单行文本 | - |

字段类型共 5 种：**单行文本 / 多行文本 / 数字 / 日期选择 / 下拉选择**（下拉选项逗号分隔）。

### 2. 完整 API 体系
- 后端用 SQLite 持久化，所有响应格式 `{ code: 0, data: ... }`，错误 `{ code: <n>, message: "..." }`。
- 56 条路由，覆盖模板、提交、名单、分类、用户、通知、回收站、分享、设置、填写页。

### 3. 用户端移动表单（fill.html）
- 移动优先（max-width 520px），实时校验（必填、pattern、错误高亮）。
- 下拉类型正确渲染为 `<select>`（从 `options` 解析）。
- 提交成功自动下载渲染好的 docx；加载/错误/成功 三态提示。

### 4. 名单关联与提交追踪
模板可关联名单，用户填写前做身份验证（学号+姓名），并统计谁已提交/谁未提交。

## API 端点（摘要）

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/templates` | 模板列表 |
| POST | `/api/templates` | 创建模板 |
| GET | `/api/templates/<id>` | 模板详情（含字段） |
| PUT | `/api/templates/<id>` | 更新模板 |
| DELETE | `/api/templates/<id>` | 软删除（移入回收站） |
| POST | `/api/templates/<id>/publish` | 发布 |
| POST | `/api/templates/parse` | docx 解析 |
| GET | `/api/submissions` | 提交列表 |
| POST | `/api/submissions` | 用户提交（含去重） |
| GET | `/api/submissions/<id>/download` | 下载渲染 docx |
| POST | `/api/submissions/export` | 批量导出（zip） |
| GET | `/api/roster` | 名单列表 |
| POST | `/api/roster/upload` | 上传名单（表头自动检测） |
| POST | `/api/roster/verify` `/api/roster/dispatch` | 验证 / 分发 |
| GET/POST | `/api/categories` `/api/users` `/api/notifications` `/api/recycle` `/api/settings` | 其他资源 |
| GET | `/api/fill/<id>` | 用户端获取填表字段（JSON） |
| GET | `/fill/<id>` | 用户端 HTML |

完整端点见 `AGENTS.md` §4。

## 完整工作流

```
[管理端] 上传 docx → 服务端解析 → 字段配置 → 创建模板
                                            ↓
                                    生成 fill_url（/fill/<tid>）
                                            ↓
[用户端] 打开 /fill/<tid> → 拉取字段 →（验证身份）→ 填写 → 提交
                                            ↓
                                    POST /api/submissions
                                            ↓
                            docxtpl 渲染 → 保存 docx
                                            ↓
                    [用户] 下载 / [管理端] 列表查看 / 批量导出 zip
```
