import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { createInterface } from 'node:readline/promises';
import {
    findProjectRoot,
    formatLocalDate,
    installCliErrorHandler,
    parseFrontMatter,
    relativeDisplay,
    requireGitWorkspace,
    setFrontMatterFields
} from './content-utils.mjs';

installCliErrorHandler();

const HELP = `
把草稿移动到正式文章目录

用法：
  npm run draft:publish
  npm run draft:publish -- reading-notes
  npm run draft:publish -- reading-notes --date 2026-08-13

选项：
  --date       发布日期，格式 YYYY-MM-DD
  --dry-run    只显示结果，不移动文件
  --help       显示帮助
`;

const options = parseArgs(process.argv.slice(2));
if (options.help) {
    console.log(HELP.trim());
    process.exit(0);
}

const root = findProjectRoot();
if (!options.dryRun) requireGitWorkspace(root);
const draftsFolder = path.join(root, '_drafts');
const drafts = fs.existsSync(draftsFolder)
    ? fs.readdirSync(draftsFolder).filter((name) => name.endsWith('.md')).sort()
    : [];

if (!drafts.length) throw new Error('没有可发布的草稿。先运行 npm run new 创建草稿。');

const selected = options.slug ? findDraft(drafts, options.slug) : await chooseDraft(drafts, draftsFolder);
const sourcePath = path.join(draftsFolder, selected);
const slug = selected.replace(/\.md$/i, '');
const date = options.date || formatLocalDate();
if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('发布日期必须使用 YYYY-MM-DD 格式。');

const targetPath = path.join(root, '_posts', `${date}-${slug}.md`);
if (fs.existsSync(targetPath)) throw new Error(`目标文章已经存在：${relativeDisplay(root, targetPath)}`);

const source = fs.readFileSync(sourcePath, 'utf8');
const parsed = parseFrontMatter(source, selected);
const title = parsed.data.title || slug;
const published = setFrontMatterFields(source, { date, status: 'published' });

if (options.dryRun) {
    console.log(`将发布：${relativeDisplay(root, sourcePath)}`);
    console.log(`目标位置：${relativeDisplay(root, targetPath)}`);
    console.log(`文章标题：${title}`);
    process.exit(0);
}

fs.writeFileSync(targetPath, published, { encoding: 'utf8', flag: 'wx' });
fs.unlinkSync(sourcePath);

console.log(`\n已发布到源码：${relativeDisplay(root, targetPath)}`);
console.log('下一步先检查：npm run check:content');
console.log('然后提交到 GitHub：');
console.log('  git add -A');
console.log(`  git commit -m "Add: ${String(title).replace(/"/g, '\\"')}"`);
console.log('  git push origin HEAD');

function findDraft(items, requested) {
    const normalized = requested.replace(/^_drafts[\\/]/, '').replace(/\.md$/i, '');
    const exact = items.find((item) => item.replace(/\.md$/i, '') === normalized);
    if (!exact) throw new Error(`没有找到草稿：${requested}`);
    return exact;
}

async function chooseDraft(items, folder) {
    console.log('可发布的草稿：');
    items.forEach((name, index) => {
        let title = name.replace(/\.md$/i, '');
        try {
            title = parseFrontMatter(fs.readFileSync(path.join(folder, name), 'utf8'), name).data.title || title;
        } catch { /* 校验命令会提供更具体的错误 */ }
        console.log(`  ${index + 1}. ${title} (${name})`);
    });
    const prompt = createInterface({ input: process.stdin, output: process.stdout });
    try {
        const answer = (await prompt.question('选择编号：')).trim();
        const index = Number(answer) - 1;
        if (!Number.isInteger(index) || index < 0 || index >= items.length) throw new Error('草稿编号无效。');
        return items[index];
    } finally {
        prompt.close();
    }
}

function parseArgs(args) {
    const result = { dryRun: false };
    for (let index = 0; index < args.length; index += 1) {
        const token = args[index];
        if (token === '--help' || token === '-h') result.help = true;
        else if (token === '--dry-run') result.dryRun = true;
        else if (token === '--date') {
            if (!args[index + 1]) throw new Error('--date 缺少日期。');
            result.date = args[index + 1];
            index += 1;
        } else if (token.startsWith('--')) throw new Error(`无法识别参数：${token}`);
        else if (!result.slug) result.slug = token;
        else throw new Error(`多余参数：${token}`);
    }
    return result;
}
