import { pinyin } from 'pinyin-pro';

const MAX_SEGMENT_VARIANTS = 8;
const MAX_DOCUMENT_CACHE_SIZE = 4096;
const CACHE_KEY_SEPARATOR = '\u0001';

interface SearchTermSegment {
  compactPinyin: string;
  compactInitials: string;
}

export interface SearchTermsDocument {
  normalizedTexts: string[];
  compactAsciiTerms: string[];
  compactPinyinTerms: string[];
  compactInitialTerms: string[];
}

const documentCache = new Map<string, SearchTermsDocument>();
const charOptionCache = new Map<string, SearchTermSegment[]>();

export class SearchTermsFactory {
  static fromOptionalFields(
    fields: Array<string | null | undefined>,
  ): SearchTermsDocument {
    const normalizedTexts = new Set<string>();
    const compactAsciiTerms = new Set<string>();
    const compactPinyinTerms = new Set<string>();
    const compactInitialTerms = new Set<string>();

    for (const field of fields) {
      const normalizedText = normalizeKeyword(field ?? '');
      if (!normalizedText) {
        continue;
      }

      normalizedTexts.add(normalizedText);

      const compactAscii = normalizeAsciiCompact(normalizedText);
      if (compactAscii) {
        compactAsciiTerms.add(compactAscii);
      }

      for (const segment of buildSearchTermSegments(normalizedText)) {
        if (segment.compactPinyin) {
          compactPinyinTerms.add(segment.compactPinyin);
        }
        if (segment.compactInitials) {
          compactInitialTerms.add(segment.compactInitials);
        }
      }
    }

    return {
      normalizedTexts: Array.from(normalizedTexts),
      compactAsciiTerms: Array.from(compactAsciiTerms),
      compactPinyinTerms: Array.from(compactPinyinTerms),
      compactInitialTerms: Array.from(compactInitialTerms),
    };
  }
}

export function getCachedSearchTermsDocument(
  ...fields: Array<string | null | undefined>
): SearchTermsDocument {
  const cacheKey = fields
    .map((field) => normalizeKeyword(field ?? ''))
    .join(CACHE_KEY_SEPARATOR);

  const cached = documentCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const next = SearchTermsFactory.fromOptionalFields(fields);
  documentCache.set(cacheKey, next);
  trimCache(documentCache, MAX_DOCUMENT_CACHE_SIZE);
  return next;
}

export function normalizeKeyword(value: string): string {
  return value.trim().toLowerCase();
}

export function normalizeAsciiCompact(value: string): string {
  return normalizeKeyword(value).replace(/[^a-z0-9]/g, '');
}

function buildSearchTermSegments(value: string): SearchTermSegment[] {
  if (!value) {
    return [];
  }

  let variants: SearchTermSegment[] = [{ compactPinyin: '', compactInitials: '' }];
  let asciiToken = '';

  for (const ch of value) {
    if (isAsciiAlphaNumeric(ch)) {
      asciiToken += ch.toLowerCase();
      continue;
    }

    flushAsciiTokenToVariants(asciiToken, variants);
    asciiToken = '';

    const options = getCharOptions(ch);
    if (options.length === 0) {
      continue;
    }

    variants = expandVariants(variants, options);
    if (variants.length === 0) {
      return [];
    }
  }

  flushAsciiTokenToVariants(asciiToken, variants);

  return variants.filter(
    (variant) => Boolean(variant.compactPinyin) && Boolean(variant.compactInitials),
  );
}

function flushAsciiTokenToVariants(
  asciiToken: string,
  variants: SearchTermSegment[],
): void {
  if (!asciiToken) {
    return;
  }

  const asciiInitials = /\d/.test(asciiToken)
    ? asciiToken
    : asciiToken.charAt(0);

  for (const variant of variants) {
    variant.compactPinyin += asciiToken;
    variant.compactInitials += asciiInitials;
  }
}

function getCharOptions(ch: string): SearchTermSegment[] {
  const cached = charOptionCache.get(ch);
  if (cached) {
    return cached;
  }

  const pinyinOptions = asStringArray(
    pinyin(ch, {
      type: 'array',
      toneType: 'none',
      nonZh: 'removed',
      multiple: true,
    }),
  )
    .map(normalizeAsciiCompact)
    .filter(Boolean);
  const initialOptions = asStringArray(
    pinyin(ch, {
      type: 'array',
      toneType: 'none',
      pattern: 'first',
      nonZh: 'removed',
      multiple: true,
    }),
  )
    .map(normalizeAsciiCompact)
    .filter(Boolean);

  const dedup = new Set<string>();
  const pairs: SearchTermSegment[] = [];
  for (let index = 0; index < pinyinOptions.length; index += 1) {
    const compactPinyin = pinyinOptions[index];
    const compactInitials = initialOptions[index] ?? compactPinyin.charAt(0);
    if (!compactPinyin || !compactInitials) {
      continue;
    }

    const dedupKey = `${compactPinyin}:${compactInitials}`;
    if (dedup.has(dedupKey)) {
      continue;
    }
    dedup.add(dedupKey);
    pairs.push({ compactPinyin, compactInitials });
    if (pairs.length >= MAX_SEGMENT_VARIANTS) {
      break;
    }
  }

  charOptionCache.set(ch, pairs);
  trimCache(charOptionCache, MAX_DOCUMENT_CACHE_SIZE);
  return pairs;
}

function expandVariants(
  currentVariants: SearchTermSegment[],
  options: SearchTermSegment[],
): SearchTermSegment[] {
  const expanded: SearchTermSegment[] = [];
  const dedup = new Set<string>();

  for (const variant of currentVariants) {
    for (const option of options) {
      const next = {
        compactPinyin: `${variant.compactPinyin}${option.compactPinyin}`,
        compactInitials: `${variant.compactInitials}${option.compactInitials}`,
      };
      const dedupKey = `${next.compactPinyin}:${next.compactInitials}`;
      if (dedup.has(dedupKey)) {
        continue;
      }
      dedup.add(dedupKey);
      expanded.push(next);
      if (expanded.length >= MAX_SEGMENT_VARIANTS) {
        return expanded;
      }
    }
  }

  return expanded;
}

function trimCache<TKey, TValue>(
  cache: Map<TKey, TValue>,
  limit: number,
): void {
  while (cache.size > limit) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey === undefined) {
      return;
    }
    cache.delete(oldestKey);
  }
}

function isAsciiAlphaNumeric(ch: string): boolean {
  return /^[a-z0-9]$/i.test(ch);
}

function asStringArray(value: string | string[]): string[] {
  return Array.isArray(value) ? value : value ? [value] : [];
}
