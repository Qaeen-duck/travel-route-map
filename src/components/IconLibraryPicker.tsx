import { useMemo, useState } from 'react';
import {
  ICON_CATEGORIES,
  ICON_LIBRARY,
  iconToDataUrl,
  type IconCategory,
  type LibraryIcon,
} from '@/lib/iconLibrary';

interface Props {
  onPick: (icon: LibraryIcon) => void;
  onCancel: () => void;
}

/**
 * 图标库选择面板（PRD F4.3：支持按分类浏览）
 * 分类固定为 自然 / 美食 / 交通 / 地标 / 其他，与 PRD 一致。
 */
export default function IconLibraryPicker({ onPick, onCancel }: Props) {
  const [category, setCategory] = useState<IconCategory>('自然');

  const icons = useMemo(() => ICON_LIBRARY.filter((i) => i.category === category), [category]);

  return (
    <div className="rounded-md border border-softbrown/40 bg-wash p-3">
      <div className="mb-2 flex items-center gap-2">
        <h4 className="flex-1 text-xs font-semibold text-inkbrown/70">选一个图标</h4>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs text-inkbrown/50 underline hover:text-inkbrown"
        >
          收起
        </button>
      </div>

      {/* 分类切换 */}
      <div className="mb-3 flex flex-wrap gap-1">
        {ICON_CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategory(c)}
            className={`rounded px-2 py-1 text-xs transition ${
              c === category
                ? 'bg-terracotta text-cream'
                : 'border border-softbrown/40 text-inkbrown hover:bg-cream'
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-4 gap-2">
        {icons.map((icon) => (
          <button
            key={icon.id}
            type="button"
            title={icon.name}
            onClick={() => onPick(icon)}
            className="flex flex-col items-center gap-1 rounded-md border border-transparent bg-cream p-2 transition hover:border-terracotta"
          >
            <img src={iconToDataUrl(icon)} alt={icon.name} className="h-9 w-9" />
            <span className="text-[10px] text-inkbrown/60">{icon.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
