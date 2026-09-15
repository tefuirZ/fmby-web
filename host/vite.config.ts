import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

function guardUnexpectedWebSocketUpgrades(): Plugin {
  return {
    name: 'guard-unexpected-websocket-upgrades',
    configureServer(server) {
      return () => {
        if (!server.httpServer) {
          return;
        }

        // 必须在 Vite 完成内部 server/ws 初始化之后再包一层 upgrade 监听，
        // Vite 自己的 HMR 通道放行，其它第三方客户端误打的 WS 升级直接拒绝。
        const viteUpgradeListeners = server.httpServer.listeners('upgrade');
        if (viteUpgradeListeners.length === 0) {
          return;
        }

        server.httpServer.removeAllListeners('upgrade');
        server.httpServer.on('upgrade', (request, socket, head) => {
          const url = request.url ? new URL(request.url, 'http://localhost') : null;
          if (url?.pathname === '/__vite_hmr') {
            for (const listener of viteUpgradeListeners) {
              listener.call(server.httpServer, request, socket, head);
            }
            return;
          }

          socket.on('error', () => {});
          socket.write('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n');
          socket.destroy();
        });
      };
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const backend = env.FMBY_BACKEND ?? 'http://localhost:18098';

  return {
    base: '/',
    plugins: [react(), guardUnexpectedWebSocketUpgrades()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
        '@fmby/v2-shared': fileURLToPath(new URL('../shared/src', import.meta.url)),
      },
    },
    // workspace 源码包（shared / themes）不做依赖预打包：
    // 它们以 TS 源码直接进模块图，CSS Module 与 ?url 资源需走 Vite 自身管线。
    optimizeDeps: {
      exclude: ['@fmby/v2-shared', '@fmby/v2-theme-darkroom', '@fmby/v2-theme-template'],
    },
    server: {
      port: 5180,
      strictPort: false,
      hmr: {
        path: '/__vite_hmr',
      },
      proxy: {
        '/api': {
          target: backend,
          changeOrigin: true,
          ws: false,
          cookieDomainRewrite: {
            '*': '',
          },
          cookiePathRewrite: {
            '*': '/',
          },
          headers: {
            'x-requested-with': 'FMBY-Web',
          },
        },
        '/emby': {
          target: backend,
          changeOrigin: true,
          ws: false,
          cookieDomainRewrite: {
            '*': '',
          },
          cookiePathRewrite: {
            '*': '/',
          },
        },
        // THEME-BUILD-01/FE-OPT-01：主题运行时外挂产物（/themes/<id>/...）由
        // 后端静态面伺服——dev 模式同样代理到真实 server，保证主题激活链路
        // 在 dev 与生产行为一致。
        '/themes': {
          target: backend,
          changeOrigin: true,
          ws: false,
        },
      },
    },
    // WEB-E2E-FULL：真实 E2E 默认服务**已构建产物**（`host/dist`），对齐卡面
    // 「主仓二进制 + 前端 host/dist（已构建）」的真实栈口径。dev server 会开
    // React StrictMode 双调用（仅 dev），在 VideoPlayer 的异步挂载上暴露竞态
    // （实测：dev 下 <video> 不挂载；产物构建无此双调用 → 正常挂载）。
    // 需要热更新（调试 spec）时可 `FMBY_E2E_DEV=1` 回落 dev server。
    preview: {
      port: 5180,
      strictPort: true,
      proxy: {
        '/api': {
          target: backend,
          changeOrigin: true,
          ws: false,
          cookieDomainRewrite: {
            '*': '',
          },
          cookiePathRewrite: {
            '*': '/',
          },
          headers: {
            'x-requested-with': 'FMBY-Web',
          },
        },
        '/emby': {
          target: backend,
          changeOrigin: true,
          ws: false,
          cookieDomainRewrite: {
            '*': '',
          },
          cookiePathRewrite: {
            '*': '/',
          },
        },
      },
    },
    build: {
      // 生成 .vite/manifest.json：scripts/check-frontend-size.mjs 依据它
      // 计算入口静态闭包（首屏 JS）与主题 async chunk 的 gzip 体积红线。
      manifest: true,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (/[\\/]node_modules[\\/](react|react-dom|react-router|scheduler)[\\/]/.test(id)) {
                return 'react-vendor';
              }
              if (id.includes('@tanstack/react-query')) {
                return 'query';
              }
              return undefined;
            }
            return undefined;
          },
        },
      },
    },
  };
});
