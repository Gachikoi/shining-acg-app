/**
 * @file 拖拽重排 — 列表几何与落点
 * @description
 * 在 `flex` / `flex-wrap` 等布局下，根据视口坐标解析指针落在哪一个列表项上。
 * 不读取 CSS gap 逐项推算步长，而依赖 DOM 命中与矩形距离，适配换行与不均匀尺寸。
 */

/**
 * 将数值限制在闭区间 `[min, max]`
 *
 * @param value - 输入值
 * @param min - 下限
 * @param max - 上限
 * @returns 截断后的值
 */
function clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), max);
}

/**
 * 根据指针视口坐标解析应落入的列表项下标
 *
 * @param clientX - 指针 X（`clientX`）
 * @param clientY - 指针 Y（`clientY`）
 * @param items - 列表项根元素，**下标顺序**与业务数组一致
 * @returns 命中项下标；`items` 为空时返回 `null`
 *
 * @remarks
 * 1. 优先遍历 `document.elementsFromPoint`，在堆叠顺序上找到第一个被某 `items[i]` 包含的节点。
 * 2. 若未命中（如指针在间隙、拖拽层遮挡），回退为「到各项 `getBoundingClientRect` 的最近点」的平方距离最小项。
 */
export function findListItemIndexUnderPoint(
	clientX: number,
	clientY: number,
	items: readonly HTMLElement[]
): number | null {
	if (items.length === 0) return null;

	const stack = document.elementsFromPoint(clientX, clientY);
	for (const el of stack) {
		for (let i = 0; i < items.length; i++) {
			if (items[i].contains(el)) {
				return i;
			}
		}
	}

	return closestItemIndexByDistance(clientX, clientY, items);
}

/**
 * 在 `elementsFromPoint` 无命中时，选取矩形边界上距离指针最近的一项
 *
 * @param clientX - 指针 X
 * @param clientY - 指针 Y
 * @param items - 列表项根元素
 * @returns 距离最小的项下标（至少一项时恒有合法下标）
 */
function closestItemIndexByDistance(
	clientX: number,
	clientY: number,
	items: readonly HTMLElement[]
): number {
	let bestIndex = 0;
	let bestDist = Infinity;
	for (let i = 0; i < items.length; i++) {
		const r = items[i].getBoundingClientRect();
		const px = clamp(clientX, r.left, r.right);
		const py = clamp(clientY, r.top, r.bottom);
		const d = (clientX - px) ** 2 + (clientY - py) ** 2;
		if (d < bestDist) {
			bestDist = d;
			bestIndex = i;
		}
	}
	return bestIndex;
}
