# 部署到 Railway（Flask + 静态前端一体）

本项目是「Flask 后端 + 静态前端」单体：后端由 `backend/` 提供，前端 `frontend/`
由 Flask 直接托管。部署时**把整个仓库根作为 Railway 的 Root Directory**，通过根目录的
`wsgi.py` 暴露 Flask 实例给 gunicorn，前端与后端同处一个服务，无需跨域。

## 仓库根的关键文件
- `requirements.txt` —— 依赖（Flask / gunicorn / docxtpl / openpyxl / qrcode 等）
- `Procfile` —— `web: gunicorn wsgi:app --bind 0.0.0.0:${PORT:-8000} --workers 1 --timeout 120`
- `runtime.txt` —— `python-3.13.14`
- `wsgi.py` —— 入口：把 `backend/` 加入路径，导入 `app` 并显式 `init_db()` 建表

## 部署步骤
1. 在 GitHub 创建仓库，将本仓库推送上去。
2. Railway → New Project → Deploy from GitHub repo，选择该仓库。
   - Root Directory 保持仓库根（默认即可，Procfile/requirements 都在根）。
   - Railway 会自动 `pip install -r requirements.txt` 并按 Procfile 启动。
3. 部署成功后，Settings → Networking → Generate Domain 获得 `*.up.railway.app` 临时域名。
4. （推荐）添加持久卷，避免重启丢数据：
   - New → Volume，挂载路径填 `/data`（容量 1GB 足够）。
   - 在 Variables 中设置 `DATA_DIR=/data`。
     应用会把 SQLite 库与上传的 docx/名单/提交文件全部写到 `/data`，
     容器重启后数据仍在。不挂卷也能跑，但数据会随容器重建而清空。
5. 绑定自定义域名 `huanhuan.dpdns.org`：
   - Railway Settings → Public Networking → + Custom Domain，填入域名。
   - Railway 给出一条 CNAME + 一条 TXT 验证记录。
   - 到 Cloudflare（huanhuan.dpdns.org 的 DNS）添加这两条记录，等待验证通过（绿勾）。

## 环境变量（可选）
- `DATA_DIR`：持久数据目录，见上。不设置则默认 `backend/data`（容器内 ephemeral）。
- `FRONTEND_DIR`：前端目录，默认仓库根 `frontend/`，一般无需改。
- `CORS_ORIGINS`：逗号分隔的额外允许跨域来源（同源部署通常不需要）。

## 说明
- 数据库用 SQLite（轻量、零额外服务）。若日后需要更高可靠性，可迁移到 Railway 的
  PostgreSQL，并把 `db.py` 的连接改为读取 `DATABASE_URL`；当前为保持功能完整先沿用 SQLite + 卷。
- 分享/二维码里的访问地址会自动取请求域名；也可在管理端「设置」里手动填写站点地址。
