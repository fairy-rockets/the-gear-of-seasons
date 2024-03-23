import * as genericPool from 'generic-pool';
import { Client, ResultIterator, ResultRecord, connect } from 'ts-postgres';

export default class Pool {
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
}
