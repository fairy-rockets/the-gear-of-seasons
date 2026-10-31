import * as protocol from '../../protocol';

// ura の一覧（/moments/）。サーバーがページに埋め込んだ全件の要約（#moments-data）を、ここで絞り込んで描く。
// 条件は URL のクエリと localStorage に書く。開いたときは URL のクエリを優先し（サイドバーの「確認待ち」など、
// リンクで条件を渡すため）、クエリが無ければ localStorage の条件を使う。
// クエリから開いたときは、そのページで条件を変えるまで localStorage に書かない。リンクで開いたあとに「一覧」へ戻ると、
// 前に自分で選んだ条件に戻る。

type Item = protocol.Moment.List.Item & {
  year: string;
  // 検索の対象（題名と本文の文章）。小文字にしてある。
  hay: string;
};

type FilterKey = 'year' | 'status' | 'tier' | 'series' | 'sensitive' | 'annotation';
type Sort = 'desc' | 'asc';

// 絞り込みの条件。null は「すべて」。
type State = Record<FilterKey, string | null> & {
  q: string;
  sort: Sort;
};

type Filter = {
  key: FilterKey;
  label: string;
  // [値, 見出し]。値は URL のクエリにもそのまま書く。
  options: [string, string][];
  match: (it: Item, v: string) => boolean;
};

const kStorageKey = 'ura-moments:state';

const kDefaults: State = {
  year: null, status: null, tier: null, series: null, sensitive: null, annotation: null, q: '', sort: 'desc',
};

const kStatusLabels: Record<protocol.MomentStatus, string> = {
  draft: '下書き',
  published: '公開',
};

const kTiers: protocol.MomentTier[] = ['pickup', 'archive', 'sketch', 'hidden'];

// series が空の moment を選ぶ値。
const kNoSeries = '';

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' }[c]!!));
}

function loadItems(): Item[] {
  const elem = document.getElementById('moments-data');
  const items = JSON.parse(elem?.textContent ?? '[]') as protocol.Moment.List.Item[];
  return items.map((it) => ({
    ...it,
    year: it.date.slice(0, 4),
    hay: `${it.title}\n${it.bodyText}`.toLowerCase(),
  }));
}

function makeFilters(items: Item[]): Filter[] {
  const years = [...new Set(items.map((it) => it.year))].sort().reverse();
  const seriesCount = new Map<string, number>();
  for (const it of items) {
    for (const s of it.series) {
      seriesCount.set(s, (seriesCount.get(s) ?? 0) + 1);
    }
  }
  const series = [...seriesCount.keys()].sort((a, b) => (seriesCount.get(b)!! - seriesCount.get(a)!!) || (a < b ? -1 : 1));
  return [
    {
      key: 'year', label: '年',
      options: years.map((y) => [y, y]),
      match: (it, v) => it.year === v,
    },
    {
      key: 'status', label: '公開状態',
      options: Object.entries(kStatusLabels),
      match: (it, v) => it.status === v,
    },
    {
      key: 'tier', label: 'tier',
      options: kTiers.map((t) => [t, t]),
      match: (it, v) => it.tier === v,
    },
    {
      key: 'series', label: 'series',
      options: [...series.map((s): [string, string] => [s, s]), [kNoSeries, '（なし）']],
      match: (it, v) => v === kNoSeries ? it.series.length === 0 : it.series.includes(v),
    },
    {
      key: 'sensitive', label: 'sensitive',
      options: [['yes', 'はい'], ['no', 'いいえ']],
      match: (it, v) => it.sensitive === (v === 'yes'),
    },
    {
      // 「未確認あり」と「未入力あり」は、両方を持つ moment がどちらにも入る。
      key: 'annotation', label: '注釈',
      options: [['unverified', '未確認あり'], ['unentered', '未入力あり'], ['done', '残りなし'], ['none', 'メディアなし']],
      match: (it, v) => {
        switch (v) {
          case 'unverified': return it.unverified > 0;
          case 'unentered': return it.unentered > 0;
          case 'done': return it.media > 0 && it.unverified === 0 && it.unentered === 0;
          case 'none': return it.media === 0;
          default: return false;
        }
      },
    },
  ];
}

// 知らない値は捨てて既定値にする（消えた series や、古い形の保存を引きずらない）。
function normalize(filters: Filter[], raw: { [key: string]: unknown }): State {
  const st: State = { ...kDefaults };
  for (const f of filters) {
    const v = raw[f.key];
    if (typeof v === 'string' && f.options.some(([o]) => o === v)) {
      st[f.key] = v;
    }
  }
  if (typeof raw['q'] === 'string') {
    st.q = raw['q'];
  }
  if (raw['sort'] === 'asc' || raw['sort'] === 'desc') {
    st.sort = raw['sort'];
  }
  return st;
}

// fromQuery は、URL のクエリから読んだか。
function loadState(filters: Filter[]): { st: State, fromQuery: boolean } {
  const params = new URLSearchParams(window.location.search);
  if ([...params.keys()].length > 0) {
    return { st: normalize(filters, Object.fromEntries(params)), fromQuery: true };
  }
  try {
    const saved = window.localStorage.getItem(kStorageKey);
    if (saved !== null) {
      return { st: normalize(filters, JSON.parse(saved)), fromQuery: false };
    }
  } catch (_e) {
    // 読めなければ既定値。
  }
  return { st: { ...kDefaults }, fromQuery: false };
}

