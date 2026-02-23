<script>
	import { shiningBridge } from '$lib';
	import { Button } from '$lib/components/ui/button';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { Menu } from 'lucide-svelte';
</script>

<div>s首页，测试手机hh</div>
<Button
	variant="default"
	onclick={() => shiningBridge.vibrate({ type: 'impact', style: 'heavy', x: 0, y: 0 })}
	>删除评论<Menu /></Button
>
<Button
	variant="secondary"
	onclick={() => shiningBridge.vibrate({ type: 'impact', style: 'soft', x: 300, y: 300 })}
	>私信</Button
>
<Button
	variant="tertiary"
	onclick={() => shiningBridge.vibrate({ type: 'notification', style: 'success' })}>删除评论</Button
>
<Button
	variant="ghost"
	onclick={() => shiningBridge.vibrate({ type: 'notification', style: 'error', x: 100, y: 100 })}
	>私信</Button
>
<Button variant="block" onclick={() => shiningBridge.vibrate({ type: 'selection' })}
	>私信<Checkbox /></Button
>
