<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import { ModeWatcher, toggleMode } from 'mode-watcher';
	import { Button } from 'share/components/ui/button';
	import {Bell} from 'lucide-svelte';
	import './layout.css';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<ModeWatcher></ModeWatcher>
<Button size="tab" variant="ghost" onclick={() => toggleMode()}><Bell></Bell>确认</Button>
<Button custom="tab">删除</Button>
{@render children()}
