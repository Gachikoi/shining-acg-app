import mitt from 'mitt';

export type AppBusEvents = {
	'home:refresh': void;
};

export const appBus = mitt<AppBusEvents>();
