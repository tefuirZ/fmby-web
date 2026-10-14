import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { usePosterUrl, useBackdropUrl } from '@fmby/v2-shared/hooks/usePosterUrl';
import React, { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

/**
 * 真实组件渲染与 Hook 调用断言（证伪断言：若删掉 hook 或返回值异常，测试必红）
 */
describe('Artwork 智能降级链真实组件渲染与 Hook 调用断言', () => {
  it('真渲染组件并调用 usePosterUrl，初始产出非空 url', () => {
    let capturedUrl: string | null = null;
    let capturedOnError: (() => void) | null = null;

    function TestComponent() {
      const { url, onError } = usePosterUrl({
        posterUrl: 'https://img.test/poster.jpg',
        thumbUrl: 'https://img.test/thumb.jpg',
      });
      capturedUrl = url;
      capturedOnError = onError;
      return React.createElement('div', null, url);
    }

    const html = renderToStaticMarkup(React.createElement(TestComponent));
    assert.equal(capturedUrl, 'https://img.test/poster.jpg');
    assert.equal(typeof capturedOnError, 'function');
    assert.match(html, /https:\/\/img\.test\/poster\.jpg/);
  });

  it('真渲染组件并调用 useBackdropUrl，遵循 banner -> backdrop 优先级', () => {
    let capturedUrl: string | null = null;

    function TestBackdropComponent() {
      const { url } = useBackdropUrl({
        bannerUrl: 'https://img.test/banner.jpg',
        backdropUrl: 'https://img.test/backdrop.jpg',
      });
      capturedUrl = url;
      return React.createElement('div', null, url);
    }

    const html = renderToStaticMarkup(React.createElement(TestBackdropComponent));
    assert.equal(capturedUrl, 'https://img.test/banner.jpg');
    assert.match(html, /https:\/\/img\.test\/banner\.jpg/);
  });
});
