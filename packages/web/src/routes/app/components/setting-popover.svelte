<script lang="ts">
	import Button from '$lib/components/ui/button/button.svelte';
	import * as Popover from '$lib/components/ui/popover';
	import PopoverTrigger from '$lib/components/ui/popover/popover-trigger.svelte';
	import * as Select from '$lib/components/ui/select';
	import { ChevronRight, ExternalLink, Menu } from 'lucide-svelte';
	import { resetMode, setMode } from 'mode-watcher';
	import TabButton from './tab-button.svelte';

	let darkMode = $state('跟随系统');
	const darkModeOptions = ['跟随系统', '浅色', '深色'];
</script>

<Popover.Root>
	<PopoverTrigger>
		<TabButton class="hidden lg:block" text="更多" icon={Menu} />
		<Button variant="ghost" size='icon-lg' class="lg:hidden">
			<Menu />
		</Button>
	</PopoverTrigger>
	<Popover.Content class="w-54 p-0">
		<a
			class="lg:hidden"
			title="晒你官网"
			href="https://www.shiningacg.club"
			data-sveltekit-preload-code="eager"
			data-sveltekit-replacestate
			data-sveltekit-preload-data="tap"
			><Button
				variant="ghost"
				class="flex h-10 w-full justify-between rounded-none px-4! text-sm font-normal"
				><span>晒你官网</span><ExternalLink /></Button
			></a
		>
		<Button
			variant="ghost"
			class="flex h-10 w-full justify-between rounded-none px-4! text-sm font-normal"
			><span>通知设置</span><ChevronRight /></Button
		>
		<Button
			variant="ghost"
			class="flex h-10 w-full justify-between rounded-none px-4! text-sm font-normal"
			><span>隐私设置</span><ChevronRight /></Button
		>
		<Button
			variant="ghost"
			class="flex h-10 w-full justify-between rounded-none px-4! text-sm font-normal"
			><span>存储空间</span><ChevronRight /></Button
		>
		<Button
			variant="ghost"
			class="flex h-10 w-full justify-between rounded-none px-4! text-sm font-normal"
			><span>深色模式</span>
			<Select.Root type="single" name="darkMode" bind:value={darkMode}>
				<Select.Trigger size="sm">
					{darkMode}
				</Select.Trigger>
				<Select.Content>
					<Select.Group>
						{#each darkModeOptions as item, i (i)}
							<Select.Item
								value={item}
								label={item}
								onclick={() => {
									switch (item) {
										case '跟随系统':
											resetMode();
											break;
										case '浅色':
											setMode('light');
											break;
										case '深色':
											setMode('dark');
											break;
									}
								}}
							>
								{item}
							</Select.Item>
						{/each}
					</Select.Group>
				</Select.Content>
			</Select.Root>
		</Button>
	</Popover.Content>
</Popover.Root>
