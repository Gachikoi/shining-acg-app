<script lang="ts">
	/* eslint-disable @typescript-eslint/no-unused-vars */
	import { PlusCircle } from 'lucide-svelte';
	import { Button } from '$lib/components/ui/button';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import VideoUpload from './components/video-upload.svelte';
	import LinkItem from './components/link-item.svelte';
	import HistoryItem from './components/history-item.svelte';
	import DepartmentForm from './components/department-form.svelte';
	import DepartmentTabs from './components/department-tabs.svelte';
	import ActivityForm from './components/activity-form.svelte';
	import ActivityTabs from './components/activity-tabs.svelte';
	import CharCounter from './components/char-counter.svelte';
	import MinisterForm from './components/minister-form.svelte';
	import MinisterTabs from './components/minister-tabs.svelte';
	import {
		uploadVideo,
		getWebsiteContent,
		saveWebsiteContent,
		publishWebsiteContent
	} from '$lib/api/website';
	import type {
		ActivityInfo,
		DepartmentInfo,
		DevelopmentHistoryItem,
		Link,
		MinisterDeclaration,
		WebsiteContent
	} from '$lib/types/website';
	import { onMount } from 'svelte';

	// 表单数据
	let homepageVideo = $state('');
	let homepageVideoLink = $state('');
	let aboutShining = $state('');
	let contactShining = $state('');
	let relatedLinks = $state<Link[]>([]);
	let developmentHistory = $state<DevelopmentHistoryItem[]>([
		{ image: '', date: '', description: '' }
	]);
	let departments = $state<DepartmentInfo[]>([
		{
			id: 'dept-1',
			logo: '',
			promotionalImage: '',
			promotionalVideo: '',
			videoLink: '',
			chineseName: '',
			englishName: '',
			description: '',
			relatedLinks: []
		}
	]);
	let activeDepartmentIndex = $state(0);
	let activities = $state<ActivityInfo[]>([
		{
			id: 'act-1',
			promotionalImage: '',
			promotionalVideo: '',
			videoLink: '',
			chineseName: '',
			englishName: '',
			description: '',
			relatedLinks: []
		}
	]);
	let activeActivityIndex = $state(0);

	let ministerDeclarations = $state<MinisterDeclaration[]>([
		{
			period: '未命名届次 1',
			appointmentDate: '',
			ministers: [
				{
					id: 'minister-1',
					qqNumber: '',
					department: '',
					description: ''
				}
			]
		}
	]);
	let activeMinisterIndex = $state(0);

	// 最后保存时间
	let lastSaved = $state<string | null>(null);
	// 加载状态
	let isLoading = $state(false);
	let isSaving = $state(false);
	let isPublishing = $state(false);
	// 错误信息
	let errorMessage = $state<string | null>(null);

	// 页面加载时获取数据
	onMount(async () => {
		try {
			isLoading = true;
			errorMessage = null;
			const content = await getWebsiteContent();
			loadWebsiteContent(content);
		} catch (error) {
			console.error('加载官网内容失败：', error);
			errorMessage = error instanceof Error ? error.message : '加载数据失败，请刷新页面重试';
		} finally {
			isLoading = false;
		}
	});

	// 加载官网内容到表单
	function loadWebsiteContent(content: WebsiteContent) {
		homepageVideo = content.homepageVideo || '';
		homepageVideoLink = content.homepageVideoLink || '';
		aboutShining = content.aboutUs?.aboutShining || '';
		contactShining = content.aboutUs?.contactInfo || '';
		relatedLinks = content.aboutUs?.relatedLinks || [];
		developmentHistory = content.aboutUs?.developmentHistory || [
			{ image: '', date: '', description: '' }
		];
		departments = content.departments || [
			{
				id: 'dept-1',
				logo: '',
				promotionalImage: '',
				promotionalVideo: '',
				videoLink: '',
				chineseName: '',
				englishName: '',
				description: '',
				relatedLinks: []
			}
		];
		activities = content.activities || [
			{
				id: 'act-1',
				promotionalImage: '',
				promotionalVideo: '',
				videoLink: '',
				chineseName: '',
				englishName: '',
				description: '',
				relatedLinks: []
			}
		];
		ministerDeclarations = content.ministerDeclarations || [
			{
				period: '未命名届次 1',
				appointmentDate: '',
				ministers: [
					{
						id: 'minister-1',
						qqNumber: '',
						department: '',
						description: ''
					}
				]
			}
		];
	}

	// 构建要保存的数据
	function buildWebsiteContent(): WebsiteContent {
		return {
			homepageVideo: homepageVideo || undefined,
			homepageVideoLink: homepageVideoLink || undefined,
			aboutUs: {
				aboutShining,
				relatedLinks,
				developmentHistory,
				contactInfo: contactShining
			},
			departments,
			activities,
			ministerDeclarations,
			aboutWebsite: {
				sponsors: [],
				staff: []
			}
		};
	}

	async function handleVideoUpload(file: File) {
		try {
			isLoading = true;
			errorMessage = null;
			const url = await uploadVideo(file, 'homepage');
			homepageVideo = url;
		} catch (error) {
			console.error('上传视频失败：', error);
			errorMessage = error instanceof Error ? error.message : '上传视频失败，请重试';
			// 失败时使用预览URL
			homepageVideo = URL.createObjectURL(file);
		} finally {
			isLoading = false;
		}
	}

	function handleVideoLinkChange(link: string) {
		homepageVideoLink = link;
	}

	function addLink() {
		relatedLinks = [...relatedLinks, { label: '', value: '' }];
	}

	function removeLink(index: number) {
		relatedLinks = relatedLinks.filter((_, i) => i !== index);
	}

	function addHistoryItem() {
		developmentHistory = [...developmentHistory, { image: '', date: '', description: '' }];
	}

	function removeHistoryItem(index: number) {
		if (developmentHistory.length <= 1) return;
		developmentHistory = developmentHistory.filter((_, i) => i !== index);
	}

	function addDepartment() {
		const nextIndex = departments.length + 1;
		departments = [
			...departments,
			{
				id: `dept-${nextIndex}`,
				logo: '',
				promotionalImage: '',
				promotionalVideo: '',
				videoLink: '',
				chineseName: '',
				englishName: '',
				description: '',
				relatedLinks: []
			}
		];
		activeDepartmentIndex = departments.length - 1;
	}

	function addActivity() {
		const nextIndex = activities.length + 1;
		activities = [
			...activities,
			{
				id: `act-${nextIndex}`,
				promotionalImage: '',
				promotionalVideo: '',
				videoLink: '',
				chineseName: '',
				englishName: '',
				description: '',
				relatedLinks: []
			}
		];
		activeActivityIndex = activities.length - 1;
	}

	function addMinisterDeclaration() {
		const nextIndex = ministerDeclarations.length + 1;
		const newDeclaration: MinisterDeclaration = {
			period: `未命名届次 ${nextIndex}`,
			appointmentDate: '',
			ministers: [
				{
					id: 'minister-1',
					qqNumber: '',
					department: '',
					description: ''
				}
			]
		};
		ministerDeclarations = [...ministerDeclarations, newDeclaration];
		activeMinisterIndex = ministerDeclarations.length - 1;
	}

	function handleReset() {
		homepageVideo = '';
		homepageVideoLink = '';
		aboutShining = '';
		contactShining = '';
		relatedLinks = [];
		developmentHistory = [{ image: '', date: '', description: '' }];
		departments = [
			{
				id: 'dept-1',
				logo: '',
				promotionalImage: '',
				promotionalVideo: '',
				videoLink: '',
				chineseName: '',
				englishName: '',
				description: '',
				relatedLinks: []
			}
		];
		activeDepartmentIndex = 0;
		activities = [
			{
				id: 'act-1',
				promotionalImage: '',
				promotionalVideo: '',
				videoLink: '',
				chineseName: '',
				englishName: '',
				description: '',
				relatedLinks: []
			}
		];
		activeActivityIndex = 0;
		ministerDeclarations = [
			{
				period: '未命名届次 1',
				appointmentDate: '',
				ministers: [
					{
						id: 'minister-1',
						qqNumber: '',
						department: '',
						description: ''
					}
				]
			}
		];
		activeMinisterIndex = 0;
		lastSaved = null;
	}

	// 校验工具函数
	function isValidUrl(url: string): boolean {
		if (!url.trim()) return false;
		try {
			new URL(url);
			return true;
		} catch {
			return false;
		}
	}

	function isValidQQNumber(qq: string): boolean {
		return /^\d{5,11}$/.test(qq.trim());
	}

	// 校验首页视频
	function validateHomepageVideo() {
		const errors: string[] = [];
		if (!homepageVideo && !homepageVideoLink) {
			errors.push('首页视频：必须上传视频或填写视频链接');
		}
		if (homepageVideoLink && !isValidUrl(homepageVideoLink)) {
			errors.push('首页视频：视频链接格式不正确');
		}
		return errors;
	}

	// 校验了解我们模块
	function validateAboutSection() {
		const errors: string[] = [];

		if (!aboutShining?.trim()) {
			errors.push('关于晒你：内容未填写');
		} else if (aboutShining.length > 300) {
			errors.push('关于晒你：内容长度超过 300 字符');
		}

		if (!contactShining?.trim()) {
			errors.push('联系晒你：内容未填写');
		} else if (contactShining.length > 300) {
			errors.push('联系晒你：内容长度超过 300 字符');
		}

		// 校验相关链接
		relatedLinks.forEach((link, index) => {
			if (!link.label?.trim()) {
				errors.push(`相关链接（第 ${index + 1} 项）：文字说明未填写`);
			} else if (link.label.length > 12) {
				errors.push(`相关链接（第 ${index + 1} 项）：文字说明长度超过 12 字符`);
			}

			if (!link.value?.trim()) {
				errors.push(`相关链接（第 ${index + 1} 项）：链接未填写`);
			} else if (!isValidUrl(link.value)) {
				errors.push(`相关链接（第 ${index + 1} 项）：链接格式不正确`);
			} else if (link.value.length > 200) {
				errors.push(`相关链接（第 ${index + 1} 项）：链接长度超过 200 字符`);
			}
		});

		// 校验发展历程
		if (!developmentHistory || developmentHistory.length === 0) {
			errors.push('发展历程：至少需要添加一条记录');
		} else {
			developmentHistory.forEach((item, index) => {
				const itemLabel = `发展历程（第 ${index + 1} 项）`;

				if (!item.image?.trim()) {
					errors.push(`${itemLabel}：图片未上传`);
				}

				if (!item.date?.trim()) {
					errors.push(`${itemLabel}：时间未选择`);
				}

				if (!item.description?.trim()) {
					errors.push(`${itemLabel}：描述未填写`);
				} else if (item.description.length > 30) {
					errors.push(`${itemLabel}：描述长度超过 30 字符`);
				}
			});
		}

		return errors;
	}

	// 校验部门信息
	function validateDepartments() {
		const errors: string[] = [];

		if (!departments || departments.length === 0) {
			errors.push('部门信息：至少需要添加一个部门');
			return errors;
		}

		departments.forEach((dept, index) => {
			const deptLabel = dept.chineseName || `部门 ${index + 1}`;

			if (!dept.logo?.trim()) {
				errors.push(`【${deptLabel}】Logo 未上传`);
			}

			if (!dept.promotionalImage?.trim()) {
				errors.push(`【${deptLabel}】宣传图未上传`);
			}

			if (dept.videoLink && !isValidUrl(dept.videoLink)) {
				errors.push(`【${deptLabel}】视频链接格式不正确`);
			}
			if (dept.videoLink && dept.videoLink.length > 200) {
				errors.push(`【${deptLabel}】视频链接长度超过 200 字符`);
			}

			if (!dept.chineseName?.trim()) {
				errors.push(`【${deptLabel}】中文名未填写`);
			} else if (dept.chineseName.length > 20) {
				errors.push(`【${deptLabel}】中文名长度超过 20 字符`);
			}

			if (dept.englishName && dept.englishName.length > 20) {
				errors.push(`【${deptLabel}】英文名长度超过 20 字符`);
			}

			if (!dept.description?.trim()) {
				errors.push(`【${deptLabel}】简介未填写`);
			} else if (dept.description.length > 200) {
				errors.push(`【${deptLabel}】简介长度超过 200 字符`);
			}

			// 校验部门相关链接
			dept.relatedLinks.forEach((link, linkIndex) => {
				if (!link.label?.trim()) {
					errors.push(`【${deptLabel} - 相关链接（第 ${linkIndex + 1} 项）】文字说明未填写`);
				} else if (link.label.length > 12) {
					errors.push(
						`【${deptLabel} - 相关链接（第 ${linkIndex + 1} 项）】文字说明长度超过 12 字符`
					);
				}

				if (!link.value?.trim()) {
					errors.push(`【${deptLabel} - 相关链接（第 ${linkIndex + 1} 项）】链接未填写`);
				} else if (!isValidUrl(link.value)) {
					errors.push(`【${deptLabel} - 相关链接（第 ${linkIndex + 1} 项）】链接格式不正确`);
				} else if (link.value.length > 200) {
					errors.push(`【${deptLabel} - 相关链接（第 ${linkIndex + 1} 项）】链接长度超过 200 字符`);
				}
			});
		});

		return errors;
	}

	// 校验活动信息
	function validateActivities() {
		const errors: string[] = [];

		if (!activities || activities.length === 0) {
			return errors; // 活动信息是可选的
		}

		activities.forEach((activity, index) => {
			const activityLabel = activity.chineseName || `活动 ${index + 1}`;

			if (!activity.promotionalImage?.trim()) {
				errors.push(`【${activityLabel}】宣传图未上传`);
			}

			if (activity.videoLink && !isValidUrl(activity.videoLink)) {
				errors.push(`【${activityLabel}】视频链接格式不正确`);
			}
			if (activity.videoLink && activity.videoLink.length > 200) {
				errors.push(`【${activityLabel}】视频链接长度超过 200 字符`);
			}

			if (!activity.chineseName?.trim()) {
				errors.push(`【${activityLabel}】中文名未填写`);
			} else if (activity.chineseName.length > 200) {
				errors.push(`【${activityLabel}】中文名长度超过 200 字符`);
			}

			if (activity.englishName && activity.englishName.length > 20) {
				errors.push(`【${activityLabel}】英文名长度超过 20 字符`);
			}

			if (!activity.description?.trim()) {
				errors.push(`【${activityLabel}】简介未填写`);
			} else if (activity.description.length > 200) {
				errors.push(`【${activityLabel}】简介长度超过 200 字符`);
			}

			// 校验活动相关链接
			activity.relatedLinks.forEach((link, linkIndex) => {
				if (!link.label?.trim()) {
					errors.push(`【${activityLabel} - 相关链接（第 ${linkIndex + 1} 项）】文字说明未填写`);
				} else if (link.label.length > 12) {
					errors.push(
						`【${activityLabel} - 相关链接（第 ${linkIndex + 1} 项）】文字说明长度超过 12 字符`
					);
				}

				if (!link.value?.trim()) {
					errors.push(`【${activityLabel} - 相关链接（第 ${linkIndex + 1} 项）】链接未填写`);
				} else if (!isValidUrl(link.value)) {
					errors.push(`【${activityLabel} - 相关链接（第 ${linkIndex + 1} 项）】链接格式不正确`);
				} else if (link.value.length > 200) {
					errors.push(
						`【${activityLabel} - 相关链接（第 ${linkIndex + 1} 项）】链接长度超过 200 字符`
					);
				}
			});
		});

		return errors;
	}

	// 校验部长宣言
	function validateMinisterDeclarations() {
		const errors: string[] = [];

		ministerDeclarations.forEach((term, termIndex) => {
			const termLabel = term.period || `未命名届次 ${termIndex + 1}`;

			if (!term.appointmentDate) {
				errors.push(`【${termLabel}】缺少上任时间`);
			}

			if (!term.ministers || term.ministers.length === 0) {
				errors.push(`【${termLabel}】至少需要添加一条部长信息`);
				return;
			}

			term.ministers.forEach((minister, ministerIndex) => {
				const rowLabel = `【${termLabel} - 第 ${ministerIndex + 1} 位部长】`;

				if (!minister.qqNumber?.trim()) {
					errors.push(`${rowLabel} QQ 号未填写`);
				} else if (!isValidQQNumber(minister.qqNumber)) {
					errors.push(`${rowLabel} QQ 号格式不正确（应为 5-11 位数字）`);
				} else if (minister.qqNumber.length > 20) {
					errors.push(`${rowLabel} QQ 号长度超过 20`);
				}

				if (!minister.department?.trim()) {
					errors.push(`${rowLabel} 统领部门未选择`);
				}

				if (!minister.description?.trim()) {
					errors.push(`${rowLabel} 简介未填写`);
				} else if (minister.description.length > 200) {
					errors.push(`${rowLabel} 简介长度超过 200`);
				}
			});
		});

		return errors;
	}

	async function handleSave() {
		const allErrors: string[] = [];

		// 校验首页视频
		const homepageErrors = validateHomepageVideo();
		allErrors.push(...homepageErrors);

		// 校验了解我们模块
		const aboutErrors = validateAboutSection();
		allErrors.push(...aboutErrors);

		// 校验部门信息
		const departmentErrors = validateDepartments();
		allErrors.push(...departmentErrors);

		// 校验活动信息
		const activityErrors = validateActivities();
		allErrors.push(...activityErrors);

		// 校验部长宣言
		const ministerErrors = validateMinisterDeclarations();
		allErrors.push(...ministerErrors);

		// 如果有错误，显示并返回
		if (allErrors.length > 0) {
			console.error('表单校验未通过：', allErrors);
			if (typeof window !== 'undefined') {
				alert(`表单信息不完整，请检查后再保存：\n\n${allErrors.map((e) => `- ${e}`).join('\n')}`);
			}
			return;
		}

		// 保存数据到后端
		try {
			isSaving = true;
			errorMessage = null;
			const content = buildWebsiteContent();
			await saveWebsiteContent(content);

			const now = new Date();
			lastSaved = `${now.getHours().toString().padStart(2, '0')}:${now
				.getMinutes()
				.toString()
				.padStart(2, '0')}`;

			if (typeof window !== 'undefined') {
				alert('保存成功！');
			}
		} catch (error) {
			console.error('保存失败：', error);
			errorMessage = error instanceof Error ? error.message : '保存失败，请重试';
			if (typeof window !== 'undefined') {
				alert(`保存失败：${errorMessage}`);
			}
		} finally {
			isSaving = false;
		}
	}

	async function handlePublish() {
		// 先走保存与校验逻辑
		await handleSave();
		if (!lastSaved) return;

		// 发布数据到后端
		try {
			isPublishing = true;
			errorMessage = null;
			const content = buildWebsiteContent();
			await publishWebsiteContent(content);

			if (typeof window !== 'undefined') {
				alert('发布成功！');
			}
		} catch (error) {
			console.error('发布失败：', error);
			errorMessage = error instanceof Error ? error.message : '发布失败，请重试';
			if (typeof window !== 'undefined') {
				alert(`发布失败：${errorMessage}`);
			}
		} finally {
			isPublishing = false;
		}
	}
