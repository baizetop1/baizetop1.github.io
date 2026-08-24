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

## 公开文本索引

每次生产构建都会从 `_posts/` 与手工维护的 `_topics/` 生成 `/text-index.json`，供 Personal Hub 搜索公开文章和正式知识节点；同时生成仅供 Jekyll 页面使用的 `_data/text_network.json`。索引只包含标题、摘要、分类、形式、标签、Topic、关联和日期等 Front Matter，不包含 Markdown 正文，也不会扫描 `_drafts/`。

```bash
npm run build:text-index
npm run check:text-index
npm run test:text-index
```

新文章使用 `/p/<slug>/` 固定链接。没有 `slug` / `permalink` 的历史文章继续输出原有日期型 URL，避免索引链接指向不存在的页面；以后为旧文章迁移短链接时应同时保留旧地址的重定向。

### Related 与 Backlinks

在来源文章 Front Matter 中填写目标文章的稳定 `slug`：

```yaml
related:
  - digital-garden
  - text-network
```

构建脚本会把 slug 解析为文章 ID，生成 `related` edge，并为目标文章自动生成 Backlink。来源文章显示“相关内容”，目标文章显示“提到本文”。不存在的 slug、自我关联和重复关系会在检查阶段报错；不需要也不应该手写 Backlink。

### Wiki Links

正文中可以直接使用目标文章的稳定 `slug` 建立链接：

```markdown
继续阅读 [[digital-garden]]。
继续阅读 [[digital-garden|数字花园]]。
```

发布构建会把有效语法临时转换为普通 Markdown 链接，最终页面得到正常的 `<a href="...">`，源文件仍保留易写的 `[[...]]`。Wiki Link 同样生成 `wiki` edge 和目标文章的 Backlink；同一对文章同时存在 `related` 与 `wiki` 时，页面只展示一张关系卡。

不存在的 Wiki Link 只输出 `WARNING`，不阻止检查或发布，并在正文中保持原样。围栏代码块、行内反引号和转义写法 `\[[example]]` 不会被识别，适合展示语法示例。Front Matter 的 `related` 仍执行严格校验。

### Topic / Knowledge Node

Topic 是作者手工维护的正式知识节点，源文件位于 `_topics/<slug>.md`，固定输出到 `/topics/<slug>/`。可以复制 `templates/topic.md` 创建新节点。Topic 至少需要英文 `slug`、标题、简介和正文；`related` 只连接其他 Topic。

普通 `tags` 继续作为轻量描述，不会自动创建节点。只有文章显式填写下面的字段才会加入 Topic：

```yaml
tags:
  - Git
topics:
  - github
```

构建会生成 `post → topic` 的 `topic` edge。不存在的 Topic 会阻止检查和发布，防止正式知识节点出现悬空关系。Topic 页面自动展示简介、相关文章、相关 Topic 和按文章更新时间排列的最近更新；文章页标题下方也会显示所属知识节点。

索引 schema 版本为 `2`：

```json
{
  "version": 2,
  "generatedAt": "2026-08-24T00:00:00.000Z",
  "nodes": [
    {
      "id": "post:text-network",
      "type": "post",
      "title": "文本互联机制",
      "slug": "text-network",
      "url": "https://baizeone.top/p/text-network/",
      "summary": "统一发现公开内容",
      "category": "项目",
      "format": "笔记",
      "tags": ["知识管理", "Web"],
      "related": ["post:digital-garden"],
      "topics": ["topic:knowledge-management"],
      "createdAt": "2026-08-24",
      "updatedAt": "2026-08-25"
    },
    {
      "id": "topic:knowledge-management",
      "type": "topic",
      "title": "知识管理",
      "slug": "knowledge-management",
      "url": "https://baizeone.top/topics/knowledge-management/",
      "summary": "组织长期维护的知识节点",
      "tags": [],
      "related": [],
      "topics": []
    }
  ],
  "edges": [
    {
      "from": "post:text-network",
      "to": "post:digital-garden",
      "type": "related"
    },
    {
      "from": "post:digital-garden",
      "to": "post:text-network",
      "type": "wiki"
    },
    {
      "from": "post:text-network",
      "to": "topic:knowledge-management",
      "type": "topic"
    }
  ]
}
```

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
| `npm run build:text-index` | 从公开文章生成 `text-index.json` |
| `npm run check:text-index` | 校验文章能否生成合法索引 |
| `npm run test:text-index` | 测试索引解析、草稿隔离和兼容逻辑 |
| `npm run report:content` | 输出文章健康度和维护优先级报告 |
| `npm run dev:drafts` | 在已安装 Jekyll 的电脑上预览草稿 |

在 PowerShell 中如果 `npm` 被执行策略拦截，将命令中的 `npm` 改成 `npm.cmd`。
