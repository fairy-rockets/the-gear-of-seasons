import { describe, it } from 'mocha';
import assert from 'assert';
import { FastifyReply, FastifyRequest } from 'fastify';

import Shelf from '../../shelf/Shelf.js';
import { Entity } from '../../shelf/Entity.js';

import EntityController from './EntityController.js';

const kExternal: Entity = {
  type: 'video', location: 'external', id: 'yt', iconID: 'yt-icon', timestamp: undefined, mimeType: 'video/x-youtube',
  width: 1280, height: 720, duration: 1,
  external: { platform: 'youtube', id: '5WDuZByHZQA' },
};

class StubReply {
  statusCode = 200;
  redirected: [string, number] | null = null;
  body: any = undefined;
  code(c: number) { this.statusCode = c; return this; }
  type(_t: string) { return this; }
  send(b: any) { this.body = b; return this; }
  redirect(url: string, code: number) { this.redirected = [url, code]; return this; }
}

describe("EntityController（外部の動画）", () => {
  const resolved: string[] = [];
  const shelf = {
    findEntity: async (id: string) => id === kExternal.id ? kExternal : null,
    resolveEntityPath: async (_e: Entity, type: string) => { resolved.push(type); return null; },
  } as unknown as Shelf;
  const get = async (type: 'original' | 'medium' | 'icon') => {
    const reply = new StubReply();
    await new EntityController(shelf).handle(type, { params: { id: 'yt' } } as unknown as FastifyRequest, reply as unknown as FastifyReply);
    return reply;
  };

  it("/entity/<id> は外部の URL へリダイレクトする", async () => {
    resolved.length = 0;
    const r = await get('original');
    assert.deepStrictEqual(r.redirected, ['https://www.youtube.com/watch?v=5WDuZByHZQA', 302]);
    assert.deepStrictEqual(resolved, []);
  });

  it("/entity/<id>/icon は storage の icon を探す", async () => {
    resolved.length = 0;
    const r = await get('icon');
    assert.strictEqual(r.redirected, null);
    assert.deepStrictEqual(resolved, ['icon']);
  });
});
