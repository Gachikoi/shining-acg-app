<script lang="ts">
	import darkLogo from '$lib/assets/dark-logo.png';
	import logo from '$lib/assets/logo.png';
	import { mode } from 'mode-watcher';
	import './layout.css';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={mode.current === 'dark' ? darkLogo : logo} />
</svelte:head>

{@render children()}
