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
    const topicsFolder = path.join(root, '_topics');
    const siteOrigin = readSiteOrigin(root);
    const postFiles = fs.readdirSync(postsFolder)
        .filter((name) => /\.(?:md|markdown)$/i.test(name))
        .sort((left, right) => left.localeCompare(right, 'en'));
    const topicFiles = fs.existsSync(topicsFolder)
        ? fs.readdirSync(topicsFolder).filter((name) => /\.(?:md|markdown)$/i.test(name)).sort((left, right) => left.localeCompare(right, 'en'))
        : [];
    const postNodes = postFiles.map((name) => buildTextNode(path.join(postsFolder, name), { root, siteOrigin }));
    const topicNodes = topicFiles.map((name) => buildTopicNode(path.join(topicsFolder, name), { root, siteOrigin }));
    const nodes = [...postNodes, ...topicNodes];
    const relatedEdges = buildRelatedEdges(nodes);
    const topicEdges = buildTopicEdges(postNodes, nodes);
    const { edges: wikiEdges, warnings } = buildWikiEdges(root, postFiles, postNodes);
    const edges = [...relatedEdges, ...wikiEdges, ...topicEdges];
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
        topics: asList(data.topics).map(normalizeTopicId),
        createdAt: asText(data.date) || filenameDate,
        updatedAt: asText(data.updated)
    };
    if (declaredSlug) node.slug = declaredSlug;
    return node;
}

export function buildTopicNode(file, { root, siteOrigin = readSiteOrigin(root) }) {
    const label = relativeDisplay(root, file);
    const filenameSlug = path.basename(file).replace(/\.(?:md|markdown)$/i, '');
    if (!/^[a-z0-9][a-z0-9-]*$/i.test(filenameSlug)) {
        throw new Error(`${label} 的 Topic 文件名必须是英文 slug。`);
    }
    const { data } = parseFrontMatter(fs.readFileSync(file, 'utf8'), label);
    const slug = asText(data.slug) || filenameSlug;
    if (!/^[a-z0-9][a-z0-9-]*$/i.test(slug)) throw new Error(`${label} 的 Topic slug 无效：${slug}`);
    if (slug !== filenameSlug) throw new Error(`${label} 的 slug 必须与文件名一致：${filenameSlug}`);
    const title = asText(data.title);
    const summary = asText(data.description) || asText(data.summary);
    if (!title) throw new Error(`${label} 缺少 Topic 标题。`);
    if (!summary) throw new Error(`${label} 缺少 Topic 简介 description。`);
    return {
        id: `topic:${slug}`,
        type: 'topic',
        title,
        slug,
        url: resolveTopicUrl({ data, slug, siteOrigin }),
        summary,
        category: '知识节点',
        format: 'Topic',
        tags: asList(data.aliases),
        related: asList(data.related).map(normalizeTopicId),
        topics: [],
        createdAt: asText(data.created),
        updatedAt: asText(data.updated)
    };
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
        const expectedPrefix = node?.type === 'post' ? 'post:' : node?.type === 'topic' ? 'topic:' : '';
        if (!node || !expectedPrefix || typeof node.id !== 'string' || !node.id.startsWith(expectedPrefix)) {
            throw new Error('text-index.json 包含无效的文本节点。');
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
        if (!Array.isArray(node.topics) || !node.topics.every((item) => typeof item === 'string' && item.startsWith('topic:'))) {
            throw new Error(`${node.id} 的 topics 必须是 Topic ID 数组。`);
        }
    }

    const seenEdges = new Set();
    for (const edge of index.edges) {
        if (!edge || !['related', 'wiki', 'topic'].includes(edge.type) || typeof edge.from !== 'string' || typeof edge.to !== 'string') {
            throw new Error('text-index.json 包含无效的关系边。');
        }
        if (!seenIds.has(edge.from) || !seenIds.has(edge.to)) {
            throw new Error(`text-index.json 包含悬空关系：${edge.from} → ${edge.to}`);
        }
        if (edge.from === edge.to) throw new Error(`${edge.from} 不能关联自身。`);
        if (edge.type === 'wiki' && (!edge.from.startsWith('post:') || !edge.to.startsWith('post:'))) {
            throw new Error(`wiki 关系只能连接文章：${edge.from} → ${edge.to}`);
        }
        if (edge.type === 'topic' && (!edge.from.startsWith('post:') || !edge.to.startsWith('topic:'))) {
            throw new Error(`topic 关系必须从文章指向 Topic：${edge.from} → ${edge.to}`);
        }
        if (edge.type === 'related' && edge.from.split(':', 1)[0] !== edge.to.split(':', 1)[0]) {
            throw new Error(`related 关系只能连接相同类型节点：${edge.from} → ${edge.to}`);
        }
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
            const expectedPrefix = `${node.type}:`;
            if (!targetId.startsWith(expectedPrefix)) continue;
            if (!nodesById.has(targetId)) {
                if (node.type === 'post') {
                    throw new Error(`${node.id} 的 related 引用了不存在的文章：${targetId.slice(5)}`);
                }
                throw new Error(`${node.id} 的 related 引用了不存在的 Topic：${targetId.slice(6)}`);
            }
            if (targetId === node.id) throw new Error(`${node.id} 不能关联自身。`);
            edges.push({ from: node.id, to: targetId, type: 'related' });
        }
    }
    return edges;
}

