#!/usr/bin/env bash
set -Eeuo pipefail

usage() {
    cat <<'EOF'
用法：
  bash scripts/new-post.sh "文章标题" [分类] [标签1,标签2] [slug]

示例：
  bash scripts/new-post.sh "我的读书笔记" "随笔" "阅读,复盘" "reading-notes"
  bash scripts/new-post.sh "Docker 排障记录" "工具" "Docker,排障"
EOF
}

if (( $# < 1 || $# > 4 )); then
    usage
    exit 1
fi

title="$1"
category="${2:-随笔}"
tags_csv="${3:-}"
slug="${4:-}"

yaml_escape() {
    local value="$1"
    value="${value//\\/\\\\}"
    value="${value//\"/\\\"}"
    printf '%s' "$value"
}

if [[ -z "$slug" ]]; then
    slug="$(printf '%s' "$title" | tr '[:upper:]' '[:lower:]' | tr -cs '[:alnum:]' '-' | sed -E 's/^-+//; s/-+$//')"
fi

# 中文标题在部分 Git Bash locale 下无法转换成 slug，使用稳定的时间 slug 兜底。
if [[ -z "$slug" || "$slug" == "-" ]]; then
    slug="note-$(date +%Y%m%d-%H%M%S)"
fi
slug="$(printf '%s' "$slug" | tr ' ' '-' | sed -E 's#[/\\]+#-#g; s/[^[:alnum:]_.-]+/-/g; s/^-+//; s/-+$//')"
[[ -z "$slug" ]] && slug="note-$(date +%Y%m%d-%H%M%S)"

today="$(date +%F)"
file="_posts/${today}-${slug}.md"
counter=2
while [[ -e "$file" ]]; do
    file="_posts/${today}-${slug}-${counter}.md"
    counter=$((counter + 1))
done

title_yaml="$(yaml_escape "$title")"
category_yaml="$(yaml_escape "$category")"
tags_block=""
if [[ -n "$tags_csv" ]]; then
    IFS=',' read -r -a tags <<< "$tags_csv"
    for raw_tag in "${tags[@]}"; do
        tag="$(printf '%s' "$raw_tag" | sed -E 's/^[[:space:]]+//; s/[[:space:]]+$//')"
        [[ -z "$tag" ]] && continue
        tags_block+="    - \"$(yaml_escape "$tag")\""$'\n'
    done
fi
if [[ -z "$tags_block" ]]; then
    tags_block="    - \"$category_yaml\""$'\n'
fi

cat > "$file" <<EOF
---
layout: post
title: "$title_yaml"
subtitle: ""
date: $today
author: 白泽
catalog: true
category: "$category_yaml"
difficulty: 基础
status: review
tags:
$tags_block---

# $title

## 先写结论

<!-- 先用几句话写清楚：解决了什么问题、适用什么场景。 -->

## 过程记录

<!-- 命令、截图、思路和踩坑都可以先记下来。 -->
EOF

printf '已创建：%s\n' "$file"
printf '编辑完成后执行：git add -A && git commit -m "Add: %s" && git push origin HEAD\n' "$title"

if command -v code >/dev/null 2>&1; then
    code "$file" >/dev/null 2>&1 || true
elif command -v notepad.exe >/dev/null 2>&1; then
    notepad.exe "$file" >/dev/null 2>&1 || true
fi
