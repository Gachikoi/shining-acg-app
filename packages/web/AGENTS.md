# AGENTS.md - Shining ACG App Web Project

为本 SvelteKit Web 项目提供编码代理的工作指南。

## 项目概览

基于域名路由的 SvelteKit 单页应用（SPA），集成了「晒你 ACG」App 界面（`/app` 路由）、官方网站（`/site` 路由）以及 QQ 登录辅助页（`/login-helper` 路由）。

**技术栈：** Deno 2.6.0+、Svelte 5、SvelteKit、shadcn-svelte、lucide-svelte、`@lucide/svelte`、TailwindCSS v4、TypeScript（严格模式）、Prettier、ESLint、lightningcss

---

## 构建 / 检查 / 测试命令

```bash
# 开发与构建
deno task dev              # 启动开发服务器
deno task build            # 生产构建
deno task build:analyze    # 带产物分析器的构建（ANALYZE=1）
deno task preview          # 预览生产构建

# 类型检查
deno task check            # 运行 svelte-check
deno task check:watch      # 监听模式

# 代码规范与格式化
deno task lint             # Prettier 检查 + ESLint
deno task lint:path src/lib/components/  # 检查指定路径
deno task format           # 格式化全部文件
deno task format:check:path src/utils.ts # 检查指定文件格式

# 接口生成（在项目根目录执行）
deno task gen:api          # 根据 Proto 生成 API 客户端
```

**注意：** 本项目目前暂无自动化测试。

---

## 项目结构

```
src/
├── lib/
│   ├── actions/            # 自定义 Svelte 指令（draggable-scroll、long-press、context-popover）
│   ├── api/                # 自动生成（禁止手动修改）
│   ├── assets/             # 组件相关静态资源
│   ├── components/
│   │   ├── custom/         # 业务组件
│   │   └── ui/             # shadcn-svelte 组件
│   ├── constants.ts        # 应用常量与 DOMAIN_CONFIG
│   ├── events/             # 全局事件总线（mitt）
│   ├── index.ts            # 库入口文件
│   ├── models/             # 数据模型
│   ├── modules/            # 功能模块
│   │   ├── bridge/         # 跨上下文桥接工具
│   │   ├── cache/          # IndexedDB 缓存（DbCache）与 Service Worker URL 辅助
│   │   ├── device/         # 响应式断点（基于 Svelte 5 Runes）
│   │   ├── gesture/        # Svelte 5 手势竞技场系统
│   │   ├── media-cover/    # 封面生成与样式注册表
│   │   ├── media-uploader/ # 基于 Uppy 的分片上传
│   │   ├── release-media/  # 发布页媒体适配层
│   │   └── reorder-grid/   # 自研 wrap-grid 拖拽排序
│   ├── stores/             # Svelte 状态存储
│   │   ├── feed/           # Feed 瀑布流 store
│   │   └── release/        # 发布页 store（草稿持久化）
│   ├── types/              # 类型定义
│   ├── utils.ts            # cn()、格式化辅助、并发限制器
│   └── utils/              # 工具函数
│       ├── animation/
│       ├── device.ts
│       ├── format-time.ts
│       ├── format-upload-error.ts
│       ├── media-url.ts
│       ├── operation-error-message.ts
│       └── virtual-scroll/
├── routes/
│   ├── app/                # app.shiningacg.club 路由
│   ├── site/               # www.shiningacg.club 路由
│   ├── login-helper/       # QQ 登录辅助路由
│   ├── +layout.svelte      # 根布局
│   └── layout.css          # 全局样式（Tailwind 入口）
├── app.d.ts                # 应用级类型
├── app.html                # HTML 模板
├── hey-api.svelte.ts       # API 客户端配置（自定义 axios 实例）
├── hooks.ts                # 域名路由
└── service-worker.ts       # Service Worker
static/                     # 静态资源
svelte.config.js            # SvelteKit 配置
vite.config.ts              # Vite 构建配置（manualChunks、lightningcss）
components.json             # shadcn-svelte 配置
package.json                # 依赖与脚本
```

---

## 代码风格

### 格式化（Prettier）

配置位于 `.prettierrc`：

