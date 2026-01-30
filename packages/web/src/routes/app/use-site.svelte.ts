import { PUBLIC_IS_TEST } from '$env/static/public';

export function useSiteMetadata() {
	const officialSiteUrl =
		PUBLIC_IS_TEST === 'true' ? 'https://test.www.shiningacg.club' : 'https://www.shiningacg.club';

	return {
		officialSiteUrl
	};
}
