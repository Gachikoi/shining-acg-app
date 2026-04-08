import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { visualizer } from 'rollup-plugin-visualizer';
import { defineConfig, type PluginOption } from 'vite';

/** 为 rollup-plugin-visualizer 生成与最终产物对
 * 齐的尺寸，仅在本地分析 bundle 时开启 */
const analyze = process.env.ANALYZE === '1';

/**
 * ## 为何不用 Rollup 官方文档中的「纯对象」`manualChunks: { vendor: ['axios', …] }`
 *
 * Rollup 文档允许对象形式用裸包名（与 `lodash: ['lodash']` 同构），但实现上分两条路径（见
 * `rollup` 源码 `Bundle.generateChunks`：`typeof manualChunks === 'object'` → `addManualChunks`，否则
 * → `assignManualChunks`）：
 *
 * - **对象形式**会对列出的每个字符串再执行 `loadEntryModule(…, isLoadForManualChunks: true)`。若解析结果为
 *   **external**，则抛出 `logExternalModulesCannotBeIncludedInManualChunks`（无法把 external 收进 manual chunk）。
 * - **SvelteKit** 会分别对 **client** 与 **SSR** 各跑一遍 Rollup，且共用同一份 `build.rollupOptions.output`。
 *   SSR 侧大量依赖默认 **external**；对象形式会在 **SSR 构建**里同样尝试把 `'axios'` 等作为 manual 入口拉入，
 *   与 external 冲突 → 要么构建失败，要么为通过构建而把 `manualChunks` 中出现的包 **全部** 列入
 *   `ssr.noExternal`，从而 **显著增大 SSR bundle**。
 * - **函数形式**只对图中已有 **`Module`** 调用 `getManualChunk`（`ExternalModule` 不会进入该分支），不会对
 *   `'axios'` 再走一遍「强制作为 manual 入口加载」，故 **不必** 为对齐对象列表而扩大 `noExternal`；
 *   代价是 SSR 里若某包保持 external，则 **无法** 在 SSR 产物中按同样规则单独打成同名 vendor chunk（与 client
 *   可能不一致，属语义取舍）。
 * - **两条路径不同 → SSR 构建行为不同**：`Bundle.generateChunks` 里 **`addManualChunks` vs `assignManualChunks`**
 *   （详见 `docs/manual-chunks.md`）。
 *
 * 本项目在「控制 SSR 体积 / 少动 `ssr.noExternal`」与「client 侧 vendor 聚合」之间选择 **函数 + 路径匹配**。
 *
 * ---
 *
 * 具名 chunk → 裸包名列表（与 `package.json` 的 `name` 一致；scoped 包写 `@scope/pkg`）。
 * 由 {@link manualChunksForId} 按模块 id 路径匹配。
 */
const MANUAL_CHUNK_PACKAGES: Readonly<Record<string, readonly string[]>> = {
	'vendor-ui': ['mode-watcher', 'svelte-sonner', 'lucide-svelte'],
	'vendor-styling': ['clsx', 'tailwind-merge', 'tailwind-variants'],
	'vendor-utils': ['axios', 'centrifuge', 'mitt', 'idb-keyval', 'sortablejs']
};

/**
 * 判断某解析后的模块路径是否落在给定 npm 包目录下（兼容 `.../node_modules/pkg/...` 与 Deno `.../.deno/pkg@ver/node_modules/pkg/...`）。
 * @param moduleId - Rollup/Vite 传入的模块 id（多为绝对路径）
 * @param pkg - 裸包名，如 `mitt` 或 `@foo/bar`
 * @returns 是否属于该包
 */
function moduleIdInPackage(moduleId: string, pkg: string): boolean {
	const n = moduleId.replace(/\\/g, '/');
	return n.includes(`/node_modules/${pkg}/`);
}

/**
 * 按 {@link MANUAL_CHUNK_PACKAGES} 将 `node_modules` 内模块归入对应具名 chunk。
 * @param id - 当前模块 id
 * @returns 具名 chunk 名；不命中则 `undefined`（走 Rollup 默认分包）
 */
function manualChunksForId(id: string): string | undefined {
	if (!id.includes('node_modules')) return;
	for (const [chunkName, pkgs] of Object.entries(MANUAL_CHUNK_PACKAGES)) {
		for (const pkg of pkgs) {
			if (moduleIdInPackage(id, pkg)) return chunkName;
		}
	}
}

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit(),
		// 仅当 ANALYZE=1 时生成 bundle 分析报告，便于排查主线程 JS 体积
		...(analyze
			? [
					{
						/** 在其余构建插件之后执行，统计更接近最终产物 */
						apply: 'build' as const,
						...visualizer({
							filename: 'stats.html',
							open: false,
							// 读取 source map 文件才能在 visualizer 中看到各模块准确的尺寸
							sourcemap: true,
							/** 与终端 `gzip:` 列口径对齐（插件默认 gzipSize: false） */
							gzipSize: true
						})
					} as PluginOption
				]
			: [])
	],
	server: {
		allowedHosts: [
			'app.shiningacg.club',
			'www.shiningacg.club',
			'shiningacg.club',
			'test.app.shiningacg.club',
			'test.www.shiningacg.club',
			'test.shiningacg.club',
			'shiningacg.gach1koi.site',
			/** 与 DOMAIN_CONFIG.loginHelper 测试域名一致（单层子域，便于 Universal SSL 覆盖） */
			'test-shiningacg.gach1koi.site'
		],
		proxy: {
			'/api': {
				target: 'https://test.api.shiningacg.club:61080',
				changeOrigin: true,
				ws: true,
				rewrite: (path) => path.replace(/^\/api/, '')
			}
		}
	},
	css: {
		transformer: 'lightningcss',
		lightningcss: {
			targets: {
				chrome: 99 << 16,
				edge: 99 << 16,
				firefox: 97 << 16,
				ios_saf: 16 << 16,
				safari: 16 << 16,
				android: 99 << 16,
				samsung: 16 << 16
			}
		}
	},
	build: {
		cssMinify: 'lightningcss',
		...(analyze
			? {
					/**
					 * 供 visualizer `sourcemap: true` 读取 `bundle.map`；仅 ANALYZE 开启，避免正式构建附带 .map。
					 */
					sourcemap: true
				}
			: {}),
		rollupOptions: {
			output: {
				manualChunks: manualChunksForId
			}
		}
	},
	/**
	 * 将 @uppy/* 打入 SSR 产物，避免默认 external 后 Wrangler 再解析 node_modules 里
	 * `import … with { type: 'json' }`（@uppy/core 读 package.json）在旧 esbuild 上失败。
	 */
	ssr: {
		noExternal: [/^@uppy\//]
	}
});