- 使用 Tab 缩进、单引号、**无尾随逗号**、单行最大 100 字符、LF 换行
- 插件：`prettier-plugin-svelte`、`prettier-plugin-tailwindcss`
- Tailwind 样式表：`./src/routes/layout.css`

### 导入规范

```typescript
import { cn } from '$lib/utils.js';
import { Button } from '$lib/components/ui/button';
import { PUBLIC_IS_TEST } from '$env/static/public';
```

### 文件命名

- 普通文件：`kebab-case.ts`、`kebab-case.svelte`
- 组件名：PascalCase（如 `<Button />`）
- 工具函数：camelCase，类型名：PascalCase

### Svelte 5 代码模式

组件变体使用 `tailwind-variants`（`tv`）：

```svelte
<script lang="ts" module>
	import { tv } from 'tailwind-variants';
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

- **严格模式** — 禁止使用 `any`、`@ts-ignore`、`@ts-expect-error`
- 导出的函数需显式声明返回类型
- 使用 `satisfies` 运算符进行带推断的类型检查

### 错误处理

```typescript
try {
	await someApiOperation();
	// 成功时显示 toast
} catch (error) {
	// 失败时显示 toast
	console.error('操作失败：', error);
}
```

### ESLint 显著覆盖规则

- `@typescript-eslint/no-unused-vars`：允许以 `_` 开头的参数或变量未被使用
- `svelte/no-href-without-base`：**关闭** — 本项目使用基于域名的 `reroute` 路由（`hooks.ts`），而非 `paths.base` 路径前缀
- `svelte/no-navigation-without-resolve`：**关闭** — 原因同上
- `svelte/prefer-svelte-reactivity`：**关闭**

---

## 关键规则

### 禁止编辑 `src/lib/api/`

该目录完全由 Proto 自动生成。如需修改客户端运行时配置，请编辑 `src/hey-api.svelte.ts`。

### 包管理

```bash
deno add npm:package-name    # 正确
npm install package-name     # 错误
```

### 运行 npm 命令

```bash
deno run -A npm:sv create my-app  # 正确
```

---

## UI/UX 规范

### 样式

- **仅使用 TailwindCSS** — 避免手写 CSS；如确有需要，使用 `rem` 单位
- **必须支持暗黑模式**
- 字体：`font-sans`

### 配色

- 背景/边框：`zinc-100`，文字：`zinc-900`，说明文字：`zinc-500`
- 主色红：`red-500`

### 交互

- **最小触控区域：44×44px** — 可通过 padding 或伪元素扩展热区
- 悬停/激活/聚焦状态使用 ease-in-out 过渡动画
- 白色悬停背景：`zinc-100`；媒体遮罩层：`#000`、20% 不透明度

### 组件

- **优先使用 shadcn-svelte** 组件
- **图标使用 lucide-svelte / `@lucide/svelte`**
- 自定义组件需添加 JSDoc 及使用示例

### 输入处理

- **所有输入框必须限制最大长度** — 设计稿有标注则按标注，无标注则默认 1000 字符

---

## 环境变量

使用 `$env/static/public` 在构建时注入环境变量。缺失必要变量将导致构建直接报错。

```bash
cp .env.example .env.local
```

---

## 域名路由

`src/hooks.ts` 通过 `DOMAIN_CONFIG`（定义于 `src/lib/constants.ts`）处理域名路由：

- `app.shiningacg.club` / `test.app.shiningacg.club` → `/app` 路由
- `www.shiningacg.club` / `shiningacg.club` 及其测试域名 → `/site` 路由
- `shiningacg.gach1koi.site` / `test-shiningacg.gach1koi.site` → `/login-helper` 路由

本地开发需配置 whistle 代理（详见 README.md）。

---

## 架构模式

### 手势竞技场（`$lib/modules/gesture`）

受 Flutter Gesture Arena 启发的 Svelte 5 手势仲裁系统。所有竞争手势（swipe、feed-stream、long-press、tap）在生效前必须先获取竞技场控制权。

**核心概念：**

