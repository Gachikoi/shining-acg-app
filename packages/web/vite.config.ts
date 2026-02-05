import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	server: {
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
	}
});
