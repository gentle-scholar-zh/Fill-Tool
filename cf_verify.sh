#!/usr/bin/env bash
# 用 Cloudflare API 部署微信业务域名校验 Worker（绕过 Railway）
# 用法：
#   CF_TOKEN=xxxx CF_ACCOUNT=xxxx CF_ZONE=xxxx bash cf_verify.sh
set -e

: "${CF_TOKEN:?请设置环境变量 CF_TOKEN（Cloudflare API Token）}"
: "${CF_ACCOUNT:?请设置环境变量 CF_ACCOUNT（Cloudflare Account ID）}"
: "${CF_ZONE:?请设置环境变量 CF_ZONE（huanhuan.dpdns.org 的 Zone ID）}"

SCRIPT="wechat-verify"
ROUTE_PATTERN="huanhuan.dpdns.org/405a55ceab4b4143f5221d996024d361.txt"
HERE="$(cd "$(dirname "$0")" && pwd)"
JS_FILE="$HERE/wechat_verify_worker.js"

AUTH="Authorization: Bearer $CF_TOKEN"

echo "== [1/2] 上传 Worker 脚本: $SCRIPT =="
curl -s -X PUT \
  "https://api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT/workers/scripts/$SCRIPT" \
  -H "$AUTH" \
  -H "Content-Type: application/javascript" \
  --data-binary "@$JS_FILE"
echo ""

echo "== [2/2] 绑定 Worker 路由: $ROUTE_PATTERN -> $SCRIPT =="
curl -s -X POST \
  "https://api.cloudflare.com/client/v4/zones/$CF_ZONE/workers/routes" \
  -H "$AUTH" \
  -H "Content-Type: application/json" \
  --data-binary "{\"pattern\":\"$ROUTE_PATTERN\",\"script\":\"$SCRIPT\"}"
echo ""

echo "== 完成，等待 1 分钟后探活 =="
echo "curl -s https://huanhuan.dpdns.org/405a55ceab4b4143f5221d996024d361.txt"
