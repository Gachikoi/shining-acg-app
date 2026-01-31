// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	type ResolvePath = Parameters<typeof import('$app/paths').resolve>[0];

	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
