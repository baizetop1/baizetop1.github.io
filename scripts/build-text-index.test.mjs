import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { buildTextIndex, buildTextIndexReport, buildTextNetworkData, validateTextIndex, writeTextIndex } from './build-text-index.mjs';
import { materializeWikiLinks, scanWikiLinks, withMaterializedWikiLinks } from './wiki-links.mjs';

function createSite() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'baize-text-index-'));
    fs.mkdirSync(path.join(root, '_posts'));
    fs.mkdirSync(path.join(root, '_drafts'));
    fs.writeFileSync(path.join(root, '_config.yml'), 'url: "https://baizeone.top"\n', 'utf8');
    return root;
}

function writePost(root, folder, name, frontMatter, body = '正文中的私密测试标记不应进入索引。') {
    fs.writeFileSync(path.join(root, folder, name), `---\n${frontMatter}\n---\n${body}\n`, 'utf8');
}

test('indexes only published metadata and uses the stable short URL', (context) => {
    const root = createSite();
    context.after(() => fs.rmSync(root, { recursive: true, force: true }));
    writePost(root, '_posts', '2026-08-24-text-network.md', [
        'title: 文本互联机制',
        'slug: text-network',
        'permalink: /p/text-network/',
        'date: 2026-08-24',
        'updated: 2026-08-25',
        'description: 统一发现公开内容',
        'category: 项目',
        'format: 笔记',
        'tags:',
        '  - 知识管理',
        '  - Web',
        'related:',
        '  - digital-garden',
        '  - site:nav'
    ].join('\n'));
    writePost(root, '_drafts', 'secret.md', 'title: 未公开草稿\nslug: secret\ntags:\n  - 私有');
    writePost(root, '_posts', '2026-08-23-digital-garden.md', [
        'title: 数字花园',
        'slug: digital-garden',
        'permalink: /p/digital-garden/',
        'date: 2026-08-23',
        'category: 项目',
        'tags: [知识管理]'
    ].join('\n'));

    const index = buildTextIndex(root, { generatedAt: '2026-08-24T00:00:00.000Z' });
    assert.equal(index.version, 2);
    assert.equal(index.nodes.length, 2);
    assert.deepEqual(index.nodes.find((node) => node.id === 'post:text-network'), {
        id: 'post:text-network',
        type: 'post',
        title: '文本互联机制',
        url: 'https://baizeone.top/p/text-network/',
        summary: '统一发现公开内容',
        category: '项目',
        format: '笔记',
        tags: ['知识管理', 'Web'],
        related: ['post:digital-garden', 'site:nav'],
        createdAt: '2026-08-24',
        updatedAt: '2026-08-25',
        slug: 'text-network'
    });
    assert.deepEqual(index.edges, [{ from: 'post:text-network', to: 'post:digital-garden', type: 'related' }]);
    assert.deepEqual(buildTextNetworkData(index).posts['post:digital-garden'].backlinks, [{
        id: 'post:text-network',
        title: '文本互联机制',
        url: 'https://baizeone.top/p/text-network/',
        summary: '统一发现公开内容',
        category: '项目',
        types: ['related']
    }]);
    assert.doesNotMatch(JSON.stringify(index), /私密测试标记|未公开草稿/);
});

test('keeps legacy posts indexable when optional metadata is missing', (context) => {
    const root = createSite();
    context.after(() => fs.rmSync(root, { recursive: true, force: true }));
    writePost(root, '_posts', '2017-02-15-Git 指令整理.md', 'title: Git 指令整理');

    const [node] = buildTextIndex(root, { generatedAt: '2026-08-24T00:00:00.000Z' }).nodes;
    assert.equal(node.id, 'post:Git 指令整理');
    assert.equal(node.url, 'https://baizeone.top/2017/02/15/Git-%E6%8C%87%E4%BB%A4%E6%95%B4%E7%90%86/');
    assert.equal(node.createdAt, '2017-02-15');
    assert.equal(node.slug, undefined);
    assert.deepEqual(node.tags, []);
    assert.deepEqual(node.related, []);
});

test('accepts inline lists and rejects duplicate node IDs', (context) => {
    const root = createSite();
    context.after(() => fs.rmSync(root, { recursive: true, force: true }));
    writePost(root, '_posts', '2026-08-23-first.md', 'title: First\nslug: same\ntags: ["one", "two"]');
    writePost(root, '_posts', '2026-08-24-second.md', 'title: Second\nslug: same\ntags: [one, two]');
    assert.throws(() => buildTextIndex(root), /重复 ID/);

    assert.throws(
        () => validateTextIndex({ version: 2, generatedAt: 'invalid', nodes: [], edges: [] }),
        /generatedAt/
    );
});

