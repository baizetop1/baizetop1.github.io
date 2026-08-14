#!/usr/bin/env bash
set -Eeuo pipefail

# 兼容旧命令；实际逻辑由跨平台 Node 脚本处理。
exec node "$(dirname "$0")/new-post.mjs" "$@"
