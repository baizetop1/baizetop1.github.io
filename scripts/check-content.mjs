import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { findProjectRoot, parseFrontMatter, relativeDisplay } from './content-utils.mjs';

const root = findProjectRoot();
const errors = [];
const warnings = [];
const seenSlugs = new Map();
const seenTitles = new Map();
const seenPermalinks = new Map();
const allowedStatuses = new Set(['draft', 'published', 'review', 'verified', 'archived']);
const legacyFilenames = [];

scanFolder('_posts', true);
scanFolder('_drafts', false);

if (legacyFilenames.length) {
    warnings.push(`${legacyFilenames.length} 篇历史文章使用中文文件名；原链接保持不变，新文章会自动使用英文 slug。`);
}

for (const [title, files] of seenTitles) {
    if (files.length > 1) warnings.push(`标题重复 “${title}”：${files.join(', ')}`);
}

if (warnings.length) {
    console.log('\n内容提醒：');
    warnings.forEach((message) => console.log(`  - ${message}`));
}

if (errors.length) {
    console.error('\n内容检查失败：');
    errors.forEach((message) => console.error(`  - ${message}`));
    console.error(`\n共 ${errors.length} 个错误，修复后再发布。`);
    process.exit(1);
}

const postCount = countMarkdown(path.join(root, '_posts'));
const draftCount = countMarkdown(path.join(root, '_drafts'));
console.log(`\n内容检查通过：${postCount} 篇文章，${draftCount} 篇草稿，${warnings.length} 条提醒。`);

function scanFolder(folderName, publishedFolder) {
    const folder = path.join(root, folderName);
    if (!fs.existsSync(folder)) return;
    const files = fs.readdirSync(folder).filter((name) => name.endsWith('.md')).sort();

    for (const name of files) {
        const file = path.join(folder, name);
        const label = relativeDisplay(root, file);
        const filenameMatch = publishedFolder
            ? name.match(/^(\d{4}-\d{2}-\d{2})-(.+)\.md$/i)
            : name.match(/^([a-z0-9][a-z0-9._-]*)\.md$/i);

        if (!filenameMatch) {
            errors.push(`${label} 文件名格式错误；${publishedFolder ? '应为 YYYY-MM-DD-english-slug.md' : '草稿应为 english-slug.md'}。`);
            continue;
        }

        const slug = publishedFolder ? filenameMatch[2] : filenameMatch[1];
        if (publishedFolder && !/^[a-z0-9][a-z0-9._-]*$/i.test(slug)) {
            legacyFilenames.push(label);
        }
        if (seenSlugs.has(slug)) errors.push(`链接标识重复 “${slug}”：${seenSlugs.get(slug)} 和 ${label}`);
        else seenSlugs.set(slug, label);

        let parsed;
        const source = fs.readFileSync(file, 'utf8');
        try {
            parsed = parseFrontMatter(source, label);
        } catch (error) {
            errors.push(error.message);
            continue;
        }

        const { data, body } = parsed;
        requireText(data, 'title', label, '标题');
        requireText(data, 'category', label, '分类');
        requireText(data, 'status', label, '状态');

        if (!Array.isArray(data.tags) || !data.tags.length) errors.push(`${label} 至少需要一个标签。`);
        if (data.status && !allowedStatuses.has(String(data.status))) {
            errors.push(`${label} 的 status 无效：${data.status}；可用 draft / published / review / verified / archived。`);
        }
        if (publishedFolder && data.status === 'draft') errors.push(`${label} 位于 _posts，但状态仍是 draft。`);
        if (!publishedFolder && data.status && data.status !== 'draft') warnings.push(`${label} 位于 _drafts，建议 status 使用 draft。`);
        if (publishedFolder && String(data.date || '') !== filenameMatch[1]) {
            errors.push(`${label} 的 date (${data.date || '缺失'}) 必须与文件名日期 ${filenameMatch[1]} 一致。`);
        }
        if (data.status === 'verified' && !data['last-verified']) {
            warnings.push(`${label} 标记为 verified，但没有 last-verified 日期。`);
        }
        if (data.permalink) {
            const permalink = String(data.permalink);
            if (!permalink.startsWith('/') || !permalink.endsWith('/') || /\s/.test(permalink)) {
                errors.push(`${label} 的 permalink 必须以 / 开头和结尾，并且不能包含空格：${permalink}`);
            }
            if (seenPermalinks.has(permalink)) {
                errors.push(`固定链接重复 “${permalink}”：${seenPermalinks.get(permalink)} 和 ${label}`);
            } else {
                seenPermalinks.set(permalink, label);
            }
            if (permalink.startsWith('/p/') && !data.slug) errors.push(`${label} 使用短链接但缺少 slug 字段。`);
        }

        if (data.title) {
            const title = String(data.title);
            const titleFiles = seenTitles.get(title) || [];
            titleFiles.push(label);
            seenTitles.set(title, titleFiles);
        }

        if (data.image) checkAssetReference(String(data.image), label, '文章封面');
        if (data['header-img']) checkAssetReference(String(data['header-img']), label, '文章头图');
        checkBodyImages(body, file, label);

        const plainText = body
            .replace(/```[\s\S]*?```/g, '')
            .replace(/<!--[^]*?-->/g, '')
            .replace(/[#>*_`\[\]()!-]/g, '')
            .trim();
        if (publishedFolder && plainText.length < 30) warnings.push(`${label} 正文内容较少，建议发布前确认。`);
        if (publishedFolder && /<!--\s*(用几句话写清楚|命令、截图、思路)/.test(body)) {
            warnings.push(`${label} 仍保留写作模板提示。`);
        }
    }
}

function requireText(data, key, label, description) {
    if (!data[key] || Array.isArray(data[key])) errors.push(`${label} 缺少${description}字段 ${key}。`);
}

function checkBodyImages(body, file, label) {
    const scannable = body
        .replace(/```[\s\S]*?```/g, '')
        .replace(/~~~[\s\S]*?~~~/g, '')
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/`[^`\n]*`/g, '');
    const markdownImages = [...scannable.matchAll(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)/g)];
    for (const match of markdownImages) {
        const [, alt, reference] = match;
        if (!alt.trim()) warnings.push(`${label} 有图片缺少替代文字：${reference}`);
        checkAssetReference(reference, label, '正文图片', path.dirname(file));
    }
    const htmlImages = [...scannable.matchAll(/<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)];
    for (const match of htmlImages) checkAssetReference(match[1], label, 'HTML 图片', path.dirname(file));
}

function checkAssetReference(reference, label, description, sourceFolder = root) {
    const clean = String(reference).split(/[?#]/)[0].trim();
    if (!clean || /^(?:https?:|data:|\/\/|#|\{\{)/i.test(clean)) return;
    let decoded = clean;
    try { decoded = decodeURIComponent(clean); } catch { /* 保留原始路径 */ }
    const target = decoded.startsWith('/')
        ? path.join(root, decoded.replace(/^\/+/, ''))
        : path.resolve(sourceFolder, decoded);
    if (!fs.existsSync(target)) errors.push(`${label} 的${description}不存在：${reference}`);
}

function countMarkdown(folder) {
    if (!fs.existsSync(folder)) return 0;
    return fs.readdirSync(folder).filter((name) => name.endsWith('.md')).length;
}