- `tryAcquire` 必须在事件处理函数内**同步**调用（之前不可插入 `await`）
- `use:edgeZone` 注册边缘优先区域（例如距左边缘 24px 的返回手势）
- `use:scrollBoundary` 允许子容器在滚动到边界时将控制权平滑移交给父容器
- 嵌套且使用相同阈值语义的手势识别器应共享同一 slop 值（参见 `DEFAULT_POINTER_SLOP_PX`）

**导入规则：** 仅从 `$lib/modules/gesture`（即 `index.ts`）导入；子路径可能随重构变化。

### 栈导航（`$lib/components/custom/stack`）

用于应用内导航的命令式页面栈管理器，模拟原生 App 的堆叠页面效果。

**全局挂载一次：** 在 `+layout.svelte` 中放置 `StackContainer`：

```svelte
<script>
	import { StackContainer } from '$lib/components/custom/stack';
</script>

<StackContainer zIndexBase={100} maxVisible={5} />
```

**业务操作（通过 `stackController`）：**

```typescript
import stackController from '$lib/components/custom/stack';

// 静态 push：直接传入已 import 的组件
await stackController.push({ component: MyPage, props: { id: 1 } });

// 懒加载 push：解决子 push 父 / 自引用导致的循环 import
await stackController.push({
	loader: () => import('./my-page.svelte'),
	props: { id: 1 }
});

// 触点缩放动画：传入触发元素的 viewport 矩形（必须来自 getBoundingClientRect()）
await stackController.push({ component: MyPage, rectInfo: el.getBoundingClientRect() });

// 出栈（业务代码不要传 false）
stackController.pop();

// 清空栈（无动画）
stackController.clearStack();
```

**`PushOptions` 字段说明：**

| 字段                   | 说明                                                                       |
| ---------------------- | -------------------------------------------------------------------------- |
| `component` / `loader` | 二选一：直接传组件引用，或传动态 import 函数                               |
| `props`                | 传给目标组件的 props                                                       |
| `rectInfo`             | `{ top, left, width, height }`，有则 push 时从触点缩放进入，pop 时缩回触点 |
| `next`                 | 下一页配置（同 push，不含 `next`）；栈顶左滑时按该配置再 push 一层         |
| `ignoreSafeArea`       | `true` 时不加安全区上下 padding；默认 `false`                              |

**只读状态（供响应式读取）：**

- `stackController.items` — 当前栈数组
- `stackController.length` — 栈深度
- `stackController.top` — 栈顶元素
- `stackController.swipeState` / `animationPhase` / `isPushingNext` — 手势与动画状态

**`maxVisible` 与可见性裁剪：**

- `StackContainer` 的 `maxVisible` 限制同时渲染的 DOM 层数，更早的层会卸载以节省内存
- 卸载时自动保存 DOM 快照（transform / clipPath / transition），重新挂载时恢复，避免视觉跳变
- 子页面组件可通过暴露 `queryStatus()` 方法返回 `'living' | 'silence'` 来影响裁剪优先级；处于 `living` 的页面更不容易被卸载

**手势交互：**

- **右滑返回**：栈顶页面支持从屏幕边缘（左侧 24px）右滑退出，由 `use:swipe` + `use:edgeZone` 实现
- **左滑 pushNext**：若当前栈顶元素配置了 `next`，左滑时会触发 `stackController.pushNext()`，从右侧滑入下一页
- 手势过程中第二层页面会同步做视差位移，营造原生感

### 拖拽排序网格（`$lib/modules/reorder-grid`）

不依赖 SortableJS 的自研 wrap-grid 拖拽排序。使用纯函数布局 + `transform: translate` + `slotOrder` 间接层。

```svelte
<script>
	import { ReorderGrid } from '$lib/modules/reorder-grid';
</script>

<ReorderGrid {items} onReorder={handleReorder}>
	{#snippet item(item, index)}
		<div class="h-full w-full rounded-lg bg-muted">{item.title}</div>
	{/snippet}
</ReorderGrid>
```

**使用规则：**

- `{#each}` 的 key 必须使用稳定引用（如对象本身），禁止使用会变化的数组下标
- `getLayout()` 计算列数时必须使用 `contentWidthPx`，不可使用 `getBoundingClientRect().width`

### 响应式断点（`$lib/modules/device`）

基于 Svelte 5 Runes 的 Tailwind 断点检测器：

