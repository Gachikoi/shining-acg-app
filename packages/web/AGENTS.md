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
│   ├── modules/            # Feature modules (gesture, cache, device, bridge, virtual-feed, release-media, media-cover)
│   ├── stores/             # Svelte state stores
│   │   ├── feed/           # Feed 瀑布流 store
│   │   └── release/        # 发布页 store（草稿持久化）
│   ├── types/              # Type definitions
│   ├── utils.ts            # cn(), type helpers
│   └── utils/              # Utility functions
│       └── format-time.ts
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

`src/lib/modules/media-uploader/` 封装基于 Uppy + @uppy/aws-s3-multipart 的媒体上传流程，release 页面使用。

```
PrepareUploadBatch → CreateMultipartUpload → (SignPart → PUT) × N → CompleteMultipartUpload
```

`src/lib/modules/release-media/` 为发布页媒体适配层，负责 File[] ↔ DraftMediaItem[] ↔ PrepareUploadParams 的转换，支持 Live Photo（`lp_<groupId>_image|video.*` 命名规则）。

```typescript
import { createMediaUploader } from '$lib/modules/media-uploader';
import {
	filesToDraftItems,
	draftItemsToPrepareParams,
	getPreviewBlob,
	mediaItemsEqual
} from '$lib/modules/release-media';

// 文件选择 → 草稿格式（含 Live Photo 解析）
const items = filesToDraftItems(files, 'MEDIA_SCENE_POST_MEDIA');

// 草稿恢复后 → 上传参数
const params = draftItemsToPrepareParams(cachedMediaItems, 'MEDIA_SCENE_POST_MEDIA');
const batchId = await uploader.upload(params);
```

- 草稿媒体以 `DraftMediaItem[]` 存于 IndexedDB（Blob + name，支持 single 与 live_photo），上传前由 `draftItemsToPrepareParams` 重建 File。

---

## Release 封面与草稿演进

### 封面样式接口（media-cover）

`src/lib/modules/media-cover/` 提供视频首帧抽取、文字封面生成与统一封面决策。

- **TextCoverRenderer**：文字封面渲染器接口，通过 `registerTextCoverRenderer` 注册；新增样式时实现该接口并注册，禁止覆盖已有 id。
- **样式 ID 白名单**：仅已注册样式视为合法；`resolveCoverBlob` 收到未知 `textCoverStyleId` 时回退 `default`，保证线上稳定。
- **默认样式**：`DEFAULT_TEXT_COVER_STYLE_ID = 'default'`，新增样式需在 registry 中注册后方可被选用。

### 草稿结构演进

`src/lib/stores/release/release-draft.ts` 采用 **schemaVersion + 默认值填充** 管理草稿结构演进。

- **默认值填充**：新增字段时递增 `RELEASE_DRAFT_SCHEMA_VERSION`，并在 `loadReleaseDraft` 中为缺失字段补充默认值；项目未上线前无需迁移链。
- **禁止破坏性变更**：不得删除或重命名已有字段。
- **归一化**：加载后对 `textCoverStyleId` 等做白名单校验，非法值回退 `default`；必要时回写最新结构。
- **上线后**：若需兼容旧版草稿，再引入迁移链（`migrateDraftVxToVy` 等）。
