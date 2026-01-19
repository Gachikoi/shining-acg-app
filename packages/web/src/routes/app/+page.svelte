<script>
	import { Button } from '$lib/components/ui/button';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { Menu } from 'lucide-svelte';
</script>

<div>home</div>
<Button variant="default">删除评论<Menu/></Button>
<Button variant="secondary" >私信</Button>
<Button variant="tertiary">删除评论</Button>
<Button variant="ghost">私信</Button>
<Button variant="block">私信<Checkbox/></Button>
