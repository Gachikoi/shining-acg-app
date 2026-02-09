import type { CreateClientConfig } from './lib/api/client/client.gen.ts';

export const createClientConfig: CreateClientConfig = (config) => ({
	...config,
	baseURL: 'https://api.shiningacg.club/api'
});
