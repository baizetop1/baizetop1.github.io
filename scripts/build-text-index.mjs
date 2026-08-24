import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { findProjectRoot, installCliErrorHandler, parseFrontMatter, relativeDisplay } from './content-utils.mjs';
import { createWikiResolver, scanWikiLinks } from './wiki-links.mjs';

export const TEXT_INDEX_VERSION = 2;

export function buildTextIndex(root, { generatedAt = new Date().toISOString() } = {}) {
    return buildTextIndexReport(root, { generatedAt }).index;
}

export function buildTextIndexReport(root, { generatedAt = new Date().toISOString() } = {}) {
    const postsFolder = path.join(root, '_posts');
    const siteOrigin = readSiteOrigin(root);
    const files = fs.readdirSync(postsFolder)
        .filter((name) => /\.(?:md|markdown)$/i.test(name))
        .sort((left, right) => left.localeCompare(right, 'en'));
    const nodes = files.map((name) => buildTextNode(path.join(postsFolder, name), { root, siteOrigin }));
    const relatedEdges = buildRelatedEdges(nodes);
    const { edges: wikiEdges, warnings } = buildWikiEdges(root, files, nodes);
    const edges = [...relatedEdges, ...wikiEdges];
    const index = { version: TEXT_INDEX_VERSION, generatedAt, nodes, edges };
    validateTextIndex(index);
    return { index, warnings };
}

export function buildTextNode(file, { root, siteOrigin = readSiteOrigin(root) }) {
    const label = relativeDisplay(root, file);
    const filename = path.basename(file);
    const filenameMatch = filename.match(/^(\d{4}-\d{2}-\d{2})-(.+)\.(?:md|markdown)$/i);
    if (!filenameMatch) throw new Error(`${label} 文件名无法生成文章索引。`);

    const [, filenameDate, filenameSlug] = filenameMatch;
    const source = fs.readFileSync(file, 'utf8');
    const { data } = parseFrontMatter(source, label);
    const declaredSlug = asText(data.slug);
    const identitySlug = declaredSlug || filenameSlug;
    const node = {
        id: `post:${identitySlug}`,
        type: 'post',
        title: asText(data.title) || filenameSlug,
        url: resolvePostUrl({ data, declaredSlug, filenameDate, filenameSlug, siteOrigin }),
        summary: asText(data.description) || asText(data.summary) || asText(data.subtitle),
        category: asText(data.category),
        format: asText(data.format),
        tags: asList(data.tags),
        related: asList(data.related).map(normalizeRelatedId),
        createdAt: asText(data.date) || filenameDate,
        updatedAt: asText(data.updated)
    };
    if (declaredSlug) node.slug = declaredSlug;
    return node;
}

export function validateTextIndex(index) {
    if (!index || index.version !== TEXT_INDEX_VERSION || !Array.isArray(index.nodes) || !Array.isArray(index.edges)) {
        throw new Error('text-index.json 顶层结构无效。');
    }
    if (typeof index.generatedAt !== 'string' || Number.isNaN(Date.parse(index.generatedAt))) {
        throw new Error('text-index.json 的 generatedAt 必须是 ISO-8601 时间。');
    }

    const seenIds = new Set();
    for (const node of index.nodes) {
        if (!node || node.type !== 'post' || typeof node.id !== 'string' || !node.id.startsWith('post:')) {
            throw new Error('text-index.json 包含无效的文章节点。');
        }
        if (seenIds.has(node.id)) throw new Error(`text-index.json 包含重复 ID：${node.id}`);
        seenIds.add(node.id);
        if (typeof node.title !== 'string' || !node.title || typeof node.url !== 'string') {
            throw new Error(`${node.id} 缺少 title 或 url。`);
        }
        if (!Array.isArray(node.tags) || !node.tags.every((item) => typeof item === 'string')) {
            throw new Error(`${node.id} 的 tags 必须是字符串数组。`);
        }
        if (!Array.isArray(node.related) || !node.related.every((item) => typeof item === 'string')) {
            throw new Error(`${node.id} 的 related 必须是字符串数组。`);
        }
    }

    const seenEdges = new Set();
    for (const edge of index.edges) {
        if (!edge || !['related', 'wiki'].includes(edge.type) || typeof edge.from !== 'string' || typeof edge.to !== 'string') {
            throw new Error('text-index.json 包含无效的关系边。');
        }
        if (!seenIds.has(edge.from) || !seenIds.has(edge.to)) {
            throw new Error(`text-index.json 包含悬空关系：${edge.from} → ${edge.to}`);
        }
        if (edge.from === edge.to) throw new Error(`${edge.from} 不能关联自身。`);
        const key = `${edge.type}:${edge.from}:${edge.to}`;
        if (seenEdges.has(key)) throw new Error(`text-index.json 包含重复关系：${edge.from} → ${edge.to}`);
        seenEdges.add(key);
    }
    return index;
}

