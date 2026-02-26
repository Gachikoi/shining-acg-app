import { PUBLIC_IS_TEST } from '$env/static/public';

export const IS_TEST = PUBLIC_IS_TEST !== 'false';

export const DOMAIN_CONFIG = {
	app: IS_TEST ? 'test.app.shiningacg.club' : 'app.shiningacg.club',
	site: IS_TEST ? 'test.www.shiningacg.club' : 'www.shiningacg.club',
	root: IS_TEST ? 'test.shiningacg.club' : 'shiningacg.club',
	api: IS_TEST ? 'test-api.shiningacg.club' : 'api.shiningacg.club',
	appSuffix: 'app.shiningacg.club',
	siteSuffix: 'www.shiningacg.club',
	rootSuffix: 'shiningacg.club'
} as const;

export enum LocalStorageKeys {
	DEVICE_ID = 'device_id',
	TOKEN = 'token',
	USER_ID = 'user_id'
}
