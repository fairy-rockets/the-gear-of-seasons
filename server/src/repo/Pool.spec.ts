import { describe, it, beforeEach } from 'mocha';
import assert from 'assert';

import Pool from './Pool.js';

// DB には繋がず、pg.Pool と接続をスタブにして、どの接続に何を流したかを見る。
// （pg.Pool は最初の connect までは接続しないので、new Pool() しても DB は要らない）
type Client = { name: string, queries: string[], failOn?: string };

function stubClients(pool: Pool): { clients: Client[], released: string[], destroyed: string[] } {
  const clients: Client[] = [];
  const released: string[] = [];
  const destroyed: string[] = [];
  (pool as any).pool = {
    connect: async () => {
      const name = `cl${clients.length}`;
      const cl: Client = { name, queries: [] };
      clients.push(cl);
      return {
        query: async (q: string) => {
          cl.queries.push(q);
          if (cl.failOn === q) {
            throw new Error(`failed: ${q}`);
          }
          return { rows: [], rowCount: null };
        },
        // pg.PoolClient.release は、引数が真ならその接続をプールに戻さずに閉じる。
        release: (err?: Error | boolean) => {
          (err ? destroyed : released).push(name);
        },
      };
    },
  };
  return { clients, released, destroyed };
}

describe("Pool.transaction", () => {
  let pool: Pool;
  let stub: ReturnType<typeof stubClients>;
  beforeEach(() => {
    pool = new Pool('localhost');
    stub = stubClients(pool);
  });

  it("中のクエリを1つの接続で BEGIN と COMMIT の間に流し、接続を戻す", async () => {
    const r = await pool.transaction(async (tx) => {
      await tx.query('select 1');
      await tx.query('select 2');
      return 42;
    });
    assert.strictEqual(r, 42);
    assert.strictEqual(stub.clients.length, 1);
    assert.deepStrictEqual(stub.clients[0].queries, ['BEGIN', 'select 1', 'select 2', 'COMMIT']);
    assert.deepStrictEqual(stub.released, ['cl0']);
    assert.deepStrictEqual(stub.destroyed, []);
  });

  it("fn が投げたら ROLLBACK して投げ直し、接続は戻す", async () => {
    await assert.rejects(() => pool.transaction(async (tx) => {
      await tx.query('select 1');
      throw new Error('boom');
    }), /boom/);
    assert.deepStrictEqual(stub.clients[0].queries, ['BEGIN', 'select 1', 'ROLLBACK']);
    assert.deepStrictEqual(stub.released, ['cl0']);
  });

  it("入れ子の transaction は外のトランザクションに加わる", async () => {
    await pool.transaction(async (tx) => {
      await tx.transaction(async (tx2) => {
        await tx2.query('select 1');
      });
    });
    assert.strictEqual(stub.clients.length, 1);
    assert.deepStrictEqual(stub.clients[0].queries, ['BEGIN', 'select 1', 'COMMIT']);
  });

  // トランザクションの途中のまま残っているかもしれない接続を、プールに戻さない。
  it("ROLLBACK に失敗した接続は捨て、元の失敗を投げ直す", async () => {
    await assert.rejects(() => pool.transaction(async (_tx) => {
      stub.clients[0].failOn = 'ROLLBACK';
      throw new Error('boom');
    }), /boom/);
    assert.deepStrictEqual(stub.released, []);
    assert.deepStrictEqual(stub.destroyed, ['cl0']);
  });
});
