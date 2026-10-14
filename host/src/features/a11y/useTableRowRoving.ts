/**
 * 表格行键盘漫游（FE-LIST-KEYNAV-2）——管理面一维行列表。
 *
 * ## 为什么复用 `nextGridIndex` 而不新造一套算法
 *
 * 表格就是 **columns=1 的一维网格**（每行一行、行内没有「左右邻项」概念），
 * 方向键/边界/Home-End 语义与既有 `useGridRovingFocus` 的纯函数完全一致。
 * 故这里只写**行级**的 React 接入层，索引运算全部复用 `nextGridIndex`。
 *
 * ## 「行内可聚焦单元」语义（原报告 §六 要求另定的那条）
 *
 * 管理面每行有 5+ 个按钮（详情/编辑/删除/上移/下移…）。两种做法：
 *
 * - **roving 到行、把行内按钮设 tabindex=-1**：标准 grid 做法，但会让「删除」
 *   这类操作**键盘不可达**，属回归 ⇒ 不采用。
 * - **（本卡采用）行是漫游单位、行内按钮 tabIndex 一律不动**：↑↓/Home/End
 *   把焦点送到**目标行本身**；行内按钮保持原生 Tab 序。
 *   Tab 顺序零变化 ⇒ 无回归，且 Enter 语义可预期。
 *
 * ## roving tabindex 的维护方式（FE-LIST-KEYNAV-6 修 I-1 / I-2）
 *
 * - **I-1 键盘入口可达**：活动行 `tabindex="0"`、其余行 `tabindex="-1"`。
 *   此前所有行一律 `-1` ⇒ 整张表**不进 Tab 序**，只有程序化 `focus()` 才能进去；
 *   对行内零可聚焦控件的只读表（ManageAuditLogsPage / ManageSecretsPage /
 *   MicrosoftAccountsSection / RewardsLedgerSection）等于键盘不可用。
 *   标准 roving 就是给容器留**一个** Tab 停靠点，本 hook 照此实现。
 * - **I-2 同数替换要重算**：行数不变但内容换了（换页/排序/等长筛选）时，
 *   仅靠 `rowCount` 一个依赖不会重跑，旧行会留下过期的 `tabindex`。
 *   因此除 effect 重跑外，另用 `MutationObserver` 监听 `<tbody>` 子树变动，
 *   每次变动都按当前 DOM 重算活动行 —— 与调用方是否传数据标识无关。
 *
 * ## Enter 打开
 *
 * 方向键把焦点落在 `<tr>` 本身 ⇒ Enter 触发 `onActivate(index)`。
 * 焦点在行内控件上时 Enter/Space 由该控件原生处理（checkbox 仍切换选中、
 * 按钮仍触发点击）—— 不抢行内控件语义。
 */

import { useEffect, useRef, useState, type RefObject } from 'react';

import { gridDirectionForKey, nextGridIndex } from './useGridRovingFocus';

export interface UseTableRowRovingOptions {
  /** `<tbody>` 容器。 */
  tbodyRef: RefObject<HTMLElement | null>;
  /** 行数（应为**当前已渲染/已筛选**的行数，与 DOM 一致）。 */
  rowCount: number;
  /** Enter 打开当前行（焦点在 `<tr>` 本身时触发）。 */
  onActivate?: (index: number) => void;
}

const ROW_ATTR = 'data-row-index';
const ROW_SELECTOR = `[${ROW_ATTR}]`;
/** 第 index 行的选择器（属性选择器须写成 [attr="v"]，不能拼 [attr][attr="v"]）。 */
const rowSelector = (index: number) => `[${ROW_ATTR}="${index}"]`;

function rowAt(container: HTMLElement, index: number): HTMLElement | null {
  // ⚠ 嵌套表（A 方案）：必须限定「最近 `<tbody>` 就是本容器」。
  // 否则子表的行（DOM 上也是父 tbody 的后代）会被父 hook 命中 ⇒ 父表 ↑↓
  // 跳到子表行上（实测：父表第 1 行按 ↓，焦点落到子表第 2 行）。
  return (
    Array.from(container.querySelectorAll<HTMLElement>(rowSelector(index))).find(
      (row) => row.closest('tbody') === container,
    ) ?? null
  );
}

/** 文本录入类控件：方向键有原生光标语义，本 hook 不劫持。 */
function isTextEntry(el: HTMLElement): boolean {
  if (el.tagName === 'TEXTAREA') return true;
  if (el.tagName === 'SELECT') return true;
  if (el.tagName !== 'INPUT') return false;
  // checkbox / radio / button / file 等：方向键无原生光标语义 ⇒ 归漫游
  const type = (el as HTMLInputElement).type;
  return !['checkbox', 'radio', 'button', 'submit', 'reset', 'file', 'image'].includes(type);
}

/**
 * 在 `<tbody>` 上挂 keydown：↑↓ / Home / End 在行间移动焦点，Enter 打开当前行。
 *
 * 调用方只需给每行加 `data-row-index={i}`（唯一 DOM 约定）。
 */
