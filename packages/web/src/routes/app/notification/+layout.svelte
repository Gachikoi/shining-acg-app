<script lang="ts">
<<<<<<< HEAD
=======
	import ManagementNav from './components/management-nav.svelte';

>>>>>>> 0955eeb (feat(web): 消息界面二级菜单及官网编辑部分内容+初步配置请求相应拦截器)
	let { children } = $props();
</script>

<div class="flex flex-col gap-4">
<<<<<<< HEAD
=======
	<ManagementNav />
>>>>>>> 0955eeb (feat(web): 消息界面二级菜单及官网编辑部分内容+初步配置请求相应拦截器)
	<div class="flex-1">
		{@render children()}
	</div>
</div>