export function writeTextIndex(root, options) {
    const { index, warnings } = buildTextIndexReport(root, options);
    const target = path.join(root, 'text-index.json');
    const dataFolder = path.join(root, '_data');
    const dataTarget = path.join(dataFolder, 'text_network.json');
    fs.mkdirSync(dataFolder, { recursive: true });
    fs.writeFileSync(target, `${JSON.stringify(index, null, 2)}\n`, 'utf8');
    fs.writeFileSync(dataTarget, `${JSON.stringify(buildTextNetworkData(index), null, 2)}\n`, 'utf8');
    return { index, warnings, target, dataTarget };
}

export function buildRelatedEdges(nodes) {
    const nodesById = new Map(nodes.map((node) => [node.id, node]));
    const edges = [];
    for (const node of nodes) {
        for (const targetId of node.related) {
            if (!targetId.startsWith('post:')) continue;
            if (!nodesById.has(targetId)) {
                throw new Error(`${node.id} 的 related 引用了不存在的文章：${targetId.slice(5)}`);
            }
            if (targetId === node.id) throw new Error(`${node.id} 不能关联自身。`);
            edges.push({ from: node.id, to: targetId, type: 'related' });
        }
    }
    return edges;
}

export function buildWikiEdges(root, files, nodes) {
    const resolver = createWikiResolver(nodes);
    const edges = [];
    const warnings = [];
    const seen = new Set();
    for (let index = 0; index < files.length; index += 1) {
        const file = path.join(root, '_posts', files[index]);
        const sourceNode = nodes[index];
        const { body, raw } = parseFrontMatter(fs.readFileSync(file, 'utf8'), relativeDisplay(root, file));
        const lineOffset = raw.split('\n').length + 2;
        for (const link of scanWikiLinks(body)) {
            const target = resolver(link.slug);
            const location = `${relativeDisplay(root, file)}:${link.line + lineOffset}:${link.column}`;
            if (!target) {
                warnings.push(`${location} Wiki Link 指向不存在的文章：${link.slug}`);
                continue;
            }
            if (target.id === sourceNode.id) {
                warnings.push(`${location} Wiki Link 指向文章自身，已忽略：${link.slug}`);
                continue;
            }
            const key = `${sourceNode.id}:${target.id}`;
            if (seen.has(key)) continue;
            seen.add(key);
            edges.push({ from: sourceNode.id, to: target.id, type: 'wiki' });
        }
    }
    return { edges, warnings };
}

export function buildTextNetworkData(index) {
    validateTextIndex(index);
    const nodesById = new Map(index.nodes.map((node) => [node.id, node]));
    const relations = Object.fromEntries(index.nodes.map((node) => [node.id, { related: [], backlinks: [] }]));
    for (const edge of index.edges) {
        mergeRelation(relations[edge.from].related, nodesById.get(edge.to), edge.type);
        mergeRelation(relations[edge.to].backlinks, nodesById.get(edge.from), edge.type);
    }
    return { version: index.version, generatedAt: index.generatedAt, posts: relations };
}

function mergeRelation(collection, node, type) {
    const existing = collection.find((item) => item.id === node.id);
    if (existing) {
        if (!existing.types.includes(type)) existing.types.push(type);
        return;
    }
    collection.push({ ...toRelationSummary(node), types: [type] });
}

