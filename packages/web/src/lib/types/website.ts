/**
 * 官网编辑相关类型定义
 */

/**
 * 链接类型
 */
export interface Link {
	label: string; // 文字说明
	value: string; // 链接地址
}

/**
 * 发展历程项
 */
export interface DevelopmentHistoryItem {
	id?: string; // 可选ID，用于编辑已有项
	image: string; // 图片URL
	date: string; // 时间（格式：YYYY-MM-DD）
	description: string; // 描述（最多30字符）
}

/**
 * 了解我们模块
 */
export interface AboutUs {
	aboutShining: string; // 关于晒你（最多300字符）
	relatedLinks: Link[]; // 相关链接
	developmentHistory: DevelopmentHistoryItem[]; // 发展历程
	contactInfo: string; // 联系晒你（最多300字符）
}

/**
 * 部门信息
 */
export interface DepartmentInfo {
	id: string; // 部门ID
	logo: string; // Logo URL（1:1比例）
	promotionalImage: string; // 宣传图URL（16:9比例）
	promotionalVideo?: string; // 宣传视频URL（可选）
	videoLink?: string; // 视频链接（可选，如果使用外部链接）
	chineseName: string; // 中文名（最多20字符）
	englishName?: string; // 英文名（最多20字符）
	description: string; // 简介（最多200字符）
	relatedLinks: Link[]; // 相关链接
}

/**
 * 活动信息
 */
export interface ActivityInfo {
	id: string; // 活动ID
	promotionalImage: string; // 宣传图URL（16:9比例）
	promotionalVideo?: string; // 宣传视频URL（可选）
	videoLink?: string; // 视频链接（可选）
	chineseName: string; // 中文名（最多200字符）
	englishName?: string; // 英文名（最多20字符）
	description: string; // 简介（最多200字符）
	relatedLinks: Link[]; // 相关链接
}

/**
 * 部长信息
 */
export interface MinisterInfo {
	id?: string; // 可选ID
	qqNumber: string; // QQ号（最多20字符）
	department: string; // 统领部门
	description: string; // 简介（最多200字符）
}

/**
 * 部长宣言模块
 */
export interface MinisterDeclaration {
	period: string; // 时间段（如：2023-2024 (19代目)）
	appointmentDate: string; // 上任时间（格式：YYYY-MM-DD）
	ministers: MinisterInfo[]; // 各部长信息
}

/**
 * 赞助感谢项
 */
export interface SponsorItem {
	id?: string; // 可选ID
	qqNumber: string; // QQ号（最多20字符）
	sponsorAmount?: string; // 赞助金额（最多20字符）
	description?: string; // 简介（最多200字符）
}

/**
 * 网站Staff项
 */
export interface StaffItem {
	id?: string; // 可选ID
	qqNumber: string; // QQ号（最多20字符）
	role: string; // 职责（最多20字符）
	description?: string; // 简介（最多200字符）
}

/**
 * 关于网站模块
 */
export interface AboutWebsite {
	sponsors: SponsorItem[]; // 赞助感谢列表
	staff: StaffItem[]; // 网站Staff列表
}

/**
 * 官网编辑完整数据结构
 */
export interface WebsiteContent {
	homepageVideo?: string; // 首页视频URL（16:9比例）
	aboutUs: AboutUs; // 了解我们
	departments: DepartmentInfo[]; // 部门信息列表
	activities: ActivityInfo[]; // 活动信息列表
	ministerDeclarations: MinisterDeclaration[]; // 部长宣言列表
	aboutWebsite: AboutWebsite; // 关于网站
}
