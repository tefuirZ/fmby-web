import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Search, Film, Tv, Inbox } from 'lucide-react';
import { Link } from 'react-router';
import type { SearchResultItem } from '@fmby/v2-shared/contracts/browse/search';
import { useSearchOverlay } from '@fmby/v2-shared/viewmodels';
import { useDebounce } from '@fmby/v2-shared/hooks';
import { generatePlaceholderColor } from '@fmby/v2-shared/hooks/usePosterUrl';
import styles from './SearchOverlay.module.css';

interface SearchOverlayProps {
  open: boolean;
  onClose: () => void;
}

/**
 * 全局搜索覆盖层
 *
 * 全屏遮罩 + 居中输入框 + 实时结果，300ms 防抖，支持 Esc 关闭和点击遮罩关闭。
 * 暗房里覆盖层同样不做毛玻璃：遮罩直接把底层内容压黑，靠对比度而不是模糊
 * 把注意力收到输入框上，也避免把海报糊成一片彩色噪点。
 */
export function SearchOverlay({ open, onClose }: SearchOverlayProps) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const debouncedQuery = useDebounce(query.trim(), 300);

  // WEB-B1：搜索取数上移至 viewmodel。
  const search = useSearchOverlay({ keyword: debouncedQuery });

  // 打开时聚焦输入框
  useEffect(() => {
    if (open) {
      setQuery('');
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  }, [open]);

  // ESC 关闭
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose],
  );

  if (!open) return null;

  const results: SearchResultItem[] = search.data.results;
  const isSearching = search.data.isSearching;
  const hasQuery = debouncedQuery.length >= 2;
  const hasSearchError = search.state === 'error' || search.state === 'forbidden';

  // 按类型分组
  const grouped = groupResults(results);

  return (
    <div className={styles.overlay} onClick={handleOverlayClick} role="dialog" aria-label="全局搜索">
      <div className={styles.panel}>
        <div className={styles.searchInputWrap}>
          <Search size={20} className={styles.searchIcon} />
          <input
            ref={inputRef}
            className={styles.searchInput}
            placeholder="搜索电影、剧集，支持拼音首字母…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
          <span className={styles.shortcutHint}>ESC</span>
        </div>

        <div className={styles.results}>
          {!hasQuery ? (
            <div className={styles.statePanel}>
              <Search size={32} className={styles.stateIcon} />
              <div className={styles.stateTitle}>输入关键词开始搜索</div>
              <div className={styles.stateDescription}>
                支持中文标题、拼音全拼和拼音首字母搜索。
              </div>
            </div>
          ) : isSearching ? (
            <div className={styles.statePanel}>
              <Loader2 size={24} className={`${styles.stateIcon} ${styles.spin}`} />
              <div className={styles.stateTitle}>搜索中…</div>
            </div>
          ) : hasSearchError ? (
            <div className={styles.statePanel}>
              <Inbox size={32} className={styles.stateIcon} />
              <div className={styles.stateTitle}>搜索暂时失败</div>
              <div className={styles.stateDescription}>
                搜索接口没有正常返回，稍后再试，或检查服务端日志。
              </div>
            </div>
          ) : results.length === 0 ? (
            <div className={styles.statePanel}>
              <Inbox size={32} className={styles.stateIcon} />
              <div className={styles.stateTitle}>未找到匹配内容</div>
              <div className={styles.stateDescription}>
                试试换个关键词，或检查是否有对应内容已入库。
              </div>
            </div>
          ) : (
            <>
              {grouped.map((group) => (
                <div key={group.label} className={styles.resultGroup}>
                  <div className={styles.resultGroupTitle}>{group.label}</div>
                  {group.items.map((item) => (
                    <Link
                      key={item.id}
                      className={styles.resultItem}
                      to={`/item/${item.id}`}
                      onClick={onClose}
                    >
                      {item.posterUrl ? (
                        <img
                          className={styles.resultThumb}
                          src={item.posterUrl}
                          alt=""
                          loading="lazy"
                        />
                      ) : (
                        <div
                          className={styles.resultThumbPlaceholder}
                          style={{ background: generatePlaceholderColor(item.title) }}
                        >
                          {item.title.charAt(0)}
                        </div>
                      )}
                      <div className={styles.resultBody}>
                        <div className={styles.resultTitle}>{item.title}</div>
                        <div className={styles.resultMeta}>
                          {[item.kindLabel, item.year ? String(item.year) : undefined]
                            .filter(Boolean)
                            .join(' · ')}
                        </div>
                      </div>
                      <span className={styles.resultChip}>{item.kindLabel}</span>
                    </Link>
                  ))}
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

interface ResultGroup {
  label: string;
  icon: typeof Film;
  items: SearchResultItem[];
}

function groupResults(items: SearchResultItem[]): ResultGroup[] {
  const groups: Record<string, SearchResultItem[]> = {};

  for (const item of items) {
    const group = getGroupLabel(item.kind);
    if (!groups[group]) groups[group] = [];
    groups[group].push(item);
  }

  return Object.entries(groups)
    .sort(([leftLabel], [rightLabel]) => getGroupPriority(leftLabel) - getGroupPriority(rightLabel))
    .map(([label, groupItems]) => ({
      label,
      icon: label === '电影' ? Film : Tv,
      items: groupItems,
    }));
}

function getGroupLabel(kind: string): string {
  switch (kind.toLowerCase()) {
    case 'movie': return '电影';
    case 'series':
    case 'season':
    case 'episode': return '剧集';
    default: return '其他';
  }
}

function getGroupPriority(label: string): number {
  switch (label) {
    case '电影': return 0;
    case '剧集': return 1;
    default: return 2;
  }
}
