import * as protocol from '../../protocol';
import { describeResponseError } from './Toast';

type Options = Pick<protocol.Annotation.Draft.Request, 'kind' | 'place' | 'note'>;

export type DraftControls = {
  elem: HTMLFieldSetElement;
  start: HTMLButtonElement;
  options: () => Options | null;
};

export function makeDraftControls(generate: () => void): DraftControls {
  const elem = document.createElement('fieldset');
  elem.classList.add('annotation-generation');
  const legend = document.createElement('legend');
  legend.textContent = 'Ollama で下書き';
  elem.appendChild(legend);

  const addField = (label: string, control: HTMLElement) => {
    const row = document.createElement('label');
    row.classList.add('annotation-field');
    const name = document.createElement('span');
    name.classList.add('annotation-label');
    name.textContent = label;
    row.append(name, control);
    elem.appendChild(row);
  };
  const kind = document.createElement('select');
  kind.append(new Option('選択してください', ''), new Option('手描き', 'drawing'), new Option('カメラ撮影', 'camera'));
  addField('制作方法', kind);
  const place = document.createElement('input');
  place.type = 'text';
  place.maxLength = 500;
  place.disabled = true;
  kind.addEventListener('change', () => { place.disabled = kind.value !== 'camera'; });
  addField('撮影場所（任意）', place);
  const note = document.createElement('textarea');
  note.rows = 2;
  note.maxLength = 1000;
  addField('作者の補足（任意）', note);

  const start = document.createElement('button');
  start.type = 'button';
  start.classList.add('annotation-generate');
  start.textContent = '下書きを生成';
  start.addEventListener('click', generate);
  elem.appendChild(start);
  const options = (): Options | null => {
    if (kind.value !== 'drawing' && kind.value !== 'camera') {
      return null;
    }
    const location = kind.value === 'camera' ? place.value.trim() : '';
    return { kind: kind.value, place: location || undefined, note: note.value.trim() || undefined };
  };
  return { elem, start, options };
}

const kPollIntervalMs = 1000;
const kRequestTimeoutMs = 15000;

async function requestJSON<T>(path: string, init: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), kRequestTimeoutMs);
  try {
    const r = await fetch(path, { ...init, signal: controller.signal });
    if (!r.ok) {
      throw new Error(await describeResponseError(r));
    }
    return await r.json() as T;
  } finally {
    window.clearTimeout(timer);
  }
}

export async function generateAnnotationDraft(req: protocol.Annotation.Draft.Request): Promise<protocol.Annotation.Draft.Values> {
  const { jobID } = await requestJSON<protocol.Annotation.Draft.StartResponse>('/annotation-draft', {
    method: 'POST',
    body: JSON.stringify(req),
    headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
  });
  const path = `/annotation-draft/${encodeURIComponent(jobID)}`;
  while (true) {
    await new Promise<void>(resolve => window.setTimeout(resolve, kPollIntervalMs));
    const result = await requestJSON<protocol.Annotation.Draft.StatusResponse>(path, {
      cache: 'no-store',
      headers: { 'Accept': 'application/json' },
    });
    if (result.status === 'complete') {
      return result.draft;
    }
    if (result.status === 'failed') {
      throw new Error(result.message);
    }
    if (result.status !== 'pending') {
      throw new Error('下書き生成の状態を取得できませんでした');
    }
  }
}
