# Web

晒你 App 及官网的 Web 项目。

# 技术栈

UI 框架：[Svelte](svelte.js.cn/docs/svelte)

元框架：[SvelteKit](svelte.js.cn/docs/kit)

组件库：[Shadcn-svelte](www.shadcn-svelte.com/docs)

图标库：[lucide-svelte](lucide.dev)

运行时 & 包管理工具：[Deno](https://deno.land/)

Format & Lint：[Prettier](www.prettier.cn/docs)、[Eslint](https://eslint.org/)

CSS：[TailwindCSS](https://tailwindcss.com/docs)

# 项目结构

```text
src/
├── lib/                  # 核心库代码
│   ├── assets/           # 组件相关静态资源
│   ├── components/       # 可复用 Svelte 组件
│   │   ├── custom/       # 项目自定义业务组件
│   │   └── ui/           # 基础 UI 组件 (基于 Shadcn-svelte)
│   ├── index.ts          # 库入口文件
│   └── utils.ts          # 工具函数
├── routes/               # 路由页面 (SvelteKit 路由)
│   ├── app/              # 晒你App（app）
|   ├   ├── components/   # /app 路由页专有组件
│   ├── site/             # 晒你官网（site）
│   ├── +layout.svelte    # 全局布局
│   └── layout.css        # 全局样式
├── app.d.ts              # 类型定义
├── app.html              # HTML 模板
└── hooks.ts              # 运行时钩子
static/                   # 静态资源 (robots.txt, 图标等)
svelte.config.js          # SvelteKit 配置
vite.config.ts            # Vite 构建配置
package.json              # 项目依赖及脚本
```

# 快速开始

## 环境要求

- [Deno](https://deno.land/) 2.6.0

## 网络代理

whistle 配置：

```
app.shiningacg.club http://127.0.0.1:5173/
www.shiningacg.club http://127.0.0.1:5173/
shiningacg.club http://127.0.0.1:5173/
```

配置作用解释：

该sveltekit项目以一个 spa 应用的形式集成了 app 和 site 两个网站。为了符合用户直觉，我们在 src/hooks.ts 文件中将 app.shiningacg.club 域名 reroute 到 /app 路由下，将 www.shiningacg.club、shiningacg.club 域名 reroute 到 /site 路由下，以实现在一个 spa 应用中模拟两个独立应用到效果。

如果不配置 whistle 代理，直接用本地 ip（如127.0.0.1、localhost）访问项目，会在开发过程中出现路由导航问题。

## dev

```sh
deno task dev
```

## build

```sh
deno task build
```

## 添加npm依赖

```sh
deno add npm:[依赖名称]

# 例
npm add lucide-svelte
# ⬇️
deno add npm:lucide-svelte
```

## 运行 npm 命令

```sh
deno run -A npm:[命令]

# 例
npm sv create my-app
# ⬇️
deno run -A npm:sv create my-app
```

# 统一样式规范

由于设计稿只给出了 lg 以上尺寸的设计稿，因此lg以下的响应式设计需要参照[小红书](www.xiaohongshu.com)的设计思路。

背景和边框颜色：zinc/100

白色在深色背景下的替代颜色：zinc/100

黑色代替颜色：zinc/900

灰色说明文字颜色：zinc/500

红色是red/500

样式都用tailwindcss不用普通css，理论上仅依靠tailwindcss 是可以实现全部样式需求的。除非实在有特殊需要。并且手写 css必须采用rem适配（为了适配系统级的字体缩放）。

需要适配黑暗模式

字体使用font-sans（tailwindcss中的原子类），设计稿中以 figma 内置字体替代

能用 shadcn （www.shadcn-svelte.com）的组件就用 shadcn的组件来做，Icon使用shadcn支持的lucide（lucide.dev）图标库。

可交互元素需要在hover、右键、click、长按......时给一个缓入缓出的交互动画。白底元素一般是将背景色设为zinc/100；图片、视频等背景内容丰富的一般是覆盖一层#000，不透明度20%的遮罩。

可点击事物（如按钮）的最小可触控区域为44x44px，可以考虑给元素额外的padding/伪元素来实现热区扩充，具体酌情实现。

# CI/CD

## 域名

测试环境域名：test-app.shiningacg.club、test-www.shiningacg.club

生产环境域名：app.shiningacg.club、www.shiningacg.club、shiningacg.club

域名管理链接：

域名接口人：

## 部署运维

测试环境：https://dash.cloudflare.com/dca725a549c82a7e9364aeced533962e/pages/view/test-shining-acg-app

生产环境：https://dash.cloudflare.com/dca725a549c82a7e9364aeced533962e/pages/view/shining-acg-app

运维接口人：

1. ガチ恋

- QQ：1131997238
- 邮箱：1131997238@qq.com
- 微信：mineskura
