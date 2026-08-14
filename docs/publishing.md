# 发文与维护流程

## 内容状态

- `_drafts/*.md`：写作中的草稿，不会部署到正式网站。
- `_posts/YYYY-MM-DD-slug.md`：正式文章，会随下一次 GitHub Pages 构建上线。
- `status: published`：普通文章已发布。
- `status: review`：技术结论仍需复核。
- `status: verified`：技术内容已经验证，建议同时填写 `last-verified`。
- `status: archived`：保留链接的历史资料。

## 推荐流程

```bash
cd /f/baizetop1-master/baizetop1.github.io-push
npm run doctor
npm run new
```

写完草稿后：

```bash
npm run draft:publish -- english-slug
npm run check
git add -A
git commit -m "Add: 文章标题"
git push origin HEAD
```

## 文章字段

```yaml
title: "文章标题"
subtitle: "一句话摘要"
date: 2026-08-13
category: 读书
format: 复盘
status: published
slug: reading-notes
permalink: /p/reading-notes/
tags:
  - 阅读
  - 复盘
image: /img/posts/reading-notes/cover.jpg
image_alt: "封面内容说明"
```

`category` 可以使用安全、系统、工具、项目、读书、生活或任何新分类，分类页会自动识别。`format` 推荐使用教程、笔记、记录、复盘、随笔或观点。

安全文章可以额外填写：

```yaml
difficulty: 进阶
last-verified: 2026-08-13
```

## 发布前自动检查

`npm run check` 会阻止以下问题进入部署：

- 正式文章文件名或日期不正确。
- 缺少标题、分类、状态或标签。
- 重复使用同一个英文 slug。
- 状态字段填写错误。
- 本地封面或正文图片不存在。
- 已发布文章仍标记为草稿。

图片缺少说明、正文过短等问题会显示提醒，但不会阻止构建。

## 内容维护报告

发布后可以运行：

```bash
npm run report:content
npm run report:content -- --json
```

报告会按优先级列出缺少摘要、更新时间、验证日期、封面或正文过短的文章。它只提供维护建议，不会修改文章。`.github/workflows/content-audit.yml` 会每周自动生成同一份报告，并上传为 Actions artifact。

文章页还支持 `series` 和 `series_order` 字段，用于展示系列目录；同分类的其他文章会自动出现在文末的“继续阅读”区域。

## 本地预览

电脑安装 Jekyll 后可运行：

```bash
npm run dev:drafts
```

草稿只会在带 `--drafts` 的本地预览中出现，不会进入正式 GitHub Pages。
