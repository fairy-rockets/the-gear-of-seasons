// サーバーの外のサービスに置いてある動画を識別するための情報（ExternalVideoRef）。entities.external_ref（jsonb）の中身。
// platform ごとに、その動画を指すのに要る項目を持つ。
//
// platform を足すときに触る場所:
// - このファイル: ExternalVideoPlatformName・型（ExternalVideoRef の union）・parseExternalVideoRef・
//   externalVideoPresentation
// - lib/ExternalVideoURL.ts: 入力された URL の matcher
// - shelf/ExternalVideo.ts: ExternalVideoPlatform の実装（URL の判定と取得）・defaultExternalVideoPlatforms
// - shelf/Shelf.ts: insertExternalVideo の、対応していない URL のエラー文（「今は YouTube の動画だけ」）
import { kYouTubeID, youTubeEmbedURL, youTubeWatchURL } from './youtube.js';

export type ExternalVideoPlatformName = 'youtube';

// {"platform": "youtube", "id": "<11文字の動画ID>"}
export type YouTubeVideoRef = {
  readonly platform: 'youtube',
  readonly id: string,
};

export type ExternalVideoRef = YouTubeVideoRef;

export class ExternalVideoRefFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ExternalVideoRefFormatError';
  }
}

// DB から読んだ external_ref の値を検証する。未知の platform、項目の過不足、不正な値なら例外を投げる。
export function parseExternalVideoRef(value: unknown): ExternalVideoRef {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ExternalVideoRefFormatError(`external_ref is not an object: ${JSON.stringify(value)}`);
  }
  const v = value as Record<string, unknown>;
  switch (v['platform']) {
    case 'youtube': {
      const keys = Object.keys(v).sort();
      if (keys.join(',') !== 'id,platform') {
        throw new ExternalVideoRefFormatError(`external_ref of youtube must have exactly platform and id: ${JSON.stringify(value)}`);
      }
      const id = v['id'];
      if (typeof id !== 'string' || !kYouTubeID.test(id)) {
        throw new ExternalVideoRefFormatError(`external_ref of youtube has an invalid video id: ${JSON.stringify(value)}`);
      }
      return { platform: 'youtube', id };
    }
    default:
      throw new ExternalVideoRefFormatError(`external_ref has an unknown platform: ${JSON.stringify(value)}`);
  }
}

// 動画を見せるのに使う URL と名前。DB には持たず、platform ごとに externalRef の中身から組み立てる。
export type ExternalVideoPresentation = {
  // その動画のページ（/entity/<id> のリダイレクト先）。
  readonly pageURL: string,
  // 本文に埋め込む iframe の src。
  readonly embedURL: string,
  // 本文に埋め込む iframe の title。
  readonly playerTitle: string,
};

export function externalVideoPresentation(video: ExternalVideoRef): ExternalVideoPresentation {
  switch (video.platform) {
    case 'youtube':
      return {
        pageURL: youTubeWatchURL(video.id),
        embedURL: youTubeEmbedURL(video.id),
        playerTitle: 'YouTube video player',
      };
  }
}
