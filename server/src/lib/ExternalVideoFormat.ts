// サーバーの外に置いてある動画の、entities.external（jsonb）の中身。
// platform ごとに、その動画を指すのに要る項目を持つ。
//
// platform を足すときに触る場所:
// - このファイル: ExternalVideoPlatformName・型（ExternalVideo の union）・parseExternalVideo・
//   externalVideoPresentation
import { youtubeEmbedURL, youtubeWatchURL } from './youtube.js';

export type ExternalVideoPlatformName = 'youtube';

// {"platform": "youtube", "id": "<11文字の動画ID>"}
export type YouTubeVideo = {
  readonly platform: 'youtube',
  readonly id: string,
};

export type ExternalVideo = YouTubeVideo;

const kYouTubeVideoID = /^[A-Za-z0-9_-]{11}$/;

export class ExternalVideoFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ExternalVideoFormatError';
  }
}

// DB から読んだ external の値を検証する。未知の platform、項目の過不足、不正な値は ExternalVideoFormatError を投げる
// （message は `external has an unknown platform: <値の JSON>` のように、何が不正かと値）。
export function parseExternalVideo(value: unknown): ExternalVideo {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ExternalVideoFormatError(`external is not an object: ${JSON.stringify(value)}`);
  }
  const v = value as Record<string, unknown>;
  switch (v['platform']) {
    case 'youtube': {
      const keys = Object.keys(v).sort();
      if (keys.join(',') !== 'id,platform') {
        throw new ExternalVideoFormatError(`external of youtube must have exactly platform and id: ${JSON.stringify(value)}`);
      }
      const id = v['id'];
      if (typeof id !== 'string' || !kYouTubeVideoID.test(id)) {
        throw new ExternalVideoFormatError(`external of youtube has an invalid video id: ${JSON.stringify(value)}`);
      }
      return { platform: 'youtube', id };
    }
    default:
      throw new ExternalVideoFormatError(`external has an unknown platform: ${JSON.stringify(value)}`);
  }
}

// 動画を見せるのに使う URL と名前。DB には持たず、platform ごとに external の中身から組み立てる。
export type ExternalVideoPresentation = {
  // その動画のページ（/entity/<id> のリダイレクト先）。
  readonly pageURL: string,
  // 本文に埋め込む iframe の src。
  readonly embedURL: string,
  // 本文に埋め込む iframe の title。
  readonly playerTitle: string,
};

export function externalVideoPresentation(video: ExternalVideo): ExternalVideoPresentation {
  switch (video.platform) {
    case 'youtube':
      return {
        pageURL: youtubeWatchURL(video.id),
        embedURL: youtubeEmbedURL(video.id),
        playerTitle: 'YouTube video player',
      };
  }
}
