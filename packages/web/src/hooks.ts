import type { Reroute } from '@sveltejs/kit';

export const reroute: Reroute = ({ url }) => {
	const { hostname, pathname } = url;

	let newPath = pathname;

	// 使用 includes 而非 === 是为了兼容测试环境的域名
	if (hostname.includes('app.shiningacg.club')) {
		newPath = `/app${pathname}`;
	} else if (hostname.includes('shiningacg.club')) {
		newPath = `/site${pathname}`;
  }

	return newPath;
};
