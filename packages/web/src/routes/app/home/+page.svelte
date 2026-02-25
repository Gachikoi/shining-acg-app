<script lang="ts">
	import { WaterfallContainer } from '$lib/components/custom/waterfall';
	import { data as waterfallData } from '$lib/test/waterfall-data-mock';
</script>

<div class="h-full">
	<WaterfallContainer data={waterfallData} />
</div>
