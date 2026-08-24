import fs from 'node:fs';
import path from 'node:path';

export function transformWikiLinks(markdown, replaceLink = null) {
    const links = [];
    let inFence = null;
    let lineNumber = 0;
    const content = String(markdown).replace(/.*(?:\r\n|\n|\r|$)/g, (line) => {
        if (!line) return line;
        lineNumber += 1;
        const withoutEnding = line.replace(/(?:\r\n|\n|\r)$/, '');
        const ending = line.slice(withoutEnding.length);
        const fence = withoutEnding.match(/^\s{0,3}(`{3,}|~{3,})/);
        if (fence) {
            const marker = fence[1][0];
            const length = fence[1].length;
            if (!inFence) inFence = { marker, length };
            else if (
                marker === inFence.marker &&
                length >= inFence.length &&
                /^\s*$/.test(withoutEnding.slice(fence[0].length))
            ) inFence = null;
            return line;
        }
        if (inFence) return line;
        return transformInline(withoutEnding, lineNumber, links, replaceLink) + ending;
    });
    return { content, links };
}

export function scanWikiLinks(markdown) {
    return transformWikiLinks(markdown).links;
}

export function createWikiResolver(nodes) {
    const bySlug = new Map();
    for (const node of nodes) {
        const aliases = [node.slug, node.id?.startsWith('post:') ? node.id.slice(5) : ''].filter(Boolean);
        for (const alias of aliases) bySlug.set(alias, node);
    }
    return (slug) => bySlug.get(String(slug).trim()) || null;
}

export function materializeWikiLinks(root, index) {
    const resolver = createWikiResolver(index.nodes);
    const postsFolder = path.join(root, '_posts');
    const changed = [];
    for (const name of fs.readdirSync(postsFolder).filter((item) => /\.(?:md|markdown)$/i.test(item)).sort()) {
        const file = path.join(postsFolder, name);
        const source = fs.readFileSync(file, 'utf8');
        const parts = splitPostSource(source);
        const result = transformWikiLinks(parts.body, ({ slug, label, raw }) => {
            const target = resolver(slug);
            return target ? `[${escapeMarkdownLabel(label)}](${toSiteHref(target.url)})` : raw;
        });
        const next = parts.prefix + result.content;
        if (next === source) continue;
        fs.writeFileSync(file, next, 'utf8');
        changed.push({ file, source, links: result.links });
    }
    return changed;
}

export async function withMaterializedWikiLinks(root, index, operation) {
    const changed = materializeWikiLinks(root, index);
    try {
        return await operation(changed);
    } finally {
        for (const entry of changed) fs.writeFileSync(entry.file, entry.source, 'utf8');
    }
}

function transformInline(line, lineNumber, links, replaceLink) {
    let output = '';
    let index = 0;
    let codeDelimiter = 0;
    while (index < line.length) {
        if (line[index] === '`') {
            let end = index + 1;
            while (line[end] === '`') end += 1;
            const length = end - index;
            if (!codeDelimiter) codeDelimiter = length;
            else if (codeDelimiter === length) codeDelimiter = 0;
            output += line.slice(index, end);
            index = end;
            continue;
        }
        if (!codeDelimiter && line[index] === '[' && line[index + 1] === '[' && !isEscaped(line, index)) {
            const close = line.indexOf(']]', index + 2);
            if (close !== -1) {
                const raw = line.slice(index, close + 2);
                const inner = line.slice(index + 2, close);
                const separator = inner.indexOf('|');
                const slug = (separator === -1 ? inner : inner.slice(0, separator)).trim();
                const customLabel = separator === -1 ? '' : inner.slice(separator + 1).trim();
                if (slug && !/[\[\]\n\r]/.test(slug) && (separator === -1 || customLabel)) {
                    const link = {
                        slug,
                        label: customLabel || slug,
                        raw,
                        line: lineNumber,
                        column: index + 1
                    };
                    links.push(link);
                    output += replaceLink ? replaceLink(link) : raw;
                    index = close + 2;
                    continue;
                }
            }
        }
        output += line[index];
        index += 1;
    }
    return output;
}

function isEscaped(text, index) {
    let slashes = 0;
    for (let cursor = index - 1; cursor >= 0 && text[cursor] === '\\'; cursor -= 1) slashes += 1;
    return slashes % 2 === 1;
}

function escapeMarkdownLabel(value) {
    return String(value).replace(/\\/g, '\\\\').replace(/([\[\]])/g, '\\$1');
}

function toSiteHref(value) {
    const url = new URL(value);
    return `${url.pathname}${url.search}${url.hash}`;
}

function splitPostSource(source) {
    const match = String(source).match(/^(\uFEFF?---(?:\r\n|\n|\r)[\s\S]*?(?:\r\n|\n|\r)---(?:\r\n|\n|\r))([\s\S]*)$/);
    if (!match) throw new Error('无法转换 Wiki Link：文章 front matter 格式不完整。');
    return { prefix: match[1], body: match[2] };
}
