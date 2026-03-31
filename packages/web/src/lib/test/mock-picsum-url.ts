/**
 * Mock 占位图 URL，与瀑布流 mock 一致：`400 x height`，`random` 区分不同图。
 * @see https://picsum.photos/
 */
export const MOCK_PICSUM_WIDTH = 400;

export function mockPicsumImageUrl(height: number, randomId: string | number): string {
	return `https://picsum.photos/${MOCK_PICSUM_WIDTH}/${height}?random=${encodeURIComponent(String(randomId))}`;
}
