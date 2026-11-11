// YouTube の URL と動画 ID の相互変換。

export class YouTubeURLError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'YouTubeURLError';
  }
}

export const kYouTubeID = /^[A-Za-z0-9_-]{11}$/;
const kYouTubeHosts = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'www.youtube-nocookie.com',
  'youtube-nocookie.com',
]);

// YouTube の URL か（動画 ID を取り出せるかは問わない）。
export function isYouTubeURL(url: string): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch (_e) {
    return false;
  }
  return (u.protocol === 'https:' || u.protocol === 'http:') &&
    (u.hostname === 'youtu.be' || kYouTubeHosts.has(u.hostname));
}

// watch?v=<id> / youtu.be/<id> / shorts|embed|live/<id> のどれかから動画 ID を取り出す。
// iframe の src などには、ここを通った ID だけを入れる。
export function parseYouTubeID(url: string | undefined): string {
  if (url === undefined) {
    throw new YouTubeURLError(`youtube: url is not set`);
  }
  let u: URL;
  try {
    u = new URL(url);
  } catch (e) {
    throw new YouTubeURLError(`youtube: invalid url: ${url}`);
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') {
    throw new YouTubeURLError(`youtube: invalid url: ${url}`);
  }
  let id: string | null = null;
  const segments = u.pathname.split('/').filter((s) => s !== '');
  if (u.hostname === 'youtu.be') {
    id = segments[0] ?? null;
  } else if (kYouTubeHosts.has(u.hostname)) {
    if (segments[0] === 'watch') {
      id = u.searchParams.get('v');
    } else if (['shorts', 'embed', 'live'].includes(segments[0])) {
      id = segments[1] ?? null;
    }
  }
  if (id === null || !kYouTubeID.test(id)) {
    throw new YouTubeURLError(`youtube: video id not found: ${url}`);
  }
  return id;
}

// 動画のページ（/entity/<id> のリダイレクト先）。
export function youTubeWatchURL(id: string): string {
  return `https://www.youtube.com/watch?v=${id}`;
}

// 本文に埋め込む iframe の src。
export function youTubeEmbedURL(id: string): string {
  return `https://www.youtube-nocookie.com/embed/${id}`;
}
