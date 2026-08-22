import {
  getCachedSearchTermsDocument,
  normalizeAsciiCompact,
  normalizeKeyword,
} from './searchTerms';

export function matchKeyword(
  keyword: string,
  ...candidates: Array<string | null | undefined>
): boolean {
  const normalizedKeyword = normalizeKeyword(keyword);
  if (!normalizedKeyword) {
    return true;
  }

  const compactKeyword = normalizeAsciiCompact(normalizedKeyword);
  return candidates.some((candidate) =>
    matchKeywordCandidate(candidate, normalizedKeyword, compactKeyword),
  );
}

function matchKeywordCandidate(
  candidate: string | null | undefined,
  normalizedKeyword: string,
  compactKeyword: string,
): boolean {
  const text = candidate?.trim();
  if (!text) {
    return false;
  }

  const searchTerms = getCachedSearchTermsDocument(text);
  if (searchTerms.normalizedTexts.some((value) => value.includes(normalizedKeyword))) {
    return true;
  }

  if (!compactKeyword) {
    return false;
  }

  return (
    searchTerms.compactAsciiTerms.some((value) => value.includes(compactKeyword)) ||
    searchTerms.compactPinyinTerms.some((value) => value.includes(compactKeyword)) ||
    searchTerms.compactInitialTerms.some((value) => value.includes(compactKeyword))
  );
}
