import styles from '../../ManageNamingRulesPage.module.css';

export function NamingRulesSignalGrid() {
  return (
    <div className={styles.signalGrid}>
      <div className={styles.signalCard}>
        <div className={styles.signalEyebrow}>规则链路</div>
        <strong>保存后新规则直接进入 `identify` 输入快照</strong>
        <p>
          后续重新请求识别、重新入队的旧任务都会带着新的 `rule_pack_version`
          和命名证据重新计算指纹，不会继续复用旧规则的残留结果。
        </p>
      </div>
      <div className={styles.signalCard}>
        <div className={styles.signalEyebrow}>运营方式</div>
        <strong>默认词做底盘，自定义词和保留词做业务收口</strong>
        <p>
          默认噪音词适合画质/编码/容器，自定义词适合字幕组、来源尾巴、内部命名规范；保留词负责兜住误杀。
        </p>
      </div>
    </div>
  );
}
