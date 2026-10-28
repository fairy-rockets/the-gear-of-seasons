import pg from 'pg';

// query の結果。rows は列名をキーにした行、rowCount は UPDATE・DELETE などで処理した行数。
export type QueryResult = {
  rows: pg.QueryResultRow[];
  rowCount: number | null;
};

// Repo がクエリを流す先。Pool そのものと、トランザクション中の1つの接続の両方がこれを満たす。
export interface Queryable {
  query(query: string, args?: any[]): Promise<QueryResult>;
  // すでにトランザクションの中にいるなら、新しく BEGIN せずにそのトランザクションに加わる（SAVEPOINT は切らない）。
  transaction<T>(fn: (tx: Queryable) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

export default class Pool implements Queryable {
  private pool: pg.Pool
  constructor(hostname: string) {
    this.pool = new pg.Pool({
      host: hostname,
      port: 5432,
      user: 'the-gear-of-seasons',
      password: 'the-gear-of-seasons',
      database: 'the-gear-of-seasons',
      // サーバーと cmd/ のコマンドは、それぞれ自分のプールを持って同じ DB に繋ぐ。
      // いくつか同時に動いても、postgres の max_connections の既定値（100）に届かない数にする。
      max: 10,
    });
    // プールで待っている接続のエラー（DB の再起動など）。その接続はプールが捨てる。
    // このハンドラが無いと、エラーがプロセスまで上がって落ちる。
    this.pool.on('error', (err) => {
      console.error('Idle connection failed: ', err);
    });
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  async query(query: string, args?: any[]): Promise<QueryResult> {
    return await this.pool.query(query, args);
  }

  // query は呼ぶたびに別の接続を借りうるので、トランザクションの中のクエリは fn に渡す tx から流す。
  // tx はすべて同じ接続で流れる。fn が投げたら ROLLBACK して投げ直す。
  // fn の中で tx ではなく外の Pool（やそれを持つ Repo）を使うと、そのクエリはプールの別の接続で
  // トランザクションの外で流れる。エラーにはならない。
  async transaction<T>(fn: (tx: Queryable) => Promise<T>): Promise<T> {
    const cl = await this.pool.connect();
    // 借りている間、pg-pool はこの接続に 'error' のリスナーを付けない。pg の Client はソケットのエラーや切断で、
    // 走っているクエリを reject したうえで 'error' を出すので、リスナーが無いとプロセスが落ちる。
    // クエリが reject されれば ROLLBACK も失敗するので、この接続は下で捨てられる。
    const onError = (err: Error) => {
      console.error('Connection in a transaction failed: ', err);
    };
    cl.on('error', onError);
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
      // プールに戻って使い回される接続に、リスナーを溜めない。
      cl.removeListener('error', onError);
      // release に true を渡すと、接続はプールに戻らずに閉じられる。
      cl.release(broken);
    }
  }
}

// トランザクション中の1つの接続。Pool.transaction が作って fn に渡す。
class TransactionClient implements Queryable {
  private readonly cl: pg.PoolClient;
  constructor(cl: pg.PoolClient) {
    this.cl = cl;
  }

  async query(query: string, args?: any[]): Promise<QueryResult> {
    return await this.cl.query(query, args);
  }

  async transaction<T>(fn: (tx: Queryable) => Promise<T>): Promise<T> {
    return await fn(this);
  }

  async close(): Promise<void> {
    throw new Error('Cannot close the pool from inside a transaction');
  }
}
