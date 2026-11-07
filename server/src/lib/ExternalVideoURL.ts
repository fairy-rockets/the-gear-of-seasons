// /embed に入力された URL が、どの platform のどの動画かを見分ける。
// platform を足すときは、ここに matcher を足し、その platform の ExternalVideoPlatform（shelf/ExternalVideo.ts）の match から使う。
import { ExternalVideoRef } from './ExternalVideoRef.js';
import { YouTubeURLError, isYoutubeURL, parseYoutubeId } from './youtube.js';

// その platform の URL だが動画を指していないときに投げる例外。
export class ExternalVideoURLError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ExternalVideoURLError';
  }
}

// その platform の URL なら動画を返し、ほかの platform の URL なら null を返す。
export type ExternalVideoMatcher = (url: string) => ExternalVideoRef | null;

export const matchYoutubeVideoURL: ExternalVideoMatcher = (url) => {
  if (!isYoutubeURL(url)) {
    return null;
  }
  let id: string;
  try {
    id = parseYoutubeId(url);
  } catch (e) {
    if (e instanceof YouTubeURLError) {
      throw new ExternalVideoURLError(`YouTube の動画の URL ではありません: ${url}`);
    }
    throw e;
  }
  return { platform: 'youtube', id };
};
