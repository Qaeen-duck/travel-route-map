import type { TravelNode } from '@/types/project';

/**
 * 按 route_order 把节点排成一条路线。
 * 单独抽成纯函数（而不是放进 store 当 selector）的原因：
 * Zustand 的 selector 如果每次返回新数组，引用一变就会触发额外渲染。
 * 组件里改成「订阅 project + useMemo 调用本函数」，渲染次数可控。
 */
export function orderNodes(nodes: readonly TravelNode[], order: readonly string[]): TravelNode[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const ordered: TravelNode[] = [];
  for (const id of order) {
    const node = byId.get(id);
    if (node) {
      ordered.push(node);
    }
  }
  return ordered;
}
