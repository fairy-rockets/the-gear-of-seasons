import axios from 'axios';

// videos.list の items[] のうち、使う項目だけ。
// https://developers.google.com/youtube/v3/docs/videos
export type YouTubeThumbnail = {
  url: string,
  width?: number,
  height?: number,
};

export type YouTubeVideoResource = {
  id: string,
  snippet?: {
    publishedAt?: string,
    title?: string,
    // 'none'（公開済み・配信終了）/ 'live'（配信中）/ 'upcoming'（配信予定）
    liveBroadcastContent?: string,
    thumbnails?: { [name: string]: YouTubeThumbnail | undefined },
  },
  contentDetails?: {
    // ISO 8601 の期間（PT1H4M16S など）
    duration?: string,
  },
  player?: {
    // int64 なので文字列で来ることもある
    embedWidth?: number | string,
    embedHeight?: number | string,
  },
  liveStreamingDetails?: {
    actualStartTime?: string,
  },
};

// YouTube への問い合わせ。テストでは差し替える。
export interface YouTubeDataAPI {
  // 見つからない（存在しない・非公開）なら null。
  findVideo(videoID: string): Promise<YouTubeVideoResource | null>;
  fetchImage(url: string): Promise<Buffer>;
}

// 埋め込みの大きさ（player.embedWidth / embedHeight）を、高さがこれ以下になるように求める。
const kMaxEmbedHeight = 720;

// API キーで YouTube Data API v3 を叩く。
// 失敗したときは、キーが入った URL を含む axios のエラーをそのまま投げず、状態とメッセージだけの Error にする。
export class YouTubeDataAPIClient implements YouTubeDataAPI {
  private readonly apiKey: string;
  // videos.list の URL。テストでは、繋がらない URL にして失敗のときの経路を見る。
  private readonly endpoint: string;
  constructor(apiKey: string, endpoint = 'https://www.googleapis.com/youtube/v3/videos') {
    this.apiKey = apiKey;
    this.endpoint = endpoint;
  }
  async findVideo(videoID: string): Promise<YouTubeVideoResource | null> {
    let data: { items?: YouTubeVideoResource[] };
    try {
      const r = await axios.get(this.endpoint, {
        params: {
          part: 'snippet,contentDetails,player,liveStreamingDetails',
          maxHeight: kMaxEmbedHeight,
          id: videoID,
          key: this.apiKey,
        },
        responseType: 'json',
        timeout: 30 * 1000,
      });
      data = r.data;
    } catch (e) {
      throw new Error(`YouTube Data API: ${describeAxiosError(e)}`);
    }
    return data.items?.[0] ?? null;
  }
  async fetchImage(url: string): Promise<Buffer> {
    try {
      const r = await axios.get<ArrayBuffer>(url, {
        responseType: 'arraybuffer',
        timeout: 30 * 1000,
      });
      return Buffer.from(r.data);
    } catch (e) {
      throw new Error(`YouTube のサムネイル: ${describeAxiosError(e)}`);
    }
  }
}

// axios のエラーを、状態と YouTube のエラーのメッセージだけの文にする。キーが入った URL や params は含めない。
export function describeAxiosError(e: unknown): string {
  if (axios.isAxiosError(e)) {
    if (e.response !== undefined) {
      const body = e.response.data as { error?: { message?: unknown } } | undefined;
      const message = typeof body?.error?.message === 'string' ? `: ${body.error.message}` : '';
      return `${e.response.status}${message}`;
    }
    return e.code ?? 'request failed';
  }
  return 'request failed';
}
