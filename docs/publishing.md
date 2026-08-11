# 发文流程

## 1. 创建文章

在 Git Bash 里运行：

```bash
bash scripts/new-post.sh "文章标题" "分类" "标签1,标签2" "slug"
```

分类可以是现有分类，也可以直接写新的，例如 `随笔`、`项目`、`读书`。分类页会自动发现新分类，不需要改模板。

## 2. 写正文

脚本会在 `_posts/` 创建当天日期的 Markdown 文件。保留顶部的 front matter，把正文写在下面即可。也可以复制 `templates/post.md`。

## 3. 发布

```bash
git add -A
git commit -m "Add: 文章标题"
git push origin HEAD
```

推送到 `master` 后，GitHub Actions 会自动构建 GitHub Pages。文章页面会显示分类、标签、阅读时间和复核状态。

## 常用 front matter

```yaml
category: 随笔       # 安全 / 系统 / 工具 / 项目 / 任何自定义分类
difficulty: 基础    # 基础 / 进阶
status: review      # review / verified / archived
tags:
  - 关键词
```
