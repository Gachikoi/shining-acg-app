import { env } from '$env/dynamic/public';

export function useSiteMetadata() {
	const officialSiteUrl =
		env.PUBLIC_IS_TEST === 'true'
			? 'https://test.www.shiningacg.club'
			: 'https://www.shiningacg.club';

	return {
		officialSiteUrl
	};
}
