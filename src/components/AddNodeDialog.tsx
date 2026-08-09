import { useEffect, useState } from 'react';
import type { PoiCandidate } from '@/types/poi';
import type { DateRange } from '@/types/project';

/** PRD F2.4 的字段边界 */
const MAX_NAME_LEN = 30;
const MAX_NOTE_LEN = 100;

interface Props {
  candidate: PoiCandidate;
  dateRange: DateRange;
  onCancel: () => void;
  onConfirm: (payload: { poiName: string; visitDate: string; note: string }) => void;
}

/**
 * 添加节点弹窗（PRD F2.2 / F2.4 / AC-11）
 *
 * 校验规则：
 * - 名称必填、≤30 字（允许用户改，因为高德返回的官方名可能太长或不是用户的叫法）
 * - 到达日期必须落在旅行日期范围内，否则阻止保存
 * - 备注 ≤100 字
 * 经纬度来自搜索结果，只读展示，不允许手改（F2.2 硬要求）
 */
export default function AddNodeDialog({ candidate, dateRange, onCancel, onConfirm }: Props) {
  const [poiName, setPoiName] = useState(candidate.name.slice(0, MAX_NAME_LEN));
  const [visitDate, setVisitDate] = useState(dateRange.start);
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<{ name?: string; date?: string }>({});

  // Esc 关闭（PRD 第六章：基础键盘操作要通）
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  function handleSubmit(): void {
    const nextErrors: { name?: string; date?: string } = {};

    const trimmedName = poiName.trim();
    if (trimmedName.length === 0) {
      nextErrors.name = '请给这个地点起个名字';
    } else if (trimmedName.length > MAX_NAME_LEN) {
      nextErrors.name = `名字太长了，最多 ${MAX_NAME_LEN} 个字`;
    }

    if (visitDate.length === 0) {
      nextErrors.date = '请选择到达日期';
    } else if (visitDate < dateRange.start || visitDate > dateRange.end) {
      // AC-11：日期不在旅行范围内，弹提示并阻止保存
      nextErrors.date = `这个日期不在你的旅行期间（${dateRange.start} 到 ${dateRange.end}），请改一下`;
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    onConfirm({ poiName: trimmedName, visitDate, note: note.trim().slice(0, MAX_NOTE_LEN) });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-inkbrown/40 p-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded-lg bg-cream p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-1 text-base font-semibold text-inkbrown">添加地点</h2>
        <p className="mb-4 text-xs text-inkbrown/50">
          {candidate.district}
          {candidate.address ? ` · ${candidate.address}` : ''}
        </p>

        <label className="mb-1 block text-sm text-inkbrown">地点名称</label>
        <input
          type="text"
          value={poiName}
          maxLength={MAX_NAME_LEN}
          onChange={(e) => setPoiName(e.target.value)}
          className="mb-1 w-full rounded-md border border-softbrown/50 bg-wash px-3 py-2 text-sm text-inkbrown outline-none focus:border-terracotta"
        />
        {errors.name ? <p className="mb-2 text-xs text-terracotta">{errors.name}</p> : <div className="mb-3" />}

        <label className="mb-1 block text-sm text-inkbrown">到达日期</label>
        <input
          type="date"
          value={visitDate}
          min={dateRange.start}
          max={dateRange.end}
          onChange={(e) => setVisitDate(e.target.value)}
          className="mb-1 w-full rounded-md border border-softbrown/50 bg-wash px-3 py-2 text-sm text-inkbrown outline-none focus:border-terracotta"
        />
        {errors.date ? <p className="mb-2 text-xs text-terracotta">{errors.date}</p> : <div className="mb-3" />}

        <label className="mb-1 block text-sm text-inkbrown">
          备注 <span className="text-inkbrown/40">（选填，{note.length}/{MAX_NOTE_LEN}）</span>
        </label>
        <textarea
          value={note}
          maxLength={MAX_NOTE_LEN}
          rows={2}
          onChange={(e) => setNote(e.target.value)}
          className="mb-4 w-full resize-none rounded-md border border-softbrown/50 bg-wash px-3 py-2 text-sm text-inkbrown outline-none focus:border-terracotta"
        />

        {/* 经纬度只读展示，让用户对「位置是真的」有感知，但不给改（F2.2） */}
        <p className="mb-4 text-xs text-inkbrown/40">
          坐标 {candidate.lat.toFixed(4)}, {candidate.lng.toFixed(4)}（来自地图服务，不可修改）
        </p>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-softbrown px-4 py-2 text-sm text-inkbrown hover:bg-wash"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="rounded-md bg-terracotta px-4 py-2 text-sm text-cream hover:bg-coral"
          >
            添加到路线
          </button>
        </div>
      </div>
    </div>
  );
}
