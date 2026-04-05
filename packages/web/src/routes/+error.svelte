<script lang="ts">
	import { page } from '$app/state';
	import { Button } from '$lib/components/ui/button';
	import { DOMAIN_CONFIG } from '$lib/constants';

	/**
	 * 根据当前 pathname 解析「返回首页」链接，与 `hooks.ts` 中域名映射到 `/app`、`/site` 的约定一致。
	 * @param pathname - 当前请求的 pathname
	 * @returns 对应产品线的首页路径
	 */
	function resolveHomeHref(hostname: string): string {
		if (hostname.includes(DOMAIN_CONFIG.appSuffix)) return '/home';
		if (hostname.includes(DOMAIN_CONFIG.siteSuffix)) return '/#home';
		if (hostname.includes(DOMAIN_CONFIG.loginHelperSuffix))
			return `https://${DOMAIN_CONFIG.app}/home`;
		return '/home';
	}

	/**
	 * 面向用户的中文说明（产品文档 §2.3 缺省与异常页）。
	 * @param status - HTTP 状态码
	 * @returns 用户可读文案
	 */
	function userFacingMessage(status: number): string {
		if (status === 404) {
			return '未找到该页面，链接可能已失效，或地址输入有误。';
		}
		if (status === 403) {
			return '没有权限访问该内容。';
		}
		if (status >= 500) {
			return '服务暂时不可用，请稍后再试。';
		}
		return '页面加载时出现问题，请稍后再试。';
	}

	/**
	 * 面向开发/排障的简短代码行：HTTP 状态 + 原始 message（若有）。
	 * @param status - HTTP 状态码
	 * @param message - SvelteKit 传入的 error.message
	 * @returns 单行展示字符串
	 */
	function developerErrorLine(status: number, message: string): string {
		const base = `HTTP ${String(status)}`;
		const trimmed = message.trim();
		return trimmed.length > 0 ? `${base} · ${trimmed}` : base;
	}

	/** 当前 HTTP 状态码 */
	const status = $derived(page.status);

	/** SvelteKit 错误对象中的 message（可能为空） */
	const rawMessage = $derived(page.error?.message ?? '');

	/** 用户向中文说明 */
	const description = $derived(userFacingMessage(status));

	/** 开发者向代码行 */
	const codeLine = $derived(developerErrorLine(status, rawMessage));

	/** 返回首页按钮目标 */
	const homeHref = $derived(resolveHomeHref(page.url.hostname));
</script>

<svelte:head>
	<title>{status} · 晒你</title>
</svelte:head>

<!--
	产品文档 §2.3：全屏兜底；三元素纵向居中：中文说明 → 报错代码 → 返回首页
-->
<div
	class="flex min-h-screen w-full flex-col items-center justify-center gap-6 bg-background px-6 py-12 font-sans text-foreground"
>
	<p class="text-center text-base leading-relaxed text-zinc-700 dark:text-zinc-300">
		{description}
	</p>

	<p
		class="font-mono text-sm tracking-tight text-zinc-500 select-all dark:text-zinc-500"
		aria-label="开发者错误信息"
	>
		{codeLine}
	</p>

	<Button href={homeHref} variant="default" size="default">返回首页</Button>
</div>
