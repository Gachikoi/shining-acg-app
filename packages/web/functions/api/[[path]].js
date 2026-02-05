export async function onRequest(context) {
	const url = new URL(context.request.url);
	// 从路径中移除 /api 前缀
	const path = url.pathname.replace(/^\/api/, '');

	// 判断当前域名是否包含 'test'
	// 例如 test.app.shiningacg.club -> test.api.shiningacg.club
	// app.shiningacg.club -> api.shiningacg.club
	const isTest = url.hostname.includes('test');

	const targetDomain = isTest ? 'test.api.shiningacg.club' : 'api.shiningacg.club';
	const targetOrigin = `https://${targetDomain}:61080`;

	// 构建目标 URL
	const targetUrl = new URL(path + url.search, targetOrigin);

	// 复制请求头
	const newHeaders = new Headers(context.request.headers);
	newHeaders.delete('Host');
	// 注意: Cloudflare 会自动处理 Upgrade: websocket 头

	// GET 和 HEAD 请求不能带 body，且 WebSocket 握手是 GET 请求
	const hasBody = !['GET', 'HEAD'].includes(context.request.method);

	try {
		const response = await fetch(targetUrl, {
			method: context.request.method,
			headers: newHeaders,
			body: hasBody ? context.request.body : null,
			redirect: 'follow'
		});

		return response;
	} catch (err) {
		return new Response('Proxy Error: ' + err.message, { status: 502 });
	}
}
