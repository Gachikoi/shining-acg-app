<script lang="ts">
	import { Input } from '$lib/components/ui/input';
	import { ShinRichTextarea, type MentionUser } from '$lib/components/custom/shin-rich';
	import type { V1PostContentUnit } from '$lib/api/types.gen';

	let {
		title = $bindable(''),
		contenteditableRef = $bindable<HTMLDivElement | null>(null),
		initialBodyContent,
		resetKey,
		titleWordLimit,
		fetchMentionUsers,
		onMentionClick
	}: {
		title?: string;
		contenteditableRef?: HTMLDivElement | null;
		initialBodyContent?: V1PostContentUnit[];
		resetKey: number;
		titleWordLimit: number;
		fetchMentionUsers: (query: string) => Promise<MentionUser[]>;
		onMentionClick: (userId: string) => void;
	} = $props();
</script>

<!-- 正文内容：标题 20 字、描述 10000 字、@ 用户见 ShinRichTextarea -->
<p class="mt-6 text-lg font-bold">正文内容</p>
<div class="relative mt-2">
	<Input bind:value={title} maxlength={titleWordLimit} placeholder="填写标题" class="pr-16"></Input>
	<div
		class="pointer-events-none absolute right-3 bottom-1/2 translate-y-1/2 text-muted-foreground"
	>
		{title.length}/{titleWordLimit}
	</div>
</div>
{#key resetKey}
	<ShinRichTextarea
		placeholder="添加帖子描述"
		class="mt-5"
		bind:contentEditableRef={contenteditableRef}
		initialContent={initialBodyContent}
		{fetchMentionUsers}
		{onMentionClick}
	/>
{/key}
