import fs from 'node:fs';
import path from 'node:path';

export function installCliErrorHandler() {
    let handled = false;
    const fail = (error) => {
        if (handled) return;
        handled = true;
        const message = error instanceof Error ? error.message : String(error);
        console.error(`\n错误：${message}`);
        process.exit(1);
    };
    process.on('uncaughtException', fail);
    process.on('unhandledRejection', fail);
}

export function findProjectRoot(start = process.cwd()) {
    let current = path.resolve(start);
    while (true) {
        if (fs.existsSync(path.join(current, '_config.yml')) && fs.existsSync(path.join(current, '_posts'))) {
            return current;
        }
        const parent = path.dirname(current);
        if (parent === current) {
            throw new Error('没有找到站点根目录（需要同时包含 _config.yml 和 _posts）。');
        }
        current = parent;
    }
}

export function requireGitWorkspace(root) {
    if (fs.existsSync(path.join(root, '.git'))) return;
    const parent = path.dirname(root);
    const repository = fs.readdirSync(parent, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => path.join(parent, entry.name))
        .find((candidate) => fs.existsSync(path.join(candidate, '.git')));
    const hint = repository ? ` 请改在这里操作：${repository}` : ' 请先克隆 GitHub 仓库。';
    throw new Error(`当前目录不是 Git 仓库，已停止创建或发布文章。${hint}`);
}

export function formatLocalDate(value = new Date()) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export function formatTimestamp(value = new Date()) {
    return [
        value.getFullYear(),
        String(value.getMonth() + 1).padStart(2, '0'),
        String(value.getDate()).padStart(2, '0'),
        '-',
        String(value.getHours()).padStart(2, '0'),
        String(value.getMinutes()).padStart(2, '0'),
        String(value.getSeconds()).padStart(2, '0')
    ].join('');
}

export function slugify(value, fallbackDate = new Date()) {
    const ascii = String(value || '')
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/['’]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    return ascii || `note-${formatTimestamp(fallbackDate)}`;
}

export function yamlString(value) {
    return JSON.stringify(String(value ?? ''));
}

export function splitTags(value, fallback = '记录') {
    const tags = String(value || '')
        .split(/[,，]/)
        .map((item) => item.trim())
        .filter(Boolean);
    return [...new Set(tags.length ? tags : [fallback])];
}

export function parseFrontMatter(source, fileLabel = '文章') {
    const normalized = String(source).replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
    if (!normalized.startsWith('---\n')) {
        throw new Error(`${fileLabel} 缺少开头的 --- front matter。`);
    }
    const end = normalized.indexOf('\n---\n', 4);
    if (end === -1) {
        throw new Error(`${fileLabel} 缺少结尾的 --- front matter。`);
    }
    const raw = normalized.slice(4, end);
    const data = {};
    let listKey = null;
    for (const line of raw.split('\n')) {
        if (!line.trim() || /^\s*#/.test(line)) continue;
        const listMatch = line.match(/^\s+-\s+(.*)$/);
        if (listMatch && listKey) {
            data[listKey].push(parseYamlScalar(listMatch[1]));
            continue;
        }
        const fieldMatch = line.match(/^([A-Za-z0-9_-]+):(?:\s*(.*))?$/);
        if (!fieldMatch) {
            listKey = null;
            continue;
        }
        const [, key, rawValue = ''] = fieldMatch;
        if (!rawValue.trim()) {
            data[key] = [];
            listKey = key;
        } else {
            data[key] = parseYamlScalar(rawValue);
            listKey = null;
        }
    }
    return {
        data,
        raw,
        body: normalized.slice(end + 5),
        source: normalized
    };
}

function parseYamlScalar(value) {
    const trimmed = String(value).trim();
    if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
        try {
            return JSON.parse(trimmed);
        } catch {
            return trimmed.slice(1, -1);
        }
    }
    if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
        return trimmed.slice(1, -1).replace(/''/g, "'");
    }
    if (trimmed === 'true') return true;
    if (trimmed === 'false') return false;
    return trimmed;
}

export function setFrontMatterFields(source, fields) {
    const normalized = String(source).replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
    const end = normalized.indexOf('\n---\n', 4);
    if (!normalized.startsWith('---\n') || end === -1) {
        throw new Error('无法更新文章：front matter 格式不完整。');
    }
    const lines = normalized.slice(4, end).split('\n');
    for (const [key, value] of Object.entries(fields)) {
        const index = lines.findIndex((line) => new RegExp(`^${escapeRegExp(key)}:`).test(line));
        const replacement = `${key}: ${value}`;
        if (index === -1) lines.push(replacement);
        else lines[index] = replacement;
    }
    return `---\n${lines.join('\n')}\n---\n${normalized.slice(end + 5)}`;
}

function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function ensureUniqueSlug(root, slug) {
    const candidates = [];
    for (const folder of ['_posts', '_drafts']) {
        const fullFolder = path.join(root, folder);
        if (!fs.existsSync(fullFolder)) continue;
        for (const name of fs.readdirSync(fullFolder)) {
            if (!/\.md$/i.test(name)) continue;
            const base = name.replace(/^\d{4}-\d{2}-\d{2}-/, '').replace(/\.md$/i, '');
            if (base === slug) candidates.push(path.join(folder, name));
        }
    }
    if (candidates.length) {
        throw new Error(`链接标识 “${slug}” 已被使用：${candidates.join(', ')}`);
    }
}

export function relativeDisplay(root, target) {
    return path.relative(root, target).split(path.sep).join('/');
}
