import { FeedbackState } from '@fmby/v2-shared/ui';

interface PlaceholderPageProps {
  /** 页面标题（用于提示当前处于哪个页面） */
  title?: string;
}

/**
 * 极简占位页
 *
 * aurora-glass 皮肤各页面的临时占位组件。
 * 真实页面实现完成后，直接替换对应页面文件内容即可，路由无需改动。
 */
export function PlaceholderPage({ title = '页面建设中' }: PlaceholderPageProps) {
  return (
    <div
      style={{
        display: 'grid',
        placeItems: 'center',
        minHeight: '60vh',
        padding: 'var(--space-6, 24px)',
      }}
    >
      <FeedbackState
        variant="empty"
        title={title}
        description="该页面正在建设中，敬请期待。"
      />
    </div>
  );
}

/**
 * 生成具名占位组件的工厂
 * 各真实页面文件先 re-export 该工厂产物，保持导出名与最终实现一致。
 */
export function createPlaceholderPage(title: string) {
  function NamedPlaceholderPage() {
    return <PlaceholderPage title={title} />;
  }
  NamedPlaceholderPage.displayName = `Placeholder(${title})`;
  return NamedPlaceholderPage;
}
