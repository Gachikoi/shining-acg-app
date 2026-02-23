import { env } from '$env/dynamic/public';

export const IS_TEST = env.PUBLIC_IS_TEST !== 'false';

export const DOMAIN_CONFIG = {
	app: IS_TEST ? 'test.app.shiningacg.club' : 'app.shiningacg.club',
	site: IS_TEST ? 'test.www.shiningacg.club' : 'www.shiningacg.club',
	root: IS_TEST ? 'test.shiningacg.club' : 'shiningacg.club',
	appSuffix: 'app.shiningacg.club',
	siteSuffix: 'www.shiningacg.club',
	rootSuffix: 'shiningacg.club'
};