</script>

<div class="space-y-8 p-6">
	<!-- 首页视频 -->
	<div class="space-y-4">
		<VideoUpload
			label="首页视频"
			required
			aspectRatio="16:9"
			videoUrl={homepageVideo}
			videoLink={homepageVideoLink}
			onVideoUpload={handleVideoUpload}
			onLinkChange={handleVideoLinkChange}
		/>
	</div>

	<!-- 了解我们 -->
	<div class="space-y-6">
		<h2 class="mb-4 text-xl font-bold">了解我们</h2>

		<!-- 关于晒你 -->
		<div class="space-y-2">
			<Label>
				关于晒你<span class="text-red-500">*</span>
			</Label>
			<div class="relative">
				<Textarea
					placeholder="填写晒你故事"
					value={aboutShining}
					maxlength={300}
					oninput={(e) => (aboutShining = e.currentTarget.value)}
					class="min-h-[120px] pr-16"
				/>
				<div class="absolute right-3 bottom-3">
					<CharCounter current={aboutShining.length} max={300} />
				</div>
			</div>
		</div>

		<!-- 相关链接 -->
		<div class="space-y-4">
			<div
				class="flex items-center justify-between border-b border-zinc-200 pb-3 dark:border-zinc-800"
			>
				<Label>相关链接</Label>
			</div>
			{#if relatedLinks.length === 0}
				<div
					class="rounded-lg border border-dashed border-zinc-300 p-8 text-center text-zinc-500 dark:border-zinc-700"
				>
					暂无相关链接，点击下方按钮新增
				</div>
			{:else}
				<div
					class="divide-y divide-zinc-200 rounded-lg border-b border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900"
				>
					{#each relatedLinks as link, index (index)}
						<div class="p-4">
							<LinkItem {link} onRemove={() => removeLink(index)} />
						</div>
					{/each}
				</div>
			{/if}
			<div class="flex">
				<Button
					variant="block"
					onclick={addLink}
					class="h-8 w-[76px] justify-center gap-2 rounded-full bg-zinc-100 px-3 py-1.5 font-['Inter'] text-sm leading-5 font-medium tracking-normal text-zinc-900 hover:bg-zinc-200"
				>
					<PlusCircle class="size-4" />
					新增
				</Button>
			</div>
		</div>

		<!-- 发展历程 -->
		<div class="space-y-4">
			<div
				class="flex items-center justify-between border-b border-zinc-200 pb-3 dark:border-zinc-800"
			>
				<Label>
					发展历程<span class="text-red-500">*</span>
				</Label>
			</div>
			<div
				class="divide-y divide-zinc-200 rounded-lg border-b border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900"
			>
				{#each developmentHistory as _item, index (index)}
					<div class="p-4">
						<HistoryItem
							bind:item={developmentHistory[index]}
							canRemove={developmentHistory.length > 1}
							onRemove={() => removeHistoryItem(index)}
						/>
					</div>
				{/each}
			</div>
			<div class="flex">
				<Button
					variant="block"
					onclick={addHistoryItem}
					class="h-8 w-[76px] justify-center gap-2 rounded-full bg-zinc-100 px-3 py-1.5 font-['Inter'] text-sm leading-5 font-medium tracking-normal text-zinc-900 hover:bg-zinc-200"
				>
					<PlusCircle class="size-4" />
					新增
				</Button>
			</div>
		</div>

		<!-- 联系晒你 -->
		<div class="space-y-2">
			<Label>
				联系晒你<span class="text-red-500">*</span>
			</Label>
			<div class="relative">
				<Textarea
					placeholder="填写联系方式"
					value={contactShining}
					maxlength={300}
					oninput={(e) => (contactShining = e.currentTarget.value)}
					class="min-h-[120px] pr-16"
				/>
				<div class="absolute right-3 bottom-3">
					<CharCounter current={contactShining.length} max={300} />
				</div>
			</div>
		</div>
	</div>

	<!-- 部门信息 -->
	<div class="space-y-6">
		<h2 class="mb-4 text-xl font-bold">部门信息</h2>

		<DepartmentTabs
			bind:departments
			bind:activeIndex={activeDepartmentIndex}
			onAdd={addDepartment}
		/>

		<div class="rounded-lg bg-white dark:bg-zinc-900">
			<DepartmentForm bind:department={departments[activeDepartmentIndex]} />
		</div>
	</div>

	<!-- 活动信息 -->
	<div class="space-y-6">
		<h2 class="mb-4 text-xl font-bold">活动信息</h2>

		<ActivityTabs bind:activities bind:activeIndex={activeActivityIndex} onAdd={addActivity} />

		<div class="rounded-lg bg-white dark:bg-zinc-900">
			<ActivityForm bind:activity={activities[activeActivityIndex]} />
		</div>
	</div>

	<!-- 部长宣言 -->
	<div class="space-y-6">
		<h2 class="mb-4 text-xl font-bold">部长宣言</h2>

		<MinisterTabs
			bind:ministerDeclarations
			bind:activeIndex={activeMinisterIndex}
			onAdd={addMinisterDeclaration}
		/>

		<div class="rounded-lg bg-white dark:bg-zinc-900">
			<MinisterForm bind:declaration={ministerDeclarations[activeMinisterIndex]} {departments} />
		</div>
	</div>

	<!-- 底部操作栏 -->
	<div class="space-y-4 border-t border-zinc-200 pt-6 dark:border-zinc-800">
		{#if errorMessage}
			<div
				class="rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400"
			>
				{errorMessage}
			</div>
		{/if}

		<div class="flex items-center justify-between">
			<div class="flex gap-4">
				<Button
					variant="tertiary"
					onclick={handleReset}
					disabled={isLoading || isSaving || isPublishing}
				>
					重置
				</Button>
				<Button
					variant="tertiary"
					onclick={handleSave}
					disabled={isLoading || isSaving || isPublishing}
				>
					{isSaving ? '保存中...' : '保存'}
				</Button>
				<Button
					variant="default"
					onclick={handlePublish}
					disabled={isLoading || isSaving || isPublishing}
				>
					{isPublishing ? '发布中...' : '发布变更'}
				</Button>
			</div>
			{#if lastSaved}
				<p class="text-sm text-zinc-500">保存于 {lastSaved}</p>
			{/if}
		</div>
	</div>
</div>

{#if isLoading}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
		role="dialog"
		aria-modal="true"
		aria-labelledby="loading-title"
	>
		<div class="rounded-lg bg-white p-6 shadow-lg dark:bg-zinc-900">
			<p id="loading-title" class="text-sm font-medium">加载中...</p>
		</div>
	</div>
{/if}
