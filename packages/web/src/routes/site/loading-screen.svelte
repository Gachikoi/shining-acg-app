<script lang="ts">
	import { onMount } from 'svelte';
	import { fly } from 'svelte/transition';

	let { onFinish } = $props<{ onFinish: () => void }>();

	let progress = $state(0);
	let visible = $state(true);

	let interval: any;

	function startSimulation() {
		if (interval) clearInterval(interval);
		progress = 0;
		interval = setInterval(() => {
			// Logarithmic progress simulation to 90%
			if (progress < 90) {
				const diff = 95 - progress;
				progress += diff * 0.05;
			}
		}, 100);
	}

	function completeLoading() {
		if (interval) clearInterval(interval);
		progress = 100;
		setTimeout(() => {
			visible = false;
			setTimeout(onFinish, 800); // Wait for exit animation
		}, 500);
	}

	function monitorUpdate(worker: ServiceWorker | null) {
		if (!worker) {
			completeLoading();
			return;
		}
		// If already ready
		if (worker.state === 'installed' || worker.state === 'activated') {
			completeLoading();
			return;
		}
		worker.addEventListener('statechange', () => {
			if (worker.state === 'installed' || worker.state === 'activated') {
				completeLoading();
			}
		});
	}

	onMount(async () => {
		// Safety fallback: if anything fails, finish after 5 seconds
		let safetyTimer: any = setTimeout(completeLoading, 5000);

		if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
			startSimulation();
			setTimeout(() => {
				clearTimeout(safetyTimer);
				completeLoading();
			}, 1500);
			return;
		}

		try {
			const reg = await navigator.serviceWorker.getRegistration();

			// Scenario 1: Already Controlled (Cached) AND Update Detected
			if (navigator.serviceWorker.controller && reg && (reg.installing || reg.waiting)) {
				startSimulation();
				monitorUpdate(reg.installing || reg.waiting);
				clearTimeout(safetyTimer);
				return;
			}

			// Scenario 2: Already Controlled (Cached) AND No Update Detected
			if (navigator.serviceWorker.controller) {
				// Instant entry for cached users
				clearTimeout(safetyTimer);
				visible = false;
				onFinish();
				// Check for updates in background
				reg?.update();
				return;
			}

			// Scenario 3: First Visit (Not Controlled)
			// We simulate progress until the SW is ready (assets cached)
			startSimulation();

			await navigator.serviceWorker.ready;
			clearTimeout(safetyTimer);
			completeLoading();
		} catch (e) {
			console.error('SW Loading Error:', e);
			clearTimeout(safetyTimer);
			completeLoading();
		}
	});
</script>

{#if visible}
	<div
		class="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black text-white"
		out:fly={{ y: -1000, duration: 800, opacity: 1 }}
	>
		<div class="relative h-2 w-64 overflow-hidden rounded-full bg-gray-800">
			<div
				class="absolute top-0 left-0 h-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)] transition-all duration-300 ease-out"
				style="width: {progress}%"
			></div>
		</div>
		<div class="mt-4 animate-pulse font-mono text-xl tracking-widest">
			LOADING {Math.round(progress)}%
		</div>

		<!-- Decorative Elements -->
		<div
			class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-red-900/40 via-transparent to-transparent opacity-20"
		></div>
	</div>
{/if}
