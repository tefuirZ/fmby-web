import { useEffect, useState, type RefCallback } from 'react';

interface UseViewportTriggerOptions {
  enabled?: boolean;
  root?: Element | Document | null;
  rootMargin?: string;
  threshold?: number | number[];
}

export function useViewportTrigger<TElement extends Element = HTMLDivElement>({
  enabled = true,
  root = null,
  rootMargin = '0px',
  threshold = 0,
}: UseViewportTriggerOptions = {}) {
  const [target, setTarget] = useState<TElement | null>(null);
  const [isTriggered, setIsTriggered] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setIsTriggered(false);
      return;
    }

    if (!target || isTriggered) {
      return;
    }

    if (typeof IntersectionObserver === 'undefined') {
      setIsTriggered(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setIsTriggered(true);
          observer.disconnect();
        }
      },
      {
        root,
        rootMargin,
        threshold,
      },
    );

    observer.observe(target);

    return () => observer.disconnect();
  }, [enabled, isTriggered, root, rootMargin, target, threshold]);

  return {
    ref: setTarget as RefCallback<TElement>,
    isTriggered,
  };
}
