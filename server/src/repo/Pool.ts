import * as genericPool from 'generic-pool';
import { Client, ResultIterator, ResultRecord, connect } from 'ts-postgres';

// Repo がクエリを流す先。Pool そのものと、トランザクション中の1つの接続の両方がこれを満たす。
export interface Queryable {
  query(query: string, args?: any[]): Promise<ResultIterator<ResultRecord<any>>>;
  // すでにトランザクションの中にいるなら、新しく BEGIN せずにそのトランザクションに加わる（SAVEPOINT は切らない）。
  transaction<T>(fn: (tx: Queryable) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

export default class Pool implements Queryable {
  private pool: genericPool.Pool<Client>
  constructor(hostname: string) {
    const opt = {
      host: hostname,
      port: 5432,
      user: 'the-gear-of-seasons',
      password: 'the-gear-of-seasons',
      database: 'the-gear-of-seasons',
    };
    this.pool = genericPool.createPool({
      create: async (): Promise<Client> => {
        try {
          return await connect(opt);
        } catch (err) {
          console.error('Failed to connect: ', err);
          throw err;
        }
      },
      destroy: async (client: Client) => {
        return client.end().then(() => {})
      },
      validate: (client: Client) => {
        return Promise.resolve(!client.closed);
      }
    }, { testOnBorrow: true });
  }

  async close(): Promise<void> {
    await this.pool.drain();
    await this.pool.clear();
  }

  async use<T>(fn: (cl: Client) => T | Promise<T>): Promise<T> {
    return await this.pool.use(fn);
  }

  async query(query: string, args?: any[]): Promise<ResultIterator<ResultRecord<any>>> {
    return await this.use(async (cl) => {
      return cl.query(query, args);
    });
  }

  // query は呼ぶたびに別の接続を借りうるので、トランザクションの中のクエリは fn に渡す tx から流す。
  // tx はすべて同じ接続で流れる。fn が投げたら ROLLBACK して投げ直す。
  async transaction<T>(fn: (tx: Queryable) => Promise<T>): Promise<T> {
    const cl = await this.pool.acquire();
    const tx = new TransactionClient(cl);
    // BEGIN や ROLLBACK に失敗した接続は、トランザクションの途中のまま残っているかもしれないので、プールに戻さず捨てる。
    let broken = true;
    try {
      await cl.query('BEGIN');
      try {
        const result = await fn(tx);
        await cl.query('COMMIT');
        broken = false;
        return result;
      } catch (err) {
        try {
          await cl.query('ROLLBACK');
          broken = false;
        } catch (rollbackErr) {
          // 呼び出し側には、ROLLBACK の失敗ではなく元の失敗を返す。
          console.error('Failed to rollback: ', rollbackErr);
        }
        throw err;
      }
    } finally {
      if (broken) {
        await this.pool.destroy(cl);
      } else {
        await this.pool.release(cl);
      }
    }
  }
}

// トランザクション中の1つの接続。Pool.transaction が作って fn に渡す。
class TransactionClient implements Queryable {
  private readonly cl: Client;
  constructor(cl: Client) {
    this.cl = cl;
  }

  async query(query: string, args?: any[]): Promise<ResultIterator<ResultRecord<any>>> {
    return await this.use(async (cl) => {
      return cl.query(query, args);
    });
  }

  async transaction<T>(fn: (tx: Queryable) => Promise<T>): Promise<T> {
    return await fn(this);
  }

  async close(): Promise<void> {
    throw new Error('Cannot close the pool from inside a transaction');
  }

  // Pool.use と同じ形。query の書き方を Pool.query に揃えるためのもの。
  private async use<T>(fn: (cl: Client) => T | Promise<T>): Promise<T> {
    return await fn(this.cl);
  }
}
