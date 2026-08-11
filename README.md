# BZ 现场笔记

这是一个 Jekyll 静态站点。文章不限制在安全主题，使用 `category` 区分安全、系统、工具、项目、随笔等方向，使用 `tags` 描述具体关键词。

## 最快发一篇文章（Git Bash）

```bash
# 在已经有 .git 的发布目录执行，例如：
cd /f/baizetop1-master/baizetop1.github.io-push

# 标题必填；分类、标签、slug 都可以省略
bash scripts/new-post.sh "我的读书笔记" "随笔" "阅读,复盘" "reading-notes"

# 编辑脚本创建的 _posts/ 文件，然后提交发布
git add -A
git commit -m "Add: 我的读书笔记"
git push origin HEAD
```

推送后，GitHub Actions 会自动构建并发布。新文章默认是“随笔 / 基础 / 待复核”，需要时直接改 front matter 的 `category`、`difficulty`、`status` 和 `tags`。

如果你在没有 `.git` 的 `baizetop1.github.io-master` 目录编辑，先把内容同步到 `baizetop1.github.io-push`，再执行上面的提交命令：

```bash
cp -a /f/baizetop1-master/baizetop1.github.io-master/. /f/baizetop1-master/baizetop1.github.io-push/
```

也可以在网站的“文章归档”页点击“在 GitHub 写一篇”，直接用 GitHub 网页编辑器新增 `_posts/` 文件。
