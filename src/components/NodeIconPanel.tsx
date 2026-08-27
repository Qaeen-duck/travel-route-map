import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { dashscopeAdapter } from '@/adapters/dashscopeAdapter';
import { ImageGenError } from '@/adapters/imageGenAdapter';
import { checkPhotoFile, downloadImage, fileToScaledDataUrl } from '@/lib/imageFile';
import { getPaletteRefDataUrl } from '@/lib/paletteRef';
import { useAssetStore } from '@/store/assetStore';
import { useProjectStore } from '@/store/projectStore';
import type { TravelNode } from '@/types/project';

type GenStatus = 'idle' | 'generating' | 'done' | 'error';

interface Props {
  node: TravelNode;
  onClose: () => void;
}

/**
 * 节点图标面板（PRD F3 全节 / AC-5 ~ AC-8）
 *
 * 覆盖的状态：未生成 → 生成中（可取消）→ 生成成功 / 生成失败
 * 成功和失败都进「四选一兜底面板」（F3.5 / F3.6）：
 * 用这张 / 重新生成 / 换成图标库图标 / 直接用我的原图
 *
 * 关于串行生成（F 冲突处理「一次只生成一个」）：
 * 这个面板一次只对一个选中节点打开，天然就是串行的，不需要额外的队列。
 */
