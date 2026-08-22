import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import manifest from './manifest.json';

function guardUnexpectedWebSocketUpgrades(): Plugin {
  return {
    name: 'guard-unexpected-websocket-upgrades',
    configureServer(server) {
      return () => {
        if (!server.httpServer) {
          return;
        }

        const viteUpgradeListeners = server.httpServer.listeners('upgrade');
        if (viteUpgradeListeners.length === 0) {
          return;
        }

        // 必须在 Vite 完成内部 server/ws 初始化之后再包一层 upgrade 监听，
        // Vite 自己的 HMR 通道放行，其它第三方客户端误打的 WS 升级直接拒绝。
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
    // 生产构建资源必须挂在 /_assets/{skin-name}/ 下（contract skin-package/build-output.md）
    base: mode === 'production' ? `/_assets/${manifest.name}/` : '/',
    plugins: [react(), guardUnexpectedWebSocketUpgrades()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
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
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            'react-vendor': ['react', 'react-dom', 'react-router'],
            query: ['@tanstack/react-query'],
          },
        },
      },
    },
  };
});
