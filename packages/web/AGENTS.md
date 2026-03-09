# AGENTS.md - Shining ACG App Web Project

Guide for agentic coding agents working in this SvelteKit web application.

## Project Overview

SvelteKit SPA integrating "Shining ACG" app interface (`/app` routes) and official website (`/site` routes) using domain-based routing.

**Tech Stack:** Deno 2.6.0+, Svelte 5, SvelteKit, shadcn-svelte, lucide-svelte, TailwindCSS v4, TypeScript (strict), Prettier, ESLint

---

## Build/Lint/Test Commands

```bash
# Development & Build
deno task dev              # Development server
deno task build            # Production build
deno task preview          # Preview production build

# Type Checking
deno task check            # Run svelte-check
deno task check:watch      # Watch mode

# Linting & Formatting
deno task lint             # Prettier check + ESLint
deno task lint:path src/lib/components/  # Lint specific path
deno task format           # Format all files
deno task format:check:path src/utils.ts # Format check path

# API Generation (from project root)
deno task gen:api          # Generate API client from proto
```

**Note:** No automated tests in this project currently.

---

## Project Structure

```
src/
├── lib/
│   ├── api/                # AUTO-GENERATED (DO NOT EDIT)
│   ├── components/
│   │   ├── custom/         # Business components
│   │   └── ui/             # shadcn-svelte components
│   ├── constants.ts        # App constants
│   ├── models/             # Data models
│   ├── modules/            # Feature modules (gesture, cache, device, bridge, virtual-feed)
│   ├── stores/             # Svelte state stores
│   │   ├── feed/           # Feed 瀑布流 store
│   │   └── release/        # 发布页 store（草稿持久化）
│   ├── types/              # Type definitions
│   ├── utils.ts            # cn(), type helpers
│   └── utils/              # Utility functions
│       ├── format-time.ts
│       └── media-upload.ts # S3 multipart upload (UploadAbortController, uploadMediaBatch)
├── routes/
│   ├── app/                # app.shiningacg.club routes
│   ├── site/               # www.shiningacg.club routes
│   └── layout.css          # Global styles
├── hey-api.svelte.ts       # API client config
└── hooks.ts                # Domain routing
```

---

## Code Style

### Formatting (Prettier)

Tabs, single quotes, no trailing commas, 100 char width, LF line endings

### Imports

```typescript
import { cn } from '$lib/utils.js';
import { Button } from '$lib/components/ui/button';
import { PUBLIC_IS_TEST } from '$env/static/public';
```

### File Naming

- Files: `kebab-case.ts`, `kebab-case.svelte`
- Components: PascalCase (`<Button />`)
- Utilities: camelCase, Types: PascalCase

### Svelte 5 Pattern

```svelte
<script lang="ts" module>
	export const variants = tv({
		/* ... */
	});
	export type Props = { variant?: string /* ... */ };
</script>

<script lang="ts">
	let {
		class: className,
		variant = 'default',
		ref = $bindable(null),
		children,
		...rest
	}: Props = $props();
	let isLoading = $state(false);
	let computedClass = $derived(cn(baseClass, className));
</script>

<button class={computedClass} bind:this={ref} {...rest}>
	{@render children?.()}
</button>
```

### TypeScript

- **Strict mode** - no `any`, `@ts-ignore`, `@ts-expect-error`
- Use explicit return types for exported functions
- Use `satisfies` operator for type checking with inference

### Error Handling

```typescript
try {
	await someApiOperation();
	// Show success toast
} catch (error) {
	// Show error toast
	console.error('Operation failed:', error);
}
```

---

## Critical Rules

### DO NOT Edit `src/lib/api/`

Entirely auto-generated from proto. Edit `src/hey-api.svelte.ts` for config changes.

### Package Management

```bash
deno add npm:package-name    # CORRECT
npm install package-name     # WRONG
```

### Running npm Commands

```bash
deno run -A npm:sv create my-app  # CORRECT
```

---

## UI/UX Guidelines

### Styling

- **TailwindCSS only** - avoid custom CSS; use `rem` if needed
- **Always support dark mode**
- Typography: `font-sans`

### Color Palette

- Background/border: `zinc-100`, text: `zinc-900`, description: `zinc-500`
- Primary red: `red-500`

### Interaction

- **Min touch target: 44x44px** - use padding/pseudo-elements
- Hover/active/focus: ease-in-out animations
- White hover: `zinc-100`; Media overlays: `#000` at 20% opacity

### Components

- **Prefer shadcn-svelte** components
- **Use lucide-svelte** for icons
- Add JSDoc with usage examples for custom components

### Input Handling

- **All inputs need max length** - use design spec or default 1000 chars

---

## Environment Variables

Uses `$env/static/public` for build-time injection. Missing vars cause build errors.

```bash
cp .env.example .env.local
```

---

## Domain Routing

`src/hooks.ts` handles:

- `app.shiningacg.club` → `/app` routes
- `www.shiningacg.club` / `shiningacg.club` → `/site` routes

Configure whistle proxy for local dev (see README.md).

---

## shadcn-svelte Export Pattern

```typescript
// index.ts
import Root, { type Props, type Variant } from './component.svelte';
export { type Props, type Props as ComponentProps, type Variant, Root, Root as Component };
```

---

## API Client Usage

```typescript
import { someEndpoint } from '$lib/api/sdk.gen';
const response = await someEndpoint({ path: { id: '123' }, body: { data } });
// Uses axios with auto token injection (configured in hey-api.svelte.ts)
```

---

## Media Upload

`src/lib/utils/media-upload.ts` encapsulates the S3 multipart upload flow used by the release page.

```
PrepareUploadBatch → CreateMultipartUpload → (SignPart → PUT) × N → CompleteMultipartUpload
```

```typescript
import { uploadMediaBatch, UploadAbortController, dataURLToFile } from '$lib/utils/media-upload';

const controller = new UploadAbortController();
const mediaAssets = await uploadMediaBatch(
	files, // File[]
	crypto.randomUUID(), // batchId — stable for the same submit attempt
	({ uploadedFiles, totalFiles }) => {
		/* update progress UI */
	},
	controller // optional; call controller.abort() to cancel
);
// Pass mediaAssets to postServiceCreatePost({ body: { ..., mediaAssets } })
```

- `dataURLToFile(dataURL, filename)` — converts a stored data URL (e.g. from IndexedDB draft) back to a `File` object when the original `File` reference is unavailable.
- The abort controller sends `AbortMultipartUpload` to clean up S3 temporary parts on cancellation.
