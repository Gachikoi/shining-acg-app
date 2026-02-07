export async function onRequest(context) {
	const url = new URL(context.request.url);

	// 判断当前域名是否包含 'test'
	// test.app.shiningacg.club -> test.api.shiningacg.club
	// app.shiningacg.club -> api.shiningacg.club
	const isTest = url.hostname.includes('test');

	const targetDomain = isTest ? 'test.api.shiningacg.club:61081' : 'api.shiningacg.club:61080';
	const targetOrigin = `https://${targetDomain}`;

	// 构建目标 URL
	const targetUrl = new URL(url.pathname + url.search, targetOrigin);

	// 复制请求头
	const newHeaders = new Headers(context.request.headers);
	newHeaders.delete('Host');

	try {
		const response = await fetch(targetUrl, {
			method: context.request.method,
			headers: newHeaders,
			body: context.request.body,
			redirect: 'follow'
		});

		return response;
	} catch (err) {
		return new Response('cloudflare pages functions 反向代理错误: ' + err.message, { status: 502 });
	}
}
