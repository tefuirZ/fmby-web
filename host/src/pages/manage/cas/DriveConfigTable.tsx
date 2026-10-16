/**
 * 盘配置表（CAS 矩阵）—— 自 `ManageCasPage.tsx` 抽出（FE-CAS-G1：加写面禁用后
 * 父组件越过 400 行 component-size 红线；按本仓「组件保持在 400 行门禁内」的惯例
 * 拆独立组件，而不是塞基线清单）。行为零变化，唯一新增是 G1 的禁用与只读说明。
 */
import { useRef, useState } from 'react';
import { InlineBanner } from '@fmby/v2-shared/ui';
import type { CasDriveConfig } from '@fmby/v2-shared/contracts/manage/casAdmin';
import { useTableRowRoving } from '../../../features/a11y/useTableRowRoving';
import styles from '../longtail-shared/ManageShared.module.css';
import {
  casDriveKey,
  isDriveDirty,
  parsePriorityInput,
  resolveDriveWriteAffordance,
} from './driveConfigEditing';

export function DriveConfigTable({
  configs,
  onSave,
  saving,
  savedKey,
}: {
  configs: CasDriveConfig[];
  onSave: (config: CasDriveConfig) => void;
  saving: boolean;
  savedKey: string | null;
}) {
  // 编辑草稿：以 providerType:driveRef 为键。★没有草稿 ⇒ 没有「改了的东西」，
  // 「保存」就是无操作；此时不提示「已保存」（⑧ 的 dirty 判据来源）。
  const [drafts, setDrafts] = useState<Record<string, CasDriveConfig>>({});

  // FE-LIST-KEYNAV-10：本表行内有 checkbox / 数字输入 / 「保存」按钮，
  // 均已具备原生 Tab 序 ⇒ 不传 onActivate，不凭空给行加 Enter 语义（保存是写操作）。
  // ★hook 必须早于下面的「空列表」early return（Hooks 规则）。
  const tbodyRef = useRef<HTMLTableSectionElement>(null);
  useTableRowRoving({ tbodyRef, rowCount: configs.length });

  const patch = (config: CasDriveConfig, next: Partial<CasDriveConfig>) => {
    const key = casDriveKey(config);
    setDrafts((prev) => ({
      ...prev,
      [key]: { ...(prev[key] ?? config), ...next },
    }));
  };

  const isDirty = (config: CasDriveConfig) =>
    isDriveDirty(config, drafts[casDriveKey(config)], savedKey);

  // #658 G1：写面未接线 ⇒ **渲染期**禁用（不假装成功，也不留一个必然 500 的按钮）。
  // 判据与文案在 driveConfigEditing.resolveDriveWriteAffordance（纯函数 ⇒ 测试可直接调用）。
  const write = resolveDriveWriteAffordance();

  if (configs.length === 0) {
    // 空列表是**真状态**（端口装配了但一个盘都没配），与「未启用」区分开。
    return <p>尚未配置任何盘。CAS 扇出不会发生。</p>;
  }
  return (
    // ★审计 FE-UI-ACCEPTANCE-AUDIT §5-C1：本页 3 张表原为**裸 table 元素**——
    // 无容器 region、无表名，是全仓唯一无任何 a11y 标注的表。此处按所在
    // ManageSectionCard 标题补可访问名（读屏器不再只播报无名的「表」）。
    <div className={styles.tableWrap} role="region" aria-label="盘配置（CAS 矩阵）（可横向滚动）">
      {/* #658 G1：写面未接线的**事前**说明（不是点了之后才报错）。 */}
      {write.disabled ? (
        <InlineBanner variant="warning" title={write.note ?? '盘配置写面未接线，本页只读。'} />
      ) : null}
      <table className={styles.table}>
      <thead>
        <tr>
          <th>盘</th>
          <th>纳入扇出</th>
          <th>优先级</th>
          <th />
        </tr>
      </thead>
      <tbody ref={tbodyRef}>
        {configs.map((config, index) => {
          const key = casDriveKey(config);
          const draft = drafts[key] ?? config;
          const dirty = isDirty(config);
          return (
            <tr key={key} data-row-index={index}>
              <td>
                {config.providerType} · {config.driveRef}
              </td>
              <td className={styles.casHitCell}>
                <label className={styles.casHitCheck}>
                  <input
                    type="checkbox"
                    aria-label={`${config.driveRef} 纳入扇出`}
                    checked={draft.enabled}
                    disabled={write.disabled}
                    onChange={(e) => patch(config, { enabled: e.target.checked })}
                  />
                </label>
              </td>
              <td>
                <input
                  type="number"
                  aria-label={`${config.driveRef} 优先级`}
                  value={draft.priority}
                  disabled={write.disabled}
                  onChange={(e) =>
                    patch(config, {
                      // 后端 priority 是 i32 ⇒ 非法输入回退原值，不发 NaN。
                      priority: parsePriorityInput(e.target.value, config.priority),
                    })
                  }
                />
              </td>
              <td className={styles.casHitCell}>
                <button
                  type="button"
                  className={styles.casHitCellBtn}
                  disabled={write.disabled || saving || !dirty}
                  onClick={() => onSave({ ...draft })}
                >
                  保存
                </button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
    </div>
  );
}

