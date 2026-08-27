import { useEffect, useState } from 'react';
import { getOutputSize, renderMapToDataUrl } from '@/lib/exportImage';
import { downloadImage } from '@/lib/imageFile';
import { useAssetStore } from '@/store/assetStore';
import type { ExportRatio, TravelNode, TravelProject } from '@/types/project';

const RATIO_OPTIONS: ReadonlyArray<{ value: ExportRatio; label: string; hint: string }> = [
  { value: '3:4', label: '竖版 3:4', hint: '小红书' },
  { value: '1:1', label: '方图 1:1', hint: '朋友圈 / Ins' },
  { value: '4:3', label: '横图 4:3', hint: '横向展示' },
];

interface Props {
  project: TravelProject;
  nodes: readonly TravelNode[];
  onClose: () => void;
  onRatioUsed: (ratio: ExportRatio, titleOverride: string | null) => void;
}

/**
 * 导出面板（PRD F8 / AC-12 / AC-13）
 * 状态覆盖：编辑 → 导出中（全屏 loading，不允许操作画布）→ 完成（可继续导出其他比例）
 */
export default function ExportDialog({ project, nodes, onClose, onRatioUsed }: Props) {
  const assets = useAssetStore((s) => s.assets);

  const [title, setTitle] = useState(project.export_settings.title_override ?? project.project.name);
  const [ratio, setRatio] = useState<ExportRatio>(project.export_settings.last_used_ratio);
  const [pixelRatio, setPixelRatio] = useState(2);
  const [exporting, setExporting] = useState(false);
  const [doneRatios, setDoneRatios] = useState<ExportRatio[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Esc 关闭（PRD 第六章：基础键盘操作要通）。导出进行中不允许关，避免中途打断
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !exporting) {
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, exporting]);

  const size = getOutputSize(ratio, pixelRatio);

  async function handleExport(): Promise<void> {
    if (nodes.length === 0) {
      setErrorMsg('还没有地点，先添加几个地点再导出吧。');
      return;
    }
    setExporting(true);
    setErrorMsg(null);
    try {
      const { start, end } = project.project.date_range;
      const dateRangeText = start === end ? start : `${start} — ${end}`;
      const dataUrl = await renderMapToDataUrl({
        nodes,
        assets,
        title: title.trim().length > 0 ? title.trim() : project.project.name,
        dateRangeText,
        ratio,
        pixelRatio,
      });
      const safeName = title.trim().replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 40) || 'travel-map';
      downloadImage(dataUrl, `${safeName}_${ratio.replace(':', 'x')}.png`);

      setDoneRatios((prev) => (prev.includes(ratio) ? prev : [...prev, ratio]));
      onRatioUsed(ratio, title.trim() === project.project.name ? null : title.trim());
    } catch {
      setErrorMsg('导出图片时出问题了，再试一次吧。');
    } finally {
      setExporting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-inkbrown/40 p-4"
      onClick={() => {
        if (!exporting) {
          onClose();
        }
      }}
    >
      <div
        className="w-full max-w-md rounded-lg bg-cream p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-base font-semibold text-inkbrown">导出图片</h2>

        <label className="mb-1 block text-sm text-inkbrown">标题</label>
        <input
          type="text"
          value={title}
          maxLength={30}
          disabled={exporting}
          onChange={(e) => setTitle(e.target.value)}
          className="mb-4 w-full rounded-md border border-softbrown/50 bg-wash px-3 py-2 text-sm text-inkbrown outline-none focus:border-terracotta disabled:opacity-50"
        />

        <label className="mb-2 block text-sm text-inkbrown">比例</label>
        <div className="mb-4 grid grid-cols-3 gap-2">
          {RATIO_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              disabled={exporting}
              onClick={() => setRatio(opt.value)}
              className={`rounded-md border px-2 py-3 text-center transition disabled:opacity-50 ${
                ratio === opt.value
                  ? 'border-terracotta bg-terracotta/10'
                  : 'border-softbrown/40 hover:bg-wash'
              }`}
            >
              <div className="text-xs font-medium text-inkbrown">{opt.label}</div>
              <div className="mt-0.5 text-[10px] text-inkbrown/50">{opt.hint}</div>
              {doneRatios.includes(opt.value) ? (
                <div className="mt-1 text-[10px] text-sage">已导出</div>
              ) : null}
            </button>
          ))}
        </div>

        <label className="mb-2 block text-sm text-inkbrown">清晰度</label>
        <div className="mb-4 flex gap-2">
          {[2, 3].map((r) => (
            <button
              key={r}
              type="button"
              disabled={exporting}
              onClick={() => setPixelRatio(r)}
              className={`flex-1 rounded-md border px-3 py-2 text-xs transition disabled:opacity-50 ${
                pixelRatio === r
                  ? 'border-terracotta bg-terracotta/10 text-inkbrown'
                  : 'border-softbrown/40 text-inkbrown hover:bg-wash'
              }`}
            >
              {r}x
            </button>
          ))}
        </div>

        <p className="mb-4 text-xs text-inkbrown/40">
          输出尺寸 {size.w} × {size.h} 像素，PNG 格式，直接下载到本地
        </p>

        {errorMsg !== null ? (
          <p className="mb-3 rounded-md bg-terracotta/10 px-3 py-2 text-xs text-inkbrown">
            {errorMsg}
          </p>
        ) : null}

        {doneRatios.length > 0 && !exporting ? (
          <p className="mb-3 rounded-md bg-sage/15 px-3 py-2 text-xs text-inkbrown">
            已保存到下载。想要别的比例，换一个再点导出就行 —— 路线不会变形。
          </p>
        ) : null}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            disabled={exporting}
            onClick={onClose}
            className="rounded-md border border-softbrown px-4 py-2 text-sm text-inkbrown hover:bg-wash disabled:opacity-50"
          >
            {doneRatios.length > 0 ? '完成' : '取消'}
          </button>
          <button
            type="button"
            disabled={exporting}
            onClick={() => {
              void handleExport();
            }}
            className="flex items-center gap-2 rounded-md bg-terracotta px-4 py-2 text-sm text-cream hover:bg-coral disabled:opacity-60"
          >
            {exporting ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-cream/40 border-t-cream" />
            ) : null}
            {exporting ? '正在生成图片…' : '导出'}
          </button>
        </div>
      </div>
    </div>
  );
}
