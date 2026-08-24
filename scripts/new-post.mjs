import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { createInterface } from 'node:readline/promises';
import {
    ensureUniqueSlug,
    findProjectRoot,
    formatLocalDate,
    installCliErrorHandler,
    relativeDisplay,
    requireGitWorkspace,
    slugify,
    splitTags,
    yamlString
} from './content-utils.mjs';

installCliErrorHandler();

const HELP = `
创建新文章或草稿

用法：
  npm run new
  npm run new -- --title "文章标题" --category "随笔" --tags "记录,复盘"
  npm run new -- --title "文章标题" --publish --slug "my-note"

选项：
  --title       文章标题
  --category    分类，默认“随笔”
  --format      形式，默认“笔记”（教程 / 记录 / 复盘 / 随笔 / 观点）
  --tags        使用逗号分隔的标签
  --slug        链接标识，推荐使用简短英文
  --draft       保存到 _drafts（默认）
  --publish     直接保存到 _posts
  --open        创建后尝试打开编辑器
  --dry-run     只预览，不写入文件
  --help        显示帮助
`;

const options = parseArgs(process.argv.slice(2));
if (options.help) {
    console.log(HELP.trim());
    process.exit(0);
}

const root = findProjectRoot();
if (!options.dryRun) requireGitWorkspace(root);
const interactive = !options.title;
const answers = interactive ? await askQuestions(options) : options;
const now = new Date();
const title = String(answers.title || '').trim();
if (!title) throw new Error('文章标题不能为空。');

const category = String(answers.category || '随笔').trim() || '随笔';
const format = String(answers.format || '笔记').trim() || '笔记';
const tags = splitTags(answers.tags, category);
const slug = slugify(answers.slug || title, now);
const isDraft = answers.publish ? false : true;
const date = formatLocalDate(now);

ensureUniqueSlug(root, slug);

const folder = isDraft ? '_drafts' : '_posts';
const filename = isDraft ? `${slug}.md` : `${date}-${slug}.md`;
const articlePath = path.join(root, folder, filename);
const imageFolder = path.join(root, 'img', 'posts', slug);
const status = isDraft ? 'draft' : 'published';
const body = buildArticle({ title, category, format, tags, slug, date, status });

if (answers.dryRun) {
    console.log(`将创建：${relativeDisplay(root, articlePath)}`);
    console.log(`图片目录：${relativeDisplay(root, imageFolder)}/`);
    console.log('\n--- 文件预览 ---\n');
    console.log(body);
    process.exit(0);
}

fs.mkdirSync(path.dirname(articlePath), { recursive: true });
fs.mkdirSync(imageFolder, { recursive: true });
fs.writeFileSync(articlePath, body, { encoding: 'utf8', flag: 'wx' });
const keepFile = path.join(imageFolder, '.gitkeep');
if (!fs.existsSync(keepFile)) fs.writeFileSync(keepFile, '', 'utf8');

console.log(`\n已创建${isDraft ? '草稿' : '文章'}：${relativeDisplay(root, articlePath)}`);
console.log(`图片放到：${relativeDisplay(root, imageFolder)}/`);
console.log(`图片写法：![图片说明](/img/posts/${slug}/example.jpg)`);
if (isDraft) {
    console.log(`\n写完后发布：npm run draft:publish -- ${slug}`);
} else {
    console.log('\n发布前检查：npm run check:content');
    console.log(`提交信息建议：Add: ${title}`);
}

if (answers.open) await openInEditor(articlePath);

function buildArticle({ title, category, format, tags, slug, date, status }) {
    const tagLines = tags.map((tag) => `    - ${yamlString(tag)}`).join('\n');
    return `---
layout: post
title: ${yamlString(title)}
subtitle: ""
date: ${date}
author: 白泽
catalog: true
category: ${yamlString(category)}
format: ${yamlString(format)}
status: ${status}
slug: ${yamlString(slug)}
permalink: /p/${slug}/
tags:
${tagLines}
# 相关文章使用目标文章的 slug；取消注释后填写。
# related:
#     - another-post-slug
# 系列文章可取消下面两行注释。
# series: "系列名称"
# series_order: 1
# 有封面时取消下一行注释，并把 cover.jpg 放进对应图片目录。
# image: /img/posts/${slug}/cover.jpg
---

## 先写结论

<!-- 用几句话写清楚：这篇文章解决什么问题，适用于什么场景。 -->

## 过程记录

<!-- 命令、截图、思路和踩坑都可以先记下来。 -->

<!-- Wiki Link：[[target-slug]] 或 [[target-slug|显示文本]] -->

<!-- 图片示例：![图片说明](/img/posts/${slug}/example.jpg) -->
`;
}

async function askQuestions(defaults) {
    const prompt = createInterface({ input: process.stdin, output: process.stdout });
    try {
        const title = (await prompt.question('文章标题：')).trim();
        const category = (await prompt.question('分类 [随笔]：')).trim() || '随笔';
        const format = (await prompt.question('形式 [笔记]：')).trim() || '笔记';
        const tags = (await prompt.question(`标签（逗号分隔）[${category}]：`)).trim() || category;
        const suggestedSlug = slugify(title);
        const slug = (await prompt.question(`英文链接标识 [${suggestedSlug}]：`)).trim() || suggestedSlug;
        const publishAnswer = (await prompt.question('直接发布而不是保存草稿？[y/N]：')).trim().toLowerCase();
        return {
            ...defaults,
            title,
            category,
            format,
            tags,
            slug,
            publish: ['y', 'yes', '是'].includes(publishAnswer)
        };
    } finally {
        prompt.close();
    }
}

function parseArgs(args) {
    const result = { draft: true, publish: false, open: false, dryRun: false };
    for (let index = 0; index < args.length; index += 1) {
        const token = args[index];
        if (token === '--help' || token === '-h') result.help = true;
        else if (token === '--draft') { result.draft = true; result.publish = false; }
        else if (token === '--publish') { result.publish = true; result.draft = false; }
        else if (token === '--open') result.open = true;
        else if (token === '--dry-run') result.dryRun = true;
        else if (token.startsWith('--')) {
            const key = token.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
            const value = args[index + 1];
            if (!value || value.startsWith('--')) throw new Error(`${token} 缺少参数。`);
            result[key] = value;
            index += 1;
        } else if (!result.title) result.title = token;
        else if (!result.category) result.category = token;
        else if (!result.tags) result.tags = token;
        else if (!result.slug) result.slug = token;
        else throw new Error(`无法识别参数：${token}`);
    }
    return result;
}

async function openInEditor(file) {
    const { spawn } = await import('node:child_process');
    const editor = process.env.EDITOR || (process.platform === 'win32' ? 'notepad.exe' : 'vi');
    try {
        const child = spawn(editor, [file], { detached: true, stdio: 'ignore', shell: true });
        child.unref();
    } catch {
        console.log(`请手动打开：${file}`);
    }
}