test('rejects broken/self related slugs and writes Jekyll relation data', (context) => {
    const root = createSite();
    context.after(() => fs.rmSync(root, { recursive: true, force: true }));
    writePost(root, '_posts', '2026-08-24-broken.md', 'title: Broken\nslug: broken\nrelated: [missing]');
    assert.throws(() => buildTextIndex(root), /related 引用了不存在的文章：missing/);

    fs.rmSync(path.join(root, '_posts', '2026-08-24-broken.md'));
    writePost(root, '_posts', '2026-08-24-self.md', 'title: Self\nslug: self\nrelated: [self]');
    assert.throws(() => buildTextIndex(root), /不能关联自身/);

    fs.rmSync(path.join(root, '_posts', '2026-08-24-self.md'));
    writePost(root, '_posts', '2026-08-23-target.md', 'title: Target\nslug: target');
    writePost(root, '_posts', '2026-08-24-source.md', 'title: Source\nslug: source\nrelated: [target]');
    const { index, dataTarget } = writeTextIndex(root, { generatedAt: '2026-08-24T00:00:00.000Z' });
    assert.equal(index.edges.length, 1);
    assert.equal(fs.existsSync(dataTarget), true);
    const data = JSON.parse(fs.readFileSync(dataTarget, 'utf8'));
    assert.equal(data.posts['post:source'].related[0].title, 'Target');
    assert.equal(data.posts['post:target'].backlinks[0].title, 'Source');
});

test('builds wiki edges, warns on broken links, and ignores code examples', (context) => {
    const root = createSite();
    context.after(() => fs.rmSync(root, { recursive: true, force: true }));
    writePost(root, '_posts', '2026-08-23-target.md', 'title: Target\nslug: target');
    writePost(root, '_posts', '2026-08-24-source.md', 'title: Source\nslug: source', [
        '阅读 [[target]]，也可以显示为 [[target|目标文章]]。',
        '断链 [[missing|尚未发布]] 只应该警告。',
        '转义 \\[[escaped]] 不参与解析。',
        '行内代码 `[[inline-code]]` 不参与解析。',
        '```markdown',
        '[[fenced-code]]',
        '```'
    ].join('\n'));

    const { index, warnings } = buildTextIndexReport(root, { generatedAt: '2026-08-24T00:00:00.000Z' });
    assert.deepEqual(index.edges, [{ from: 'post:source', to: 'post:target', type: 'wiki' }]);
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /missing/);
    assert.doesNotMatch(warnings[0], /escaped|inline-code|fenced-code/);
    assert.deepEqual(buildTextNetworkData(index).posts['post:target'].backlinks[0].types, ['wiki']);
});

test('materializes valid wiki links for Jekyll and always restores post sources', async (context) => {
    const root = createSite();
    context.after(() => fs.rmSync(root, { recursive: true, force: true }));
    writePost(root, '_posts', '2026-08-23-target.md', 'title: Target\nslug: target\npermalink: /p/target/');
    writePost(root, '_posts', '2026-08-24-source.md', 'title: Source\nslug: source', [
        '[[target]] 与 [[target|目标文章]]，以及 [[missing]]。',
        '`[[target]]`',
        '~~~text',
        '[[target]]',
        '~~~'
    ].join('\n'));
    const file = path.join(root, '_posts', '2026-08-24-source.md');
    const original = fs.readFileSync(file, 'utf8');
    const index = buildTextIndex(root);

    await assert.rejects(
        withMaterializedWikiLinks(root, index, async () => {
            const rendered = fs.readFileSync(file, 'utf8');
            assert.match(rendered, /\[target\]\(\/p\/target\/\)/);
            assert.match(rendered, /\[目标文章\]\(\/p\/target\/\)/);
            assert.match(rendered, /\[\[missing\]\]/);
            assert.match(rendered, /`\[\[target\]\]`/);
            throw new Error('模拟 Jekyll 失败');
        }),
        /模拟 Jekyll 失败/
    );
    assert.equal(fs.readFileSync(file, 'utf8'), original);

    const direct = materializeWikiLinks(root, index);
    assert.equal(direct.length, 1);
    for (const entry of direct) fs.writeFileSync(entry.file, entry.source, 'utf8');
    assert.equal(fs.readFileSync(file, 'utf8'), original);
});

test('scanner supports aliases without treating malformed syntax as links', () => {
    const links = scanWikiLinks('[[one]] [[two|显示文本]] [[|empty]] [[three|]]');
    assert.deepEqual(links.map(({ slug, label }) => ({ slug, label })), [
        { slug: 'one', label: 'one' },
        { slug: 'two', label: '显示文本' }
    ]);
});
