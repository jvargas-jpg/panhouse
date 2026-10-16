/** Strip OAuth callback query before Fastify's automatic incoming-request logger. */
export function safeRequestUrl(url:string|undefined) {
  if (!url) return url;
  return url.split('?')[0] === '/api/auth/google/callback' ? '/api/auth/google/callback' : url;
}
