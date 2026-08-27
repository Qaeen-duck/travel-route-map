import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

/**
 * 开发期图片取回代理。
 *
 * 为什么需要它：百炼生成成功后返回的是阿里云 OSS 临时链接，浏览器直接 fetch 会被 CORS 拦，
 * 而且就算用 <img> 直接加载，跨域图片画进 canvas 会把画布「污染」（tainted），
 * 导致 P0-5 导出 PNG 时 toDataURL() 直接抛错 —— 那是整个产品的核心价值，不能留这个坑。
 *
 * 做法：由 dev server 代为下载再吐回来，前端拿到的就是同源图片，画布干净。
 * 只放行 aliyuncs.com 域名，避免变成一个任人使用的开放代理。
 */
function devImageProxy(): Plugin {
  return {
    name: 'dev-image-proxy',
    configureServer(server) {
      server.middlewares.use('/imgproxy', (req, res) => {
        const parsed = new URL(req.url ?? '', 'http://localhost');
        const target = parsed.searchParams.get('url');
        if (!target) {
          res.statusCode = 400;
          res.end('missing url');
          return;
        }
        let host = '';
        try {
          host = new URL(target).hostname;
        } catch {
          res.statusCode = 400;
          res.end('bad url');
          return;
        }
        if (!host.endsWith('.aliyuncs.com')) {
          res.statusCode = 403;
          res.end('host not allowed');
          return;
        }
        fetch(target)
          .then(async (upstream) => {
            const buf = new Uint8Array(await upstream.arrayBuffer());
            res.statusCode = upstream.status;
            res.setHeader('Content-Type', upstream.headers.get('content-type') ?? 'image/png');
            res.end(buf);
          })
          .catch(() => {
            res.statusCode = 502;
            res.end('fetch failed');
          });
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), devImageProxy()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    port: 5173,
    open: true,
    proxy: {
      // 高德 Web 服务 API（见 adapters/amapAdapter.ts）
      '/amap': {
        target: 'https://restapi.amap.com',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/amap/, ''),
      },
      // 阿里云百炼（见 adapters/dashscopeAdapter.ts）
      '/dashscope': {
        target: 'https://dashscope.aliyuncs.com',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/dashscope/, ''),
      },
    },
  },
});
