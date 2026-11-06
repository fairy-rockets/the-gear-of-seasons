// YouTube の URL と動画 ID の相互変換。

// 動画のページ（/entity/<id> のリダイレクト先）。
export function youtubeWatchURL(id: string): string {
  return `https://www.youtube.com/watch?v=${id}`;
}

// 本文に埋め込む iframe の src。
export function youtubeEmbedURL(id: string): string {
  return `https://www.youtube-nocookie.com/embed/${id}`;
}
