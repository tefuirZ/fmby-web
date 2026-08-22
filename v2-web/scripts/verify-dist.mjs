// 构建产物合同自检（fmby-ui-contract skin-package/build-output.md）
// 检查项：dist/index.html 存在且含 </head>；资源引用走 /_assets/{name}/；
// gzip 总量 <2MB；单 chunk <500KB(gzip)；入口直接引用 JS gzip 总量 ≤200KB；无外部域名引用；
// 产物内无开发期文案。
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';
import { gzipSync } from 'node:zlib';

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const manifest = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'));
const distDir = join(root, 'dist');
const basePrefix = `/_assets/${manifest.name}/`;

let failed = false;
const fail = (msg) => { failed = true; console.error(`✖ ${msg}`); };
const ok = (msg) => console.log(`✔ ${msg}`);

// 开发期文案黑名单。
// 皮肤包是直接发给终端用户的产物，「建设中」「暂未开放」这类字样一旦进了 dist，
// 就等于把半成品当成品发出去了；构建期挡住比等用户反馈便宜得多。
//
// 中文词直接子串匹配（中文没有词边界问题，且这些词组不会嵌进正常业务文案）。
// TODO / FIXME 只认全大写，并要求左右都不是标识符字符：
//   - 排除 todoItems / TodoList / data-todo 这类正常命名（小写或有后缀）；
//   - 保留 "TODO:" "// FIXME" 这种真正的开发标记。
// 注意压缩产物里注释已被剥离，命中的基本都是字符串字面量，可信度更高。
const DEV_COPY_PATTERNS = [
  /建设中/g,
  /敬请期待/g,
  /暂未开放/g,
  /待补充/g,
  /即将上线/g,
  /(?<![A-Za-z0-9_$])TODO(?![A-Za-z0-9_$])/g,
  /(?<![A-Za-z0-9_$])FIXME(?![A-Za-z0-9_$])/g,
];

// 命中处截一小段上下文，方便直接定位是哪句文案，而不用再去 dist 里翻。
const snippetAt = (text, index, length) => {
  const from = Math.max(0, index - 24);
  const to = Math.min(text.length, index + length + 24);
  return `${from > 0 ? '…' : ''}${text.slice(from, to).replace(/\s+/g, ' ')}${to < text.length ? '…' : ''}`;
};

const scanDevCopy = (rel, text) => {
  const hits = [];
  for (const pattern of DEV_COPY_PATTERNS) {
    pattern.lastIndex = 0;
    for (const m of text.matchAll(pattern)) {
      hits.push(`「${m[0]}」@ ${snippetAt(text, m.index, m[0].length)}`);
      if (hits.length >= 5) break; // 同一文件列前几条足够定位，不刷屏
    }
    if (hits.length >= 5) break;
  }
  if (hits.length) fail(`${rel} 含开发期文案：\n    ${hits.join('\n    ')}`);
  return hits.length;
};

let devCopyHits = 0;

// 1. index.html
const indexPath = join(distDir, 'index.html');
if (!existsSync(indexPath)) {
  fail('dist/index.html 不存在');
} else {
  const html = readFileSync(indexPath, 'utf8');
  if (!html.includes('</head>')) fail('index.html 缺少 </head>（bootstrap 注入点）');
  else ok('index.html 含 </head>');
  const assetRefs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1]);
  const bad = assetRefs.filter((u) => !u.startsWith(basePrefix) && !u.startsWith('data:') && !u.startsWith('#'));
  if (bad.length) fail(`index.html 存在非 ${basePrefix} 前缀的资源引用: ${bad.join(', ')}`);
  else ok(`index.html 资源引用均以 ${basePrefix} 开头`);
}

// 2. 遍历产物
const files = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else files.push(p);
  }
};
if (existsSync(distDir)) walk(distDir);

let totalGzip = 0;
let entryJsGzip = 0;
const entryHtml = existsSync(indexPath) ? readFileSync(indexPath, 'utf8') : '';
for (const f of files) {
  const buf = readFileSync(f);
  const gz = gzipSync(buf).length;
  totalGzip += gz;
  const rel = f.slice(distDir.length + 1).replace(/\\/g, '/');
  if (extname(f) === '.js') {
    if (gz > 500 * 1024) fail(`chunk 超 500KB(gzip): ${rel} = ${(gz / 1024).toFixed(0)}KB`);
    if (entryHtml.includes(rel)) entryJsGzip += gz;
  }
  // 3. 外部域名扫描（js/css/html）
  if (['.js', '.css', '.html'].includes(extname(f))) {
    const text = buf.toString('utf8');
    const externals = [...text.matchAll(/https?:\/\/([a-z0-9.-]+)/gi)]
      .map((m) => m[1])
      .filter((h) => ![
        'localhost', '127.0.0.1', 'www.w3.org', 'reactjs.org', 'react.dev', 'github.com',
        'artplayer.org', 'aplayer.js.org', 'dplayer.diygod.dev', 'registry.npmjs.org',
        // 以下为 vendor 库内嵌的作者主页 / 文档链接 / 占位示例字符串，非运行时资源加载：
        'kushagra.dev', 'kushagragour.in', // artplayer 作者主页
        'diygod.me', // DPlayer 作者主页
        'www.gstatic.com', // DPlayer 内置 chromecast SDK 引用（仅点播时按需加载，与 classic 皮肤一致）
        'example.com', // 表单占位示例（含 alist.example.com）
        'reactrouter.com', // react-router 错误信息文档链接
      ].some((w) => h.endsWith(w)));
    if (externals.length) fail(`${rel} 引用外部域名: ${[...new Set(externals)].join(', ')}`);

    // 4. 开发期文案扫描（复用同一次读取，避免重复 IO）
    devCopyHits += scanDevCopy(rel, text);
  }
}
if (!devCopyHits) ok('产物内未发现开发期文案');
if (totalGzip > 2 * 1024 * 1024) fail(`gzip 总量超 2MB: ${(totalGzip / 1024 / 1024).toFixed(2)}MB`);
else ok(`gzip 总量 ${(totalGzip / 1024 / 1024).toFixed(2)}MB < 2MB`);
if (entryJsGzip > 200 * 1024) fail(`入口 JS gzip ${(entryJsGzip / 1024).toFixed(0)}KB 超 200KB`);
else ok(`入口 JS gzip ${(entryJsGzip / 1024).toFixed(0)}KB ≤ 200KB`);

// 5. manifest 必填字段
const required = ['contract_version', 'name', 'display_name', 'version', 'description', 'author', 'license', 'entry'];
const missing = required.filter((k) => manifest[k] == null);
if (missing.length) fail(`manifest.json 缺少必填字段: ${missing.join(', ')}`);
else if (manifest.entry !== 'dist/index.html') fail('manifest.entry 必须为 dist/index.html');
else if (!/^[a-z][a-z0-9-]{1,63}$/.test(manifest.name)) fail('manifest.name 不符合 slug 规则');
else ok('manifest.json 必填字段齐全');

process.exit(failed ? 1 : 0);
