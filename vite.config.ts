import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    port: 5173,
    open: true,
    /**
     * 高德 Web 服务 API 是给服务端调的，浏览器直接 fetch 会被 CORS 拦下来。
     * 这里用 Vite 自带的开发代理绕开：前端只请求同源的 /amap/xxx，
     * dev server 收到后原样转发到 https://restapi.amap.com/xxx。
     *
     * changeOrigin: true —— 转发时把 Host 头改成目标域名，否则高德会拒。
     * 注意：这只在 npm run dev 时生效。将来真要部署上线，需要一个等价的线上代理
     * （Vercel/Netlify 的 serverless function 或自己的 Node 服务），这条已记入 PRD 开放项。
     */
    proxy: {
      '/amap': {
        target: 'https://restapi.amap.com',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/amap/, ''),
      },
    },
  },
});
