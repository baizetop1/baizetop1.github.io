# BZ 现场笔记

这是一个 Jekyll + GitHub Pages 个人知识库，支持安全、系统、工具、项目、读书和随笔等任意主题。

## 第一次：切换到真正的 Git 仓库

只有下面这个目录包含 `.git`，以后请直接用它打开 Codex、VS Code 和终端：

```bash
cd /f/baizetop1-master/baizetop1.github.io-push
npm run doctor
```

如果这里还没有本次优化，最后同步一次：

```bash
cd /f/baizetop1-master
cp -a baizetop1.github.io-master/. baizetop1.github.io-push/
cd baizetop1.github.io-push
npm run doctor
```

同步完成后不再来回复制，所有写作和提交都在 `baizetop1.github.io-push` 完成。

## 日常发文

### 1. 创建草稿

```bash
npm run new
```

按提示输入标题、分类、文章形式、标签和英文链接标识。工具会自动创建：

```text
_drafts/reading-notes.md
img/posts/reading-notes/
```

也可以一次性传入参数：

```bash
npm run new -- --title "我的读书笔记" --category "读书" --format "复盘" --tags "阅读,复盘" --slug "reading-notes"
```

### 2. 添加图片

把图片放进工具创建的专属目录：

```text
img/posts/reading-notes/photo.jpg
```

正文中这样插入：

```markdown
![图片说明](/img/posts/reading-notes/photo.jpg)
```

封面使用 `cover.jpg`，然后取消文章顶部这一行的注释：

```yaml
image: /img/posts/reading-notes/cover.jpg
```

### 3. 草稿转正式文章

```bash
npm run draft:publish -- reading-notes
```

新文章会使用稳定短链接：

```text
https://baizeone.top/p/reading-notes/
```

### 4. 检查并提交

```bash
npm run check
git add -A
git commit -m "Add: 我的读书笔记"
git push origin HEAD
```

GitHub Actions 会先检查文章字段和本地图片，再自动构建发布。旧文章链接保持不变。

### 5. 维护内容健康度

搜索窗口支持按分类、文章形式和年份筛选。定期运行内容报告，可以快速找到需要补摘要、更新时间或复核的旧文章：

```bash
npm run report:content
```

仓库还配置了每周内容审计工作流；报告会出现在 Actions 的运行摘要和构建产物中。

## 直接创建正式文章

不需要草稿时可以加入 `--publish`：

```bash
npm run new -- --title "临时记录" --category "随笔" --tags "记录" --slug "quick-note" --publish
```

## 常用命令

| 命令 | 作用 |
|---|---|
| `npm run doctor` | 检查当前目录是不是可提交的 Git 仓库 |
| `npm run new` | 交互式创建草稿和图片目录 |
| `npm run draft:publish` | 从列表选择草稿并转为正式文章 |
| `npm run check` | 检查脚本、文章字段和图片路径 |
| `npm run report:content` | 输出文章健康度和维护优先级报告 |
| `npm run dev:drafts` | 在已安装 Jekyll 的电脑上预览草稿 |

在 PowerShell 中如果 `npm` 被执行策略拦截，将命令中的 `npm` 改成 `npm.cmd`。