export function buildTopicEdges(postNodes, nodes) {
    const nodesById = new Map(nodes.map((node) => [node.id, node]));
    const edges = [];
    for (const post of postNodes) {
        for (const topicId of post.topics) {
            const topic = nodesById.get(topicId);
            if (!topic || topic.type !== 'topic') {
                throw new Error(`${post.id} 的 topics 引用了不存在的 Topic：${topicId.slice(6)}`);
            }
            edges.push({ from: post.id, to: topicId, type: 'topic' });
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
        if (edge.type !== 'topic') mergeRelation(relations[edge.from].related, nodesById.get(edge.to), edge.type);
        mergeRelation(relations[edge.to].backlinks, nodesById.get(edge.from), edge.type);
    }
    const posts = Object.fromEntries(index.nodes.filter((node) => node.type === 'post').map((node) => [node.id, relations[node.id]]));
    const topics = Object.fromEntries(index.nodes.filter((node) => node.type === 'topic').map((node) => {
        const relation = relations[node.id];
        const articles = relation.backlinks
            .filter((item) => item.type === 'post' && item.types.includes('topic'))
            .sort(compareRecent);
        const related = uniqueRelations([...relation.related, ...relation.backlinks]
            .filter((item) => item.type === 'topic' && item.types.includes('related')));
        return [node.id, { ...toRelationSummary(node), articles, related, recent: articles.slice(0, 5) }];
    }));
    return { version: index.version, generatedAt: index.generatedAt, posts, topics };
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
    const summary = {
        id: node.id,
        title: node.title,
        url: node.url,
        summary: node.summary,
        category: node.category,
        type: node.type
    };
    if (node.createdAt) summary.createdAt = node.createdAt;
    if (node.updatedAt) summary.updatedAt = node.updatedAt;
    return summary;
}

function compareRecent(left, right) {
    const leftDate = Date.parse(left.updatedAt || left.createdAt || '') || 0;
    const rightDate = Date.parse(right.updatedAt || right.createdAt || '') || 0;
    return rightDate - leftDate || left.title.localeCompare(right.title, 'zh-CN');
}

function uniqueRelations(items) {
    const seen = new Set();
    return items.filter((item) => {
        if (seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
    });
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

function resolveTopicUrl({ data, slug, siteOrigin }) {
    const permalink = asText(data.permalink) || `/topics/${slug}/`;
    if (/^https?:\/\//i.test(permalink)) return permalink;
    return new URL(permalink.replace(/^\/*/, '/'), `${siteOrigin}/`).href;
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

function normalizeTopicId(value) {
    return String(value).startsWith('topic:') ? String(value) : `topic:${value}`;
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
        const postCount = index.nodes.filter((node) => node.type === 'post').length;
        const topicCount = index.nodes.filter((node) => node.type === 'topic').length;
        console.log(`文本索引检查通过：${postCount} 篇公开文章，${topicCount} 个 Topic。`);
        return;
    }
    const { index, warnings, target, dataTarget } = writeTextIndex(root);
    for (const warning of warnings) console.warn(`WARNING: ${warning}`);
    const postCount = index.nodes.filter((node) => node.type === 'post').length;
    const topicCount = index.nodes.filter((node) => node.type === 'topic').length;
    const legacyCount = index.nodes.filter((node) => node.type === 'post' && !node.slug).length;
    console.log(`文本索引已生成：${relativeDisplay(root, target)}（${postCount} 篇公开文章，${topicCount} 个 Topic，${index.edges.length} 条关系）。`);
    console.log(`页面关系数据已生成：${relativeDisplay(root, dataTarget)}。`);
    if (legacyCount) console.log(`兼容提醒：${legacyCount} 篇历史文章继续使用原有日期型 URL。`);
}

const isEntryPoint = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isEntryPoint) await main();
