import { useMemo, useRef, useState, type ChangeEvent } from 'react';
import MapCanvas from '@/components/MapCanvas';
import { orderNodes } from '@/lib/order';
import { downloadProjectJson, parseProjectFile, readFileAsText } from '@/lib/projectIo';
import { useProjectStore } from '@/store/projectStore';

/**
 * P0-1 外壳：顶部工具条（导出 / 导入 JSON）+ 左侧节点列表 + 右侧画布。
 * 这一版刻意不做视觉，只保证 PRD F1.3 / F1.4 / AC-14 / AC-15 这条数据闭环能被肉眼验证。
 */
export default function App() {
  const project = useProjectStore((s) => s.project);
  const notices = useProjectStore((s) => s.notices);
  const loadProject = useProjectStore((s) => s.loadProject);
  const clearNotices = useProjectStore((s) => s.clearNotices);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const ordered = useMemo(
    () => orderNodes(project.nodes, project.route_order),
    [project.nodes, project.route_order],
  );

  function handleExport(): void {
    downloadProjectJson(project);
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    // 先清空 input 的值，否则连续选同一个文件不会再次触发 change
    event.target.value = '';
    if (!file) {
      return;
    }

    // PRD 第六章「防误操作」：覆盖当前工程要二次确认
    const confirmed = window.confirm('导入会覆盖当前画布上的全部内容，确定继续吗？');
    if (!confirmed) {
      return;
    }

    setErrorMsg(null);
    clearNotices();

    try {
      const text = await readFileAsText(file);
      const result = parseProjectFile(text);
      if (!result.ok) {
        setErrorMsg(result.message);
        return;
      }
      loadProject(result.project, result.notices);
    } catch {
      setErrorMsg('文件读取失败了，请重新选择一次。');
    }
  }

  return (
    <div className="flex h-full w-full flex-col">
      {/* 顶部工具条 */}
      <header className="flex items-center gap-3 border-b border-softbrown/30 bg-cream px-5 py-3">
        <h1 className="mr-auto text-lg font-semibold text-inkbrown">
          {project.project.name}
          <span className="ml-3 text-sm font-normal text-inkbrown/60">
            {project.project.date_range.start} ~ {project.project.date_range.end}
          </span>
        </h1>

        <button
          type="button"
          onClick={handleExport}
          className="rounded-md bg-terracotta px-4 py-2 text-sm text-cream transition hover:bg-coral"
        >
          导出工程 JSON
        </button>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="rounded-md border border-softbrown px-4 py-2 text-sm text-inkbrown transition hover:bg-wash"
        >
          导入工程 JSON
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            void handleFileChange(e);
          }}
        />
      </header>

      {/* 错误提示：面向普通用户的人话文案，不出现技术字段名 */}
      {errorMsg ? (
        <div className="flex items-start gap-3 border-b border-terracotta/40 bg-terracotta/10 px-5 py-3 text-sm text-inkbrown">
          <span className="flex-1">{errorMsg}</span>
          <button type="button" className="underline" onClick={() => setErrorMsg(null)}>
            知道了
          </button>
        </div>
      ) : null}

      {/* 数据自愈提示 */}
      {notices.length > 0 ? (
        <div className="flex items-start gap-3 border-b border-mustard/50 bg-mustard/10 px-5 py-3 text-sm text-inkbrown">
          <ul className="flex-1 list-disc pl-5">
            {notices.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
          <button type="button" className="underline" onClick={clearNotices}>
            知道了
          </button>
        </div>
      ) : null}

      <main className="flex min-h-0 flex-1">
        {/* 左侧节点列表：P0-2 会在这里加拖拽排序（F6.2） */}
        <aside className="w-64 shrink-0 overflow-y-auto border-r border-softbrown/30 bg-cream/50 p-4">
          <h2 className="mb-3 text-sm font-semibold text-inkbrown/80">
            路线顺序（{ordered.length} 个地点）
          </h2>
          <ol className="space-y-2">
            {ordered.map((node, index) => (
              <li key={node.id} className="rounded-md bg-wash px-3 py-2 text-sm text-inkbrown">
                <div className="font-medium">
                  {index + 1}. {node.poi_name}
                </div>
                <div className="text-xs text-inkbrown/60">{node.visit_date}</div>
              </li>
            ))}
          </ol>
        </aside>

        <section className="min-w-0 flex-1">
          <MapCanvas />
        </section>
      </main>
    </div>
  );
}
