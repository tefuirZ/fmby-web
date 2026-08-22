import type { MediaCardSummary } from '@/domains/browse';
import { LandscapeMediaCard } from './LandscapeMediaCard';
import { PosterMediaCard } from './PosterMediaCard';

export function LibraryDetailMediaCard({ item }: { item: MediaCardSummary }) {
  if (item.kind === 'episode' || item.kind === 'video') {
    return <LandscapeMediaCard item={item} />;
  }

  return <PosterMediaCard item={item} />;
}
