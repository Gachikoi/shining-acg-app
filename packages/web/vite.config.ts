import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, type PluginOption } from 'vite';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit(),
		// 仅当 ANALYZE=1 时生成 bundle 分析报告，便于排查主线程 JS 体积
		...(process.env.ANALYZE === '1'
			? [visualizer({ filename: 'stats.html', open: false }) as PluginOption]
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
		cssMinify: 'lightningcss'
	},
	/**
	 * 将 @uppy/* 打入 SSR 产物，避免默认 external 后 Wrangler 再解析 node_modules 里
	 * `import … with { type: 'json' }`（@uppy/core 读 package.json）在旧 esbuild 上失败。
	 */
	ssr: {
		noExternal: [/^@uppy\//]
	}
});
