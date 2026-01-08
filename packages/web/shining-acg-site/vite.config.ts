import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	// 允许 vite 从 vite 项目根目录的上一级目录中加载文件
	server: {
		fs: {
			allow: ['..']
		}
	},
	// Deno 兼容性修复: 防止构建时出现的 "Import not a dependency" 错误
	// 将 .svelte-kit 依赖的包除在外部化之外
	ssr: {
		noExternal: ['clsx', 'tiny-invariant', 'cookie', 'devalue', 'set-cookie-parser']
	}
});
