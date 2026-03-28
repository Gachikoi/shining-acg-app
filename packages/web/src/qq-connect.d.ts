/**
 * 腾讯 QQ 互联 `qc_jssdk.js` 注入的全局 `QC` 类型声明。
 *
 * @see https://wiki.connect.qq.com/js_sdk%E4%BD%BF%E7%94%A8%E8%AF%B4%E6%98%8E
 */
export {};

declare global {
	/**
	 * `QC.Login` 登录成功回调第一参：与 OpenAPI `get_user_info` 返回字段一致的基础用户信息。
	 * `ret === 0` 表示成功。
	 */
	interface QQConnectUserInfo {
		ret: number;
		msg?: string;
		nickname?: string;
		figureurl?: string;
		figureurl_1?: string;
		figureurl_2?: string;
		gender?: string;
		vip?: string;
		level?: string;
		[key: string]: unknown;
	}

	/**
	 * `QC.Login(options, …)` 的 `options` 参数：按钮挂载点、授权 scope、按钮尺寸等。
	 */
	interface QCLoginOptions {
		/** 页面内唯一元素 id，SDK 将在此节点插入或替换登录按钮 */
		btnId?: string;
		/** 用户需确认的 scope，默认 `all` */
		scope?: string;
		/**
		 * 内置按钮尺寸，默认 `B_S`。
		 * 可选值：A_XL | A_L | A_M | A_S | B_M | B_S | C_S
		 */
		size?: 'A_XL' | 'A_L' | 'A_M' | 'A_S' | 'B_M' | 'B_S' | 'C_S';
	}

	/**
	 * `QC.Login` 本体：既是初始化函数，又挂载 `signOut` / `check` / `getMe` / `showPopup`。
	 */
	interface QCLoginCallable {
		/**
		 * 初始化 QQ 登录（插入按钮、绑定授权流程）。
		 *
		 * @param options - 按钮与授权相关配置
		 * @param loginFun - 登录成功回调：`reqData` 为用户信息，`opts` 为初始化 options 回传（多按钮时用于区分来源）
		 * @param logoutFun - 注销成功回调，参数为初始化 options 回传
		 * @param outCallBackFun - 官方文档仅列出形参名，未说明具体语义与调用时机；若需兼容旧版脚本可传入，一般可省略
		 * @returns void
		 */
		(
			options: QCLoginOptions,
			loginFun?: (reqData: QQConnectUserInfo, opts: QCLoginOptions) => void,
			logoutFun?: (opts: QCLoginOptions) => void,
			outCallBackFun?: (...args: unknown[]) => void
		): void;

		/**
		 * 注销当前登录用户。
		 *
		 * @returns void
		 */
		signOut(): void;

		/**
		 * 是否已登录（授权有效）。
		 *
		 * @returns 已登录为 true，否则 false
		 */
		check(): boolean;

		/**
		 * 在已登录前提下获取当前用户的 OpenID 与 Access Token。
		 *
		 * @param callback - `openId` 用户唯一标识；`accessToken` 会话与授权信息
		 * @returns void
		 */
		getMe(callback: (openId: string, accessToken: string) => void): void;

		/**
		 * 直接打开 QQ 登录弹窗；可与 `QC.Login` 二选一使用。
		 *
		 * @param oOpts - `appId`、`redirectURI`；不传则登录成功后回到当前页
		 * @returns 浏览器弹窗对象，环境不支持时可能为 null
		 */
		showPopup(oOpts?: { appId?: string; redirectURI?: string }): Window | null;
	}

	/** `QC.String` 工具（模板与 HTML 转义等） */
	interface QCStringApi {
		/**
		 * @param template - 含 `{key}` 占位符的模板串
		 * @param data - 占位符键值
		 * @returns 替换后的字符串
		 */
		format(template: string, data: Record<string, unknown>): string;

		/**
		 * @param str - 原始字符串
		 * @returns 转义后的安全 HTML 片段
		 */
		escHTML(str: string): string;
	}

	/** `qc_jssdk.js` 暴露的全局命名空间（与脚本中全局变量 `QC` 对应） */
	interface QCNamespace {
		Login: QCLoginCallable;
		String: QCStringApi;
		/**
		 * 调用 OpenAPI 封装。
		 *
		 * @param api - OpenAPI 名称，如 `get_user_info`
		 * @param paras - 业务参数（无需自行传 access_token / openid）
		 * @param fmt - 返回格式 `json` | `xml`，默认 json
		 * @param method - `GET` | `POST`
		 * @returns SDK 的 Request 对象，可链式注册 success / error / complete
		 */
		api(api: string, paras: Record<string, unknown>, fmt?: string, method?: string): unknown;
	}

	/** 由 `https://connect.qq.com/qc_jssdk.js` 注入 */
	const QC: QCNamespace;
}
