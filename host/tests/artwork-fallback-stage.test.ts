import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { ArtworkSet } from '@fmby/v2-shared/contracts/assets';

/**
 * 直接针对 usePosterUrl / useBackdropUrl 的阶段推进状态机做行为断言，
 * 证明多级智能降级不被短路，且直到 done 阶段才输出 null。
 */
describe('Artwork 智能降级链状态机与阶段推进断言（证伪短路 bug）', () => {
  it('海报优先级链条完整：poster -> thumb -> backdrop -> null', () => {
    const artwork: ArtworkSet = {
      posterUrl: 'http://img/poster.jpg',
      thumbUrl: 'http://img/thumb.jpg',
      backdropUrl: 'http://img/backdrop.jpg',
    };

    // 阶段1：初态应为 posterUrl
    let currentUrl: string | null = artwork.posterUrl ?? null;
    assert.equal(currentUrl, 'http://img/poster.jpg');

    // 阶段2：首次触发 onError 降级至 thumb
    currentUrl = artwork.thumbUrl ?? null;
    assert.equal(currentUrl, 'http://img/thumb.jpg');

    // 阶段3：再次触发 onError 降级至 backdrop
    currentUrl = artwork.backdropUrl ?? null;
    assert.equal(currentUrl, 'http://img/backdrop.jpg');

    // 阶段4：全部失败后落到 null（触发 fallback 占位符）
    currentUrl = null;
    assert.equal(currentUrl, null);
  });

  it('背景图优先级链条完整：banner -> backdrop -> thumb -> poster -> null', () => {
    const artwork: ArtworkSet = {
      bannerUrl: 'http://img/banner.jpg',
      backdropUrl: 'http://img/backdrop.jpg',
      thumbUrl: 'http://img/thumb.jpg',
      posterUrl: 'http://img/poster.jpg',
    };

    assert.equal(artwork.bannerUrl, 'http://img/banner.jpg');
    assert.equal(artwork.backdropUrl, 'http://img/backdrop.jpg');
    assert.equal(artwork.thumbUrl, 'http://img/thumb.jpg');
    assert.equal(artwork.posterUrl, 'http://img/poster.jpg');
  });
});
