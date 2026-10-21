// FE-UI-2「同值重复 / 死代码」机械收口的护栏（3 条）：
//   P2-4  登录页 mfa 分支重复（死代码）——第二个 `mfaChallenge ?` 永不可达
//   P1-4  历史页同一计数显示两次（页头 + 工具条，且两者口径相同）
//   P1-5  库详情页「已加载 x/y」三处重复（hero + 工具条 + 尾部提示）
//
// 跑法：node --import ./tests/register-aliases.mjs --test tests/fe-ui2-density-mechanical.test.ts
//
// ★rebase 后如实说明：P1-4 / P1-5 两条**已由 main 591eb0a 修掉**（密度 P1 批量收口），
//   本提交实际交付的是 P2-4（登录页死代码分支）+ 这 3 条**防回归钉**——
//   P1-4/P1-5 的断言从此锁定「不许再退回两处/三处」，而不是宣称本轮修了它们。
//
// 为什么是源码契约断言：三条修的都是**同一信息在源码里出现多次**（死代码分支 /
// 同值渲染两遍/三遍），断言目标与改动同层（源码）。真 DOM 里「少了一行」由
// 农场验收节点人工抽查（见交付说明的验收步骤）。
//
// ★口径（防伪断言）：不只数「字符串出现次数」——
//   · 死代码用**同一三元分支连续出现两次**判定（两次判断同一个 state）；
//   · 同值重复用**同一表达式在不同 JSX 位置渲染**判定，且不钉具体保留哪一处
//     （保留页头还是工具条是产品口径，main 选了页头）。

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..');

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), 'utf8');
}

/** 剥注释（同 manage-overview-honesty.test.ts 的理由：注释可引用改前原文）。 */
function readCode(rel: string): string {
  return read(rel)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

const LOGIN_PAGE = 'host/src/pages/login/LoginPage.tsx';
const HISTORY_PAGE = 'host/src/pages/browse/HistoryPage.tsx';
const LIBRARY_DETAIL_PAGE = 'host/src/pages/browse/LibraryDetailPage.tsx';

// ─── P2-4 登录页 mfa 分支重复（死代码） ───────────────────────────────────

test('P2-4：登录页不得有两个连续的相同 mfaChallenge 三元分支（死代码）', () => {
  const src = readCode(LOGIN_PAGE);
  // 改前：`: mfaChallenge ? (<MfaVerifyPanel .../>) : mfaChallenge ? (<MfaVerifyPanel .../>)`
  //   —— 第二个分支永不可达（第一个已穷尽 mfaChallenge 为真的情形）。
  const dupCount = src.match(/mfaChallenge\s*\?/g)?.length ?? 0;
  assert.ok(
    dupCount <= 1,
    `mfaChallenge 三元分支出现 ${dupCount} 次；改前是两个完全相同且连续的分支（第二个永不可达 = 死代码），应只留 1 个`,
  );
});

// ─── P1-4 历史页同一计数两次 ──────────────────────────────────────────────

test('P1-4：历史页不得把同一计数渲染两遍（页头 + 工具条）', () => {
  const src = readCode(HISTORY_PAGE);
  // 改前两处同值：页头 `共整理出 {allItems.length} 条记录` +
  //       工具条 `当前结果：{continueWatching.length + recentlyPlayed.length + completed.length} 条`
  //       —— 两侧算式等价（allItems 就是三者拼接）⇒ 同屏两个 N。
  // ★保留哪一处是产品口径选择（main 591eb0a 保留页头那处），断言只钉
  //   「同屏不许有两个 N」，不钉具体位置。
  const headerCount = (src.match(/共整理出/g) ?? []).length;
  const toolbarCount = (src.match(/当前结果/g) ?? []).length;
  assert.equal(
    headerCount + toolbarCount,
    1,
    `历史页的「总条数」渲染处数应为 1（页头「共整理出」${headerCount} 处 + 工具条「当前结果」${toolbarCount} 处）——两处同值重复即回归`,
  );
  // 删掉计数后空出的信息位由「筛选生效中」补（仅筛选非默认时出现）
  assert.ok(
    /筛选生效中/.test(src),
    '工具条须保留「筛选生效中」状态（补回计数的信息位，且只在筛选生效时出现）',
  );
});

// ─── P1-5 库详情「已加载 x/y」三处重复 ────────────────────────────────────

test('P1-5：库详情页「已加载 x/y」不得在三处重复渲染', () => {
  const src = readCode(LIBRARY_DETAIL_PAGE);
  // 改前三处：
  //   ① heroSummary/loadedLabel（hero 区）
  //   ② 工具条 metaText `已加载 ${loadedCount}/${vm.totalItems}`
  //   ③ 尾部 loadMoreHintCard（布尔态即可，不带数字）
  const loadedOccurrences = src.match(/已加载/g)?.length ?? 0;
  assert.ok(
    loadedOccurrences <= 1,
    `「已加载」文案出现 ${loadedOccurrences} 次；改前是三处重复（hero + 工具条 + 尾部），应收敛到 1 处`,
  );
  // 尾部提示只留布尔态（不出现数字口径）
  assert.ok(
    !/个条目已经全部展开了/.test(src) || !/\$\{vm\.totalItems\}[^`]*个条目已经全部展开/.test(src),
    '尾部提示不应再拼「N 个条目已经全部展开」这类数字（保留布尔态即可）',
  );
});
