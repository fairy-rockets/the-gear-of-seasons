import crypto from 'crypto';
import dayjs from 'dayjs';

import kConfig from '../Config.js';
import { ExternalVideoURLError, matchYoutubeVideoURL } from '../lib/ExternalVideoURL.js';
import { YouTubeDataAPI, YouTubeDataAPIClient, YouTubeVideoResource } from '../lib/YouTubeDataAPI.js';
import { ExternalVideoRef } from './Entity.js';

// 外部に置いてある動画を entity として取り込むときの、platform ごとの URL の判定と取得。
// platform を足すときは ExternalVideoPlatform を実装し、defaultExternalVideoPlatforms に足す。

// 取り込めない理由。statusCode は /embed が返す HTTP の状態。
export class ExternalVideoError extends Error {
  readonly statusCode: number;
  constructor(statusCode: number, message: string) {
    super(message);
    this.name = 'ExternalVideoError';
    this.statusCode = statusCode;
  }
}

// 外部から取った、entity に入れる値。
export type ExternalVideoInfo = {
  readonly timestamp: dayjs.Dayjs,
  // 埋め込みの大きさ。縦横比として使う。
  readonly width: number,
  readonly height: number,
  readonly duration: number,
  readonly thumbnailURL: string,
};

export type ExternalVideoFetched = {
  readonly info: ExternalVideoInfo,
  readonly thumbnail: Buffer,
};

export interface ExternalVideoPlatform {
  readonly platform: ExternalVideoRef['platform'];
  // この platform の URL なら動画（externalRef に入れる値）を返す。ほかの platform の URL なら null。
  // この platform の URL だが動画を指していなければ、例外を投げる。
  match(url: string): ExternalVideoRef | null;
  fetch(video: ExternalVideoRef): Promise<ExternalVideoFetched>;
}

// entity の id。同じ動画は、どの形の URL から取り込んでも同じ entity になる。
export function externalVideoEntityID(video: ExternalVideoRef): string {
  return crypto.createHash('md5').update(`${video.platform}:${video.id}`).digest('hex');
}

// 環境変数の設定で作る、サーバーとコマンドが使う platform の一覧。
export function defaultExternalVideoPlatforms(): ExternalVideoPlatform[] {
  const key = kConfig.youtubeApiKey;
  return [
    new YouTubePlatform(key !== null ? new YouTubeDataAPIClient(key) : null),
  ];
}

/* *************************************************************************************************
 * YouTube
 ************************************************************************************************ */

// ISO 8601 の期間（PT1H4M16S など）を秒にする。
export function parseISODuration(s: string): number {
  const m = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/.exec(s);
  if (m === null || s === 'P' || s.endsWith('T')) {
    throw new Error(`Invalid ISO 8601 duration: ${s}`);
  }
  const [days, hours, minutes, seconds] = [m[1], m[2], m[3], m[4]].map((v) => v === undefined ? 0 : Number(v));
  return ((days * 24 + hours) * 60 + minutes) * 60 + seconds;
}

// サムネイルは、この順で最初にあるもの。
const kThumbnailOrder = ['maxres', 'standard', 'high'];

function positiveInteger(v: number | string | undefined): number | null {
  const n = typeof v === 'string' ? Number(v) : v;
  return n !== undefined && Number.isInteger(n) && n > 0 ? n : null;
}

// videos.list の結果を entity に入れる値にする。取り込まない動画（配信中・配信予定）なら例外を投げる。
export function youtubeVideoInfo(resource: YouTubeVideoResource): ExternalVideoInfo {
  const snippet = resource.snippet;
  const live = snippet?.liveBroadcastContent;
  if (live === 'live' || live === 'upcoming') {
    const why = live === 'live' ? '配信中' : '配信予定';
    throw new ExternalVideoError(400, `YouTube の動画 ${resource.id} は${why}なので取り込めません。配信が終わってから取り込んでください。`);
  }
  // 値が無い・知らない値なのは YouTube の応答の問題なので、ほかの値が欠けているときと同じく 502 にする。
  if (live !== 'none') {
    throw new ExternalVideoError(502, `YouTube の動画 ${resource.id} が配信かどうか分かりません: liveBroadcastContent=${live}`);
  }
  // 生放送のアーカイブでは publishedAt が配信開始より後になるので、配信開始の時刻を先に見る。
  const time = resource.liveStreamingDetails?.actualStartTime ?? snippet?.publishedAt;
  const timestamp = time === undefined ? null : dayjs(time);
  if (timestamp === null || !timestamp.isValid()) {
    throw new ExternalVideoError(502, `YouTube の動画 ${resource.id} の公開日時が分かりません: ${time}`);
  }
  const width = positiveInteger(resource.player?.embedWidth);
  const height = positiveInteger(resource.player?.embedHeight);
  if (width === null || height === null) {
    throw new ExternalVideoError(502, `YouTube の動画 ${resource.id} の埋め込みの大きさが分かりません`);
  }
  let duration: number;
  try {
    duration = parseISODuration(resource.contentDetails?.duration ?? '');
  } catch (_e) {
    throw new ExternalVideoError(502, `YouTube の動画 ${resource.id} の長さが分かりません: ${resource.contentDetails?.duration}`);
  }
  const thumbnail = kThumbnailOrder
    .map((name) => snippet?.thumbnails?.[name])
    .find((t) => t !== undefined && typeof t.url === 'string' && t.url.length > 0);
  if (thumbnail === undefined) {
    throw new ExternalVideoError(502, `YouTube の動画 ${resource.id} にサムネイル（${kThumbnailOrder.join(' / ')}）がありません`);
  }
  return { timestamp, width, height, duration, thumbnailURL: thumbnail.url };
}

export class YouTubePlatform implements ExternalVideoPlatform {
  readonly platform = 'youtube';
  // API キーが無ければ null。そのときも URL の判定と、取り込み済みの entity を返すことはできる。
  private readonly api: YouTubeDataAPI | null;
  constructor(api: YouTubeDataAPI | null) {
    this.api = api;
  }
  match(url: string): ExternalVideoRef | null {
    try {
      return matchYoutubeVideoURL(url);
    } catch (e) {
      if (e instanceof ExternalVideoURLError) {
        throw new ExternalVideoError(400, e.message);
      }
      throw e;
    }
  }
  async fetch(video: ExternalVideoRef): Promise<ExternalVideoFetched> {
    if (this.api === null) {
      throw new ExternalVideoError(503, 'YOUTUBE_API_KEY が設定されていないので、YouTube の動画を取り込めません');
    }
    let resource: YouTubeVideoResource | null;
    try {
      resource = await this.api.findVideo(video.id);
    } catch (e) {
      throw new ExternalVideoError(502, (e as Error).message);
    }
    if (resource === null) {
      throw new ExternalVideoError(400, `YouTube の動画 ${video.id} が見つかりません（非公開か、存在しません）`);
    }
    const info = youtubeVideoInfo(resource);
    let thumbnail: Buffer;
    try {
      thumbnail = await this.api.fetchImage(info.thumbnailURL);
    } catch (e) {
      throw new ExternalVideoError(502, (e as Error).message);
    }
    return { info, thumbnail };
  }
}
