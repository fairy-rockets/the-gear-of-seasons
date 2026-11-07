import { describe, it } from 'mocha';
import assert from 'assert';
import { AxiosError, AxiosHeaders, InternalAxiosRequestConfig } from 'axios';

import { YouTubeDataAPIClient, describeAxiosError } from './YouTubeDataAPI.js';

// API キーは URL の query に入るので、失敗したときの文にキーが出ないことを見る。

const kKey = 'SECRET-API-KEY-0123456789';
const kURL = `https://www.googleapis.com/youtube/v3/videos?id=x&key=${kKey}`;
// 繋がらない URL（ポート 1 は使われていない）。ネットワークには出ない。
const kUnreachable = 'http://127.0.0.1:1';

function config(): InternalAxiosRequestConfig {
  return { url: kURL, params: { id: 'x', key: kKey }, headers: new AxiosHeaders() };
}

describe("describeAxiosError", () => {
  it("応答があれば、状態と YouTube のエラーのメッセージだけにし、キーを含めない", () => {
    const c = config();
    const e = new AxiosError(`Request failed: ${kURL}`, 'ERR_BAD_REQUEST', c, undefined, {
      status: 403, statusText: 'Forbidden', headers: {}, config: c,
      data: { error: { message: 'The request cannot be completed because you have exceeded your quota.' } },
    });
    const s = describeAxiosError(e);
    assert.strictEqual(s, '403: The request cannot be completed because you have exceeded your quota.');
    assert.ok(!s.includes(kKey), s);
  });
  it("応答が無ければ、エラーのコードだけにし、キーを含めない", () => {
    const e = new AxiosError(`timeout of 30000ms exceeded: ${kURL}`, 'ECONNABORTED', config());
    const s = describeAxiosError(e);
    assert.strictEqual(s, 'ECONNABORTED');
    assert.ok(!s.includes(kKey), s);
  });
  it("axios のエラーでなければ、中身を出さない", () => {
    const s = describeAxiosError(new Error(kURL));
    assert.strictEqual(s, 'request failed');
  });
});

describe("YouTubeDataAPIClient の失敗", () => {
  it("findVideo が失敗しても、投げる例外の message にキーを含めない", async () => {
    const client = new YouTubeDataAPIClient(kKey, `${kUnreachable}/youtube/v3/videos`);
    await assert.rejects(client.findVideo('jLfOrvniehM'), (e: unknown) => {
      const message = (e as Error).message;
      assert.ok(message.startsWith('YouTube Data API: '), message);
      assert.ok(!message.includes(kKey), message);
      assert.ok(!JSON.stringify(e).includes(kKey), JSON.stringify(e));
      return true;
    });
  });
  it("fetchImage が失敗しても、投げる例外の message に URL の query を含めない", async () => {
    const client = new YouTubeDataAPIClient(kKey);
    await assert.rejects(client.fetchImage(`${kUnreachable}/vi/x/maxresdefault.jpg?key=${kKey}`), (e: unknown) => {
      const message = (e as Error).message;
      assert.ok(message.startsWith('YouTube のサムネイル: '), message);
      assert.ok(!message.includes(kKey), message);
      assert.ok(!JSON.stringify(e).includes(kKey), JSON.stringify(e));
      return true;
    });
  });
});
