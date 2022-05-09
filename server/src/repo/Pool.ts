import * as genericPool from 'generic-pool';
import { Client, ResultIterator } from 'ts-postgres';
import { Value } from 'ts-postgres/src/types';

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
        const client = new Client(opt);
        try {
          const timeout = new Promise((resolve, reject) => setTimeout(() => reject(new Error('Connection Timed out')), 500));
          await Promise.race([client.connect(), timeout]);
          client.on('error', console.error);
          return client;
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
  async use<T>(fn: (cl: Client) => T | Promise<T>): Promise<T> {
    return await this.pool.use(fn);
  }
  async query(query: string, args?: Value[]): Promise<ResultIterator> {
    return await this.use(async (cl) => {
      return cl.query(query, args);
    });
  }
}
