import { Readable } from 'node:stream';
import { DriveIntegrationError } from './errors.js';

// No OAuth headers or cookies are sent to this public download endpoint.
// Keep the transfer streamed: recordings must not accumulate in server memory.
export const VIDEO_TRANSFER_TIMEOUT = 30 * 60 * 1000;
export async function downloadPublicVideo(fileId: string, resourceKey?: string) {
  if (!/^[\w-]{10,}$/.test(fileId) || resourceKey && !/^[\w-]+$/.test(resourceKey)) {
    throw new DriveIntegrationError('PUBLIC_VIDEO_UNAVAILABLE', 400);
  }
  let url = new URL('https://drive.usercontent.google.com/download');
  url.search = new URLSearchParams({ id: fileId, export: 'download', confirm: 't', ...(resourceKey ? { resourcekey: resourceKey } : {}) }).toString();
  const signal = AbortSignal.timeout(VIDEO_TRANSFER_TIMEOUT);
  for (let redirects = 0; redirects <= 5; redirects++) {
    const response = await fetch(url, { redirect: 'manual', signal });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      await response.body?.cancel();
      const location = response.headers.get('location');
      if (!location) break;
      const next = new URL(location, url);
      if (next.protocol !== 'https:' || next.username || next.password || next.port ||
          !(next.hostname === 'drive.usercontent.google.com' || next.hostname.endsWith('.googleusercontent.com'))) break;
      url = next;
      continue;
    }
    if (!response.ok) {
      await response.body?.cancel();
      if (response.status === 429) throw new DriveIntegrationError('RATE_LIMITED', 429);
      if (response.status >= 500) throw new DriveIntegrationError('GOOGLE_UNAVAILABLE', 503);
      throw new DriveIntegrationError('PUBLIC_VIDEO_UNAVAILABLE', 400);
    }
    const mimeType = response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() ?? '';
    // Google returns HTML for sign-in, disabled downloads and confirmation pages.
    // Never upload those pages as if the video had been saved successfully.
    if (!response.body || !mimeType.startsWith('video/')) {
      await response.body?.cancel();
      throw new DriveIntegrationError('PUBLIC_VIDEO_UNAVAILABLE', 400);
    }
    const extension = ({ 'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov', 'video/x-msvideo': 'avi', 'video/x-matroska': 'mkv' } as Record<string, string>)[mimeType];
    return { content: Readable.fromWeb(response.body), mimeType, extension };
  }
  throw new DriveIntegrationError('PUBLIC_VIDEO_UNAVAILABLE', 400);
}
