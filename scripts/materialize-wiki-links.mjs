import process from 'node:process';
import { buildTextIndexReport } from './build-text-index.mjs';
import { findProjectRoot, installCliErrorHandler, relativeDisplay } from './content-utils.mjs';
import { materializeWikiLinks } from './wiki-links.mjs';

installCliErrorHandler();

if (!process.argv.slice(2).includes('--ci') || !process.env.CI) {
    throw new Error('该命令只允许在 CI 的临时检出目录运行；本机请使用 npm run build。');
}

const root = findProjectRoot();
const { index, warnings } = buildTextIndexReport(root);
for (const warning of warnings) console.warn(`WARNING: ${warning}`);
const changed = materializeWikiLinks(root, index);
console.log(`Wiki Link 已为 Jekyll 临时展开：${changed.length} 个文件。`);
for (const entry of changed) console.log(`- ${relativeDisplay(root, entry.file)}`);