// remember が false なら URL だけを書き換え、localStorage には書かない。
function saveState(st: State, remember: boolean) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(st)) {
    if (v !== null && v !== kDefaults[k as keyof State]) {
      params.set(k, v);
    }
  }
  const query = params.toString();
  window.history.replaceState(null, '', query.length > 0 ? `?${query}` : window.location.pathname);
  if (!remember) {
    return;
  }
  try {
    window.localStorage.setItem(kStorageKey, JSON.stringify(st));
  } catch (_e) {
    // 書けなくても絞り込みは動く。
  }
}

function filtersHTML(filters: Filter[], items: Item[]): string {
  const rows = filters.map((f) => {
    const buttons = f.options.map(([v, label]) => {
      const n = items.filter((it) => f.match(it, v)).length;
      return `<button data-v="${esc(v)}">${esc(label)}<small>${n}</small></button>`;
    }).join('');
    return `<div class="moments-filter"><span class="moments-filter-label">${esc(f.label)}</span>` +
      `<span class="seg" data-f="${f.key}"><button data-all="">すべて</button>${buttons}</span></div>`;
  });
  rows.push(
    '<div class="moments-filter"><span class="moments-filter-label">並び</span>' +
    '<span class="seg" id="moments-sort"><button data-v="desc">新しい順</button><button data-v="asc">古い順</button></span></div>',
    '<div class="moments-filter"><span class="moments-filter-label">検索</span>' +
    '<input type="search" id="moments-q" placeholder="題名・本文"><button id="moments-reset">条件を解除</button></div>',
  );
  return rows.join('');
}

function cardHTML(it: Item): string {
  const badges: string[] = [];
  if (it.status === 'draft') {
    badges.push('<span class="moment-badge moment-badge-draft">下書き</span>');
  }
  badges.push(`<span class="moment-badge moment-badge-tier-${it.tier}">${it.tier}</span>`);
  if (it.sensitive) {
    badges.push(`<span class="moment-badge moment-badge-sensitive">sensitive${it.sensitiveManual ? '（手）' : ''}</span>`);
  }
  if (it.unverified > 0) {
    badges.push(`<span class="moment-badge moment-badge-unverified">未確認 ${it.unverified}</span>`);
  }
  if (it.unentered > 0) {
    badges.push(`<span class="moment-badge moment-badge-unentered">未入力 ${it.unentered}</span>`);
  }
  const img = it.iconID !== null
    ? `<img loading="lazy" src="/entity/${encodeURIComponent(it.iconID)}/icon" alt="icon">`
    : '<div class="moment-noimage"></div>';
  return `<a href="${esc(it.path)}" class="moment">` +
    `<div class="moment-image">${img}<div class="moment-badges">${badges.join('')}</div></div>` +
    `<div class="moment-title">${esc(it.title)}</div>` +
    `<div class="moment-date">${esc(it.date)}</div></a>`;
}

export default function main() {
  const items = loadItems();
  const filters = makeFilters(items);
  const { st, fromQuery } = loadState(filters);
  let remember = !fromQuery;

  const filtersElem = document.getElementById('moments-filters')!!;
  const listElem = document.getElementById('moments-list')!!;
  const countElem = document.getElementById('moments-count')!!;
  const emptyElem = document.getElementById('moments-empty')!!;
  filtersElem.innerHTML = filtersHTML(filters, items);
  const qElem = document.getElementById('moments-q') as HTMLInputElement;

  const visible = (): Item[] => {
    const words = st.q.trim().toLowerCase().split(/\s+/).filter((w) => w.length > 0);
    const found = items.filter((it) =>
      filters.every((f) => st[f.key] === null || f.match(it, st[f.key]!!)) &&
      words.every((w) => it.hay.includes(w)));
    // サーバーは新しい順で渡す。
    return st.sort === 'desc' ? found : found.reverse();
  };

  const apply = () => {
    for (const f of filters) {
      const seg = filtersElem.querySelector(`[data-f="${f.key}"]`)!!;
      seg.querySelectorAll<HTMLButtonElement>('button').forEach((b) => {
        const pressed = b.dataset.all !== undefined ? st[f.key] === null : b.dataset.v === st[f.key];
        b.setAttribute('aria-pressed', String(pressed));
      });
    }
    filtersElem.querySelectorAll<HTMLButtonElement>('#moments-sort button').forEach((b) => {
      b.setAttribute('aria-pressed', String(b.dataset.v === st.sort));
    });
    if (qElem.value !== st.q) {
      qElem.value = st.q;
    }
    const found = visible();
    listElem.innerHTML = found.map(cardHTML).join('');
    countElem.textContent = `${found.length} / ${items.length}件`;
    emptyElem.hidden = found.length > 0;
    saveState(st, remember);
  };

  filtersElem.addEventListener('click', (ev) => {
    const b = (ev.target as Element).closest('button');
    if (b === null) {
      return;
    }
    const seg = b.closest<HTMLElement>('[data-f]');
    if (seg !== null) {
      st[seg.dataset.f as FilterKey] = b.dataset.all !== undefined ? null : b.dataset.v!!;
    } else if (b.closest('#moments-sort') !== null) {
      st.sort = b.dataset.v as Sort;
    } else if (b.id === 'moments-reset') {
      Object.assign(st, kDefaults, { sort: st.sort });
    } else {
      return;
    }
    remember = true;
    apply();
  });
  qElem.addEventListener('input', () => {
    st.q = qElem.value;
    remember = true;
    apply();
  });
  apply();
}
