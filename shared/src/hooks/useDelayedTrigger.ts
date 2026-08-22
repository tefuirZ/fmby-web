import { useEffect, useState } from 'react';

interface UseDelayedTriggerOptions {
  delayMs: number;
  enabled?: boolean;
}

export function useDelayedTrigger({
  delayMs,
  enabled = true,
}: UseDelayedTriggerOptions) {
  const [isTriggered, setIsTriggered] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setIsTriggered(false);
      return;
    }

    if (isTriggered) {
      return;
    }

    const timerId = window.setTimeout(() => {
      setIsTriggered(true);
    }, delayMs);

    return () => window.clearTimeout(timerId);
  }, [delayMs, enabled, isTriggered]);

  return isTriggered;
}
