import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefCallback } from 'react';

interface HoverWheelScrollBindings<T extends HTMLElement> {
  ref: RefCallback<T>;
}

interface HoverWheelScrollOptions {
  delayMs?: number;
  axis?: 'x' | 'y';
}

export function useHoverWheelScroll<T extends HTMLElement>(
  options: number | HoverWheelScrollOptions = 50,
) {
  const delayMs = typeof options === 'number' ? options : options.delayMs ?? 50;
  const axis = typeof options === 'number' ? 'x' : options.axis ?? 'x';
  const [container, setContainer] = useState<T | null>(null);
  const timerRef = useRef<number | null>(null);
  const scrollingTimerRef = useRef<number | null>(null);
  const hoveredRef = useRef(false);
  const enterTimeRef = useRef(0);
  const enabledRef = useRef(false);
  const [enabled, setEnabled] = useState(false);
  const scrollingRef = useRef(false);
  const [scrolling, setScrolling] = useState(false);

  const setEnabledState = useCallback((next: boolean) => {
    enabledRef.current = next;
    setEnabled((prev) => (prev === next ? prev : next));
  }, []);

  const setScrollingState = useCallback((next: boolean) => {
    scrollingRef.current = next;
    setScrolling((prev) => (prev === next ? prev : next));
  }, []);

  const clearEnableTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const clearScrollingTimer = useCallback(() => {
    if (scrollingTimerRef.current !== null) {
      window.clearTimeout(scrollingTimerRef.current);
      scrollingTimerRef.current = null;
    }
  }, []);

  const enableWheelScroll = useCallback(() => {
    clearEnableTimer();
    setEnabledState(true);
  }, [clearEnableTimer, setEnabledState]);

  const scheduleEnable = useCallback(() => {
    clearEnableTimer();
    if (delayMs <= 0) {
      setEnabledState(true);
      return;
    }
    timerRef.current = window.setTimeout(() => {
      if (hoveredRef.current) {
        setEnabledState(true);
      }
      timerRef.current = null;
    }, delayMs);
  }, [clearEnableTimer, delayMs, setEnabledState]);

  const disableWheelScroll = useCallback(() => {
    clearEnableTimer();
    setEnabledState(false);
  }, [clearEnableTimer, setEnabledState]);

  const markWheelScrolling = useCallback(() => {
    clearScrollingTimer();
    setScrollingState(true);
    scrollingTimerRef.current = window.setTimeout(() => {
      setScrollingState(false);
      scrollingTimerRef.current = null;
    }, 140);
  }, [clearScrollingTimer, setScrollingState]);

  const stopWheelScrolling = useCallback(() => {
    clearScrollingTimer();
    setScrollingState(false);
  }, [clearScrollingTimer, setScrollingState]);

  useEffect(
    () => () => {
      hoveredRef.current = false;
      disableWheelScroll();
      stopWheelScrolling();
    },
    [disableWheelScroll, stopWheelScrolling],
  );

  useEffect(() => {
    if (!container) {
      return;
    }

    const handlePointerEnter = () => {
      hoveredRef.current = true;
      enterTimeRef.current = performance.now();
      scheduleEnable();
    };

    const handlePointerLeave = () => {
      hoveredRef.current = false;
      disableWheelScroll();
      stopWheelScrolling();
    };

    const handleWheel = (event: WheelEvent) => {
      if (!hoveredRef.current) {
        return;
      }

      if (!enabledRef.current) {
        const hoveredFor = performance.now() - enterTimeRef.current;
        if (hoveredFor < delayMs) {
          return;
        }
        enableWheelScroll();
      }

      const delta = normalizeWheelDelta(event, axis, container);
      if (delta === 0) {
        return;
      }

      const currentOffset = axis === 'y' ? container.scrollTop : container.scrollLeft;
      const maxOffset =
        axis === 'y'
          ? Math.max(0, container.scrollHeight - container.clientHeight)
          : Math.max(0, container.scrollWidth - container.clientWidth);
      if (maxOffset <= 0) {
        return;
      }

      const nextOffset = Math.max(0, Math.min(maxOffset, currentOffset + delta));
      if (Math.abs(nextOffset - currentOffset) < 1) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      markWheelScrolling();
      if (axis === 'y') {
        container.scrollTop = nextOffset;
      } else {
        container.scrollLeft = nextOffset;
      }
    };

    container.addEventListener('pointerenter', handlePointerEnter);
    container.addEventListener('pointerleave', handlePointerLeave);
    container.addEventListener('wheel', handleWheel, { passive: false });
    if (container.matches(':hover')) {
      scheduleEnable();
    }

    return () => {
      container.removeEventListener('pointerenter', handlePointerEnter);
      container.removeEventListener('pointerleave', handlePointerLeave);
      container.removeEventListener('wheel', handleWheel);
      hoveredRef.current = false;
      clearEnableTimer();
      clearScrollingTimer();
      setEnabledState(false);
      setScrollingState(false);
    };
  }, [
    axis,
    clearEnableTimer,
    clearScrollingTimer,
    container,
    delayMs,
    disableWheelScroll,
    enableWheelScroll,
    markWheelScrolling,
    scheduleEnable,
    setEnabledState,
    setScrollingState,
    stopWheelScrolling,
  ]);

  const ref = useCallback<RefCallback<T>>((node) => {
    setContainer(node);
  }, []);

  return {
    enabled,
    scrolling,
    bindings: {
      ref,
    } satisfies HoverWheelScrollBindings<T>,
  };
}

function normalizeWheelDelta(
  event: WheelEvent,
  axis: 'x' | 'y',
  container: HTMLElement,
) {
  let delta = 0;

  if (axis === 'x') {
    delta =
      Math.abs(event.deltaX) > Math.abs(event.deltaY) && event.deltaX !== 0
        ? event.deltaX
        : event.deltaY !== 0
          ? event.deltaY
          : event.deltaX;
  } else {
    delta =
      Math.abs(event.deltaY) >= Math.abs(event.deltaX) && event.deltaY !== 0
        ? event.deltaY
        : event.deltaX;
  }

  if (delta === 0) {
    return 0;
  }

  switch (event.deltaMode) {
    case WheelEvent.DOM_DELTA_LINE:
      return delta * 18;
    case WheelEvent.DOM_DELTA_PAGE:
      return delta * (axis === 'y' ? container.clientHeight : container.clientWidth);
    default:
      return delta;
  }
}
