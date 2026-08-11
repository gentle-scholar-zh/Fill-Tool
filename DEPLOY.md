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
- `BASE_URL`（或 `SITE_URL`）：**强烈推荐在 Railway 设置**。填写你的公网域名，例如
  `https://huanhuan.dpdns.org`。应用会把该值作为分享/二维码链接的基址（最高优先级），
  彻底避免容器内网虚拟 IP（如 `10.255.254.20`）被误当作公网地址。
  即使不设置，应用也会优先用「请求实际到达的主机头（经反向代理转发）」自动适配域名，
  仅在完全无法识别时才回退——且任何内网/私有 IP 一律被拒绝写入链接。

## 说明
- 数据库用 SQLite（轻量、零额外服务）。若日后需要更高可靠性，可迁移到 Railway 的
  PostgreSQL，并把 `db.py` 的连接改为读取 `DATABASE_URL`；当前为保持功能完整先沿用 SQLite + 卷。
- 分享/二维码里的访问地址会自动取请求域名；也可在管理端「设置」里手动填写站点地址。

## 本地更新 → 自动部署 工作流
Railway 连接 GitHub 仓库后，**推送即自动部署**：每次 push 到 `main`，Railway 会拉取最新代码、
重装依赖、重启应用（约 1-3 分钟），无需手动操作。

日常开发流程：
1. 在本地照常写代码、改 bug、调试（本地服务 `http://127.0.0.1:5000`）。
2. 改动完成后，用一键脚本提交并推送：
   ```bash
   bash deploy.sh "修复了填写页崩溃"
   ```
   脚本等价于：`git add -A && git commit -m "..." && git push origin main`。
3. 推送后到 Railway 面板看部署进度；完成后刷新域名即可看到新版本。

> 注意：本地仓库分支已统一为 `main`（远程默认分支也是 `main`）。Railway 连接仓库时
> 选择部署分支为 `main`，这样 `git push origin main` 才会触发自动部署。

## 已推送到 GitHub
- 仓库：https://github.com/gentle-scholar-zh/Fill-Tool （默认分支 `main`）
- 如需重新推送：`git push -u origin main`
