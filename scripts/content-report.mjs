import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { findProjectRoot, formatLocalDate, installCliErrorHandler, parseFrontMatter, relativeDisplay } from './content-utils.mjs';

installCliErrorHandler();

const options = parseArgs(process.argv.slice(2));
const root = findProjectRoot();
const today = new Date(`${formatLocalDate()}T12:00:00`);
const postsFolder = path.join(root, '_posts');
const entries = fs.readdirSync(postsFolder)
    .filter((name) => name.endsWith('.md'))
    .map((name) => inspectPost(path.join(postsFolder, name)))
    .sort((left, right) => right.score - left.score || left.date.localeCompare(right.date));

const report = options.json ? `${JSON.stringify({ generated: formatLocalDate(), posts: entries }, null, 2)}\n` : buildMarkdown(entries);

if (options.write) {
    const outputPath = path.resolve(root, options.write);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, report, 'utf8');
    console.log(`内容健康报告已生成：${relativeDisplay(root, outputPath)}`);
} else {
    process.stdout.write(report);
}

function inspectPost(file) {
    const label = relativeDisplay(root, file);
    const source = fs.readFileSync(file, 'utf8');
    const { data, body } = parseFrontMatter(source, label);
    const filenameDate = path.basename(file).slice(0, 10);
    const date = String(data.date || filenameDate);
    const parsedDate = new Date(`${date}T12:00:00`);
    const ageDays = Number.isNaN(parsedDate.getTime()) ? 0 : Math.max(0, Math.floor((today - parsedDate) / 86400000));
    const plainText = body
        .replace(/```[\s\S]*?```/g, '')
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/<[^>]+>/g, '')
        .replace(/[#>*_`\[\]()!-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    const length = plainText.length;
    const reasons = [];
    let score = 0;

    const subtitle = String(data.subtitle || '').trim();
    if (!subtitle || /^(教程|命令|问题解决方法|为了避免遗忘)\.*$/i.test(subtitle)) add(15, '摘要需要完善');
    if (!data.format) add(8, '缺少文章形式');
    if (!data.updated) add(8, '没有更新时间');
    const image = String(data.image || data['header-img'] || '').trim();
    if (!image) add(4, '没有文章封面');
    if (length < 200) add(25, '正文过短');
    else if (length < 600) add(12, '正文较短');
    if (data.status === 'review' && ageDays > 365) add(25, '待复核超过一年');
    if (data.status === 'verified' && !data['last-verified']) add(20, '已验证但缺少验证日期');
    if (data['last-verified']) {
        const verifiedDate = new Date(`${data['last-verified']}T12:00:00`);
        if (!Number.isNaN(verifiedDate.getTime()) && (today - verifiedDate) / 86400000 > 365) add(15, '验证时间超过一年');
    }

    return {
        file: label,
        title: String(data.title || path.basename(file)),
        date,
        category: String(data.category || '未分类'),
        format: String(data.format || '未设置'),
        status: String(data.status || '未设置'),
        ageDays,
        contentLength: length,
        score,
        reasons
    };

    function add(points, reason) {
        score += points;
        reasons.push(reason);
    }
}

function buildMarkdown(posts) {
    const needsAttention = posts.filter((post) => post.score >= 20);
    const missingFormat = posts.filter((post) => post.format === '未设置').length;
    const reviewPosts = posts.filter((post) => post.status === 'review').length;
    const archivedPosts = posts.filter((post) => post.status === 'archived').length;
    const shortPosts = posts.filter((post) => post.contentLength < 200).length;
    const withoutImages = posts.filter((post) => post.reasons.includes('没有文章封面')).length;
    const lines = [
        '# BZ 内容健康报告',
        '',
        `生成日期：${formatLocalDate()}`,
        '',
        '## 总览',
        '',
        '| 指标 | 数量 |',
        '|---|---:|',
        `| 正式文章 | ${posts.length} |`,
        `| 建议优先维护 | ${needsAttention.length} |`,
        `| 待复核文章 | ${reviewPosts} |`,
        `| 历史归档 | ${archivedPosts} |`,
        `| 缺少文章形式 | ${missingFormat} |`,
        `| 正文少于 200 字符 | ${shortPosts} |`,
        `| 没有封面 | ${withoutImages} |`,
        '',
        '## 维护优先级',
        '',
        '分数越高，越建议优先处理。封面属于低权重提醒，不会单独让文章进入高优先级。',
        '',
        '| 分数 | 文章 | 分类 | 状态 | 字符数 | 建议 |',
        '|---:|---|---|---|---:|---|'
    ];

    posts.slice(0, 25).forEach((post) => {
        lines.push(`| ${post.score} | ${escapeCell(post.title)} | ${escapeCell(post.category)} | ${escapeCell(post.status)} | ${post.contentLength} | ${escapeCell(post.reasons.join('、') || '状态良好')} |`);
    });
    lines.push('', '## 建议', '');
    if (!needsAttention.length) lines.push('- 当前没有高优先级维护项。');
    else lines.push('- 先处理“待复核超过一年”和“正文过短”的文章。', '- 为重要文章补充准确摘要、更新时间和验证日期。', '- 封面可以按阅读量逐步补齐，不需要一次完成。');
    lines.push('');
    return `${lines.join('\n')}\n`;
}

function escapeCell(value) {
    return String(value).replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim();
}

function parseArgs(args) {
    const result = { json: false, write: '' };
    for (let index = 0; index < args.length; index += 1) {
        const token = args[index];
        if (token === '--json') result.json = true;
        else if (token === '--write') {
            if (!args[index + 1]) throw new Error('--write 缺少输出文件路径。');
            result.write = args[index + 1];
            index += 1;
        } else if (token === '--help' || token === '-h') {
            console.log('用法：node scripts/content-report.mjs [--json] [--write content-health.md]');
            process.exit(0);
        } else throw new Error(`无法识别参数：${token}`);
    }
    return result;
}
