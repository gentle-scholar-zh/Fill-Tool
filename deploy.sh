#!/usr/bin/env bash
# Fill-Tool 一键部署脚本
# 用法：  bash deploy.sh "本次更新的说明"
# 作用： 把本地所有改动提交并推送到 GitHub 的 main 分支，
#        Railway 检测到推送后会自动拉取最新代码并重新部署（约 1-3 分钟）。
set -e
cd "$(dirname "$0")"

MSG="${1:-更新}"
if [ -z "$(git status --porcelain)" ]; then
  echo "✅ 没有需要提交的改动，已是最新。"
  exit 0
fi

echo "==> 暂存所有改动"
git add -A
echo "==> 提交: $MSG"
git commit -m "$MSG"
echo "==> 推送到 origin/main (Railway 将自动部署)"
git push origin main
echo "✅ 已推送。请到 Railway 面板查看部署进度（通常 1-3 分钟完成）。"
