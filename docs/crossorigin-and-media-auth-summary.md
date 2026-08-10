# `img` 的 `crossorigin` 与媒体鉴权讨论总结

## 1. `img` 标签设置 `crossorigin` 有什么作用

`crossorigin` 主要控制浏览器发起跨域资源请求时的 CORS 模式，影响点包括：

1. 是否能安全用于 `canvas` 读像素/导出  
不满足 CORS 条件时，跨域图片会导致 canvas 被污染（tainted），`toDataURL/getImageData` 会报错。

2. 是否携带凭证（cookie 等）  
`crossorigin` 会决定请求是否带凭证，以及服务端需要返回什么 CORS 头。

## 2. `anonymous` 与 `use-credentials` 的区别

### `crossorigin="anonymous"`

1. 跨域请求不带 cookie/认证信息。  
2. 服务端通常只需返回匹配的 `Access-Control-Allow-Origin`。

### `crossorigin="use-credentials"`

1. 跨域请求会带 cookie/凭证。  
2. 服务端必须返回：
`Access-Control-Allow-Credentials: true`  
`Access-Control-Allow-Origin: <具体前端源>`（不能是 `*`）。

## 3. 能起到防盗链作用吗

基本不能。  

原因：

1. `crossorigin` 是浏览器侧 CORS 行为控制，不是访问控制系统。  
2. 直链、服务端转发、爬虫等路径不依赖浏览器 CORS 读权限。

更有效的防盗链/访问控制方案：

1. 私有存储 + 短期签名 URL（推荐）  
2. CDN Signed URL / Signed Cookie / Token  
3. 网关层鉴权（签名、过期时间、IP/UA 等）  
4. `Referer` 校验只能做辅助手段，容易被绕过。

## 4. `use-credentials` 有什么实际好处

只有在“资源服务本身就是 Cookie 鉴权”的情况下才有价值：

1. 跨域请求自动带该域的登录态 cookie。  
2. 可用于“登录后可见”的图片/视频资源访问。

如果资源本来就是公开的，或服务端不按 cookie 做鉴权，`use-credentials` 基本看不到收益。

## 5. MinIO 能否直接用 `use-credentials` + 业务 cookie/JWT 鉴权

结论：通常不能直接实现你想要的业务鉴权语义。

### MinIO 常见鉴权模型

1. AWS SigV4 签名  
2. Presigned URL  
3. 临时访问密钥（STS）后再 SigV4

MinIO Console 的登录 cookie 仅用于管理控制台，不等于对象 API 的业务鉴权机制。

## 6. 如果 JWT 在 `localStorage`，`use-credentials` 有用吗

对 `<img>/<video>` 标签直链场景，基本没用。

原因：

1. `use-credentials` 自动带的是 cookie，不会读取并自动附加 `localStorage` 里的 JWT。  
2. 标签请求通常不能像 `fetch` 那样灵活注入 `Authorization: Bearer ...`。

## 7. `use-credentials` 何时能派上用场

以下条件同时满足时很有用：

1. 资源不是直连 MinIO，而是走你的业务网关/CDN 域名。  
2. 该域名使用 cookie/session 鉴权。  
3. 网关会校验 cookie 决定是否返回媒体资源。  
4. 前端跨域加载媒体时使用 `crossorigin="use-credentials"`。

## 8. 推荐实践（结合当前项目）

1. 对象存储保持私有（不要长期 public）。  
2. 后端按业务鉴权后签发短期 Presigned URL。  
3. 前端不要持久化“永久可播地址”，而是按需刷新短期地址。  
4. CORS 白名单作为浏览器约束，不应视为核心访问控制。

