// 運営者自身の閲覧を GA4 の集計から分ける印。
//
// ura は前段のリバースプロキシで守られているので、ura に届くリクエストは運営者のものとみなせる。
// ura のレスポンスで omote のドメインにも届く Cookie を付ける。omote ではシェル(index.hbs)の
// inline script がこの Cookie を読み、gtag('set') で traffic_type: 'internal' と debug_mode: true を付ける。
// GA 側のデータフィルタで、レポートからは除き、DebugView では見えるようにする。
//
// シェルを誰にでも同じ中身にするため、判定はサーバではなくブラウザでする。そのため HttpOnly は付けない。
// 値は印でしかなく、読まれても困らない。装ってできるのは自分の閲覧をレポートから外すことだけ。

export const kInternalTrafficCookie = 'gear_internal';

// ura を開くたびに延ばすので、1 年あれば普段使うブラウザでは切れない。
const kMaxAgeSeconds = 365 * 24 * 60 * 60;

/**
 * ura のレスポンスに付ける Set-Cookie の値。
 * ura のホストが omote のホストのサブドメイン(ura.hexe.net と hexe.net)のときだけ、
 * 親の omote のドメインに付けられる。そうでなければ omote に届かないので null を返す。
 */
export function internalTrafficSetCookie(omoteHost: string, uraHost: string, omoteOrigin: string): string | null {
  if (!uraHost.endsWith(`.${omoteHost}`)) {
    return null;
  }
  const secure = omoteOrigin.startsWith('https:') ? '; Secure' : '';
  return `${kInternalTrafficCookie}=1; Domain=${omoteHost}; Path=/; Max-Age=${kMaxAgeSeconds}; SameSite=Lax${secure}`;
}
