const POSITION_KEY_PREFIX = 'fmby.playpos.';

export function saveLocalPosition(itemId: string, seconds: number) {
  try {
    localStorage.setItem(
      POSITION_KEY_PREFIX + itemId,
      JSON.stringify({
        position: seconds,
        updatedAt: Date.now(),
      }),
    );
  } catch {
    // quota exceeded — ignore
  }
}

export function readLocalPosition(itemId?: string): number | undefined {
  if (!itemId) return undefined;
  try {
    const raw = localStorage.getItem(POSITION_KEY_PREFIX + itemId);
    if (!raw) return undefined;
    const data = JSON.parse(raw) as { position?: number; updatedAt?: number };
    if (data.updatedAt && Date.now() - data.updatedAt > 30 * 86400_000) {
      localStorage.removeItem(POSITION_KEY_PREFIX + itemId);
      return undefined;
    }
    return typeof data.position === 'number' && data.position > 5
      ? data.position
      : undefined;
  } catch {
    return undefined;
  }
}

export function clearLocalPosition(itemId: string) {
  try {
    localStorage.removeItem(POSITION_KEY_PREFIX + itemId);
  } catch {
    // noop
  }
}