export function useTableRowRoving({ tbodyRef, rowCount, onActivate }: UseTableRowRovingOptions) {
  // 当前活动行索引。放 ref 而非 state：方向键每次移动都要写它，
  // 用 state 会引发一次额外 render + effect 重绑（纯属自伤）。
  const activeIndexRef = useRef(0);

  // ★I-3 `<tbody>` 晚于首次 commit 挂载 ⇒ hook 永久静默失效。
  //
  // 管理面大量组件被 query/mutation 早退挡住（`if (q.isPending) return <加载中/>`），
  // 此时调用方已经调了本 hook，但 `tbodyRef.current` 仍是 null，于是下面主 effect
  // 直接 return。等数据到位、`<tbody>` 真正挂上后，ref 变了却**没有任何通知**
  // （RefObject 不是 state），主 effect 的依赖 `[tbodyRef, rowCount, onActivate]`
  // 又全是常量 ⇒ effect 永不重跑 ⇒ 该表**一行 tabindex 都不写** ⇒
  // 整张表不进 Tab 序，键盘完全不可用（实测：ManageSystemAboutPage 的
  // 「运行时」/「链接」两张表 rowCount 恒为 4，roving 停靠点为空）。
  //
  // 之前没暴露，是因为多数表的 rowCount 恰好会从 0 变成 N，
  // 顺带把 effect 重跑了一次 —— 属**巧合恢复**，不是 hook 正确。
  //
  // 修法（不改 hook 的对外 API、不改调用方）：每次 commit 后把 ref 同步进 state，
  // 用元素**身份**做依赖。挂载时机任意都能追上；身份不变时 setState 会
  // 按 Object.is 直接 bail out，不会产生额外渲染循环。
  const [attachedTbody, setAttachedTbody] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setAttachedTbody(tbodyRef.current);
  });

  useEffect(() => {
    const tbody = attachedTbody;
    if (!tbody || rowCount <= 0) return;

    /**
     * 本 hook **自己的**行域。
     *
     * ⚠ 嵌套表（FE-LIST-KEYNAV-10，A 方案）：子表的 `<table>` 在 DOM 上是父 `<tbody>`
     * 的后代 ⇒ `tbody.querySelectorAll(ROW_SELECTOR)` 会把**子表的行也算进来**。
     * 父域因此被污染（实测：父表 2 行 + 子表 2 行 ⇒ 父 hook 认为有 4 行，
     * 并把 tabindex 写到子行上，父子互相覆盖）。
     * A 方案要求父子**各自独立索引域**，故一律按「最近 `<tbody>` 归属」过滤。
     */
    const ownRows = (): HTMLElement[] =>
      Array.from(tbody.querySelectorAll<HTMLElement>(ROW_SELECTOR)).filter(
        (row) => row.closest('tbody') === tbody,
      );

    /**
     * 按**当前 DOM** 重算 roving tabindex：活动行 0、其余 -1。
     *
     * 活动行取值：① 焦点当前所在行（点击/程序化聚焦后仍正确 —— 网格 hook 曾踩过
     * 的 B-2：只信内部 ref 会导致「点第 5 行后按方向键回首行」）；② 否则沿用上次
     * 活动行（换页/筛选后尽量不丢位置）；③ 越界则回首行。
     * ★M-3 注释精度（rv02 #24 评审，CAS 分支收尾移植）：Home/End 传 forceIndex
     *   时 ref 也被写回为**跳转目标**（`activeIndexRef.current = current`）——
     *   行为有意如此（跳转后失焦再回来从目标行起算），非「沿用上次活动行」。
     */
    const enforceRovingTabindex = (forceIndex?: number) => {
      const rows = ownRows();
      if (rows.length === 0) return;

      const focused = document.activeElement as HTMLElement | null;
      // 嵌套表：焦点在**子表**行上时，父表不得把它当作自己的活动行
      // （否则父表的停靠点会跟着子表跑，父表首行被写 -1 ⇒ 键盘进不去父表）。
      const focusedIndex =
        focused && focused.closest('tbody') === tbody
          ? Number(focused.closest(ROW_SELECTOR)?.getAttribute(ROW_ATTR) ?? Number.NaN)
          : Number.NaN;

      const current =
        forceIndex ??
        (Number.isFinite(focusedIndex)
          ? focusedIndex
          : Math.min(Math.max(activeIndexRef.current, 0), rows.length - 1));
      activeIndexRef.current = current;

      for (const row of rows) {
        const next = Number(row.getAttribute(ROW_ATTR)) === current ? '0' : '-1';
        // 必须比对**属性**而不是 `row.tabIndex`：未设过 tabindex 的 `<tr>` 读回
        // 就是 -1（HTMLTableRowElement 默认不可聚焦），比对会误判「已一致」而跳过
        // 写入 ⇒ 行永远不可聚焦，`focus()` 静默失败（这正是 I-2 的坑）。
        if (row.getAttribute('tabindex') !== next) row.setAttribute('tabindex', next);
      }
    };

    // I-2：`rowCount` 不变但行已换（换页/排序/等长筛选）时 effect 不会重跑，
    // 旧行的 tabindex 会一直是过期值。监听 tbody 子树变动，行一换就重算。
    // 只观察 childList：不观察 attributes，避免自己写 tabindex 触发自循环。
    const observer = new MutationObserver(() => {
      enforceRovingTabindex();
    });
    observer.observe(tbody, { childList: true, subtree: true });
    enforceRovingTabindex();

    /** 当前 DOM 里的**实际**数据行数（虚拟化下与闭包 rowCount 可能已不同）。嵌套表只数本域。 */
    const liveRowCount = () => ownRows().length;

    const handleKeyDown = (event: KeyboardEvent) => {
      // 焦点不在表体内时不劫持 —— 避免影响页面滚动与表头筛选控件
      const active = document.activeElement as HTMLElement | null;
      if (!active || !tbody.contains(active)) return;
      // ★嵌套表（A 方案）：子表的 keydown 会**冒泡**到父 `<tbody>` 的监听上。
      // 若父 hook 不拦，父会拿子行的 data-row-index 当自己的当前行、
      // 再把焦点 `focus()` 抢回父表某一行 ⇒ 子表方向键完全不可用。
      // 判据：焦点最近的 `<tbody>` 必须是本 tbody，否则交给子 hook 处理。
      if (active.closest('tbody') !== tbody) return;
      // 仅**文本输入类**控件内不劫持（方向键要用于光标移动）。
      // FE-LIST-KEYNAV-4：不能写成 `tag === 'INPUT'` 一刀切 —— 行首常是
      // `<input type="checkbox">`（如 UserTable），那样会把整行的方向键漫游
      // 全部跳过 ⇒ 漫游在该表上完全失效（实测焦点不动/掉 body）。
      // checkbox / radio / button 上方向键无原生语义，应交由本 hook 漫游。
      if (isTextEntry(active)) return;

      if (event.key === 'Enter') {
        // 只在焦点落在行本身时接管；行内按钮由浏览器原生处理 Enter。
        if (active.matches(ROW_SELECTOR)) {
          const index = Number(active.getAttribute(ROW_ATTR));
          if (Number.isFinite(index) && index >= 0) {
            event.preventDefault();
            onActivate?.(index);
          }
        }
        return;
      }

      const direction = gridDirectionForKey(event.key);
      if (!direction) return;

      // 当前行索引：以 activeElement 所在行为准（点击/程序化聚焦后仍正确，
      // 这是网格 hook 曾踩过的 B-2：只信内部 ref 会导致「点第 5 行后按方向键回首行」）。
      const currentIndex = Number(
        active.closest(ROW_SELECTOR)?.getAttribute(ROW_ATTR) ?? -1,
      );

      const target = nextGridIndex(
        { activeIndex: currentIndex, itemCount: liveRowCount(), columns: 1, hasMore: false },
        direction,
      );
      if (target < 0) return;
      event.preventDefault();
      if (target === currentIndex) return;

      const row = rowAt(tbody, target);
      if (!row) return;
      // 主代理裁定（FE-LIST-KEYNAV-3）：↑↓/Home/End 一律把焦点落到**行本身**，
      // 而不是行内首个控件。
      // 原因：若落到行内首控件，Enter 的语义就由该控件决定 —— LibraryTable 首控件
      // 恰好是「详情」所以看着对，但 UserTable 行首是 **checkbox**，Enter 会变成
      // 「切换选中」；37 表铺开后 `onActivate` 会整体退化成死分支。
      // 行本身是 roving 的活动项 ⇒ tabindex=0，构成真实 Tab 停靠点（I-1）。
      // 行内控件的 tabIndex 一律不动，Tab 仍逐一可达，零回归原则不变。
      // 先布 tabindex 再 focus：`<tr>` 没有 tabindex 属性时根本不可聚焦，
      // `focus()` 会静默失败（表现为「方向键没反应」）。
      enforceRovingTabindex(target);
      row.focus();
    };

    tbody.addEventListener('keydown', handleKeyDown);
    return () => {
      observer.disconnect();
      tbody.removeEventListener('keydown', handleKeyDown);
      // ★M-1 teardown（rv02 #24 评审，CAS 分支收尾移植）：与 enforceRovingTabindex
      //   对称还原 —— 本 hook 在行上写过 tabindex（活动行 0、其余 -1），卸载时
      //   清掉本域所有行的 roving tabindex，避免 React 卸载后 DOM 上残留
      //   tabindex（曾聚焦的行残留非自然值，破坏 Tab 序 / 可访问性）。
      //   ★只清本域（closest('tbody') === tbody，与 ownRows 同一归属判据）：
      //     嵌套表的行归子 hook 的 cleanup 管，不越界清除。
      tbody
        .querySelectorAll<HTMLElement>(ROW_SELECTOR)
        .forEach((r) => {
          if (r.closest('tbody') === tbody) r.removeAttribute('tabindex');
        });
    };
  }, [attachedTbody, rowCount, onActivate]);
}
