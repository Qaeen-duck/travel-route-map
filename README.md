# 旅行路线可视化地图 · MVP

把一次旅行经历转成一张兼具手绘插画风格与真实空间关系的可视化地图。

## 当前进度

- [x] **P0-1 骨架**：画布 + 节点数据结构 + JSON 序列化/反序列化
- [x] **P0-2 核心链路**：POI 搜索 → 添加节点 → 按经纬度渲染 → 连线
- [x] **P0-3 AI 图标**：照片上传 → 图生图 → 四选一兜底
- [x] **P0-4 兜底**：内置图标库（自绘 SVG 占位素材）+ 用原图 + 纯文字节点
- [x] **P0-5 导出**：三种比例 PNG 导出，补白不拉伸
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

### 环境变量

在项目根目录建 `.env.local`（已被 .gitignore 忽略，不会提交）：

```
VITE_AMAP_KEY=你的高德Web服务Key
VITE_DASHSCOPE_API_KEY=sk-你的阿里云百炼Key
```

- **高德**：开放平台 → 应用管理 → 添加 Key → 服务平台选「Web服务」。
  IP 白名单留空（请求由 dev server 转发，来源是公网出口 IP），安全性靠日调用量上限兜底。
- **百炼**：控制台 → API-KEY，地域选华北2（北京）。模型 `qwen-image-3.0` 需已开通。
  **按成功生成张数计费，失败不计费**。建议在阿里云设费用预算告警。

## 数据存储边界（PRD 决策 3 · v1.2）

| 数据 | 存在哪 | 会被导出进 JSON 吗 |
|---|---|---|
| 地点名称 / 经纬度 / 日期 / 备注 / 路线顺序 | `store/projectStore.ts` | ✅ |
| 用户照片 / AI 生成图标 | `store/assetStore.ts`（会话内存） | ❌ |

图片只活在当前会话。刷新或换设备后图片丢失，节点回落到文字形态，
其余数据完整保留。这是 MVP 明确接受的取舍，持久化留到有真实用户需求时再做。

## 目录约定

```
src/
  types/project.ts              工程 JSON 类型（PRD 决策 1）
  types/poi.ts                  与服务商无关的 POI 候选项结构
  store/projectStore.ts         矢量数据（会导出）
  store/assetStore.ts           图片资产（不导出，仅会话内存）
  adapters/poiSearchAdapter.ts  POI 搜索接口抽象（决策 5）
  adapters/amapAdapter.ts       高德实现（v3 inputtips）
  adapters/imageGenAdapter.ts   图片生成接口抽象（决策 6）
  adapters/dashscopeAdapter.ts  百炼实现（qwen-image-3.0 同步接口）
  hooks/useDebouncedValue.ts    输入防抖
  hooks/useStickerImage.ts      抠白底 + 解码，产出可直接上画布的贴纸
  lib/projection.ts             经纬度 → 像素（d3-geo，含重叠微偏移）
  lib/projectIo.ts              JSON 导入导出 + 校验 + 数据自愈
  lib/order.ts                  按 route_order 排序
  lib/palette.ts                附录 A.1 色板（JS 侧，供 Konva）
  lib/paletteRef.ts             色板参考图，运行时用 canvas 现画（手段 H1）
  lib/iconPrompt.ts             固化 prompt 模板（手段 H3）
  lib/imageFile.ts              图片校验/缩放/取回/下载
  lib/iconLibrary.ts            内置图标库（自绘 SVG，附录 A.1 配色）
  components/IconLibraryPicker.tsx  图标库分类选择面板
  components/MapCanvas.tsx      画布
  components/MapNodeShape.tsx   单节点呈现（决策 4，三形态共用接口）
  components/PoiSearchBox.tsx   地点搜索
  components/AddNodeDialog.tsx  添加节点（含日期范围校验）
  components/NodeIconPanel.tsx  图标生成与四选一兜底
```

## 开发代理（仅 npm run dev 生效）

`vite.config.ts` 里配了三条：

- `/amap/*` → `restapi.amap.com`：高德 Web 服务 API 面向服务端，浏览器直连会被 CORS 拦
- `/dashscope/*` → `dashscope.aliyuncs.com`：同上
- `/imgproxy?url=...` → 由 dev server 代为下载生成图

第三条尤其关键：百炼返回的 OSS 图片链接是跨域的，跨域图片画进 canvas 会污染画布，
导致 P0-5 导出 PNG 时 `toDataURL()` 直接抛错。经代理取回后是同源 blob，画布干净。
只放行 `*.aliyuncs.com`，避免变成开放代理。

**上线部署需要等价的线上代理**（已记入 PRD 第九章开放项 9）。

## 已知依赖告警（有意保留）

`npm audit` 报 2 条（esbuild moderate + vite high），同一根因
[GHSA-67mh-4wv8-2f99](https://github.com/advisories/GHSA-67mh-4wv8-2f99)：
esbuild 开发服务器允许任意站点读取其响应。

**暂不修复**：仅影响 dev server，不影响构建产物；本项目不部署服务端；
npm 的修复方案是升到 vite@8，跨三个大版本，与 PRD 附录 B.1 锁定的 Vite 5 + React 18 冲突。
复评时机：P0 全部完成、进入 P1 时统一评估。
