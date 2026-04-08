/** 官网导航项：hash 与锚点一致；enDescription 多行英文小字以 | 分隔，供背景竖排展示 */
export type SiteNavItem = {
	label: string;
	hash: string;
	enLabel: string;
	enDescription: string;
};

export const NAV_ITEMS: SiteNavItem[] = [
	{
		label: '首页',
		hash: '#home',
		enLabel: 'HOME',
		enDescription: 'WELCOME /////|SHINING ACG CLUB'
	},
	{
		label: '了解我们',
		hash: '#us',
		enLabel: 'US',
		enDescription: 'OUR STORY /////|WHO WE ARE'
	},
	{
		label: '部门信息',
		hash: '#department',
		enLabel: 'DEPARTMENT',
		enDescription: 'TEAMS /////|CREW & CULTURE'
	},
	{
		label: '活动信息',
		hash: '#activity',
		enLabel: 'ACTIVITY',
		enDescription: 'EVENTS /////|JOIN THE FUN'
	},
	{
		label: '热门动态',
		hash: '#post',
		enLabel: 'POST',
		enDescription: 'TRENDING /////|FROM THE APP'
	},
	{
		label: '部长宣言',
		hash: '#declaration',
		enLabel: 'DECLARATION',
		enDescription: 'LEADERSHIP /////|NEW TERM, NEW VOICE'
	},
	{
		label: '关于网站',
		hash: '#site',
		enLabel: 'ABOUT WEBSITE',
		enDescription: 'CREDITS /////|THANKS & STAFF'
	}
];

/**
 * 官网主列纵向 swipe：`commitThreshold` 与 `+layout.svelte` 中 `SwipeOptions` 一致（相对视口高度比例）。
 */
export const SITE_SWIPE_COMMIT_FRACTION = 0.1;

/**
 * 官网 wheel 通道：累计位移达到 `SITE_SWIPE_COMMIT_FRACTION`×容器高度时立即结束序列。
 * 对应 `SwipeOptions.wheelEarlyFinishOnThreshold`。
 */
export const SITE_SWIPE_WHEEL_EARLY_FINISH_ON_THRESHOLD = true;

export const DEPARTMENTS = [
	{
		id: '1',
		name: 'ZENLESS ZONE ZERO',
		enName: 'Zenless Zone Zero',
		logo: 'https://picsum.photos/seed/zzz_hero_1/1200/800',
		image: 'https://picsum.photos/seed/zzz_hero_1/1200/800',
		description:
			'A brand new action game from HoYoverse. In a world plagued by the "Hollows", a specialized city has risen - "New Eridu". You will play as a "Proxy", a professional who guides people through the Hollows, and witness their stories.',
		video: 'https://example.com/video.mp4',
		links: [
			{ label: '哔哩哔哩', value: 'www.bilibili.com' },
			{ label: '官网', value: 'www.gach1koi.site' },
			{ label: '小红书', value: 'www.xiaohongshu.com' }
		]
	},
	{
		id: '2',
		name: 'ZENLESS ZONE ZERO',
		enName: 'Zenless Zone Zero',
		logo: 'https://picsum.photos/seed/zzz_hero_1/1200/800',
		image: 'https://picsum.photos/seed/zzz_hero_1/1200/800',
		description:
			'A brand new action game from HoYoverse. In a world plagued by the "Hollows", a specialized city has risen - "New Eridu". You will play as a "Proxy", a professional who guides people through the Hollows, and witness their stories.',
		video: 'https://example.com/video.mp4',
		links: [
			{ label: '哔哩哔哩', value: 'www.bilibili.com' },
			{ label: '官网', value: 'www.gach1koi.site' },
			{ label: '小红书', value: 'www.xiaohongshu.com' }
		]
	},
	{
		id: '3',
		name: 'ZENLESS ZONE ZERO',
		enName: 'Zenless Zone Zero',
		logo: 'https://picsum.photos/seed/zzz_hero_1/1200/800',
		image: 'https://picsum.photos/seed/zzz_hero_1/1200/800',
		description:
			'A brand new action game from HoYoverse. In a world plagued by the "Hollows", a specialized city has risen - "New Eridu". You will play as a "Proxy", a professional who guides people through the Hollows, and witness their stories.',
		video: 'https://example.com/video.mp4',
		links: [
			{ label: '哔哩哔哩', value: 'www.bilibili.com' },
			{ label: '官网', value: 'www.gach1koi.site' },
			{ label: '小红书', value: 'www.xiaohongshu.com' }
		]
	}
];
