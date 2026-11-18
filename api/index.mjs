import { handleRequest } from '../backend/src/server.mjs';

// Single Vercel Function: /healthz, /readyz and /api/v1/* share one runtime.
export default async function handler(request, response) {
  const url = new URL(request.url || '/', 'http://localhost');
  const fromRewrite = typeof request.query?.__route === 'string'
    ? request.query.__route
    : url.searchParams.get('__route');

  if (fromRewrite) {
    if (!/^\/(?:healthz|readyz|api\/v1\/[a-zA-Z0-9/_-]+)$/.test(fromRewrite)) {
      response.statusCode = 400;
      response.setHeader('Content-Type', 'application/json');
      response.end(JSON.stringify({ error: 'invalid_api_route' }));
      return;
    }
    url.searchParams.delete('__route');
    const params = url.searchParams.toString();
    request.url = fromRewrite + (params ? '?' + params : '');
  }
  return handleRequest(request, response);
}