export default function NodeIconPanel({ node, onClose }: Props) {
  const assets = useAssetStore((s) => s.assets[node.id]);
  const setPhoto = useAssetStore((s) => s.setPhoto);
  const setIcon = useAssetStore((s) => s.setIcon);
  const updateNode = useProjectStore((s) => s.updateNode);

  const [status, setStatus] = useState<GenStatus>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  /** 刚生成出来、还没被用户「采用」的图 */
  const [preview, setPreview] = useState<string | null>(null);
  /** 镜像一份最新预览地址，供卸载时清理（state 会被闭包固化，ref 不会） */
  const previewRef = useRef<string | null>(null);
  previewRef.current = preview;
  const [photoError, setPhotoError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // 切换到别的节点时，把没被采用的预览图释放掉，别漏内存
  useEffect(() => {
    return () => {
      if (previewRef.current !== null) {
        URL.revokeObjectURL(previewRef.current);
      }
      abortRef.current?.abort();
    };
    // 只在卸载时执行，preview 的最新值由闭包捕获，这里不需要依赖它
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handlePhotoChange(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }
    setPhotoError(null);

    const checked = checkPhotoFile(file);
    if (!checked.ok) {
      setPhotoError(checked.message);
      return;
    }
    try {
      const dataUrl = await fileToScaledDataUrl(checked.file);
      setPhoto(node.id, dataUrl);
    } catch (error) {
      setPhotoError(error instanceof Error ? error.message : '这张照片处理失败了，换一张试试。');
    }
  }

  async function handleGenerate(): Promise<void> {
    setStatus('generating');
    setErrorMsg(null);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const result = await dashscopeAdapter.generateIcon({
        poiName: node.poi_name,
        photoDataUrl: assets?.photo ?? null,
        paletteRefDataUrl: getPaletteRefDataUrl(),
        signal: controller.signal,
      });
      // 上一张没采用的预览先释放
      if (preview !== null) {
        URL.revokeObjectURL(preview);
      }
      setPreview(result.blobUrl);
      setStatus('done');
    } catch (error) {
      // 用户主动点了取消：回到未生成态，不报错
      if (error instanceof DOMException && error.name === 'AbortError') {
        setStatus('idle');
        return;
      }
      setErrorMsg(
        error instanceof ImageGenError ? error.message : '生成图标时出问题了，请再试一次。',
      );
      setStatus('error');
    } finally {
      abortRef.current = null;
    }
  }

  /** 采用生成图（F3.5 用这张） */
  function handleAdopt(): void {
    if (preview === null) {
      return;
    }
    setIcon(node.id, preview);
    updateNode(node.id, { icon_type: 'ai_generated' });
    setPreview(null);
    setStatus('idle');
  }

  /** 直接用原图（F3.5 第四项） */
  function handleUseOriginalPhoto(): void {
    if (assets?.photo === undefined) {
      return;
    }
    setIcon(node.id, assets.photo);
    updateNode(node.id, { icon_type: 'user_photo' });
    setStatus('idle');
  }

  const hasPhoto = assets?.photo !== undefined;
  const generating = status === 'generating';
  /** 生成成功或失败都要展示兜底面板（F3.6：主观不满意也走同一个面板） */
  const showFallbackPanel = status === 'done' || status === 'error';

  return (
    <div className="flex h-full w-80 shrink-0 flex-col overflow-y-auto border-l border-softbrown/30 bg-cream/60 p-4">
      <div className="mb-3 flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-semibold text-inkbrown">{node.poi_name}</h2>
          <p className="text-xs text-inkbrown/50">{node.visit_date}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="关闭"
          className="rounded px-2 text-inkbrown/50 hover:text-inkbrown"
        >
          ✕
        </button>
      </div>

      {/* 当前图标 */}
      <section className="mb-4">
        <h3 className="mb-2 text-xs font-semibold text-inkbrown/70">当前图标</h3>
        {assets?.icon !== undefined ? (
          <img
            src={assets.icon}
            alt="当前图标"
            className="h-28 w-28 rounded-md border border-softbrown/30 bg-wash object-cover"
          />
        ) : (
          <p className="text-xs text-inkbrown/40">还没有图标，这个地点现在显示为文字</p>
        )}
      </section>

      {/* 照片上传（F2.2 / F2.4） */}
      <section className="mb-4">
        <h3 className="mb-2 text-xs font-semibold text-inkbrown/70">我的照片</h3>
        {hasPhoto ? (
          <img
            src={assets?.photo}
            alt="我上传的照片"
            className="mb-2 h-28 w-28 rounded-md border border-softbrown/30 object-cover"
          />
        ) : null}
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="rounded-md border border-softbrown px-3 py-1.5 text-xs text-inkbrown hover:bg-wash"
        >
          {hasPhoto ? '换一张照片' : '上传照片（选填）'}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            void handlePhotoChange(e);
          }}
        />
        {photoError !== null ? <p className="mt-2 text-xs text-terracotta">{photoError}</p> : null}
        <p className="mt-2 text-xs text-inkbrown/40">
          {hasPhoto
            ? 'AI 会拿你的照片重新画一张手绘风小图，保留主体轮廓，但不是照片滤镜'
            : '不上传也能生成，会根据地点名称画一张通用手绘小图'}
        </p>
      </section>

      {/* 生成区 */}
      <section className="mb-4">
        <h3 className="mb-2 text-xs font-semibold text-inkbrown/70">生成手绘图标</h3>

        {!generating ? (
          <button
            type="button"
            onClick={() => {
              void handleGenerate();
            }}
            className="w-full rounded-md bg-terracotta px-3 py-2 text-sm text-cream hover:bg-coral"
          >
            {status === 'idle' && assets?.icon !== undefined ? '重新生成' : '生成图标'}
          </button>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-inkbrown">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-softbrown/30 border-t-terracotta" />
              正在绘制，大约需要 10-20 秒…
            </div>
            <button
              type="button"
              onClick={() => abortRef.current?.abort()}
              className="w-full rounded-md border border-softbrown px-3 py-1.5 text-xs text-inkbrown hover:bg-wash"
            >
              取消
            </button>
          </div>
        )}
      </section>

      {/* 生成结果预览 */}
      {status === 'done' && preview !== null ? (
        <section className="mb-4">
          <h3 className="mb-2 text-xs font-semibold text-inkbrown/70">生成结果</h3>
          <img
            src={preview}
            alt="生成结果"
            className="mb-2 h-40 w-40 rounded-md border border-softbrown/30 bg-white object-contain"
          />
          <button
            type="button"
            onClick={() => downloadImage(preview, `${node.poi_name}-图标.png`)}
            className="text-xs text-inkbrown/60 underline hover:text-inkbrown"
          >
            保存这张图到本地
          </button>
        </section>
      ) : null}

      {/* 错误提示（AC-7） */}
      {status === 'error' && errorMsg !== null ? (
        <p className="mb-3 rounded-md bg-terracotta/10 px-3 py-2 text-xs text-inkbrown">{errorMsg}</p>
      ) : null}

      {/* 四选一兜底面板（F3.5 / F3.6 / AC-6 / AC-7 / AC-8） */}
      {showFallbackPanel ? (
        <section className="space-y-2 rounded-md border border-mustard/40 bg-mustard/10 p-3">
          <p className="text-xs text-inkbrown/70">
            {status === 'done' ? '不满意也没关系，随时换：' : '换个方式试试：'}
          </p>

          <button
            type="button"
            disabled={preview === null}
            onClick={handleAdopt}
            className="w-full rounded-md bg-terracotta px-3 py-1.5 text-xs text-cream disabled:cursor-not-allowed disabled:opacity-40 hover:bg-coral"
          >
            用这张
          </button>

          <button
            type="button"
            onClick={() => {
              void handleGenerate();
            }}
            className="w-full rounded-md border border-softbrown px-3 py-1.5 text-xs text-inkbrown hover:bg-wash"
          >
            重新生成
          </button>

          <button
            type="button"
            disabled
            title="图标库在下一阶段（P0-4）提供"
            className="w-full cursor-not-allowed rounded-md border border-softbrown/40 px-3 py-1.5 text-xs text-inkbrown/40"
          >
            换成图标库图标（P0-4 提供）
          </button>

          <button
            type="button"
            disabled={!hasPhoto}
            onClick={handleUseOriginalPhoto}
            className="w-full rounded-md border border-softbrown px-3 py-1.5 text-xs text-inkbrown disabled:cursor-not-allowed disabled:opacity-40 hover:bg-wash"
          >
            直接用我的原图
          </button>
        </section>
      ) : null}

      <p className="mt-auto pt-4 text-xs text-inkbrown/30">
        生成服务：{dashscopeAdapter.name} · {dashscopeAdapter.model}
      </p>
    </div>
  );
}
