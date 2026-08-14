import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { findProjectRoot, installCliErrorHandler } from './content-utils.mjs';

installCliErrorHandler();

const root = findProjectRoot();
const gitPath = path.join(root, '.git');

console.log(`当前站点目录：${root}`);

if (!fs.existsSync(gitPath)) {
    console.error('\n当前目录不是 Git 仓库，不能在这里执行 git add 或 git push。');
    const parent = path.dirname(root);
    const repositories = fs.readdirSync(parent, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => path.join(parent, entry.name))
        .filter((candidate) => fs.existsSync(path.join(candidate, '.git')));

    if (repositories.length) {
        console.error('在同级目录发现可提交的仓库：');
        repositories.forEach((repository) => console.error(`  ${repository}`));
        console.error('\n建议以后直接用上面的仓库目录打开 Codex 和编辑器。');
    } else {
        console.error('同级目录也没有发现 Git 仓库，请先重新克隆 GitHub 仓库。');
    }
    process.exit(1);
}

const branch = runGit(['branch', '--show-current']) || '未知分支';
const remote = runGit(['remote', 'get-url', 'origin']) || '未配置 origin';
const status = runGit(['status', '--short']);

console.log('Git 仓库：正常');
console.log(`当前分支：${branch}`);
console.log(`远程仓库：${remote}`);
console.log(status ? `未提交改动：\n${status}` : '工作区：干净');

function runGit(args) {
    const result = spawnSync('git', ['-c', `safe.directory=${root.replace(/\\/g, '/')}`, ...args], {
        cwd: root,
        encoding: 'utf8',
        shell: false
    });
    if (result.status !== 0) return '';
    return String(result.stdout || '').trim();
}
