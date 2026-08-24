import { spawn } from 'node:child_process';
import process from 'node:process';
import { buildTextIndexReport, writeTextIndex } from './build-text-index.mjs';
import { findProjectRoot, installCliErrorHandler } from './content-utils.mjs';
import { withMaterializedWikiLinks } from './wiki-links.mjs';

installCliErrorHandler();

const root = findProjectRoot();
const args = process.argv.slice(2);
const { index, warnings } = buildTextIndexReport(root);
for (const warning of warnings) console.warn(`WARNING: ${warning}`);
writeTextIndex(root);

await withMaterializedWikiLinks(root, index, async (changed) => {
    console.log(`构建期间临时展开 Wiki Link：${changed.length} 个文件；结束后自动恢复源文件。`);
    const status = await run('jekyll', args.length ? args : ['build'], root);
    if (status !== 0) throw new Error(`Jekyll 执行失败（退出码 ${status}）。文章源文件已恢复。`);
});

function run(command, args, cwd) {
    return new Promise((resolve, reject) => {
        const windows = process.platform === 'win32';
        const executable = windows ? (process.env.ComSpec || 'cmd.exe') : command;
        const commandArgs = windows ? ['/d', '/s', '/c', command, ...args] : args;
        const child = spawn(executable, commandArgs, {
            cwd,
            stdio: 'inherit',
            windowsHide: true
        });
        const stop = (signal) => {
            if (!child.killed) child.kill(signal);
        };
        const onInterrupt = () => stop('SIGINT');
        const onTerminate = () => stop('SIGTERM');
        const cleanup = () => {
            process.off('SIGINT', onInterrupt);
            process.off('SIGTERM', onTerminate);
        };
        process.once('SIGINT', onInterrupt);
        process.once('SIGTERM', onTerminate);
        child.once('error', (error) => {
            cleanup();
            reject(error);
        });
        child.once('exit', (code, signal) => {
            cleanup();
            resolve(code ?? (signal ? 1 : 0));
        });
    });
}
