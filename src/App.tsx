import { useMemo, useRef, useState, type ChangeEvent } from 'react';
import AddNodeDialog from '@/components/AddNodeDialog';
import MapCanvas from '@/components/MapCanvas';
import NodeIconPanel from '@/components/NodeIconPanel';
import PoiSearchBox from '@/components/PoiSearchBox';
import { createId, downloadProjectJson, parseProjectFile, readFileAsText } from '@/lib/projectIo';
import { orderNodes } from '@/lib/order';
import { useAssetStore } from '@/store/assetStore';
import { useProjectStore } from '@/store/projectStore';
import type { PoiCandidate } from '@/types/poi';
import type { TravelNode } from '@/types/project';

/**
 * 应用外壳：顶部旅行信息 + 工具条，左侧搜索与路线列表，中间画布，右侧图标面板。
 */
export default function App() {
  const project = useProjectStore((s) => s.project);
  const notices = useProjectStore((s) => s.notices);
  const loadProject = useProjectStore((s) => s.loadProject);
  const clearNotices = useProjectStore((s) => s.clearNotices);
  const updateTripMeta = useProjectStore((s) => s.updateTripMeta);
  const addNode = useProjectStore((s) => s.addNode);
  const removeNode = useProjectStore((s) => s.removeNode);
  const dropNodeAssets = useAssetStore((s) => s.dropNode);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [pendingCandidate, setPendingCandidate] = useState<PoiCandidate | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const ordered = useMemo(
    () => orderNodes(project.nodes, project.route_order),
    [project.nodes, project.route_order],
  );

  const selectedNode = useMemo(
    () => project.nodes.find((n) => n.id === selectedNodeId) ?? null,
    [project.nodes, selectedNodeId],
  );

  function handleExport(): void {
    downloadProjectJson(project);
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }
    if (!window.confirm('导入会覆盖当前画布上的全部内容，确定继续吗？')) {
      return;
    }
    setErrorMsg(null);
    clearNotices();
    setSelectedNodeId(null);
    try {
      const text = await readFileAsText(file);
      const result = parseProjectFile(text);
      if (!result.ok) {
        setErrorMsg(result.message);
        return;
      }
      // v1.2 决策 3：图片不进 JSON，所以导入后原本有图的节点会没有图，这里明确告知
      const withIcon = result.project.nodes.filter((n) => n.icon_type !== 'text_only').length;
      const notes = [...result.notices];
      if (withIcon > 0) {
        notes.push(
          `有 ${withIcon} 个地点原来配了图片。图片不会保存在工程文件里，需要重新上传照片或重新生成图标。`,
        );
      }
      loadProject(result.project, notes);
    } catch {
      setErrorMsg('文件读取失败了，请重新选择一次。');
    }
  }

  function handleConfirmAdd(payload: { poiName: string; visitDate: string; note: string }): void {
    if (!pendingCandidate) {
      return;
    }
    const node: TravelNode = {
      id: createId('node'),
      poi_name: payload.poiName,
      lat: pendingCandidate.lat,
      lng: pendingCandidate.lng,
      visit_date: payload.visitDate,
      // v1.2 决策 3：图片资产不进工程数据，这两个字段固定为 null
      user_photo: null,
      icon_type: 'text_only',
      icon_asset: null,
      note: payload.note,
    };
    addNode(node);
    setPendingCandidate(null);
    // 新加的节点直接选中，用户可以马上给它配图
    setSelectedNodeId(node.id);
  }

  function handleRemove(node: TravelNode): void {
    if (window.confirm(`确定删除「${node.poi_name}」吗？`)) {
      removeNode(node.id);
      dropNodeAssets(node.id);
      if (selectedNodeId === node.id) {
        setSelectedNodeId(null);
      }
    }
  }

  const { date_range: dateRange } = project.project;
  const dateRangeInvalid = dateRange.start > dateRange.end;

  return (
    <div className="flex h-full w-full flex-col">
      <header className="flex flex-wrap items-center gap-3 border-b border-softbrown/30 bg-cream px-5 py-3">
        <input
          type="text"
          value={project.project.name}
          maxLength={30}
          onChange={(e) => updateTripMeta({ name: e.target.value })}
          className="rounded-md border border-transparent bg-transparent px-2 py-1 text-lg font-semibold text-inkbrown outline-none hover:border-softbrown/30 focus:border-terracotta"
        />
        <div className="flex items-center gap-2 text-sm text-inkbrown/70">
          <input
            type="date"
            value={dateRange.start}
            onChange={(e) => updateTripMeta({ date_range: { ...dateRange, start: e.target.value } })}
            className="rounded-md border border-softbrown/40 bg-wash px-2 py-1 outline-none focus:border-terracotta"
          />
          <span>至</span>
          <input
            type="date"
            value={dateRange.end}
            onChange={(e) => updateTripMeta({ date_range: { ...dateRange, end: e.target.value } })}
            className="rounded-md border border-softbrown/40 bg-wash px-2 py-1 outline-none focus:border-terracotta"
          />
        </div>

        <div className="ml-auto flex gap-2">
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
        </div>

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

      {dateRangeInvalid ? (
        <div className="border-b border-terracotta/40 bg-terracotta/10 px-5 py-2 text-sm text-inkbrown">
          结束日期比开始日期还早，请调整一下旅行时间。
        </div>
      ) : null}

      {errorMsg ? (
        <div className="flex items-start gap-3 border-b border-terracotta/40 bg-terracotta/10 px-5 py-3 text-sm text-inkbrown">
          <span className="flex-1">{errorMsg}</span>
          <button type="button" className="underline" onClick={() => setErrorMsg(null)}>
            知道了
          </button>
        </div>
      ) : null}

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
        <aside className="flex w-72 shrink-0 flex-col border-r border-softbrown/30 bg-cream/50 p-4">
          <PoiSearchBox onPicked={(c) => setPendingCandidate(c)} />

          <h2 className="mb-2 mt-4 text-sm font-semibold text-inkbrown/80">
            路线顺序（{ordered.length} 个地点）
          </h2>

          <ol className="min-h-0 flex-1 space-y-2 overflow-y-auto">
            {ordered.map((node, index) => (
              <li key={node.id}>
                <div
                  className={`group flex items-start gap-2 rounded-md px-3 py-2 text-sm text-inkbrown ${
                    selectedNodeId === node.id ? 'bg-terracotta/15' : 'bg-wash'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedNodeId(node.id)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <div className="truncate font-medium">
                      {index + 1}. {node.poi_name}
                    </div>
                    <div className="text-xs text-inkbrown/60">{node.visit_date}</div>
                    {node.note ? (
                      <div className="mt-1 text-xs text-inkbrown/50">{node.note}</div>
                    ) : null}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemove(node)}
                    aria-label={`删除 ${node.poi_name}`}
                    className="shrink-0 rounded px-1 text-xs text-inkbrown/40 opacity-0 transition group-hover:opacity-100 hover:text-terracotta"
                  >
                    删除
                  </button>
                </div>
              </li>
            ))}
          </ol>

          {ordered.length === 1 ? (
            <p className="mt-2 text-xs text-inkbrown/50">再添加一个地点，就能画出路线了</p>
          ) : null}
          {ordered.length > 0 ? (
            <p className="mt-2 text-xs text-inkbrown/40">点一个地点，可以给它配图标</p>
          ) : null}
        </aside>

        <section className="min-w-0 flex-1">
          <MapCanvas selectedNodeId={selectedNodeId} onSelectNode={setSelectedNodeId} />
        </section>

        {selectedNode !== null ? (
          <NodeIconPanel
            key={selectedNode.id}
            node={selectedNode}
            onClose={() => setSelectedNodeId(null)}
          />
        ) : null}
      </main>

      {pendingCandidate ? (
        <AddNodeDialog
          candidate={pendingCandidate}
          dateRange={dateRange}
          onCancel={() => setPendingCandidate(null)}
          onConfirm={handleConfirmAdd}
        />
      ) : null}
    </div>
  );
}
