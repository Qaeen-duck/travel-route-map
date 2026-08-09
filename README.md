# 旅行路线可视化地图 · MVP

把一次旅行经历转成一张兼具手绘插画风格与真实空间关系的可视化地图。

## 当前进度

- [x] **P0-1 骨架**：画布 + 节点数据结构 + JSON 序列化/反序列化
- [ ] P0-2 核心链路：POI 搜索 → 添加节点 → 连线
- [ ] P0-3 AI 图生图图标
- [ ] P0-4 图标库兜底
- [ ] P0-5 三比例导出
- [ ] P0-6 IndexedDB 本地缓存
- [ ] P1 视觉打磨

## 技术栈

Vite 5 + React 18 + TypeScript（strict）+ Tailwind 3 + Zustand + Konva/react-konva + d3-geo

## 本地运行

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # 类型检查 + 构建
```

## 目录约定

```
src/
  types/project.ts     工程 JSON 的 TypeScript 类型（对应 PRD 决策 1）
  store/projectStore.ts  Zustand 全局状态，单一 project 对象
  lib/projection.ts    经纬度 → 像素坐标（d3-geo geoMercator，纯函数）
  lib/projectIo.ts     JSON 导入导出 + 校验 + 数据自愈
  lib/order.ts         按 route_order 排序节点
  lib/palette.ts       附录 A.1 色板的 JS 副本（供 Konva 使用）
  components/MapCanvas.tsx  Konva 画布
```

## 已知依赖告警（有意保留）

`npm audit` 会报 2 条漏洞（esbuild moderate + vite high），二者同一根因：
[GHSA-67mh-4wv8-2f99](https://github.com/advisories/GHSA-67mh-4wv8-2f99)，
即 esbuild 开发服务器允许任意站点读取其响应。

**决定：暂不修复。** 理由：
1. 仅影响 `npm run dev` 开发服务器，不影响 `npm run build` 产物；
2. 本项目为纯前端、不部署服务端，dev server 只监听本机；
3. npm 给出的修复方案是升级到 vite@8，跨三个大版本，与 PRD 附录 B.1 锁定的
   Vite 5 + React 18 冲突，改动风险远大于收益。

复评时机：P0 全部完成、进入 P1 打磨阶段时统一评估依赖升级。