function toRelationSummary(node) {
    return {
        id: node.id,
        title: node.title,
        url: node.url,
        summary: node.summary,
        category: node.category
    };
}

function readSiteOrigin(root) {
    const config = fs.readFileSync(path.join(root, '_config.yml'), 'utf8');
    const match = config.match(/^url:\s*(.+?)\s*(?:#.*)?$/m);
    const value = match ? unquote(match[1]) : '';
    if (!/^https?:\/\//i.test(value)) throw new Error('_config.yml 缺少有效的站点 url。');
    return value.replace(/\/+$/, '');
}

function resolvePostUrl({ data, declaredSlug, filenameDate, filenameSlug, siteOrigin }) {
    const permalink = asText(data.permalink);
    if (permalink) {
        if (/^https?:\/\//i.test(permalink)) return permalink;
        return new URL(permalink.replace(/^\/*/, '/'), `${siteOrigin}/`).href;
    }
    if (declaredSlug) return new URL(`/p/${encodeURIComponent(declaredSlug)}/`, `${siteOrigin}/`).href;

    // Historical posts predate the /p/<slug>/ workflow. Keep their deployed
    // Jekyll "pretty" URLs instead of emitting links that do not exist.
    const [year, month, day] = filenameDate.split('-');
    const legacyTitle = filenameSlug.trim().replace(/\s+/g, '-');
    return new URL(`/${year}/${month}/${day}/${encodeURIComponent(legacyTitle)}/`, `${siteOrigin}/`).href;
}

function asText(value) {
    if (value === undefined || value === null || Array.isArray(value)) return '';
    return String(value).trim();
}

function asList(value) {
    if (Array.isArray(value)) return uniqueStrings(value);
    const text = asText(value);
    if (!text) return [];
    if (text.startsWith('[') && text.endsWith(']')) {
        try {
            const parsed = JSON.parse(text.replace(/'/g, '"'));
            if (Array.isArray(parsed)) return uniqueStrings(parsed);
        } catch { /* Fall back to the simple comma-separated form below. */ }
        return uniqueStrings(text.slice(1, -1).split(/[,，]/).map(unquote));
    }
    return uniqueStrings(text.split(/[,，]/));
}

function uniqueStrings(values) {
    return [...new Set(values.map((value) => unquote(String(value).trim())).filter(Boolean))];
}

function normalizeRelatedId(value) {
    return /^[a-z][a-z0-9-]*:/i.test(value) ? value : `post:${value}`;
}

function unquote(value) {
    const text = String(value).trim();
    if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) {
        return text.slice(1, -1);
    }
    return text;
}

function parseArgs(args) {
    const options = { check: false };
    for (const token of args) {
        if (token === '--check') options.check = true;
        else if (token === '--help' || token === '-h') options.help = true;
        else throw new Error(`无法识别参数：${token}`);
    }
    return options;
}

async function main() {
    installCliErrorHandler();
    const options = parseArgs(process.argv.slice(2));
    if (options.help) {
        console.log('用法：node scripts/build-text-index.mjs [--check]');
        return;
    }
    const root = findProjectRoot();
    if (options.check) {
        const { index, warnings } = buildTextIndexReport(root);
        for (const warning of warnings) console.warn(`WARNING: ${warning}`);
        console.log(`文本索引检查通过：${index.nodes.length} 篇公开文章。`);
        return;
    }
    const { index, warnings, target, dataTarget } = writeTextIndex(root);
    for (const warning of warnings) console.warn(`WARNING: ${warning}`);
    const legacyCount = index.nodes.filter((node) => !node.slug).length;
    console.log(`文本索引已生成：${relativeDisplay(root, target)}（${index.nodes.length} 篇公开文章，${index.edges.length} 条关系）。`);
    console.log(`页面关系数据已生成：${relativeDisplay(root, dataTarget)}。`);
    if (legacyCount) console.log(`兼容提醒：${legacyCount} 篇历史文章继续使用原有日期型 URL。`);
}

const isEntryPoint = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isEntryPoint) await main();
