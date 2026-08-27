import { Circle, Group, Image as KonvaImage, Text } from 'react-konva';
import { useStickerImage } from '@/hooks/useStickerImage';
import { PALETTE } from '@/lib/palette';
import { useAssetStore } from '@/store/assetStore';
import type { TravelNode } from '@/types/project';

/** 路线锚点圆的半径。这个点才是真实经纬度所在的位置，不能被贴纸顶掉 */
const DOT_RADIUS = 9;

/** 贴纸显示边长 */
const STICKER_SIZE = 96;

/** 贴纸底边与锚点之间留的空隙 */
const STICKER_GAP = 10;

interface Props {
  node: TravelNode;
  x: number;
  y: number;
  index: number;
  selected: boolean;
  onSelect: (nodeId: string) => void;
}

/**
 * 单个节点的画布呈现（PRD F7.4 + 决策 4）
 *
 * 布局（2026-08-27 调整）：
 *   贴纸 —— 浮在锚点正上方，原图比例，不裁切、不套圆框
 *   锚点 —— 始终是那个小圆点，位置严格等于 project(lat,lng) 的结果
 *   标签 —— 锚点正下方
 *
 * 为什么贴纸不能替代锚点：锚点承载的是「这个地方在地图上的真实位置」（决策 2），
 * 贴纸尺寸大又是方的，用它当位置标识会让相对方位读起来失真。
 * 分开之后，贴纸怎么换、多大，都不影响空间关系的准确性。
 *
 * 决策 4 要求「三种节点视觉呈现共用同一组件接口」：外部只传 node + 坐标，
 * 内部根据有没有贴纸决定画不画，调用方无差异。
 */
export default function MapNodeShape({ node, x, y, index, selected, onSelect }: Props) {
  const iconUrl = useAssetStore((s) => s.assets[node.id]?.icon);
  const sticker = useStickerImage(iconUrl);

  const hasSticker = sticker !== null;
  // 等比缩放，宽高不一定相等，别把非正方形的图压变形
  const ratio = hasSticker ? sticker.width / sticker.height : 1;
  const stickerW = ratio >= 1 ? STICKER_SIZE : STICKER_SIZE * ratio;
  const stickerH = ratio >= 1 ? STICKER_SIZE / ratio : STICKER_SIZE;

  return (
    <Group
      x={x}
      y={y}
      onClick={() => onSelect(node.id)}
      onTap={() => onSelect(node.id)}
      onMouseEnter={(e) => {
        const container = e.target.getStage()?.container();
        if (container) {
          container.style.cursor = 'pointer';
        }
      }}
      onMouseLeave={(e) => {
        const container = e.target.getStage()?.container();
        if (container) {
          container.style.cursor = 'default';
        }
      }}
    >
      {/* 贴纸：浮在锚点上方，白底已在 stickerCutout 里抠掉 */}
      {hasSticker ? (
        <KonvaImage
          image={sticker}
          x={-stickerW / 2}
          y={-(DOT_RADIUS + STICKER_GAP + stickerH)}
          width={stickerW}
          height={stickerH}
          shadowColor={PALETTE.inkbrown}
          shadowBlur={selected ? 10 : 0}
          shadowOpacity={selected ? 0.25 : 0}
        />
      ) : null}

      {/* 路线锚点：真实经纬度的落点，永远在 */}
      <Circle
        radius={DOT_RADIUS}
        fill={index === 0 ? PALETTE.coral : PALETTE.terracotta}
        stroke={selected ? PALETTE.inkbrown : PALETTE.cream}
        strokeWidth={selected ? 3 : 2}
      />

      {/* 没有贴纸时，锚点里显示序号，兼作纯文字节点的徽章（F7.4 第四行） */}
      {!hasSticker ? (
        <Text
          x={-DOT_RADIUS}
          y={-5}
          width={DOT_RADIUS * 2}
          align="center"
          text={String(index + 1)}
          fontSize={11}
          fontStyle="bold"
          fill={PALETTE.cream}
        />
      ) : null}

      {/* 标签：锚点正下方 */}
      <Text
        x={-70}
        y={DOT_RADIUS + 6}
        width={140}
        align="center"
        text={node.poi_name}
        fontSize={14}
        fontFamily="PingFang SC, system-ui, sans-serif"
        fill={PALETTE.inkbrown}
      />
    </Group>
  );
}
