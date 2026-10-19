const DURATION_MS = 5000;

type ToastOptions = {
  // 同じ key のトーストが出ていれば、新しく出さずに本文を差し替える
  key?: string,
  // true なら時間では消さない（クリックか dismissToast で消す）
  sticky?: boolean,
};

type Entry = {
  elem: HTMLDivElement,
  timer: number | null,
};

let container: HTMLDivElement | null = null;
const entries = new Map<string, Entry>();
let serial = 0;

function getContainer(): HTMLDivElement {
  if (container === null) {
    container = document.createElement('div');
    container.classList.add('toast-container');
    document.body.appendChild(container);
  }
  return container;
}

export function dismissToast(key: string) {
  const entry = entries.get(key);
  if (entry === undefined) {
    return;
  }
  entries.delete(key);
  if (entry.timer !== null) {
    window.clearTimeout(entry.timer);
  }
  entry.elem.remove();
}

export function showToast(text: string, options: ToastOptions = {}) {
  const key = options.key ?? `toast-${serial++}`;
  let entry = entries.get(key);
  if (entry === undefined) {
    const elem = document.createElement('div');
    elem.classList.add('toast');
    elem.setAttribute('role', 'alert');
    elem.addEventListener('click', () => dismissToast(key));
    getContainer().appendChild(elem);
    entry = { elem, timer: null };
    entries.set(key, entry);
  }
  entry.elem.textContent = text;
  if (entry.timer !== null) {
    window.clearTimeout(entry.timer);
    entry.timer = null;
  }
  if (!options.sticky) {
    entry.timer = window.setTimeout(() => dismissToast(key), DURATION_MS);
  }
}

// 失敗した応答を、利用者に見せる一行にする。
// Fastify のエラー（{"statusCode":500,"error":…,"message":…}）なら message を、取れなければ状態を返す。
export async function describeResponseError(r: Response): Promise<string> {
  // HTTP/2 では statusText が空になる
  const status = `${r.status}${r.statusText ? ' ' + r.statusText : ''}`;
  try {
    const body: unknown = JSON.parse(await r.text());
    if (typeof body === 'object' && body !== null && 'message' in body &&
        typeof body.message === 'string' && body.message.length > 0) {
      return body.message;
    }
  } catch (_) {
    // JSON でなければ状態だけを出す
  }
  return status;
}

export function describeError(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