```svelte
<script>
	import { breakpoint } from '$lib/modules/device';
	let cols = $derived(breakpoint.isMd ? 2 : 1);
</script>

{#if breakpoint.isLg}<DesktopLayout />{/if}
```

同时导出 `remToPx(rem)` 与 `pxToRem(px)`，会响应式跟随 `rootFontSize` 变化。

### IndexedDB 缓存（`$lib/modules/cache`）

`DbCache` 封装 `idb-keyval`，提供命名空间隔离与 TTL 过期机制：

```typescript
import { createDbCache } from '$lib/modules/cache';
const feedCache = createDbCache<FeedSnapshot>('feed', { defaultTtl: 5 * 60 * 1000 });
await feedCache.set('general', data);
const data = await feedCache.get('general'); // 过期时返回 null
```

SSR 安全：在非浏览器环境下会优雅降级。

### 事件总线（`$lib/events/app-bus`）

基于 mitt 的跨模块类型安全事件总线：

```typescript
import { appBus } from '$lib/events/app-bus';
appBus.emit('home:refresh');
appBus.on('home:refresh', () => {
	/* ... */
});
```

---

## shadcn-svelte 导出模式

```typescript
// index.ts
import Root, { type Props, type Variant } from './component.svelte';
export { type Props, type Props as ComponentProps, type Variant, Root, Root as Component };
```

---

## API 客户端使用

API 客户端由 hey-api 生成到 `$lib/api/`。运行时配置位于 `src/hey-api.svelte.ts`，其中提供了**自定义 axios 实例**，已注入 Token 并包含 401 统一处理：

```typescript
import { someEndpoint } from '$lib/api/sdk.gen';
const response = await someEndpoint({ path: { id: '123' }, body: { data } });
// 使用 axios 实例，自动注入 Token（配置见 hey-api.svelte.ts）
```

---

## 媒体上传

`src/lib/modules/media-uploader/` 封装了基于 Uppy + `@uppy/aws-s3-multipart` 的上传流程，主要在发布页使用。

```
PrepareUploadBatch → CreateMultipartUpload → (SignPart → PUT) × N → CompleteMultipartUpload
```

`src/lib/modules/release-media/` 是发布页的媒体适配层，负责 `File[] ↔ DraftMediaItem[] ↔ PrepareUploadParams` 的转换，支持 Live Photo（命名规则：`lp_<groupId>_image|video.*`）。

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

// 草稿恢复 → 上传参数
const params = draftItemsToPrepareParams(cachedMediaItems, 'MEDIA_SCENE_POST_MEDIA');
const batchId = await uploader.upload(params);
```

- 草稿媒体以 `DraftMediaItem[]` 形式存储在 IndexedDB 中（Blob + name，支持 single 与 live_photo）
- 上传前由 `draftItemsToPrepareParams` 从草稿中重建 `File` 对象

---

## 发布页封面与草稿演进

### 封面样式接口（`media-cover`）

`src/lib/modules/media-cover/` 提供视频首帧抽取、文字封面生成与统一封面决策。

- **TextCoverRenderer**：文字封面渲染器接口，通过 `registerTextCoverRenderer` 注册；新增样式时实现该接口并注册，禁止覆盖已有 id
- **样式 ID 白名单**：仅已注册样式视为合法；`resolveCoverBlob` 收到未知 `textCoverStyleId` 时回退 `default`，保证线上稳定
- **默认样式**：`DEFAULT_TEXT_COVER_STYLE_ID = 'default'`，新增样式需在注册表中注册后方可被选用

### 草稿结构演进

`src/lib/stores/release/release-draft.ts` 采用 **schemaVersion + 默认值填充** 管理草稿结构演进。

- **默认值填充**：新增字段时递增 `RELEASE_DRAFT_SCHEMA_VERSION`，并在 `loadReleaseDraft` 中为缺失字段补充默认值；项目未上线前无需迁移链
- **禁止破坏性变更**：不得删除或重命名已有字段
- **归一化**：加载后对 `textCoverStyleId` 等做白名单校验，非法值回退 `default`；必要时回写最新结构
- **上线后**：若需兼容旧版草稿，再引入迁移链（`migrateDraftVxToVy` 等）
