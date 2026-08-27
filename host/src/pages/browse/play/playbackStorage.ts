const POSITION_KEY_PREFIX = 'fmby.playpos.';
const MAX_POSITION_SECONDS = 7 * 86400;
const MAX_AGE_MS = 30 * 86400_000;
const MAX_FUTURE_SKEW_MS = 5 * 60_000;

type StoredPosition = {
  position: number;
  updatedAt: number;
};

function isStoredPosition(value: unknown, now: number): value is StoredPosition {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const data = value as Record<string, unknown>;
  return (
    typeof data.position === 'number' &&
    Number.isFinite(data.position) &&
    data.position >= 0 &&
    data.position <= MAX_POSITION_SECONDS &&
    typeof data.updatedAt === 'number' &&
    Number.isFinite(data.updatedAt) &&
    data.updatedAt >= 0 &&
    data.updatedAt <= now + MAX_FUTURE_SKEW_MS
  );
}

export function saveLocalPosition(itemId: string, seconds: number) {
  const updatedAt = Date.now();
  if (!isStoredPosition({ position: seconds, updatedAt }, updatedAt)) return;
  try {
    localStorage.setItem(
      POSITION_KEY_PREFIX + itemId,
      JSON.stringify({ position: seconds, updatedAt }),
    );
  } catch {
    // quota exceeded — ignore
  }
}

export function readLocalPosition(itemId?: string): number | undefined {
  if (!itemId) return undefined;
  const key = POSITION_KEY_PREFIX + itemId;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return undefined;
    const data: unknown = JSON.parse(raw);
    const now = Date.now();
    if (!isStoredPosition(data, now)) {
      localStorage.removeItem(key);
      return undefined;
    }
    if (now - data.updatedAt > MAX_AGE_MS) {
      localStorage.removeItem(key);
      return undefined;
    }
    return data.position > 5 ? data.position : undefined;
  } catch {
    try {
      localStorage.removeItem(key);
    } catch {
      // storage unavailable — safely ignore
    }
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